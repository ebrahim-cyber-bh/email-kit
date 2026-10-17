// Checks the Gmail credentials in .env and sends one test email.
//
//	go run ./cmd/test-email                     a normal email to SMTP_USER (yourself)
//	go run ./cmd/test-email someone@x.y         a normal email to another address
//	go run ./cmd/test-email -otp [address]      a sample code email instead
package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/ebrahim-cyber-bh/email-kit/go/mail"
	"github.com/ebrahim-cyber-bh/email-kit/go/otp"
)

func main() {
	withOTP := flag.Bool("otp", false, "send a sample code email")
	flag.Parse()
	wd, _ := os.Getwd()
	mail.LoadDotEnv(wd)
	cfg := mail.FromEnv()
	m := mail.New(cfg)
	to := cfg.User
	if flag.NArg() > 0 {
		to = flag.Arg(0)
	}
	if !m.Enabled() {
		fail("SMTP_USER and SMTP_PASS are empty in .env. Fill them in first (see GUIDE.md).")
	}
	fmt.Printf("Logging in to %s:%d as %s ...\n", cfg.Host, cfg.Port, cfg.User)
	if err := m.Check(); err != nil {
		msg := "Login failed: " + err.Error()
		if strings.Contains(err.Error(), "535") {
			msg += "\nGmail refused the login. Use a 16-character App Password, not your normal password (GUIDE.md, step 2)."
		}
		fail(msg)
	}
	fmt.Println("Login OK.")
	var msg mail.Message
	if *withOTP {
		msg = mail.CodeEmail(cfg.FromName, "", otp.GenerateCode(cfg.OTPLength), cfg.OTPTTLMinutes)
	} else {
		msg = mail.MessageEmail(mail.Content{Subject: cfg.FromName + ": test email", Greeting: "Hello,",
			Paragraphs: []string{"This is a test email from the email kit. If you can read it, sending works."}})
	}
	msg.To = []string{to}
	if err := m.Send(msg); err != nil {
		fail("Sending failed: " + err.Error())
	}
	fmt.Printf("Test email sent to %s. Check the inbox, and the spam folder the first time.\n", to)
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}
