import { createTipCheckout, handleWebhook } from '../services/stripe.service.js';
import Transaction from '../models/transaction.model.js';
import User from '../models/user.model.js';

export const createCheckout = async (req, res, next) => {
  try {
    const { recipientId, videoId, amountCents } = req.body;
    if (!recipientId || !videoId || !amountCents || amountCents < 100) {
      return res.status(400).json({ message: 'Invalid tip parameters (min $1.00)' });
    }
    const result = await createTipCheckout(req.user.id, recipientId, videoId, amountCents);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

export const stripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await handleWebhook(req.rawBody, sig);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('balance');
    res.json({ status: 'success', data: { balance: user.balance, balanceUSD: (user.balance / 100).toFixed(2) } });
  } catch (err) { next(err); }
};

export const getHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    const transactions = await Transaction.find({
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    })
      .populate('sender', 'username')
      .populate('recipient', 'username')
      .populate('videoId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit);
    const total = await Transaction.countDocuments({
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    });
    res.json({ status: 'success', data: { transactions, total } });
  } catch (err) { next(err); }
};