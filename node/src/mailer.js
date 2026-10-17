import nodemailer from 'nodemailer';

// Sends any email by SMTP (Gmail by default): plain text, HTML, attachments, inline images, cc/bcc, reply-to.
// While SMTP_USER or SMTP_PASS is empty it runs in console mode: each email is printed in the terminal instead
// of sent, so an app can be built and tested before the credentials exist.
export function createMailer(smtp, { log = console.log } = {}) {
  const enabled = Boolean(smtp.user && smtp.pass);
  const transport = enabled
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      })
    : null;

  // msg: { to, subject, text?, html?, cc?, bcc?, replyTo?, attachments? }
  //   to/cc/bcc: an address, "Name <address>", or a list of them
  //   attachments: [{ filename, path } | { filename, content } | { filename, path, cid }]  (cid: inline image,
  //   shown in the HTML as <img src="cid:...">)
  async function send(msg) {
    if (!msg?.to) throw new Error('send: "to" is required');
    if (!msg.subject) throw new Error('send: "subject" is required');
    if (!msg.text && !msg.html) throw new Error('send: give "text", "html" or both');
    if (!enabled) {
      const files = (msg.attachments || []).map((a) => a.filename).join(', ');
      log(`[console mode] email to ${[].concat(msg.to).join(', ')}: "${msg.subject}"${files ? ` + ${files}` : ''}`);
      if (msg.text) log(msg.text);
      return { mode: 'console' };
    }
    // Gmail always sends from the logged-in address, so "from" is fixed to it; only the name is free.
    const info = await transport.sendMail({ ...msg, from: { name: msg.fromName || smtp.fromName, address: smtp.user } });
    return { mode: 'smtp', messageId: info.messageId };
  }

  // Logs in to the mail server without sending anything: the quickest check of the credentials.
  async function check() {
    if (!enabled) return { ok: false, error: 'SMTP_USER and SMTP_PASS are empty in .env' };
    try {
      await transport.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  return { enabled, send, check, fromName: smtp.fromName };
}
