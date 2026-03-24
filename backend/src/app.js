// src/app.js
import express from 'express';
import loggerMiddleware from './middleware/logger.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import videoRoutes from './routes/video.routes.js';      // ← YOUR ROUTES
import adminRoutes from './routes/admin.routes.js';      // ← YOUR ROUTES

const app = express();

// Middleware
app.use(express.json());
app.use(loggerMiddleware);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'ClipSphere API is running',
    version: '1.0.0'
  });
});

// === API v1 ROUTES ===
// Auth & User routes (Member 1 & 2)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// === YOUR ROUTES (Member 3) ===
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error handler (must be LAST)
app.use(errorMiddleware);

export default app;