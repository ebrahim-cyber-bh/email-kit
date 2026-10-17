# Guide: get the email kit sending in 10 minutes

This guide is for people. It takes you from nothing to a working email sender. You need two things from Google: **a Gmail address** and **an App Password** for it. Everything else is already in the repo.

---

## 1. Choose the Gmail address that sends the emails

Your app's emails will come **from** this address.

- **Recommended:** create a new Gmail just for the app (for example `myapp.noreply@gmail.com`) at <https://accounts.google.com/signup>. Your personal inbox stays separate, and you can turn the app off without touching your own account.
- You can also use an existing Gmail.
- A Google Workspace (company or school) address works too, if its admin allows App Passwords. Many school accounts don't.

Write the address down. It goes in `SMTP_USER`.

## 2. Get an App Password

An App Password is a 16-character password that lets one app send email through your Gmail. It is **not** your normal Gmail password, and Gmail refuses the normal one for SMTP.

1. Sign in to the Gmail address from step 1 in your browser.
2. **Turn on 2-Step Verification** (Google requires it before App Passwords appear). Go to <https://myaccount.google.com/signinoptions/two-step-verification>, click **Turn on**, and follow the steps (a phone number or the Google Authenticator app).
3. **Create the App Password.** Go to <https://myaccount.google.com/apppasswords>.
   - In **App name**, type a name you'll recognise, for example `email-kit` or your project's name.
   - Click **Create**.
4. Google shows a yellow box with 16 letters in four groups, like `abcd efgh ijkl mnop`. **Copy it now**: Google shows it only once. (If you lose it, delete it on the same page and create a new one.)

That is your `SMTP_PASS`. The spaces don't matter; the kit removes them.

**If the App Passwords page says "The setting you are looking for is not available for your account":**
- 2-Step Verification is not on yet (step 2), or it was turned on a minute ago: wait and reload.
- The account uses **Advanced Protection**, or it's a Workspace account whose admin blocked App Passwords. Use a normal Gmail instead.

## 3. Put the two values in `.env`

```bash
git clone https://github.com/ebrahim-cyber-bh/email-kit.git
cd email-kit
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Open `.env` and fill in the first two lines:

```
SMTP_USER=myapp.noreply@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
```

Optionally set `MAIL_FROM_NAME`, the sender name people see (for example `MyApp`). Leave the rest as it is.

`.env` is in `.gitignore`, so it never reaches GitHub. **Never put the App Password in code, in a commit, or in a chat.** If it leaks, delete it on the App Passwords page and make a new one.

## 4. Send a test email

Pick the version that matches your project.

**Node.js (20 or newer):**

```bash
cd node
npm install
npm run test-email                  # a normal email to yourself
npm run test-email -- --otp         # a sample code email
npm start                           # demo page on http://127.0.0.1:4600
```

**Go (1.22 or newer):**

```bash
cd go
go run ./cmd/test-email             # a normal email to yourself
go run ./cmd/test-email -otp        # a sample code email
go run ./cmd/demo                   # demo page on http://127.0.0.1:4600
```

You should see `Login OK.` and then `Test email sent`. The first email often lands in **Spam**: open it and click "Not spam", and later ones arrive in the inbox.

The demo page has two tabs: **Send an email** (a normal message) and **One-time code** (send a code, then type it in to verify).

## 5. If something goes wrong

| You see | Fix |
|---|---|
| `SMTP_USER and SMTP_PASS are empty` | Fill both lines in `.env` (step 3). The file must be named exactly `.env`, in the repo root |
| `535 ... Username and Password not accepted` | You used the normal Gmail password, or the App Password was mistyped. Make a new App Password (step 2) |
| `Application-specific password required` | Same: use the App Password, not the normal password |
| The App Passwords page is missing | Turn on 2-Step Verification first (step 2) |
| `connect ETIMEDOUT` or timeout on port 587 | The network blocks SMTP (some school and office networks do). Try port 465: `SMTP_PORT=465` and `SMTP_SECURE=true`, or use another network |
| The email arrives, but in Spam | Normal at first. Mark it "Not spam". For real users, keep the subject and text plain (no links-only emails) |
| The "From" address is my Gmail, not the one I wanted | Gmail always sends from the logged-in address. Change `MAIL_FROM_NAME` for the name, or set up "Send mail as" in Gmail settings for another address |
| `Daily user sending limit exceeded` | A free Gmail sends about 500 emails a day. Wait 24 hours, or use a provider made for bulk mail |

## Without credentials

Leave `SMTP_USER` and `SMTP_PASS` empty and the kit runs in **console mode**: every email (and every OTP code) is printed in the terminal instead of sent. Use it to build and test your app before you have the App Password.
