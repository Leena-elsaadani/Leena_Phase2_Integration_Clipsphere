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

const app = express();

// CORS: allow the running frontend origin (dev ports may shift, e.g. 3001 if 3000 is taken)
const allowedOrigins = new Set(
  [
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    // When both run in Docker, server-side requests may originate from the service hostnames
    'http://frontend:3000',
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser requests (no Origin header) like curl/Postman/health checks
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(loggerMiddleware);

app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'ClipSphere API is running', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/videos', likeRoutes);           // /:videoId/likes and /:videoId/comments
app.use('/api/v1/videos', reviewRoutes);          // /:videoId/reviews
app.use('/api/v1/admin', adminRoutes);

app.use(errorMiddleware);

export default app;