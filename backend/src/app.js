import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import loggerMiddleware from './middleware/logger.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';
import env from './config/env.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import videoRoutes from './routes/video.routes.js';
import adminRoutes from './routes/admin.routes.js';
import likeRoutes from './routes/like.routes.js';
import reviewRoutes from './routes/review.routes.js';
import paymentRoutes from './routes/payment.routes.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

/* ================= SECURITY HEADERS ================= */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

/* ================= RATE LIMITERS ================= */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ================= CORS CONFIG ================= */
const allowedOrigins = new Set(
  [
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://frontend:3000',
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

/* ================= APPLY RATE LIMITERS ================= */
app.use(globalLimiter);
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/videos/upload', uploadLimiter);

/* ================= RAW BODY FOR STRIPE WEBHOOK ================= */
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  next();
});

/* ================= CORE MIDDLEWARE ================= */
app.use(express.json());
app.use(cookieParser());
app.use(loggerMiddleware);

/* ================= HEALTH ROUTES ================= */
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'ClipSphere API is running',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

/* ================= API ROUTES ================= */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/videos', likeRoutes);
app.use('/api/v1/videos', reviewRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentRoutes);

/* ================= ERROR HANDLER ================= */
app.use(errorMiddleware);

export default app;