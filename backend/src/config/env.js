const env = {
  PORT: 3000,
  // Default targets local MongoDB. In Docker Compose, set MONGO_URI=mongodb://mongo:27017/clipsphere in .env
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/clipsphere",
  JWT_SECRET: process.env.JWT_SECRET || "ee3bf6101d62c0e6907288d6fa746f6c731cc9645d2e9382995d128ee4c677a219e2a056e0b77550f659e90573637c166f191e956e7389178ac062f299bc97d7",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  SMTP_HOST: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587"),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
};

export default env;