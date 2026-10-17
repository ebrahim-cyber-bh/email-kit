package otp

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"sync"
)

// MemoryStore keeps codes in memory: fine for one server process and for tests.
type MemoryStore struct {
	mu sync.Mutex
	m  map[string]Record
}

func NewMemoryStore() *MemoryStore { return &MemoryStore{m: map[string]Record{}} }

func (s *MemoryStore) Get(subject string) (*Record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if r, ok := s.m[subject]; ok {
		return &r, nil
	}
	return nil, nil
}

func (s *MemoryStore) Set(subject string, r Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[subject] = r
	return nil
}

func (s *MemoryStore) Delete(subject string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.m, subject)
	return nil
}

// SQLStore keeps codes in the otp_codes table (sql/schema.sqlite.sql or sql/schema.postgres.sql) through any
// database/sql driver. Set Postgres for $1-style placeholders; SQLite and MySQL use ?.
type SQLStore struct {
	DB       *sql.DB
	Postgres bool
}

func (s SQLStore) q(query string) string {
	if !s.Postgres {
		return query
	}
	var b strings.Builder
	n := 0
	for _, r := range query {
		if r == '?' {
			n++
			b.WriteString("$" + strconv.Itoa(n))
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func (s SQLStore) Get(subject string) (*Record, error) {
	var r Record
	err := s.DB.QueryRow(s.q(`SELECT code_hash, salt, expires_at, attempts, last_sent_at FROM otp_codes WHERE subject = ?`), subject).
		Scan(&r.CodeHash, &r.Salt, &r.ExpiresAt, &r.Attempts, &r.LastSentAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &r, err
}

func (s SQLStore) Set(subject string, r Record) error {
	if _, err := s.DB.Exec(s.q(`DELETE FROM otp_codes WHERE subject = ?`), subject); err != nil {
		return err
	}
	_, err := s.DB.Exec(s.q(`INSERT INTO otp_codes (subject, code_hash, salt, expires_at, attempts, last_sent_at) VALUES (?, ?, ?, ?, ?, ?)`),
		subject, r.CodeHash, r.Salt, r.ExpiresAt.UTC(), r.Attempts, r.LastSentAt.UTC())
	return err
}

func (s SQLStore) Delete(subject string) error {
	_, err := s.DB.Exec(s.q(`DELETE FROM otp_codes WHERE subject = ?`), subject)
	return err
}
