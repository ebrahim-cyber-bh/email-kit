-- Same table for PostgreSQL. See schema.sqlite.sql for what each column holds.
CREATE TABLE IF NOT EXISTS otp_codes (
    subject      TEXT PRIMARY KEY,
    code_hash    TEXT        NOT NULL,
    salt         TEXT        NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    attempts     INTEGER     NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ NOT NULL
);

-- ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;
