# Email kit

A small, ready-to-use kit for sending email from any app through **Gmail SMTP with an App Password**: normal emails (text, HTML, attachments, inline images, cc/bcc) and, when the case needs it, **one-time codes (OTP)** for email verification. It comes in **Node.js** and **Go**, and both read the same `.env`.

Clone it and everything is there except the credentials: fill in two lines of `.env` and it sends.

- **[GUIDE.md](GUIDE.md):** for people. How to get the Gmail address and App Password, fill `.env`, and send a test email.
- **[CLAUDE.md](CLAUDE.md):** for Claude Code. The concept and the steps to add it to another project.

## What's inside

| Part | Node | Go | Use it when |
|---|---|---|---|
| **Mailer**: any email, or console mode without credentials | `createMailer` | `mail.New` | always |
| **Templates**: message with button, code email (`{subject, text, html}`) | `messageEmail`, `codeEmail` | `mail.MessageEmail`, `mail.CodeEmail` | you want a ready layout |
| **Code generator**: crypto-random digits | `generateCode()` | `otp.GenerateCode(6)` | you only need a code |
| **OTP flow**: send, store a hash, verify once | `createOtp` | `otp.New` | email verification, login codes, password reset |
| **Demo**: page and routes, two tabs (email / code) | `npm start` | `go run ./cmd/demo` | to try it |
| **Credential check**: logs in and sends a test | `npm run test-email` | `go run ./cmd/test-email` | after filling `.env` |

**The OTP rules:** 6 digits, valid 10 minutes, one active code per user, only a salted hash is stored, constant-time compare, deleted after one use, at most 5 wrong tries, 60 s between sends. All of these can be changed in `.env`.

## Quick start

```bash
git clone https://github.com/ebrahim-cyber-bh/email-kit.git
cd email-kit
cp .env.example .env        # then fill SMTP_USER and SMTP_PASS (GUIDE.md shows how)

cd node && npm install && npm run test-email && npm start     # Node 20+
# or
cd go && go run ./cmd/test-email && go run ./cmd/demo         # Go 1.22+
```

Open <http://127.0.0.1:4600>. Without credentials it still runs: emails and codes are printed in the terminal (console mode).

## The `.env` file

`.env` lives in the repo root and is git-ignored. `.env.example` is the template; copy it and fill in **only the two credential lines**. Gmail defaults are already set.

```ini
# ---- Credentials (the only two lines you must fill in) ----
SMTP_USER=                 # the Gmail address the emails are sent from
SMTP_PASS=                 # its 16-character Google App Password (not the normal password)

# ---- Mail server (ready for Gmail) ----
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587              # 587 + SMTP_SECURE=false (STARTTLS), or 465 + SMTP_SECURE=true (SSL)
SMTP_SECURE=false
MAIL_FROM_NAME=My App      # sender name people see

# ---- OTP rules (used only by the OTP part) ----
OTP_LENGTH=6
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_SECONDS=60

# ---- Demo server ----
PORT=4600
```

| Variable | Needed | Meaning |
|---|---|---|
| `SMTP_USER` | **yes** | Gmail address that sends (GUIDE.md step 1) |
| `SMTP_PASS` | **yes** | App Password of that address (GUIDE.md step 2); spaces are ignored |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | no | Mail server; Gmail by default |
| `MAIL_FROM_NAME` | no | Sender name; Gmail always uses `SMTP_USER` as the address |
| `OTP_*` | no | Code length, minutes valid, wrong tries allowed, seconds between sends |
| `PORT` | no | Demo server port |

## Using it in code

**Node: a normal email**

```js
import { loadConfig, createMailer, messageEmail } from './email-kit/node/src/index.js';

const mailer = createMailer(loadConfig().smtp);
await mailer.send({
  to: 'student@example.com',
  ...messageEmail({ subject: 'Your registration', greeting: 'Hi Sara,', paragraphs: ['You are registered for topic 07.'],
                    button: { text: 'Open the portal', url: 'https://example.com' } }),
  attachments: [{ filename: 'topic-07.pdf', path: './files/07.pdf' }],
});
```

