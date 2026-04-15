import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// import mongoSanitize from 'express-mongo-sanitize';  // not compatible with Express 5
import loggerMiddleware from './middleware/logger.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';
// import swaggerUi from 'swagger-ui-express';
// import swaggerSpec from './docs/swagger.js';
import env from './config/env.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import videoRoutes from './routes/video.routes.js';
// import adminRoutes from './routes/admin.routes.js';
import likeRoutes from './routes/like.routes.js';

const app = express();

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
// app.use(mongoSanitize());  // not compatible with Express 5
app.use(loggerMiddleware);

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'ClipSphere API is running', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/videos', videoRoutes);
// app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/likes', likeRoutes);


app.use(errorMiddleware);

export default app;