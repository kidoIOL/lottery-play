/**
 * LKO Thrift Ticket Giveaway – Backend
 * Paystack Payment Integration + hidden lottery logic
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
  PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY,
  PAYSTACK_ENV = 'test',
  PORT = 3000,
  TICKET_AMOUNT = 3000 // 30 KSh in kobo
} = process.env;

// Check for missing config
const missingConfig = [
  ['PAYSTACK_SECRET_KEY', PAYSTACK_SECRET_KEY],
  ['PAYSTACK_PUBLIC_KEY', PAYSTACK_PUBLIC_KEY]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingConfig.length) {
  console.warn(
    `⚠️  Missing Paystack config in .env: ${missingConfig.join(', ')}. Payments will not work until these are set.`
  );
}

// Paystack API URL
const PAYSTACK_API_URL = 'https://api.paystack.co';

// Hidden win configuration
const WIN_THRESHOLD = 1000; // only after this many successful payments can someone win
const WIN_CHANCE = 0.08;    // 8% chance after threshold (0.08 = 8%)

// ---------- Simple file-based storage ----------
const DATA_DIR = path.join(__dirname, 'data');
const COUNTER_FILE = path.join(DATA_DIR, 'ticket-counter.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

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

// In-memory + file map of transactions
// { reference: { status: 'pending' | 'success' | 'failed', won: boolean, email, product, amount, ticketNumber, message } }
let transactions = readJSON(TRANSACTIONS_FILE, {});

function saveTransactions() {
  writeJSON(TRANSACTIONS_FILE, transactions);
}

// ---------- Helpers ----------
function decideWin(ticketNumber) {
  // Hidden rule: only from 1000th successful payment onward
  if (ticketNumber < WIN_THRESHOLD) return false;
  // Random chance: 8% (0.08)
  return Math.random() < WIN_CHANCE;
}

// Generate a unique reference
function generateReference() {
  return 'LKO-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

async function verifyTransaction(reference) {
  const transaction = transactions[reference];
  if (!transaction) return null;
  if (transaction.status !== 'pending') return transaction;

  const response = await fetch(`${PAYSTACK_API_URL}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
  });
  const data = await response.json();

  if (!data.status) throw new Error(data.message || 'Failed to verify payment');

  const paymentData = data.data;
  if (paymentData.status === 'success') {
    const ticketNumber = incrementTicketCount();
    const won = decideWin(ticketNumber);
    transaction.status = 'success';
    transaction.won = won;
    transaction.ticketNumber = ticketNumber;
    transaction.paystackData = paymentData;
    transaction.message = won
      ? `🎉 Congratulations! You won the ${transaction.productName}! We will contact you shortly.`
      : `✅ Payment received. Ticket #${ticketNumber}. You did not win this time. Try again for another chance!`;
    transaction.verifiedAt = new Date().toISOString();
  } else if (['failed', 'abandoned'].includes(paymentData.status)) {
    transaction.status = 'failed';
    transaction.message = paymentData.gateway_response || 'Payment was not successful';
    transaction.paystackData = paymentData;
  }

  saveTransactions();
  return transaction;
}

// ---------- Routes ----------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    service: 'LKO Thrift Ticket Backend',
    status: 'running',
    paystack_mode: PAYSTACK_ENV,
    paystack_configured: !!PAYSTACK_SECRET_KEY
  });
});

/**
 * POST /api/initialize-payment
 * Body: { email, productName, productId }
 * Initializes Paystack payment
 */
