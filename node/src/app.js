import path from 'node:path';
import express from 'express';
import { ROOT } from './config.js';
import { messageEmail } from './templates.js';

// Demo routes for both parts of the kit:
//   POST /api/mail/send     a normal email   { to, subject, message, buttonText?, buttonUrl? }
//   POST /api/otp/send      a one-time code  { email, name? }         (as in the Social Network project)
//   POST /api/otp/verify    check the code   { email, code }
// In a real app the OTP subject is the logged-in user's id (from the session) and the email comes from the user
// record; the demo takes the email from the request body so it works without accounts. The demo listens on
// 127.0.0.1 only: /api/mail/send would let anyone send mail from your address if it were public.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGES = {
  missing: 'No code was sent to this email, or it was already used. Send a new one.',
  expired: 'The code has expired. Send a new one.',
  too_many: 'Too many wrong codes. Send a new one.',
  wrong: 'Wrong code.',
};

export function createApp({ mailer, otp }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(ROOT, 'node', 'public')));
  const mode = () => (mailer.enabled ? 'smtp' : 'console');

  app.post('/api/mail/send', async (req, res) => {
    const to = String(req.body?.to || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!EMAIL.test(to) || !subject || !message) {
      return res.status(400).json({ success: false, message: 'A valid "to", a subject and a message are required.' });
    }
    const { buttonText, buttonUrl } = req.body;
    const mail = messageEmail({ subject, paragraphs: message.split(/\n\s*\n/), button: buttonText && buttonUrl ? { text: buttonText, url: buttonUrl } : undefined });
    try {
      await mailer.send({ to, ...mail });
      res.json({ success: true, mode: mode(), message: `Email sent to ${to}` });
    } catch (err) {
      res.status(502).json({ success: false, message: `The email could not be sent: ${err.message}` });
    }
  });

  app.post('/api/otp/send', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    try {
      const r = await otp.send(email, { email, name: req.body?.name });
      if (!r.ok) {
        return res.status(429).json({ success: false, retryAfter: r.retryAfter, message: `Wait ${r.retryAfter} s before asking for another code.` });
      }
      res.json({ success: true, mode: mode(), message: `Verification code sent to ${email}` });
    } catch (err) {
      res.status(502).json({ success: false, message: `The email could not be sent: ${err.message}` });
    }
  });

  app.post('/api/otp/verify', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!email || !code) return res.status(400).json({ success: false, message: 'Email and code are required.' });
    const r = await otp.verify(email, code);
    if (r.ok) return res.json({ success: true, message: 'Email verified!' });
    const message = r.reason === 'wrong' ? `${MESSAGES.wrong} ${r.attemptsLeft} attempt(s) left.` : MESSAGES[r.reason];
    res.status(400).json({ success: false, reason: r.reason, message });
  });

  return app;
}
