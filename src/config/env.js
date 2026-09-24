// Loads and validates environment variables once. Import config from here, never process.env directly.
require('dotenv').config({ quiet: true });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}. See .env.example`);
  process.exit(1);
}

const int = (value, fallback) => (value === undefined || value === '' ? fallback : parseInt(value, 10));

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  mongoUri: process.env.MONGO_URI,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  cookieName: process.env.COOKIE_NAME || 'token',
  bcryptSaltRounds: int(process.env.BCRYPT_SALT_ROUNDS, 10),

  rules: {
    cancellationCutoffHours: int(process.env.CANCELLATION_CUTOFF_HOURS, 2),
    checkinWindowMinutes: int(process.env.CHECKIN_WINDOW_MINUTES, 60),
    defaultNoShowGraceMinutes: int(process.env.DEFAULT_NO_SHOW_GRACE_MINUTES, 15),
  },

  mail: {
    host: process.env.SMTP_HOST,
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Webforge Workshops <no-reply@webforge.dev>',
  },

  enableCron: process.env.ENABLE_CRON !== 'false',
};
