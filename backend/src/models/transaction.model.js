import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  amount: { type: Number, required: true }, // in cents
  currency: { type: String, default: 'usd' },
  stripeSessionId: { type: String, unique: true, sparse: true },
  stripePaymentIntentId: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
}, { timestamps: true });

transactionSchema.index({ recipient: 1, createdAt: -1 });
transactionSchema.index({ sender: 1, createdAt: -1 });

export default mongoose.model('Transaction', transactionSchema);