import Stripe from 'stripe';
import env from '../config/env.js';
import Transaction from '../models/transaction.model.js';
import User from '../models/user.model.js';

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

if (!env.STRIPE_SECRET_KEY) {
  console.warn(
    '[Stripe] STRIPE_SECRET_KEY is not configured. Tip checkout and webhook handling will fail until it is provided.'
  );
}

function ensureStripeConfigured() {
  if (!stripe) {
    throw new Error('Stripe is not configured: missing STRIPE_SECRET_KEY');
  }
}

export async function createTipCheckout(senderId, recipientId, videoId, amountCents) {
  ensureStripeConfigured();
  const recipient = await User.findById(recipientId).select('username');
  if (!recipient) throw new Error('Creator not found');

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Tip for @${recipient.username}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${env.FRONTEND_URL}/watch/${videoId}?tip=success`,
    cancel_url: `${env.FRONTEND_URL}/watch/${videoId}?tip=cancelled`,
    metadata: { senderId, recipientId, videoId, amountCents },
  });

  await Transaction.create({
    sender: senderId,
    recipient: recipientId,
    videoId,
    amount: amountCents,
    stripeSessionId: session.id,
    status: 'pending',
  });

  return { url: session.url, sessionId: session.id };
}

export async function handleWebhook(rawBody, signature) {
  ensureStripeConfigured();
  const event = stripe.webhooks.constructEvent(
    rawBody, signature, env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await Transaction.findOneAndUpdate(
      { stripeSessionId: session.id },
      { status: 'completed', stripePaymentIntentId: session.payment_intent }
    );
    const { recipientId, amountCents } = session.metadata;
    await User.findByIdAndUpdate(recipientId, {
      $inc: { balance: parseInt(amountCents) }
    });
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    await Transaction.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { status: 'failed' }
    );
  }

  return { received: true };
}