app.post('/api/initialize-payment', async (req, res) => {
  try {
    const { email, productName = 'LKO Thrift Ticket', productId = 'ticket' } = req.body;

    if (missingConfig.length) {
      return res.status(500).json({
        success: false,
        message: `Missing Paystack config: ${missingConfig.join(', ')}. Copy .env.example to .env and fill in real values.`
      });
    }

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const amount = Number(TICKET_AMOUNT);
    const reference = generateReference();

    // Prepare Paystack request
    const payload = {
      email: email,
      amount: amount,
      reference: reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/payment-callback.html`,
      metadata: {
        productId: productId,
        productName: productName,
        custom_fields: [
          {
            display_name: "Ticket Type",
            variable_name: "ticket_type",
            value: productName
          },
          {
            display_name: "Reference",
            variable_name: "reference",
            value: reference
          }
        ]
      }
    };

    // Initialize payment with Paystack
    const response = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack initialization failed:', data);
      return res.status(400).json({
        success: false,
        message: data.message || 'Failed to initialize payment',
        details: data
      });
    }

    // Store transaction
    transactions[reference] = {
      status: 'pending',
      email: email,
      productId: productId || null,
      productName: productName,
      amount: amount / 100, // Convert back to KSh for display
      amountInKobo: amount,
      createdAt: new Date().toISOString(),
      won: false,
      ticketNumber: null,
      message: null,
      paystackData: data.data
    };
    saveTransactions();

    console.log(`💰 Payment initialized → ${email} | Reference: ${reference}`);
    console.log(`   Authorization URL: ${data.data.authorization_url}`);

    res.json({
      success: true,
      message: 'Payment initialized successfully',
      reference: reference,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code
    });

  } catch (err) {
    console.error('Payment initialization error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while initializing payment. Please try again.'
    });
  }
});

/**
 * Compatibility endpoint for the existing frontend payment form.
 * Paystack checkout is used here; the browser opens the returned URL.
 */
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, email, productName = 'LKO Thrift Ticket', productId = 'ticket' } = req.body;
    const normalizedPhone = String(phone || '').replace(/\D/g, '');

    if (!/^[17]\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Valid Kenyan phone number is required' });
    }
    const normalizedEmail = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }
    if (missingConfig.length) {
      return res.status(500).json({ success: false, message: `Missing Paystack config: ${missingConfig.join(', ')}` });
    }

    const initialization = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        amount: Number(TICKET_AMOUNT),
        reference: generateReference(),
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/payment-callback.html`,
        metadata: { productId, productName, phone: `+254${normalizedPhone}` }
      })
    });
    const data = await initialization.json();

    if (!data.status) {
      return res.status(400).json({ success: false, message: data.message || 'Failed to initialize payment' });
    }

    const reference = data.data.reference;
    transactions[reference] = {
      status: 'pending',
      email: normalizedEmail,
      phone: `+254${normalizedPhone}`,
      productId,
      productName,
      amount: Number(TICKET_AMOUNT) / 100,
      amountInKobo: Number(TICKET_AMOUNT),
      createdAt: new Date().toISOString(),
      won: false,
      ticketNumber: null,
      message: null,
      paystackData: data.data
    };
    saveTransactions();

    res.json({
      success: true,
      checkoutRequestID: reference,
      reference,
      authorization_url: data.data.authorization_url
    });
  } catch (err) {
    console.error('Payment initialization error:', err);
    res.status(500).json({ success: false, message: 'Server error while initializing payment. Please try again.' });
  }
});

/**
 * GET /api/verify-payment/:reference
 * Verifies payment with Paystack and processes ticket
 */
app.get('/api/verify-payment/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Check if transaction exists
    const transaction = transactions[reference];
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    // If already processed, return stored result
    if (transaction.status === 'success' || transaction.status === 'failed') {
      return res.json({
        success: true,
        status: transaction.status,
        won: transaction.won,
        ticketNumber: transaction.ticketNumber,
        message: transaction.message,
        email: transaction.email,
        productName: transaction.productName
      });
    }

    // Verify with Paystack
    const response = await fetch(`${PAYSTACK_API_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack verification failed:', data);
      return res.status(400).json({
        success: false,
        message: data.message || 'Failed to verify payment'
      });
    }

    const paymentData = data.data;
    const isSuccessful = paymentData.status === 'success';

    if (isSuccessful) {
      // Payment successful - process ticket
      const ticketNumber = incrementTicketCount();
      const won = decideWin(ticketNumber);

      // Update transaction
      transaction.status = 'success';
      transaction.won = won;
      transaction.ticketNumber = ticketNumber;
      transaction.paystackData = paymentData;
      transaction.message = won
        ? `🎉 Congratulations! You won the ${transaction.productName}! We will contact you shortly.`
        : `✅ Payment received. Ticket #${ticketNumber}. You did not win this time. Try again for another chance!`;
      transaction.verifiedAt = new Date().toISOString();

      console.log(
        `✅ Payment success | Ticket #${ticketNumber} | Won: ${won} | Email: ${transaction.email}`
      );

      if (won) {
        console.log(`🏆 WINNER! Ticket #${ticketNumber} - ${transaction.email}`);
      }
    } else {
      // Payment failed
      transaction.status = 'failed';
      transaction.message = paymentData.gateway_response || 'Payment was not successful';
      transaction.paystackData = paymentData;
      
      console.log(`❌ Payment failed: ${paymentData.gateway_response}`);
    }

    saveTransactions();

    res.json({
      success: true,
      status: transaction.status,
      won: transaction.won,
      ticketNumber: transaction.ticketNumber,
      message: transaction.message,
      email: transaction.email,
      productName: transaction.productName
    });

  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying payment. Please try again.'
    });
  }
});

/**
 * GET /api/status/:reference
 * Frontend polls this after payment is initialized
 */
