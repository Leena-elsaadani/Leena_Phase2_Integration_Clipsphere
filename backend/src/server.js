import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Stripe and other services import env at module load time,
// so we must set process.env BEFORE any other imports
import { initSocket } from './socket/index.js';

// Dynamic imports after dotenv.config()
const app = (await import('./app.js')).default;
const connectDB = (await import('./config/db.js')).default;

const PORT = process.env.PORT || 5000;

// Connect to MongoDB before starting server
await connectDB();

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
initSocket(server);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(' Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default server;