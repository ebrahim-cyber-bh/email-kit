// Package mail sends any email by SMTP (Gmail by default): text, HTML, attachments, inline images, cc/bcc.
// While SMTP_USER or SMTP_PASS is empty it runs in console mode and prints each email instead of sending it.
package mail

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config holds the settings from .env (see .env.example at the repo root).
type Config struct {
	Host     string
	Port     int
	Secure   bool // true: SSL from the start (port 465); false: STARTTLS (port 587)
	User     string
	Pass     string
	FromName string

	OTPLength        int
	OTPTTLMinutes    int
	OTPMaxAttempts   int
	OTPResendSeconds int
	ServerPort       int // demo server port (PORT)
}

// LoadDotEnv reads KEY=VALUE lines into the environment, without overriding variables already set.
// It looks for .env in dir and its parents, so the Go and Node versions share the repo root's .env.
func LoadDotEnv(dir string) string {
	for d := dir; ; d = filepath.Dir(d) {
		path := filepath.Join(d, ".env")
		if f, err := os.Open(path); err == nil {
			defer f.Close()
			sc := bufio.NewScanner(f)
			for sc.Scan() {
				line := strings.TrimSpace(sc.Text())
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				k, v, ok := strings.Cut(line, "=")
				if !ok {
					continue
				}
				k, v = strings.TrimSpace(k), strings.TrimSpace(v)
				if len(v) >= 2 && (v[0] == '"' || v[0] == '\'') && strings.IndexByte(v[1:], v[0]) >= 0 {
					v = v[1 : 1+strings.IndexByte(v[1:], v[0])] // quoted: keep everything inside the quotes
				} else if i := strings.Index(v, " #"); i >= 0 {
					v = strings.TrimSpace(v[:i]) // unquoted: a " #" starts a comment, as in Node's dotenv
				} else if strings.HasPrefix(v, "#") {
					v = ""
				}
				if _, set := os.LookupEnv(k); !set {
					os.Setenv(k, v)
				}
			}
			return path
		}
		if filepath.Dir(d) == d {
			return ""
		}
	}
}

// FromEnv builds a Config from the environment, with Gmail defaults.
func FromEnv() Config {
	num := func(name string, fallback int) int {
		if n, err := strconv.Atoi(os.Getenv(name)); err == nil && n > 0 {
			return n
		}
		return fallback
	}
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		host = "smtp.gmail.com"
	}
	from := os.Getenv("MAIL_FROM_NAME")
	if from == "" {
		from = "My App"
	}
	return Config{
		Host:     host,
		Port:     num("SMTP_PORT", 587),
		Secure:   os.Getenv("SMTP_SECURE") == "true",
		User:     os.Getenv("SMTP_USER"),
		Pass:     strings.Join(strings.Fields(os.Getenv("SMTP_PASS")), ""), // Google shows app passwords as "abcd efgh ijkl mnop"
		FromName: from,

		OTPLength:        num("OTP_LENGTH", 6),
		OTPTTLMinutes:    num("OTP_TTL_MINUTES", 10),
		OTPMaxAttempts:   num("OTP_MAX_ATTEMPTS", 5),
		OTPResendSeconds: num("OTP_RESEND_SECONDS", 60),
		ServerPort:       num("PORT", 4600),
	}
}
