/**
 * Redis Connection Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides Redis client initialization and graceful fallback if Redis is unavailable.
 * All cache operations fail safely and fall through to database.
 */

import { createClient } from 'redis';
import env from './env.js';

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection
 * Fails gracefully if Redis is unavailable — app continues without caching
 */
export async function initRedis() {
  try {
    redisClient = createClient({
      password: env.REDIS_PASSWORD || undefined,
      socket: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          // Retry up to 5 times with exponential backoff, then fail fast.
          if (retries > 5) {
            return new Error('Redis reconnect limit reached');
          }
          return Math.min(50 * retries, 5000);
        },
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('disconnect', () => {
      console.warn('[Redis] Disconnected');
      isRedisAvailable = false;
    });

    await redisClient.connect();
    isRedisAvailable = true;
    console.log(`[Redis] Initialized at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  } catch (err) {
    console.warn('[Redis] Failed to connect (cache disabled):', err.message);
    isRedisAvailable = false;
    redisClient = null;
  }
}

/**
 * Get Redis client instance
 * @returns {Object|null} Redis client or null if unavailable
 */
export function getRedisClient() {
  if (!isRedisAvailable || !redisClient) return null;
  return redisClient;
}

/**
 * Check if Redis is currently available
 * @returns {boolean}
 */
export function isRedisReady() {
  return isRedisAvailable && redisClient !== null;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis() {
  if (redisClient && isRedisAvailable) {
    try {
      await redisClient.quit();
      console.log('[Redis] Connection closed');
      isRedisAvailable = false;
      redisClient = null;
    } catch (err) {
      console.error('[Redis] Error closing connection:', err.message);
    }
  }
}
