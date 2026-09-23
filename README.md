# LKO Thrift Ticket Backend

## What this does
- Initializes a Paystack hosted checkout for a selected product and a 30 KSh ticket.
- Redirects customers to Paystack and verifies the returned transaction reference.
- Increments a hidden ticket counter after successful payment.
- Applies the server-side win rules and returns the result to the callback page.

## Setup

Install dependencies and start the API:

```bash
npm install
npm start
```

Create a `.env` file with your Paystack credentials:

```env
PAYSTACK_SECRET_KEY=your_secret_key
PAYSTACK_PUBLIC_KEY=your_public_key
PAYSTACK_ENV=test
FRONTEND_URL=http://localhost:5500
PORT=3000
TICKET_AMOUNT=3000
```

The server runs at `http://localhost:3000` by default.

## Frontend connection

Set `PAYMENT_API_URL` in `index.html` and `payment-callback.html` to the public HTTPS URL where `server.js` is deployed:

```js
window.PAYMENT_API_URL = 'https://your-api-domain.com';
```

The frontend can be hosted separately. Configure `FRONTEND_URL` so Paystack redirects customers to `payment-callback.html`, and configure CORS for the frontend domain in production.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Check API and Paystack configuration |
| POST | `/api/initialize-payment` | Initialize a Paystack checkout |
| GET | `/api/verify-payment/:reference` | Verify a Paystack transaction and process the ticket |
| POST | `/api/webhook` | Receive Paystack payment events |
| GET | `/api/public-key` | Return the configured Paystack public key |

## Security notes
- Keep `PAYSTACK_SECRET_KEY` on the server only.
- Use HTTPS for deployed frontend and backend URLs.
- Payment success is determined by Paystack verification, not by the browser redirect alone.
- The win logic and ticket counter remain server-side.

## Deploying to Vercel

1. Import this repository into Vercel.
2. Add `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_ENV`, `FRONTEND_URL`, `TICKET_AMOUNT`, and `ADMIN_SECRET_KEY` as environment variables.
3. Deploy with the included `vercel.json`; the Paystack API is served from `/api`.
4. Set `PAYMENT_API_URL` in `index.html` and `payment-callback.html` to the deployed Vercel URL.
5. Configure the Paystack webhook URL as `https://your-project.vercel.app/api/webhook`.

The local JSON files are used for development. Vercel functions have ephemeral storage, so configure durable storage before relying on the ticket counter and transaction history in production.
