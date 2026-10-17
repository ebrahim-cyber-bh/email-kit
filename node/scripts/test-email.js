// Checks the Gmail credentials in .env and sends one test email.
//   npm run test-email                     a normal email to SMTP_USER (yourself)
//   npm run test-email -- someone@x.y      a normal email to another address
//   npm run test-email -- --otp [address]  a sample code email instead
import { loadConfig } from '../src/config.js';
import { createMailer } from '../src/mailer.js';
import { messageEmail, codeEmail } from '../src/templates.js';
import { generateCode } from '../src/otp.js';

const args = process.argv.slice(2);
const otp = args.includes('--otp');
const cfg = loadConfig();
const mailer = createMailer(cfg.smtp);
const to = args.find((a) => !a.startsWith('--')) || cfg.smtp.user;

if (!mailer.enabled) {
  console.error('SMTP_USER and SMTP_PASS are empty in .env. Fill them in first (see GUIDE.md).');
  process.exit(1);
}
console.log(`Logging in to ${cfg.smtp.host}:${cfg.smtp.port} as ${cfg.smtp.user} ...`);
const check = await mailer.check();
if (!check.ok) {
  console.error(`Login failed: ${check.error}`);
  if (/535|Username and Password not accepted|BadCredentials/i.test(check.error)) {
    console.error('Gmail refused the login. Use a 16-character App Password, not your normal password (GUIDE.md, step 2).');
  }
  process.exit(1);
}
console.log('Login OK.');
const mail = otp
  ? codeEmail({ appName: cfg.smtp.fromName, code: generateCode(cfg.otp.length), ttlMinutes: cfg.otp.ttlMinutes })
  : messageEmail({ subject: `${cfg.smtp.fromName}: test email`, greeting: 'Hello,', paragraphs: ['This is a test email from the email kit. If you can read it, sending works.'] });
await mailer.send({ to, ...mail });
console.log(`Test ${otp ? 'code ' : ''}email sent to ${to}. Check the inbox, and the spam folder the first time.`);
