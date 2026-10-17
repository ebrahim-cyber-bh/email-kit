import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// One .env at the repo root, shared with the Go version.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

export function loadConfig(env = process.env) {
  const num = (name, fallback) => {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    smtp: {
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER || '',
      pass: (env.SMTP_PASS || '').replace(/\s+/g, ''), // Google shows app passwords as "abcd efgh ijkl mnop"
      fromName: env.MAIL_FROM_NAME || 'My App',
    },
    otp: {
      length: num('OTP_LENGTH', 6),
      ttlMinutes: num('OTP_TTL_MINUTES', 10),
      maxAttempts: num('OTP_MAX_ATTEMPTS', 5),
      resendSeconds: num('OTP_RESEND_SECONDS', 60),
    },
    port: num('PORT', 4600),
  };
}
