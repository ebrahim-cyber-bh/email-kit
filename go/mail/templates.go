package mail

import (
	"fmt"
	"html/template"
	"strings"
)

// Ready email layouts. Each fills Subject, Text and HTML of a Message; set To (and anything else) yourself:
//
//	msg := mail.MessageEmail(mail.Content{Subject: "Welcome", Paragraphs: []string{"..."}})
//	msg.To = []string{"someone@example.com"}
//	err := mailer.Send(msg)
//
// All share one dark card design (from the Social Network OTP email). html/template escapes every value.

type Button struct{ Text, URL string }

type Content struct {
	Subject    string
	Title      string // defaults to Subject
	Greeting   string
	Paragraphs []string
	Button     *Button
	Footer     string // defaults to "If you did not expect this email, you can ignore it."
	LogoCID    string // an inline image attachment's CID, shown above the title
}

var cardTmpl = template.Must(template.New("card").Parse(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#002e28;padding:28px 40px;text-align:center;">{{if .LogoCID}}<img src="cid:{{.LogoCID}}" alt="" height="40" style="display:block;margin:0 auto 12px;">{{end}}
        <h1 style="margin:0;color:#00d1b2;font-size:20px;letter-spacing:1px;">{{.Title}}</h1>
      </td></tr>
      <tr><td style="padding:32px 40px;color:#d4d4d8;font-size:15px;line-height:1.6;">
        {{if .Code}}<p style="margin:0 0 24px;text-align:center;color:#a1a1aa;">{{if .Name}}Hi <strong style="color:#f4f4f5;">{{.Name}}</strong>, use{{else}}Use{{end}} the code below to verify your email.</p>
        <div style="text-align:center;margin:0 0 24px;"><span style="display:inline-block;background:#09090b;border:2px solid #00d1b2;border-radius:12px;padding:20px 36px;font-size:40px;font-weight:900;letter-spacing:12px;color:#00d1b2;font-family:'Courier New',monospace;">{{.Code}}</span></div>
        <p style="margin:0;text-align:center;color:#71717a;font-size:13px;">This code expires in <strong style="color:#a1a1aa;">{{.TTL}} minutes</strong>.</p>
        {{else}}{{if .Greeting}}<p style="margin:0 0 16px;">{{.Greeting}}</p>{{end}}{{range .Paragraphs}}<p style="margin:0 0 16px;">{{.}}</p>{{end}}
        {{with .Button}}<p style="margin:24px 0 8px;text-align:center;"><a href="{{.URL}}" style="display:inline-block;background:#00d1b2;color:#002e28;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:10px;">{{.Text}}</a></p>{{end}}{{end}}
      </td></tr>
      <tr><td style="border-top:1px solid #27272a;padding:18px 40px;text-align:center;">
        <p style="color:#52525b;font-size:12px;margin:0;">{{.Footer}}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`))

type cardData struct {
	Content
	Code, Name string
	TTL        int
}

func render(d cardData) string {
	if d.Title == "" {
		d.Title = d.Subject
	}
	if d.Footer == "" {
		d.Footer = "If you did not expect this email, you can ignore it."
	}
	var b strings.Builder
	cardTmpl.Execute(&b, d)
	return b.String()
}

// MessageEmail is a normal message: a title, paragraphs and an optional button.
func MessageEmail(c Content) Message {
	parts := []string{}
	if c.Greeting != "" {
		parts = append(parts, c.Greeting)
	}
	parts = append(parts, c.Paragraphs...)
	if c.Button != nil {
		parts = append(parts, c.Button.Text+": "+c.Button.URL)
	}
	return Message{Subject: c.Subject, Text: strings.Join(parts, "\n\n"), HTML: render(cardData{Content: c})}
}

// CodeEmail is the one-time code email: large spaced digits and the expiry.
func CodeEmail(appName, name, code string, ttlMinutes int) Message {
	text := fmt.Sprintf("Your %s verification code is %s.\nIt expires in %d minutes.\n\nIf you did not ask for this, you can ignore this email.", appName, code, ttlMinutes)
	if name != "" {
		text = "Hi " + name + ",\n\n" + text
	}
	c := Content{Subject: fmt.Sprintf("%s is your %s verification code", code, appName), Title: appName + " verification",
		Footer: "If you did not ask for this, you can ignore this email."}
	return Message{Subject: c.Subject, Text: text, HTML: render(cardData{Content: c, Code: code, Name: name, TTL: ttlMinutes})}
}
