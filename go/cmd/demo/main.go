// The demo server: the same routes and page as the Node version (node/server.js).
//
//	POST /api/mail/send     a normal email   {to, subject, message, buttonText?, buttonUrl?}
//	POST /api/otp/send      a one-time code  {email, name?}
//	POST /api/otp/verify    check the code   {email, code}
//
// It listens on 127.0.0.1 only: /api/mail/send would let anyone send mail from your address if it were public.
// In a real app the OTP subject is the logged-in user's id and the email comes from the user record.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/ebrahim-cyber-bh/email-kit/go/mail"
	"github.com/ebrahim-cyber-bh/email-kit/go/otp"
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

var messages = map[string]string{
	otp.Missing: "No code was sent to this email, or it was already used. Send a new one.",
	otp.Expired: "The code has expired. Send a new one.",
	otp.TooMany: "Too many wrong codes. Send a new one.",
}

func main() {
	wd, _ := os.Getwd()
	envFile := mail.LoadDotEnv(wd)
	cfg := mail.FromEnv()
	m := mail.New(cfg)
	codes := otp.New(otp.NewMemoryStore(), m, otp.FromConfig(cfg))
	mode := map[bool]string{true: "smtp", false: "console"}[m.Enabled()]

	reply := func(w http.ResponseWriter, status int, body map[string]any) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(body)
	}
	read := func(r *http.Request) map[string]string {
		body := map[string]string{}
		json.NewDecoder(r.Body).Decode(&body)
		for k, v := range body {
			body[k] = strings.TrimSpace(v)
		}
		return body
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/mail/send", func(w http.ResponseWriter, r *http.Request) {
		b := read(r)
		if !emailRe.MatchString(b["to"]) || b["subject"] == "" || b["message"] == "" {
			reply(w, 400, map[string]any{"success": false, "message": `A valid "to", a subject and a message are required.`})
			return
		}
		c := mail.Content{Subject: b["subject"], Paragraphs: regexp.MustCompile(`\n\s*\n`).Split(b["message"], -1)}
		if b["buttonText"] != "" && b["buttonUrl"] != "" {
			c.Button = &mail.Button{Text: b["buttonText"], URL: b["buttonUrl"]}
		}
		msg := mail.MessageEmail(c)
		msg.To = []string{b["to"]}
		if err := m.Send(msg); err != nil {
			reply(w, 502, map[string]any{"success": false, "message": "The email could not be sent: " + err.Error()})
			return
		}
		reply(w, 200, map[string]any{"success": true, "mode": mode, "message": "Email sent to " + b["to"]})
	})
	mux.HandleFunc("POST /api/otp/send", func(w http.ResponseWriter, r *http.Request) {
		b := read(r)
		email := strings.ToLower(b["email"])
		if !emailRe.MatchString(email) {
			reply(w, 400, map[string]any{"success": false, "message": "Enter a valid email address."})
			return
		}
		res, err := codes.Send(email, email, b["name"])
		if err != nil {
			reply(w, 502, map[string]any{"success": false, "message": "The email could not be sent: " + err.Error()})
			return
		}
		if !res.OK {
			reply(w, 429, map[string]any{"success": false, "retryAfter": res.RetryAfter, "message": fmt.Sprintf("Wait %d s before asking for another code.", res.RetryAfter)})
			return
		}
		reply(w, 200, map[string]any{"success": true, "mode": mode, "message": "Verification code sent to " + email})
	})
	mux.HandleFunc("POST /api/otp/verify", func(w http.ResponseWriter, r *http.Request) {
		b := read(r)
		email := strings.ToLower(b["email"])
		if email == "" || b["code"] == "" {
			reply(w, 400, map[string]any{"success": false, "message": "Email and code are required."})
			return
		}
		res, err := codes.Verify(email, b["code"])
		if err != nil {
			reply(w, 500, map[string]any{"success": false, "message": "Verification error"})
			return
		}
		if res.OK {
			reply(w, 200, map[string]any{"success": true, "message": "Email verified!"})
			return
		}
		msg := messages[res.Reason]
		if res.Reason == otp.Wrong {
			msg = fmt.Sprintf("Wrong code. %d attempt(s) left.", res.AttemptsLeft)
		}
		reply(w, 400, map[string]any{"success": false, "reason": res.Reason, "message": msg})
	})

	// the demo page is shared with the Node version
	root := wd
	if envFile != "" {
		root = filepath.Dir(envFile)
	} else if filepath.Base(wd) == "go" {
		root = filepath.Dir(wd)
	}
	mux.Handle("/", http.FileServer(http.Dir(filepath.Join(root, "node", "public"))))

	addr := fmt.Sprintf("127.0.0.1:%d", cfg.ServerPort)
	log.Printf("Email kit demo (Go) on http://%s", addr)
	if m.Enabled() {
		log.Printf("Sending real emails from %s through %s:%d", cfg.User, cfg.Host, cfg.Port)
	} else {
		log.Print("Console mode: emails and codes are printed here. Fill SMTP_USER and SMTP_PASS in .env to send real emails.")
	}
	log.Fatal(http.ListenAndServe(addr, mux))
}
