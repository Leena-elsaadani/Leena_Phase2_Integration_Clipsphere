const env = {
  get PORT() { return process.env.PORT || 5000 },
  get MONGO_URI() { return process.env.MONGO_URI || "mongodb://127.0.0.1:27017/clipsphere" },
  get JWT_SECRET() { return process.env.JWT_SECRET },
  get FRONTEND_URL() { return process.env.FRONTEND_URL || "http://localhost:3000" },
  get SMTP_HOST() { return process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io" },
  get SMTP_PORT() { return parseInt(process.env.SMTP_PORT || "587") },
  get SMTP_USER() { return process.env.SMTP_USER || "" },
  get SMTP_PASS() { return process.env.SMTP_PASS || "" },
  get STRIPE_SECRET_KEY() { return process.env.STRIPE_SECRET_KEY || "" },
  get STRIPE_WEBHOOK_SECRET() { return process.env.STRIPE_WEBHOOK_SECRET || "" },
  get STRIPE_PUBLISHABLE_KEY() { return process.env.STRIPE_PUBLISHABLE_KEY || "" },
  get REDIS_HOST() { return process.env.REDIS_HOST || "localhost" },
  get REDIS_PORT() { return parseInt(process.env.REDIS_PORT || "6379") },
  get REDIS_PASSWORD() { return process.env.REDIS_PASSWORD || "" },
  get CACHE_TTL() { return parseInt(process.env.CACHE_TTL || "90") }, // seconds
};

export default env;