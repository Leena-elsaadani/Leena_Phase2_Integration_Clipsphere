// src/app.js
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import loggerMiddleware from './middleware/logger.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
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
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
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