app.get('/api/status/:reference', async (req, res) => {
  const reference = req.params.reference;
  let transaction = transactions[reference];

  if (!transaction) {
    return res.status(404).json({ 
      success: false, 
      message: 'Transaction not found' 
    });
  }

  try {
    transaction = await verifyTransaction(reference);
  } catch (err) {
    console.error('Payment status verification error:', err);
    return res.status(502).json({
      success: false,
      status: transaction.status,
      message: 'Unable to verify payment right now. Please try again.'
    });
  }

  // Return status (never reveal threshold info)
  res.json({
    success: true,
    status: transaction.status,     // pending | success | failed
    won: transaction.won || false,  // true only if they actually won
    ticketNumber: transaction.ticketNumber || null,
    email: transaction.email,
    productName: transaction.productName,
    amount: transaction.amount,
    message: transaction.message,
    createdAt: transaction.createdAt
  });
});

/**
 * POST /api/webhook
 * Paystack webhook for server-side verification (optional but recommended)
 */
app.post('/api/webhook', (req, res) => {
  // Always respond quickly
  res.sendStatus(200);

  try {
    // Verify webhook signature (optional but recommended for production)
    const signature = req.headers['x-paystack-signature'];
    // In production, verify the signature here
    
    const event = req.body;
    
    // Handle charge.success event
    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;
      
      console.log(`💰 Webhook: Payment successful for ${reference}`);
      
      // Check if transaction exists and is still pending
      const transaction = transactions[reference];
      if (transaction && transaction.status === 'pending') {
        // Process the payment (similar to verify-payment logic)
        const ticketNumber = incrementTicketCount();
        const won = decideWin(ticketNumber);
        
        transaction.status = 'success';
        transaction.won = won;
        transaction.ticketNumber = ticketNumber;
        transaction.paystackData = data;
        transaction.message = won
          ? `🎉 Congratulations! You won the ${transaction.productName}! We will contact you shortly.`
          : `✅ Payment received. Ticket #${ticketNumber}. You did not win this time.`;
        
        console.log(`💰 Webhook processed | Ticket #${ticketNumber} | Won: ${won}`);
        saveTransactions();
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

/**
 * GET /api/public-key
 * Returns the Paystack public key for frontend
 */
app.get('/api/public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: PAYSTACK_PUBLIC_KEY || 'pk_test_c656a72e19b8f0e62df2fa9e1e599be64d94f096',
    paystack_mode: PAYSTACK_ENV || 'test'
  });
});

/**
 * GET /api/admin/stats
 * Admin endpoint to see counter (protected with secret key)
 */
app.get('/api/admin/stats', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  
  // Check admin key
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized - Invalid admin key' 
    });
  }

  // Get statistics
  const totalTickets = getTicketCount();
  const totalTransactions = Object.keys(transactions).length;
  const successfulTransactions = Object.values(transactions).filter(t => t.status === 'success').length;
  const winners = Object.values(transactions).filter(t => t.won === true).length;
  const pendingTransactions = Object.values(transactions).filter(t => t.status === 'pending').length;

  res.json({
    success: true,
    data: {
      totalSuccessfulTickets: totalTickets,
      winThreshold: WIN_THRESHOLD,
      winChance: `${WIN_CHANCE * 100}%`,
      totalTransactions: totalTransactions,
      successfulTransactions: successfulTransactions,
      winners: winners,
      pendingTransactions: pendingTransactions,
      paystackMode: PAYSTACK_ENV || 'test',
      note: 'Wins only possible after the threshold. This endpoint is for admin use only.'
    }
  });
});

/**
 * GET /api/admin/transactions
 * List all transactions (protected)
 */
app.get('/api/admin/transactions', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized - Invalid admin key' 
    });
  }

  // Return transactions (hide sensitive data)
  const transactionList = Object.entries(transactions).map(([ref, data]) => ({
    reference: ref,
    email: data.email,
    productName: data.productName,
    amount: data.amount,
    status: data.status,
    won: data.won,
    ticketNumber: data.ticketNumber,
    createdAt: data.createdAt,
    message: data.message
  }));

  res.json({
    success: true,
    data: transactionList
  });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`\n🎟️  LKO Thrift Ticket Backend running on http://localhost:${PORT}`);
  console.log(`   💳 Paystack Mode: ${PAYSTACK_ENV || 'test'}`);
  console.log(`   🔑 Paystack Public Key: ${PAYSTACK_PUBLIC_KEY?.substring(0, 30) || 'Not set'}...`);
  console.log(`   💰 Ticket price: ${(Number(TICKET_AMOUNT) / 100).toFixed(2)} KSh`);
  console.log(`   🎯 Win threshold: ticket #${WIN_THRESHOLD}+`);
  console.log(`   🎲 Win chance: ${WIN_CHANCE * 100}% after threshold\n`);
  console.log(`   📊 Admin stats: http://localhost:${PORT}/api/admin/stats`);
  console.log(`   🔒 Use header: x-admin-key: ${process.env.ADMIN_SECRET_KEY || 'your_secret_key'}\n`);
});