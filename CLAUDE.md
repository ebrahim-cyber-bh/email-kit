# Email kit: notes for Claude Code

Read this before using the kit in any project. It explains the concept, so you can add email sending (and, only when the case needs it, one-time codes) to another codebase in that codebase's own language and style.

## The concept

1. **One mailer, any email.** SMTP with Gmail and an App Password. It sends text, HTML, attachments, inline images (CID), cc/bcc and reply-to. Settings come from `.env` only; nothing secret goes in code.
2. **Console mode.** While `SMTP_USER` or `SMTP_PASS` is empty, the mailer prints each email to the terminal instead of sending it. The app works end to end before credentials exist, and tests never need them.
3. **Templates are separate from sending.** A template returns `{subject, text, html}`, which goes into a send call. Always send a plain-text part with the HTML. Escape every value put into HTML.
4. **OTP is optional, and built on the mailer.** Use only what the case needs:
   - only a code: `generateCode()` / `otp.GenerateCode(n)`, using a cryptographic random source, never `Math.random` or `math/rand`;
   - the full flow: `send(subject)` emails a code and `verify(subject, code)` checks it.
5. **OTP rules** (the defaults in `.env.example`):
   - 6 digits, valid 10 minutes;
   - one active code per subject (a user id, or an email before an account exists); a new code replaces the old;
   - store only a salted SHA-256 hash of the code, never the code;
   - compare in constant time;
   - a right code is deleted at once (one-time, no replay); 5 wrong tries delete it;
   - 60 s cooldown between sends; if the email fails, the record is deleted so the cooldown does not block a retry;
   - say clearly why a code failed: missing / expired / too many / wrong (with attempts left).
6. **Routes** (as in the original Social Network project): `POST /api/otp/send` and `POST /api/otp/verify`, behind the app's login, with the subject taken from the session, not the request body. In a real app, a general "send any email" route must never be public; the demo's `/api/mail/send` listens on 127.0.0.1 only.

Where it came from: email OTP verification in a Go + Next.js social network (6-digit code, 10-minute expiry, SQLite `otp_codes` table, deleted after use), and the Gmail App Password mail setup of an Express portal (sending off until `.env` has credentials, PDF attachments, inline logo). This kit keeps both and adds crypto-random codes, hashing, attempt limits, a cooldown and console mode.

## Layout

| Path | What |
|---|---|
| `.env.example` | Every setting, commented. Copy to `.env`; only `SMTP_USER` and `SMTP_PASS` need filling |
| `node/src/mailer.js` | `createMailer(smtp)` → `send(msg)`, `check()`, `enabled` |
| `node/src/templates.js` | `messageEmail({...})`, `codeEmail({...})`, `escape` |
| `node/src/otp.js` | `generateCode`, `createOtp({store, mailer, ...})` → `send`, `verify`; `memoryStore()` |
| `node/src/config.js` | Reads the root `.env` into `{smtp, otp, port}` |
| `node/src/index.js` | Everything from one import |
| `node/src/app.js`, `server.js`, `public/` | Demo Express routes and page |
| `go/mail/` | `mail.New(cfg)` → `Send(Message)`, `Check()`; `Build` (MIME); `MessageEmail`, `CodeEmail`; `LoadDotEnv`, `FromEnv` |
| `go/otp/` | `GenerateCode`, `otp.New(store, sender, opts)` → `Send`, `Verify`; `MemoryStore`, `SQLStore` (database/sql) |
| `go/cmd/demo`, `go/cmd/test-email` | Demo server (same page) and credential check |
| `sql/` | The `otp_codes` table for SQLite and PostgreSQL |

Tests: `cd node && npm test` (15) and `cd go && go test ./...`. They use fake mailers and never send mail.

## Adding it to a project

1. Ask the user whether the project needs **normal emails only**, or **OTP as well** (verification, login codes, password reset). Don't add OTP unless the case needs it.
2. Match the project's stack:
   - Node: copy `node/src/{config,mailer,templates,otp}.js` (or what is needed) and add `nodemailer` and `dotenv`.
   - Go: copy `go/mail` (and `go/otp`), or import `github.com/ebrahim-cyber-bh/email-kit/go`. No outside dependencies.
   - Another language: port the concept above with its standard SMTP library.
3. **Storage for OTP:** the memory store is fine for one process. Otherwise add the `otp_codes` table from `sql/` to the project's migrations and use or write a store with `get/set/delete`.
4. **Settings:** add the `SMTP_*`, `MAIL_FROM_NAME` and `OTP_*` lines to the project's `.env.example`, with empty credentials. Make sure `.env` is git-ignored **before** anyone fills it in.
5. **Credentials:** never ask the user to paste the App Password into the chat, and never write it into a file yourself. Send them to `GUIDE.md` steps 1–3 (Gmail address, 2-Step Verification, App Password, `.env`) and let them fill `.env` themselves. Then have them run the test-email command.
6. Keep console mode, so the project runs and its tests pass without credentials.
