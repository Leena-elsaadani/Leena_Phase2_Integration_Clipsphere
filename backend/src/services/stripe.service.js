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

  // Create transaction first to get ID for linking
  const transaction = await Transaction.create({
    sender: senderId,
    recipient: recipientId,
    videoId,
    amount: amountCents,
    status: 'pending',
  });

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
    client_reference_id: transaction._id.toString(),
    metadata: { senderId, recipientId, videoId, amountCents },
  });

  // Update transaction with Stripe session ID
  await Transaction.findByIdAndUpdate(transaction._id, {
    stripeSessionId: session.id,
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
    // Use client_reference_id to find the transaction
    const transactionId = session.client_reference_id;
    if (transactionId) {
      await Transaction.findByIdAndUpdate(
        transactionId,
        {
          status: 'completed',
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        }
      );
      // Get transaction to increment user balance
      const transaction = await Transaction.findById(transactionId);
      if (transaction) {
        await User.findByIdAndUpdate(transaction.recipient, {
          $inc: { balance: transaction.amount }
        });
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    // Try to find transaction by payment intent ID first
    let updated = await Transaction.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { status: 'failed' }
    );
    // If not found, look for pending transactions and update the most recent one
    // This handles race conditions where payment_intent event fires before session.completed
    if (!updated) {
      updated = await Transaction.findOneAndUpdate(
        {
          status: 'pending',
          createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // 30 min window
        },
        { status: 'failed' },
        { sort: { createdAt: -1 } }
      );
    }
  }

  return { received: true };
}