/**
 * LKO Thrift Ticket Giveaway – Backend
 * M-Pesa STK Push (Daraja API) + hidden lottery logic
 *
 * Wins only possible from the 1000th successful purchase onward.
 * The counter and win chance are NEVER exposed to the customer.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ---------- Config ----------
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BUSINESS_SHORTCODE,
  PASSKEY,
  MPESA_ENV = 'sandbox',
  CALLBACK_URL,
  PORT = 3000,
  TICKET_AMOUNT = 30
} = process.env;

const missingConfig = [
  ['CONSUMER_KEY', CONSUMER_KEY],
  ['CONSUMER_SECRET', CONSUMER_SECRET],
  ['BUSINESS_SHORTCODE', BUSINESS_SHORTCODE],
  ['PASSKEY', PASSKEY],
  ['CALLBACK_URL', CALLBACK_URL]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingConfig.length) {
  console.warn(
    `⚠️  Missing Daraja config in .env: ${missingConfig.join(', ')}. STK Push will not work until these are set.`
  );
}

const BASE_URL =
  MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const WIN_THRESHOLD = 50000; // only after this many successful payments can someone win
const WIN_CHANCE = 0.0000008;    // 0.08% chance after threshold

// ---------- Simple file-based storage ----------
const DATA_DIR = path.join(__dirname, 'data');
const COUNTER_FILE = path.join(DATA_DIR, 'ticket-counter.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return fallback;
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getTicketCount() {
  const data = readJSON(COUNTER_FILE, { count: 0 });
  return data.count || 0;
}

function incrementTicketCount() {
  const data = readJSON(COUNTER_FILE, { count: 0 });
  data.count = (data.count || 0) + 1;
  writeJSON(COUNTER_FILE, data);
  return data.count;
}

// In-memory + file map of CheckoutRequestID → status
// { status: 'pending' | 'success' | 'failed', won: boolean, product, phone, receipt, message }
let pending = readJSON(PENDING_FILE, {});

function savePending() {
  writeJSON(PENDING_FILE, pending);
}

// ---------- Helpers ----------
function formatPhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  if (!p.startsWith('254')) p = '254' + p;
  return p;
}

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function generatePassword(timestamp) {
  return Buffer.from(`${BUSINESS_SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
}

// ---------- Secure Access Token (cached) ----------
// Token is valid for ~3600 seconds. We cache it in memory and
// refresh a bit early to avoid race conditions near expiry.
let tokenCache = {
  accessToken: null,
  expiresAt: 0          // Unix timestamp in ms
};

/**
 * Securely generate (or reuse) a Daraja OAuth access token.
 * - Consumer Key & Secret never leave the server
 * - Token is cached in memory only (never written to disk)
 * - Automatically refreshes before expiry
 */
async function getAccessToken() {
  const now = Date.now();

  // Reuse cached token if still valid (with 60-second safety buffer)
  if (tokenCache.accessToken && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  // Validate credentials exist
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('CONSUMER_KEY and CONSUMER_SECRET must be set in .env');
  }

  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  const res = await fetch(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error('No access_token in response: ' + JSON.stringify(data));
  }

  // Cache the token (expires_in is usually 3599 seconds)
  const expiresInMs = (data.expires_in || 3599) * 1000;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs
  };

  console.log(`🔐 New access token generated (valid ~${Math.round(expiresInMs / 1000)}s)`);
  return tokenCache.accessToken;
}

function decideWin(ticketNumber) {
  // Hidden rule: only from 1000th successful payment onward
  if (ticketNumber < WIN_THRESHOLD) return false;
  return Math.random() < WIN_CHANCE;
}

// ---------- Routes ----------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    service: 'LKO Thrift Ticket Backend',
    status: 'running',
    env: MPESA_ENV
  });
});

