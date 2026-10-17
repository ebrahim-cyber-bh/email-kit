// Package otp is the optional part of the kit: one-time codes. Use only what the case needs:
//
//	otp.GenerateCode(6)   just a random code (you store, send and check it yourself)
//	otp.New(...)          the whole flow: email a code, keep only its hash, verify it once
package otp

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ebrahim-cyber-bh/email-kit/go/mail"
)

// GenerateCode returns a random code of n digits, keeping leading zeros. crypto/rand is uniform and
// unpredictable (math/rand, used in the original Social Network code, is neither).
func GenerateCode(n int) string {
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil)
	v, err := rand.Int(rand.Reader, max)
	if err != nil {
		panic(err) // the system's random source failed: nothing safe to fall back to
	}
	return fmt.Sprintf("%0*s", n, v.String())
}

// Record is what a Store keeps per subject (a user id or an email). The code itself is never stored.
type Record struct {
	CodeHash   string
	Salt       string
	ExpiresAt  time.Time
	Attempts   int
	LastSentAt time.Time
}

// Store keeps one Record per subject. Get returns (nil, nil) when there is none.
type Store interface {
	Get(subject string) (*Record, error)
	Set(subject string, r Record) error
	Delete(subject string) error
}

// Sender is what the flow needs from a mailer; *mail.Mailer is one.
type Sender interface {
	Send(mail.Message) error
	FromName() string
}

type Options struct {
	Length      int // default 6
	TTL         time.Duration
	MaxAttempts int
	ResendAfter time.Duration
	Now         func() time.Time // for tests
}

type Service struct {
	store  Store
	sender Sender
	opt    Options
}

// FromConfig turns the OTP_* settings of .env into Options.
func FromConfig(c mail.Config) Options {
	return Options{Length: c.OTPLength, TTL: time.Duration(c.OTPTTLMinutes) * time.Minute,
		MaxAttempts: c.OTPMaxAttempts, ResendAfter: time.Duration(c.OTPResendSeconds) * time.Second}
}

func New(store Store, sender Sender, opt Options) *Service {
	if opt.Length == 0 {
		opt.Length = 6
	}
	if opt.TTL == 0 {
		opt.TTL = 10 * time.Minute
	}
	if opt.MaxAttempts == 0 {
		opt.MaxAttempts = 5
	}
	if opt.ResendAfter == 0 {
		opt.ResendAfter = time.Minute
	}
	if opt.Now == nil {
		opt.Now = time.Now
	}
	return &Service{store: store, sender: sender, opt: opt}
}

// Why a send or a verify did not go through.
const (
	Cooldown = "cooldown" // send: a code was sent too recently
	Missing  = "missing"  // verify: no code, or it was already used
	Expired  = "expired"
	TooMany  = "too_many"
	Wrong    = "wrong"
)

type Result struct {
	OK           bool
	Reason       string
	RetryAfter   int // seconds, with Cooldown
	AttemptsLeft int // with Wrong
}

func hash(code, salt string) string {
	sum := sha256.Sum256([]byte(salt + code))
	return hex.EncodeToString(sum[:])
}

// Send emails a new code to email for subject, replacing any earlier code.
func (s *Service) Send(subject, email, name string) (Result, error) {
	now := s.opt.Now()
	old, err := s.store.Get(subject)
	if err != nil {
		return Result{}, err
	}
	if old != nil {
		if wait := old.LastSentAt.Add(s.opt.ResendAfter).Sub(now); wait > 0 {
			return Result{Reason: Cooldown, RetryAfter: int((wait + time.Second - 1) / time.Second)}, nil
		}
	}
	code := GenerateCode(s.opt.Length)
	saltBytes := make([]byte, 16)
	rand.Read(saltBytes)
	salt := hex.EncodeToString(saltBytes)
	rec := Record{CodeHash: hash(code, salt), Salt: salt, ExpiresAt: now.Add(s.opt.TTL), LastSentAt: now}
	if err := s.store.Set(subject, rec); err != nil {
		return Result{}, err
	}
	msg := mail.CodeEmail(s.sender.FromName(), name, code, int(s.opt.TTL/time.Minute))
	msg.To = []string{email}
	if err := s.sender.Send(msg); err != nil {
		s.store.Delete(subject) // nobody got the code, so do not block a retry with the cooldown
		return Result{}, err
	}
	return Result{OK: true}, nil
}

// Verify checks code for subject. A right code is deleted, so it works once only.
func (s *Service) Verify(subject, code string) (Result, error) {
	rec, err := s.store.Get(subject)
	if err != nil || rec == nil {
		return Result{Reason: Missing}, err
	}
	if s.opt.Now().After(rec.ExpiresAt) {
		return Result{Reason: Expired}, s.store.Delete(subject)
	}
	if rec.Attempts >= s.opt.MaxAttempts {
		return Result{Reason: TooMany}, s.store.Delete(subject)
	}
	if subtle.ConstantTimeCompare([]byte(hash(strings.TrimSpace(code), rec.Salt)), []byte(rec.CodeHash)) == 1 {
		return Result{OK: true}, s.store.Delete(subject)
	}
	rec.Attempts++
	if rec.Attempts >= s.opt.MaxAttempts {
		return Result{Reason: TooMany}, s.store.Delete(subject)
	}
	return Result{Reason: Wrong, AttemptsLeft: s.opt.MaxAttempts - rec.Attempts}, s.store.Set(subject, *rec)
}
