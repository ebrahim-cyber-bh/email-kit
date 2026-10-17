// Ready email layouts. Each returns { subject, text, html } to spread into mailer.send({ to, ...mail }).
// All share one dark card design (from the Social Network OTP email); pass your own html instead when needed.

export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function card({ title, bodyHtml, footer = 'If you did not expect this email, you can ignore it.', logoCid }) {
  const logo = logoCid ? `<img src="cid:${escape(logoCid)}" alt="" height="40" style="display:block;margin:0 auto 12px;">` : '';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#002e28;padding:28px 40px;text-align:center;">${logo}
        <h1 style="margin:0;color:#00d1b2;font-size:20px;letter-spacing:1px;">${escape(title)}</h1>
      </td></tr>
      <tr><td style="padding:32px 40px;color:#d4d4d8;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
      <tr><td style="border-top:1px solid #27272a;padding:18px 40px;text-align:center;">
        <p style="color:#52525b;font-size:12px;margin:0;">${escape(footer)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// A normal message: a title, paragraphs, and an optional button.
//   messageEmail({ subject, title?, greeting?, paragraphs: [...], button?: { text, url }, footer?, logoCid? })
export function messageEmail({ subject, title = subject, greeting, paragraphs = [], button, footer, logoCid }) {
  const parts = [];
  if (greeting) parts.push(`<p style="margin:0 0 16px;">${escape(greeting)}</p>`);
  for (const p of paragraphs) parts.push(`<p style="margin:0 0 16px;">${escape(p)}</p>`);
  if (button) {
    parts.push(`<p style="margin:24px 0 8px;text-align:center;"><a href="${escape(button.url)}" style="display:inline-block;background:#00d1b2;color:#002e28;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:10px;">${escape(button.text)}</a></p>`);
  }
  const text = [greeting, ...paragraphs, button ? `${button.text}: ${button.url}` : null].filter(Boolean).join('\n\n');
  return { subject, text, html: card({ title, bodyHtml: parts.join(''), footer, logoCid }) };
}

// The one-time code email: large spaced digits and the expiry.
export function codeEmail({ appName = 'My App', name, code, ttlMinutes }) {
  const hi = name ? `Hi <strong style="color:#f4f4f5;">${escape(name)}</strong>, use` : 'Use';
  const bodyHtml = `<p style="margin:0 0 24px;text-align:center;color:#a1a1aa;">${hi} the code below to verify your email.</p>
        <div style="text-align:center;margin:0 0 24px;"><span style="display:inline-block;background:#09090b;border:2px solid #00d1b2;border-radius:12px;padding:20px 36px;font-size:40px;font-weight:900;letter-spacing:12px;color:#00d1b2;font-family:'Courier New',monospace;">${escape(code)}</span></div>
        <p style="margin:0;text-align:center;color:#71717a;font-size:13px;">This code expires in <strong style="color:#a1a1aa;">${ttlMinutes} minutes</strong>.</p>`;
  return {
    subject: `${code} is your ${appName} verification code`,
    text: `${name ? `Hi ${name},\n\n` : ''}Your ${appName} verification code is ${code}.\nIt expires in ${ttlMinutes} minutes.\n\nIf you did not ask for this, you can ignore this email.`,
    html: card({ title: `${appName} verification`, bodyHtml, footer: 'If you did not ask for this, you can ignore this email.' }),
  };
}
