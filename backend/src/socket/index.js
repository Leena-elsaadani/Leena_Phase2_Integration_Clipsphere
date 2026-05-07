import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, 'http://localhost:3000'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    // Try to extract token from multiple sources
    let token = socket.handshake.auth?.token;
    
    // If not in auth, try extracting from cookie header
    if (!token && socket.handshake.headers?.cookie) {
      const cookies = socket.handshake.headers.cookie
        .split(';')
        .map((c) => c.trim());
      const tokenCookie = cookies.find((c) => c.startsWith('token='));
      if (tokenCookie) {
        token = tokenCookie.substring(6); // Remove 'token=' prefix
      }
    }

    if (!token) {
      return next(new Error('Authentication required: no token found'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error(`Invalid token: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User ${socket.userId} connected`);
    socket.join(socket.userId);

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${socket.userId} disconnected`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}