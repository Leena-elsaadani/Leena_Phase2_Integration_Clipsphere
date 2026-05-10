import emailQueue from '../queues/emailQueue.js';
import { sendEngagementEmail } from '../services/email.service.js';

export const startEmailWorker = () => {
  try {
    emailQueue.process(async (job) => {
      const {
        to,
        recipientUsername,
        actorUsername,
        action,
        videoTitle,
        notificationPreferenceKey,
      } = job.data;

      await sendEngagementEmail(
        to,
        recipientUsername,
        actorUsername,
        action,
        videoTitle,
        notificationPreferenceKey
      );

      console.log(`[Email Worker] Processed email job ${job.id} for ${to}`);
      return { delivered: true };
    });

    emailQueue.on('ready', () => {
      console.log('[Email Worker] Ready');
    });

    emailQueue.on('failed', (job, err) => {
      console.error(`[Email Worker] Job ${job.id} failed:`, err.message);
    });

    console.log('[Email Worker] Started');
  } catch (err) {
    console.error('[Email Worker] Failed to start:', err.message);
  }
};
