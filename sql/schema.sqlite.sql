-- One active code per subject (a user id or an email). Sending a new code replaces the old one.
-- The code itself is never stored: only a salted SHA-256 hash of it.
CREATE TABLE IF NOT EXISTS otp_codes (
    subject      TEXT PRIMARY KEY,          -- user id or email the code was sent for
    code_hash    TEXT    NOT NULL,          -- hex sha256(salt || code)
    salt         TEXT    NOT NULL,          -- hex, random per code
    expires_at   DATETIME NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_sent_at DATETIME NOT NULL
);

-- If accounts get a verified flag (as in the Social Network project):
-- ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT 0;
