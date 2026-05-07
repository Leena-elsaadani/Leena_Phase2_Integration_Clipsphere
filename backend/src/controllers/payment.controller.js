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

export const getEarnings = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    
    // Get earnings summary
    const transactions = await Transaction.find({
      recipient: creatorId,
    }).populate('videoId', 'title');
    
    const completed = transactions.filter(t => t.status === 'completed');
    const pending = transactions.filter(t => t.status === 'pending');
    const failed = transactions.filter(t => t.status === 'failed');
    
    const completedAmount = completed.reduce((sum, t) => sum + t.amount, 0);
    const pendingAmount = pending.reduce((sum, t) => sum + t.amount, 0);
    const failedAmount = failed.reduce((sum, t) => sum + t.amount, 0);
    
    const balanceInCents = (await User.findById(creatorId).select('balance')).balance || 0;
    
    res.json({
      status: 'success',
      data: {
        totalEarned: completedAmount,
        totalEarnedUSD: (completedAmount / 100).toFixed(2),
        pendingEarnings: pendingAmount,
        pendingEarningsUSD: (pendingAmount / 100).toFixed(2),
        currentBalance: balanceInCents,
        currentBalanceUSD: (balanceInCents / 100).toFixed(2),
        transactionCount: transactions.length,
        completedCount: completed.length,
        pendingCount: pending.length,
        failedCount: failed.length,
        recentTransactions: completed.slice(0, 10).map(t => ({
          amount: t.amount,
          amountUSD: (t.amount / 100).toFixed(2),
          from: t.sender,
          videoTitle: t.videoId?.title || 'Unknown',
          date: t.createdAt,
          status: t.status,
        })),
      }
    });
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