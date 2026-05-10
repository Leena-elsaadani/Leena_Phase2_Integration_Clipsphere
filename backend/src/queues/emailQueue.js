import Queue from 'bull';
import env from '../config/env.js';

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
};

const emailQueue = new Queue('email-notifications', {
  redis: redisConfig,
});

emailQueue.on('ready', () => {
  console.log('[Email Queue] Ready');
});

emailQueue.on('error', (err) => {
  console.error('[Email Queue] Error:', err.message);
});

emailQueue.on('failed', (job, err) => {
  console.error(
    `[Email Queue] Job ${job.id} failed after ${job.attemptsMade} attempt(s):`,
    err.message
  );
});

emailQueue.on('completed', (job) => {
  console.log(`[Email Queue] Job ${job.id} completed for ${job.data.to}`);
});

export const addEmailJob = async (payload) => {
  try {
    return await emailQueue.add('engagement', payload, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  } catch (err) {
    console.error('[Email Queue] Enqueue failed:', err.message);
    throw err;
  }
};

export default emailQueue;