/**
 * POST /api/stkpush
 * Body: { phone, productId, productName }
 * Initiates STK Push for 30 KSh
 */
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, productId, productName } = req.body;

    if (missingConfig.length) {
      return res.status(500).json({
        success: false,
        message: `Missing Daraja config: ${missingConfig.join(', ')}. Copy env.example to .env and fill in real values.`
      });
    }

    if (!phone || !productName) {
      return res.status(400).json({ success: false, message: 'Phone and product are required' });
    }

    const formattedPhone = formatPhone(phone);
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Kenyan phone number. Use format 07XXXXXXXX or 01XXXXXXXX'
      });
    }

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    const payload = {
      BusinessShortCode: BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(TICKET_AMOUNT),
      PartyA: formattedPhone,
      PartyB: BUSINESS_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: `LKO-${productId || 'ticket'}`,
      TransactionDesc: `LKO Ticket - ${productName}`.slice(0, 13) // max 13 chars recommended
    };

    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== '0') {
      console.error('STK Push failed:', stkData);
      return res.status(400).json({
        success: false,
        message: stkData.CustomerMessage || stkData.errorMessage || 'Failed to send payment prompt',
        details: stkData
      });
    }

    // Store pending transaction
    const checkoutId = stkData.CheckoutRequestID;
    pending[checkoutId] = {
      status: 'pending',
      phone: formattedPhone,
      productId: productId || null,
      productName,
      amount: Number(TICKET_AMOUNT),
      createdAt: new Date().toISOString(),
      won: false,
      receipt: null,
      message: null
    };
    savePending();

    console.log(`STK Push sent → ${formattedPhone} | CheckoutRequestID: ${checkoutId}`);

    res.json({
      success: true,
      message: 'Payment prompt sent to your phone. Enter your M-Pesa PIN.',
      checkoutRequestID: checkoutId,
      merchantRequestID: stkData.MerchantRequestID
    });
  } catch (err) {
    console.error('STK Push error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while initiating payment. Please try again.'
    });
  }
});

/**
 * GET /api/status/:checkoutRequestID
 * Frontend polls this after STK Push is accepted
 */
app.get('/api/status/:checkoutRequestID', (req, res) => {
  const id = req.params.checkoutRequestID;
  const record = pending[id];

  if (!record) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  res.json({
    success: true,
    status: record.status,          // pending | success | failed
    won: record.won,                // true only if they actually won
    productName: record.productName,
    receipt: record.receipt,
    message: record.message,
    phone: record.phone
  });
});

/**
 * POST /api/mpesa/callback
 * Safaricom calls this after the customer enters PIN (or cancels / times out)
 */
app.post('/api/mpesa/callback', (req, res) => {
  // Always respond quickly so Safaricom does not retry
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      console.warn('Invalid callback body:', JSON.stringify(req.body));
      return;
    }

    const {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = callback;

    console.log(`Callback received → ${CheckoutRequestID} | ResultCode: ${ResultCode}`);

    const record = pending[CheckoutRequestID];
    if (!record) {
      console.warn('Unknown CheckoutRequestID:', CheckoutRequestID);
      return;
    }

    if (ResultCode === 0) {
      // Payment successful
      const items = CallbackMetadata?.Item || [];
      const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || null;
      const amount = items.find((i) => i.Name === 'Amount')?.Value;

      // Increment the hidden global ticket counter
      const ticketNumber = incrementTicketCount();
      const won = decideWin(ticketNumber);

      record.status = 'success';
      record.receipt = receipt;
      record.won = won;
      record.ticketNumber = ticketNumber; // internal only
      record.message = won
        ? `Congratulations! You won the ${record.productName}. We will contact you shortly.`
        : `Payment received. You did not win this time. Try again for another chance!`;

      console.log(
        `✅ Payment success | Ticket #${ticketNumber} | Won: ${won} | Receipt: ${receipt}`
      );
    } else {
      // Failed / cancelled / timeout
      record.status = 'failed';
      record.won = false;
      record.message = ResultDesc || 'Payment was not completed.';
      console.log(`❌ Payment failed: ${ResultDesc}`);
    }

    savePending();
  } catch (err) {
    console.error('Callback processing error:', err);
  }
});

// Optional: simple admin endpoint to see counter (protect this in production!)
app.get('/api/admin/stats', (req, res) => {
  // In real production put a secret key check here
  res.json({
    totalSuccessfulTickets: getTicketCount(),
    winThreshold: WIN_THRESHOLD,
    note: 'Wins only possible after the threshold. This endpoint is for you only.'
  });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`\n🎟️  LKO Thrift Ticket Backend running on http://localhost:${PORT}`);
  console.log(`   Environment : ${MPESA_ENV}`);
  console.log(`   Callback URL: ${CALLBACK_URL}`);
  console.log(`   Ticket price: ${TICKET_AMOUNT} KSh`);
  console.log(`   Win threshold: ticket #${WIN_THRESHOLD}+\n`);
});
