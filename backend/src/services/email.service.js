import nodemailer from 'nodemailer';
import env from '../config/env.js';

// Only create transporter if SMTP credentials exist
let transporter = null;

if (env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

// ── HTML TEMPLATES ────────────────────────────────────────────────────────────

const welcomeTemplate = (username) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;color:#f9fafb;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.2);">
    <div style="background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:40px 32px;text-align:center;">
      <h1 style="margin:0;font-size:2rem;font-weight:800;color:#fff;">ClipSphere</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);">Short video. Big impact.</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="margin:0 0 12px;color:#f9fafb;">Welcome, ${username}! 🎉</h2>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 20px;">You've just joined one of the fastest-growing short-video platforms.</p>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 24px;">Start uploading videos, discover trending clips, and connect with creators worldwide.</p>
      <a href="${env.FRONTEND_URL}" style="display:inline-block;padding:14px 32px;border-radius:100px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;font-weight:700;">Start Exploring →</a>
    </div>
    <div style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#6b7280;font-size:0.8rem;">
      © 2026 ClipSphere · You received this because you registered.
    </div>
  </div>
</body>
</html>`;

const engagementTemplate = (recipientUsername, actorUsername, action, videoTitle) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;color:#f9fafb;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.2);">
    <div style="background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:32px;text-align:center;">
      <h1 style="margin:0;font-size:1.5rem;font-weight:800;color:#fff;">New Activity on ClipSphere 🔔</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#9ca3af;">Hey <strong style="color:#f9fafb;">${recipientUsername}</strong>,</p>
      <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;color:#a78bfa;font-weight:600;">🎬 <strong>${actorUsername}</strong> ${action} your video "<em>${videoTitle}</em>"</p>
      </div>
      <p style="color:#9ca3af;margin:0 0 24px;">Head back to ClipSphere to keep the momentum going!</p>
      <a href="${env.FRONTEND_URL}" style="display:inline-block;padding:12px 28px;border-radius:100px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;font-weight:700;">View Activity →</a>
    </div>
    <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#6b7280;font-size:0.8rem;">
      © 2026 ClipSphere · Update notification preferences in your settings.
    </div>
  </div>
</body>
</html>`;

// ── SEND FUNCTIONS ────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (toEmail, username) => {
  if (!transporter) return; // silently skip if not configured
  try {
    await transporter.sendMail({
      from: `"ClipSphere" <${env.SMTP_USER}>`,
      to: toEmail,
      subject: `Welcome to ClipSphere, ${username}! 🎉`,
      html: welcomeTemplate(username),
    });
    console.log(`Welcome email sent to ${toEmail}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error.message);
  }
};

export const sendEngagementEmail = async (
  recipientEmail,
  recipientUsername,
  actorUsername,
  action,
  videoTitle
) => {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"ClipSphere" <${env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `${actorUsername} ${action} your video on ClipSphere`,
      html: engagementTemplate(recipientUsername, actorUsername, action, videoTitle),
    });
    console.log(`Engagement email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Failed to send engagement email:', error.message);
  }
};