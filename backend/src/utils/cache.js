/**
 * Cache Utility Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides helper functions for cache operations with graceful fallback.
 * If Redis is down, all operations fail silently and return null/false.
 */

import { getRedisClient, isRedisReady } from '../config/redis.js';
import env from '../config/env.js';

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} Cached value or null if miss/Redis unavailable
 */
export async function getCacheValue(key) {
  if (!isRedisReady()) {
    return null;
  }

  try {
    const client = getRedisClient();
    if (!client) return null;

    const value = await client.get(key);
    if (value) {
      console.log(`[Cache] HIT: ${key}`);
      return value;
    }
    console.log(`[Cache] MISS: ${key}`);
    return null;
  } catch (err) {
    console.error(`[Cache] Error reading key "${key}":`, err.message);
    return null;
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {string} value - Value to cache (should be JSON stringified)
 * @param {number} ttl - Time to live in seconds (default: env.CACHE_TTL)
 * @returns {Promise<boolean>} Success indicator
 */
export async function setCacheValue(key, value, ttl = env.CACHE_TTL) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    if (!client) return false;

    await client.setEx(key, ttl, value);
    console.log(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (err) {
    console.error(`[Cache] Error setting key "${key}":`, err.message);
    return false;
  }
}

/**
 * Delete one or more cache keys
 * @param {string|string[]} keys - Single key or array of keys
 * @returns {Promise<boolean>} Success indicator
 */
export async function invalidateCache(keys) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    if (!client) return false;

    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length === 0) return true;

    const deleted = await client.del(keyArray);
    console.log(`[Cache] INVALIDATED: ${deleted} key(s) out of ${keyArray.length}`);
    return deleted > 0;
  } catch (err) {
    console.error(`[Cache] Error invalidating keys:`, err.message);
    return false;
  }
}

/**
 * Pattern-based cache invalidation (e.g., clear all trending pages)
 * @param {string} pattern - Redis key pattern (e.g., "trending:feed:*")
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCachePattern(pattern) {
  if (!isRedisReady()) {
    return 0;
  }

  try {
    const client = getRedisClient();
    if (!client) return 0;

    const keys = await client.keys(pattern);
    if (keys.length === 0) {
      console.log(`[Cache] No keys matching pattern: ${pattern}`);
      return 0;
    }

    const deleted = await client.del(keys);
    console.log(`[Cache] INVALIDATED PATTERN: ${pattern} (${deleted} keys)`);
    return deleted;
  } catch (err) {
    console.error(`[Cache] Error invalidating pattern "${pattern}":`, err.message);
    return 0;
  }
}

/**
 * Safely get cached value and parse as JSON
 * @param {string} key - Cache key
 * @returns {Promise<Object|null>} Parsed JSON or null
 */
export async function getCacheJSON(key) {
  const value = await getCacheValue(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (err) {
    console.error(`[Cache] Failed to parse JSON from key "${key}":`, err.message);
    return null;
  }
}

/**
 * Safely set cached value as JSON
 * @param {string} key - Cache key
 * @param {Object} obj - Object to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success indicator
 */
export async function setCacheJSON(key, obj, ttl = env.CACHE_TTL) {
  try {
    const value = JSON.stringify(obj);
    return await setCacheValue(key, value, ttl);
  } catch (err) {
    console.error(`[Cache] Failed to stringify object for key "${key}":`, err.message);
    return false;
  }
}

/**
 * Get or set cache (cache-aside pattern)
 * If cache hit, returns cached value.
 * If cache miss, calls fallback function, caches result, and returns it.
 * @param {string} key - Cache key
 * @param {Function} fallback - Async function to call on cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} Cached or fallback value
 */
export async function cacheAside(key, fallback, ttl = env.CACHE_TTL) {
  if (!isRedisReady()) {
    console.log(`[Cache] Redis unavailable, calling fallback for key: ${key}`);
    return await fallback();
  }

  try {
    // Try to get from cache
    const cached = await getCacheJSON(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss — call fallback
    const result = await fallback();

    // Try to cache result
    await setCacheJSON(key, result, ttl);

    return result;
  } catch (err) {
    console.error(`[Cache] Error in cacheAside for key "${key}":`, err.message);
    // Fallback to direct call if cache operation fails
    return await fallback();
  }
}
