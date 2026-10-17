import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createOtp, memoryStore, generateCode } from '../src/otp.js';
import { createMailer } from '../src/mailer.js';
import { messageEmail, codeEmail } from '../src/templates.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// A mailer that records emails instead of sending them.
function fakeMailer() {
  const sent = [];
  return { enabled: true, fromName: 'Test App', sent, async send(m) { sent.push(m); return { mode: 'fake' }; } };
}
const codeIn = (mail) => mail.text.match(/code is (\d+)/)[1];

describe('mailer', () => {
  it('prints instead of sending while the credentials are empty', async () => {
    const lines = [];
    const m = createMailer(loadConfig({}).smtp, { log: (l) => lines.push(l) });
    expect(m.enabled).toBe(false);
    expect(await m.send({ to: 'a@x.com', subject: 'Hi', text: 'Body', attachments: [{ filename: 'a.pdf', content: 'x' }] })).toEqual({ mode: 'console' });
    expect(lines[0]).toContain('a@x.com');
    expect(lines[0]).toContain('a.pdf');
    expect((await m.check()).ok).toBe(false);
  });

  it('refuses an email without to, subject or body', async () => {
    const m = createMailer(loadConfig({}).smtp, { log: () => {} });
    await expect(m.send({ subject: 'x', text: 'y' })).rejects.toThrow('"to"');
    await expect(m.send({ to: 'a@x.com', text: 'y' })).rejects.toThrow('"subject"');
    await expect(m.send({ to: 'a@x.com', subject: 'x' })).rejects.toThrow('"text", "html"');
  });
});

describe('templates', () => {
  it('builds a normal message with escaped text and a button', () => {
    const mail = messageEmail({ subject: 'Welcome', paragraphs: ['<b>hi</b>', 'second'], button: { text: 'Open', url: 'https://x.y/?a=1&b=2' } });
    expect(mail.subject).toBe('Welcome');
    expect(mail.html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(mail.html).toContain('https://x.y/?a=1&amp;b=2');
    expect(mail.text).toBe('<b>hi</b>\n\nsecond\n\nOpen: https://x.y/?a=1&b=2');
  });

  it('builds the code email', () => {
    const mail = codeEmail({ appName: 'Kit', code: '042137', ttlMinutes: 10 });
    expect(mail.subject).toBe('042137 is your Kit verification code');
    expect(mail.html).toContain('042137');
    expect(mail.text).toContain('expires in 10 minutes');
  });
});

describe('generateCode', () => {
  it('gives digits of the asked length, keeping leading zeros', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
    expect(generateCode(8)).toMatch(/^\d{8}$/);
  });
});

describe('otp flow', () => {
  let clock, store, mailer, otp;
  beforeEach(() => {
    clock = 1_000_000;
    store = memoryStore();
    mailer = fakeMailer();
    otp = createOtp({ store, mailer, now: () => clock });
  });

  it('emails a 6-digit code and stores only its hash', async () => {
    expect(await otp.send('a@x.com')).toEqual({ ok: true });
    const code = codeIn(mailer.sent[0]);
    expect(code).toMatch(/^\d{6}$/);
    expect(mailer.sent[0].to).toBe('a@x.com');
    expect(JSON.stringify(await store.get('a@x.com'))).not.toContain(code);
  });

  it('accepts the right code once only', async () => {
    await otp.send('a@x.com');
    const code = codeIn(mailer.sent[0]);
    expect(await otp.verify('a@x.com', code)).toEqual({ ok: true });
    expect(await otp.verify('a@x.com', code)).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects an expired code', async () => {
    await otp.send('a@x.com');
    clock += 10 * 60 * 1000 + 1;
    expect(await otp.verify('a@x.com', codeIn(mailer.sent[0]))).toEqual({ ok: false, reason: 'expired' });
  });

  it('throws the code away after 5 wrong guesses', async () => {
    await otp.send('a@x.com');
    const code = codeIn(mailer.sent[0]);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let left = 4; left >= 1; left--) {
      expect(await otp.verify('a@x.com', wrong)).toEqual({ ok: false, reason: 'wrong', attemptsLeft: left });
    }
    expect(await otp.verify('a@x.com', wrong)).toEqual({ ok: false, reason: 'too_many' });
    expect(await otp.verify('a@x.com', code)).toEqual({ ok: false, reason: 'missing' });
  });

  it('waits before sending another code, and the new code replaces the old', async () => {
    await otp.send('a@x.com');
    expect(await otp.send('a@x.com')).toEqual({ ok: false, reason: 'cooldown', retryAfter: 60 });
    clock += 60 * 1000;
    expect(await otp.send('a@x.com')).toEqual({ ok: true });
    const [first, second] = mailer.sent.map(codeIn);
    if (first !== second) expect((await otp.verify('a@x.com', first)).ok).toBe(false);
    expect((await otp.verify('a@x.com', second)).ok).toBe(true);
  });

  it('frees the cooldown when the email fails', async () => {
    const failing = { fromName: 'x', async send() { throw new Error('smtp down'); } };
    const o = createOtp({ store, mailer: failing, now: () => clock });
    await expect(o.send('a@x.com')).rejects.toThrow('smtp down');
    expect(await store.get('a@x.com')).toBeNull();
  });
});

describe('demo routes', () => {
  const setup = () => {
    const mailer = fakeMailer();
    return { mailer, app: createApp({ mailer, otp: createOtp({ store: memoryStore(), mailer }) }) };
  };

  it('sends a normal email', async () => {
    const { mailer, app } = setup();
    const r = await request(app).post('/api/mail/send').send({ to: 'b@x.com', subject: 'Hello', message: 'One\n\nTwo', buttonText: 'Go', buttonUrl: 'https://x.y' });
    expect(r.status).toBe(200);
    expect(mailer.sent[0]).toMatchObject({ to: 'b@x.com', subject: 'Hello' });
    expect(mailer.sent[0].text).toBe('One\n\nTwo\n\nGo: https://x.y');
    expect((await request(app).post('/api/mail/send').send({ to: 'b@x.com' })).status).toBe(400);
  });

  it('sends then verifies a code', async () => {
    const { mailer, app } = setup();
    expect((await request(app).post('/api/otp/send').send({ email: 'Me@Example.com' })).status).toBe(200);
    expect(mailer.sent[0].to).toBe('me@example.com');
    expect((await request(app).post('/api/otp/verify').send({ email: 'me@example.com', code: 'nope' })).status).toBe(400);
    const good = await request(app).post('/api/otp/verify').send({ email: 'me@example.com', code: codeIn(mailer.sent[0]) });
    expect(good.body).toEqual({ success: true, message: 'Email verified!' });
  });

  it('rejects a bad email and a second code inside the cooldown', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/otp/send').send({ email: 'nope' })).status).toBe(400);
    await request(app).post('/api/otp/send').send({ email: 'a@x.com' });
    expect((await request(app).post('/api/otp/send').send({ email: 'a@x.com' })).status).toBe(429);
  });
});

describe('config', () => {
  it('defaults to Gmail and strips spaces from the app password', () => {
    const cfg = loadConfig({ SMTP_USER: 'me@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' });
    expect(cfg.smtp).toMatchObject({ host: 'smtp.gmail.com', port: 587, secure: false, pass: 'abcdefghijklmnop' });
    expect(cfg.otp).toEqual({ length: 6, ttlMinutes: 10, maxAttempts: 5, resendSeconds: 60 });
  });
});
