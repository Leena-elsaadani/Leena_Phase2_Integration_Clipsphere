<<<<<<< Updated upstream
// src/app.js
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import loggerMiddleware from './middleware/logger.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';
=======
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import loggerMiddleware from './middleware/logger.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';
//import swaggerUi from 'swagger-ui-express';
//import swaggerSpec from './docs/swagger.js';
import env from './config/env.js';
>>>>>>> Stashed changes

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
<<<<<<< Updated upstream
import videoRoutes from './routes/video.routes.js';      
import adminRoutes from './routes/admin.routes.js';

const app = express();

// Middleware
app.use(express.json());
app.use(mongoSanitize());
app.use(loggerMiddleware);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'ClipSphere API is running',
    version: '1.0.0'
  });
=======
//import videoRoutes from './routes/video.routes.js';
//import adminRoutes from './routes/admin.routes.js';

const app = express();

// CORS — allow requests from the Next.js frontend
// credentials: true is required to send/receive cookies cross-origin
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Parse cookies (needed for JWT in HTTP-only cookies)
app.use(cookieParser());

// Sanitize MongoDB queries
app.use(mongoSanitize());

// Simple request logger
app.use(loggerMiddleware);

// Swagger Documentation
//app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'ClipSphere API is running', version: '1.0.0' });
>>>>>>> Stashed changes
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

<<<<<<< Updated upstream
// === API v1 ROUTES ===
// Auth & User routes (Member 1 & 2)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// === YOUR ROUTES (Member 3) ===
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/admin', adminRoutes);
=======
// === API v1 ROUTES === (same as Phase 1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
//app.use('/api/v1/videos', videoRoutes);
//app.use('/api/v1/admin', adminRoutes);
>>>>>>> Stashed changes

// Error handler (must be LAST)
app.use(errorMiddleware);

export default app;
