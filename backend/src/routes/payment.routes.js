import express from 'express';
import { createCheckout, stripeWebhook, getBalance, getHistory, getEarnings } from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/webhook', stripeWebhook); // raw body — registered separately
router.use(protect);
router.post('/checkout', createCheckout);
router.get('/balance', getBalance);
router.get('/history', getHistory);
router.get('/earnings', getEarnings);

export default router;