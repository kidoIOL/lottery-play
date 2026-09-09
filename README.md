# LKO Thrift Ticket – Backend (M-Pesa STK Push)

## What this does
- Receives phone number + selected product from the frontend
- Sends a real **M-Pesa STK Push** (Lipa Na M-Pesa Online) for **30 KSh**
- Listens for the Safaricom callback
- On successful payment:
  - Increments a **hidden** ticket counter
  - Only from the **1000th successful payment onward** can a customer win
  - ~8% win chance after the threshold
  - Tells the frontend whether the customer **won** or **did not win**

The counter and the 1000-ticket rule are **never** shown to the buyer.

---

## 1. Setup

```bash
cd backend
cp .env.example .env
```

Edit `.env` and put your real credentials:

```
CONSUMER_KEY=your_actual_consumer_key
CONSUMER_SECRET=your_actual_consumer_secret
BUSINESS_SHORTCODE=174379          # sandbox default, change for production
PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_ENV=sandbox                  # or production
CALLBACK_URL=https://xxxx.ngrok-free.app/api/mpesa/callback
PORT=3000
TICKET_AMOUNT=30
```

### Install & run

```bash
npm install
npm start
```

Server will start on `http://localhost:3000`

---

## 2. Callback URL (very important)

Safaricom must be able to reach your server.

**Local testing:**
1. Install ngrok → `ngrok http 3000`
2. Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
3. Put it in `.env`:
   ```
   CALLBACK_URL=https://abc123.ngrok-free.app/api/mpesa/callback
   ```
4. Restart the server

**Production:** Use your real domain with HTTPS.

---

## 3. Frontend connection

In `index.html`, set `PAYMENT_API_URL` to the public HTTPS URL where `server.js` is deployed:

```js
window.PAYMENT_API_URL = 'https://your-api-domain.com';
```

Firebase Hosting does not run `server.js`; the backend must be deployed separately (for example on Render, Railway, Cloud Run, or Firebase Functions). Configure `FRONTEND_URL` in the backend `.env` to the Firebase Hosting URL so Paystack can redirect back to `payment-callback.html`. The backend must also allow requests from the Firebase domain through CORS.

---

## 4. API Endpoints

| Method | Path                          | Description                          |
|--------|-------------------------------|--------------------------------------|
| POST   | `/api/stkpush`                | Start STK Push                       |
| GET    | `/api/status/:checkoutId`     | Poll payment + win result            |
| POST   | `/api/mpesa/callback`         | Safaricom callback (do not call)     |
| GET    | `/api/admin/stats`            | See total successful tickets (yours only) |

---

## 5. Sandbox test numbers

When using sandbox, use the test phone numbers provided by Safaricom in the Daraja portal (usually `254708374149` and others).

---

## 6. Going live (Production)

1. Create a **production** app on Daraja
2. Get new Consumer Key, Secret, Shortcode & Passkey
3. Set `MPESA_ENV=production`
4. Change `BASE_URL` automatically switches to `https://api.safaricom.co.ke`
5. Use a real HTTPS domain for `CALLBACK_URL`
6. Protect `/api/admin/stats` with a secret key

---

## Security notes
- Never put Consumer Key / Secret in the frontend
- The win logic lives only on the server
- Always wait for the **callback** before confirming a win (never trust the initial STK response alone)
