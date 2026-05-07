# Stripe Webhook Setup & Testing

## Overview

Stripe webhooks notify the backend of payment events (completed, failed, etc.). This guide explains how to test webhooks locally.

## Prerequisites

- Stripe account with test keys
- [Stripe CLI](https://stripe.com/docs/stripe-cli) installed
- Backend running on `http://localhost:5000`

## Local Setup

### 1. Get Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Enable **Test Mode** (toggle in top-right)
3. Navigate to **Developers → API Keys**
4. Copy your test keys:
   - **Secret Key** (`sk_test_*`)
   - **Publishable Key** (`pk_test_*`)

### 2. Configure Environment

Add to `.env` or `docker-compose.yml`:

```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret
```

### 3. Start Stripe CLI Listener

```bash
stripe listen --forward-to localhost:5000/api/v1/payments/webhook
```

The CLI will output your **Webhook Signing Secret** (starts with `whsec_`). Update `STRIPE_WEBHOOK_SECRET` with this value.

## Testing Webhook Flow

### Option A: Using Stripe CLI (Recommended)

**Simulate a successful payment:**
```bash
stripe trigger checkout.session.completed
```

**Simulate a failed payment:**
```bash
stripe trigger payment_intent.payment_failed
```

### Option B: Real Test Payment

1. In frontend, click "Tip" button
2. Use Stripe test card: `4242 4242 4242 4242` (expires: any future date, CVC: any 3 digits)
3. Complete checkout
4. Check backend logs for webhook events

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Mark transaction as completed, increment creator balance |
| `payment_intent.payment_failed` | Mark transaction as failed, no balance change |

## Docker Testing

To test webhooks in Docker:

1. Start services:
   ```bash
   docker-compose up -d
   ```

2. From host machine, run Stripe CLI with Docker backend:
   ```bash
   stripe listen --forward-to http://host.docker.internal:5000/api/v1/payments/webhook
   ```
   (Replace `host.docker.internal` with your Docker host IP if needed)

3. Trigger test events as above

## Troubleshooting

**Webhook not hitting backend?**
- Verify backend is running on `:5000`
- Check Stripe CLI output for forward-to URL
- Ensure `STRIPE_WEBHOOK_SECRET` matches Stripe CLI output

**Transaction not updated in database?**
- Check backend logs for errors
- Verify `MONGO_URI` is correct
- Confirm Stripe keys are valid

**Payment button redirects to wrong URL?**
- Verify `FRONTEND_URL` env var is set correctly
- Check Stripe session `success_url` in backend logs

## For Production

1. Deploy to production domain
2. Update Stripe dashboard webhook endpoints to your production URL
3. Use production Stripe keys (NOT test keys)
4. Never commit real Stripe keys to git
