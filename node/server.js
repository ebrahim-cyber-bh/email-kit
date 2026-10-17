import { loadConfig } from './src/config.js';
import { createMailer } from './src/mailer.js';
import { createOtp, memoryStore } from './src/otp.js';
import { createApp } from './src/app.js';

const cfg = loadConfig();
const mailer = createMailer(cfg.smtp);
const otp = createOtp({ store: memoryStore(), mailer, ...cfg.otp });

createApp({ mailer, otp }).listen(cfg.port, '127.0.0.1', () => {
  console.log(`Email kit demo on http://127.0.0.1:${cfg.port}`);
  console.log(mailer.enabled
    ? `Sending real emails from ${cfg.smtp.user} through ${cfg.smtp.host}:${cfg.smtp.port}`
    : 'Console mode: emails and codes are printed here. Fill SMTP_USER and SMTP_PASS in .env to send real emails.');
});
