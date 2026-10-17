import crypto from 'node:crypto';
import { codeEmail } from './templates.js';

// Optional part: one-time codes. Use only what the case needs:
//   generateCode()        just a random code (you store, send and check it yourself)
//   createOtp(...)        the whole flow: send a code by email, keep only its hash, verify it once
// A store holds one record per subject (a user id or an email): { codeHash, salt, expiresAt, attempts, lastSentAt }
// with times in ms.

// crypto.randomInt is uniform and unpredictable (Math.random is neither).
export function generateCode(length = 6) {
  return String(crypto.randomInt(0, 10 ** length)).padStart(length, '0');
}

export function createOtp({ store, mailer, length = 6, ttlMinutes = 10, maxAttempts = 5, resendSeconds = 60, now = Date.now }) {
  const hash = (code, salt) => crypto.createHash('sha256').update(salt + code).digest('hex');

  // Returns { ok: true } or { ok: false, reason: 'cooldown', retryAfter } (seconds).
  async function send(subject, { email = subject, name = '' } = {}) {
    const old = await store.get(subject);
    if (old) {
      const wait = Math.ceil((old.lastSentAt + resendSeconds * 1000 - now()) / 1000);
      if (wait > 0) return { ok: false, reason: 'cooldown', retryAfter: wait };
    }
    const code = generateCode(length);
    const salt = crypto.randomBytes(16).toString('hex');
    await store.set(subject, { codeHash: hash(code, salt), salt, expiresAt: now() + ttlMinutes * 60 * 1000, attempts: 0, lastSentAt: now() });
    try {
      await mailer.send({ to: email, ...codeEmail({ appName: mailer.fromName, name, code, ttlMinutes }) });
    } catch (err) {
      await store.delete(subject); // nobody got the code, so do not block a retry with the cooldown
      throw err;
    }
    return { ok: true };
  }

  // Returns { ok: true } or { ok: false, reason: 'missing' | 'expired' | 'too_many' | 'wrong', attemptsLeft? }.
  async function verify(subject, code) {
    const rec = await store.get(subject);
    if (!rec) return { ok: false, reason: 'missing' };
    if (now() > rec.expiresAt) {
      await store.delete(subject);
      return { ok: false, reason: 'expired' };
    }
    if (rec.attempts >= maxAttempts) {
      await store.delete(subject);
      return { ok: false, reason: 'too_many' };
    }
    const given = Buffer.from(hash(String(code ?? '').trim(), rec.salt), 'hex');
    if (crypto.timingSafeEqual(given, Buffer.from(rec.codeHash, 'hex'))) {
      await store.delete(subject); // one-time: a used code cannot be replayed
      return { ok: true };
    }
    rec.attempts += 1;
    if (rec.attempts >= maxAttempts) {
      await store.delete(subject);
      return { ok: false, reason: 'too_many' };
    }
    await store.set(subject, rec);
    return { ok: false, reason: 'wrong', attemptsLeft: maxAttempts - rec.attempts };
  }

  return { send, verify };
}

// Keeps codes in memory: fine for one server process and for tests. For several processes or restarts,
// write a store with the same get/set/delete over the otp_codes table in sql/.
export function memoryStore() {
  const map = new Map();
  return {
    async get(subject) {
      const rec = map.get(subject);
      return rec ? { ...rec } : null;
    },
    async set(subject, rec) {
      map.set(subject, { ...rec });
    },
    async delete(subject) {
      map.delete(subject);
    },
  };
}