**Node: OTP**

```js
import { loadConfig, createMailer, createOtp, memoryStore, generateCode } from './email-kit/node/src/index.js';

const cfg = loadConfig();
const otp = createOtp({ store: memoryStore(), mailer: createMailer(cfg.smtp), ...cfg.otp });
await otp.send(user.id, { email: user.email, name: user.firstName });   // { ok } or { ok:false, reason:'cooldown', retryAfter }
await otp.verify(user.id, req.body.code);                               // { ok } or { ok:false, reason, attemptsLeft? }

generateCode();   // or just a code, for your own use
```

**Go: a normal email, then OTP**

```go
import (
    "github.com/ebrahim-cyber-bh/email-kit/go/mail"
    "github.com/ebrahim-cyber-bh/email-kit/go/otp"
)

mail.LoadDotEnv(".")
cfg := mail.FromEnv()
m := mail.New(cfg)

msg := mail.MessageEmail(mail.Content{Subject: "Welcome", Paragraphs: []string{"Thanks for joining."}})
msg.To = []string{"someone@example.com"}
err := m.Send(msg)

codes := otp.New(otp.SQLStore{DB: db}, m, otp.FromConfig(cfg))   // or otp.NewMemoryStore()
res, err := codes.Send(userID, user.Email, user.FirstName)
res, err = codes.Verify(userID, code)                            // res.OK, res.Reason, res.AttemptsLeft
```

The `otp_codes` table for a database is in [`sql/`](sql) (SQLite and PostgreSQL).

## Tests

```bash
cd node && npm test          # 15 tests
cd go && go test ./...
```

They use fake mailers and never send real email.

## Use it in another project with Claude Code

Open Claude Code in **your own project's folder**, and paste this prompt. Claude gets the kit, learns the idea, adds what your project needs, and walks you through the only two things it can't do for you: the Gmail address and the App Password.

```text
I want to add email sending to this project using the email kit at
https://github.com/ebrahim-cyber-bh/email-kit

1. Clone it into a temporary folder outside this project (for example ../email-kit), then read its CLAUDE.md,
   README.md and GUIDE.md to understand the concept.
2. Look at this project (language, framework, database, existing .env and .gitignore) and ask me what I need:
   normal emails only, or one-time codes (OTP) as well, and for what (email verification, login codes,
   password reset, notifications...).
3. Add only what I need, following the kit's concept but in this project's own language and style: the mailer
   with console mode, the templates I need, and the OTP flow with its rules and an otp_codes table only if I
   need OTP. Do not add the kit's demo server.
4. Add the SMTP_*, MAIL_FROM_NAME (and OTP_* if used) lines to this project's .env.example with empty
   credentials, and make sure .env is in .gitignore before anything else.
5. Then guide me, step by step and waiting for me at each step, through GUIDE.md:
   a. choosing or creating the Gmail address that will send the emails,
   b. turning on 2-Step Verification on it,
   c. creating the App Password at https://myaccount.google.com/apppasswords,
   d. putting both into .env myself.
   Never ask me to paste the App Password into this chat and never write it into a file yourself.
6. When I say .env is filled, run a test that logs in and sends one email to my address, and help me fix any
   error using GUIDE.md section 5.
7. Make sure the project still runs and its tests pass with empty credentials (console mode).
```

## Security notes

- The App Password gives full access to send as that Gmail account. Keep it only in `.env`. If it leaks, revoke it at <https://myaccount.google.com/apppasswords>.
- Never expose a general "send any email" route to the internet. The demo listens on `127.0.0.1` only.
- OTP routes belong behind your app's login (or rate limiting, for sign-up), with the subject taken from the session.
- A free Gmail sends about 500 emails a day. For more, use a provider made for transactional mail. The kit works with any SMTP server: change `SMTP_HOST`, `SMTP_PORT` and `SMTP_SECURE`.

## License

MIT
