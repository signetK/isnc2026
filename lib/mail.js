// Sends email through Gmail (SMTP with an App Password).
// Vercel settings: SMTP_USER = the Gmail address, SMTP_PASS = its 16-letter App Password, MAIL_FROM_NAME (optional).
import nodemailer from 'nodemailer';
import { writeFile, mkdir } from 'node:fs/promises';

let transport = null;
function getTransport() {
  if (transport) return transport;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Email is not set up yet. Add SMTP_USER and SMTP_PASS in Vercel.');
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: true,
    auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS).replace(/\s+/g, '') },
  });
  return transport;
}
export const mailReady = () => Boolean(process.env.MAIL_CAPTURE_DIR || (process.env.SMTP_USER && process.env.SMTP_PASS));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** One email in the site's green-and-gold style. `lines` are plain paragraphs; `button` is {text, url}. */
function layout({ heading, lines, button, footer }) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7f3;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9e1d9;border-radius:8px;overflow:hidden">
    <div style="background:#0b5a2a;color:#fff;padding:16px 20px;border-bottom:4px solid #f2b705">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#f2b705">Mariano Marcos State University · College of Medicine</div>
      <div style="font-size:18px;font-weight:bold;margin-top:4px">ISNC 2026 Paper Evaluation</div>
    </div>
    <div style="padding:20px;color:#17231b;font-size:15px;line-height:1.5">
      <h2 style="font-size:19px;margin:0 0 12px">${esc(heading)}</h2>
      ${lines.map(l => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}
      ${button ? `<p style="margin:20px 0"><a href="${esc(button.url)}" style="background:#0b5a2a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;display:inline-block">${esc(button.text)}</a></p>
      <p style="font-size:12px;color:#5b6b60;margin:0">If the button doesn't work, copy this link: ${esc(button.url)}</p>` : ''}
      ${footer ? `<p style="font-size:12px;color:#5b6b60;margin:16px 0 0">${esc(footer)}</p>` : ''}
    </div>
  </div></div>`;
}

export async function sendMail({ to, subject, heading, lines, button, footer, attachments }) {
  const msg = {
    from: `"${process.env.MAIL_FROM_NAME || 'ISNC 2026 Evaluation'}" <${process.env.SMTP_USER || 'test@localhost'}>`,
    to, subject, html: layout({ heading, lines, button, footer }),
    text: [heading, ...lines, button ? `${button.text}: ${button.url}` : '', footer || ''].filter(Boolean).join('\n\n'),
    attachments,
  };
  // Local testing only: write the email to a folder instead of sending it.
  if (process.env.MAIL_CAPTURE_DIR) {
    await mkdir(process.env.MAIL_CAPTURE_DIR, { recursive: true });
    const f = `${process.env.MAIL_CAPTURE_DIR}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`;
    await writeFile(f, JSON.stringify({ ...msg, attachments: (attachments || []).map(a => ({ filename: a.filename, base64: Buffer.from(a.content).toString('base64') })) }, null, 1));
    return;
  }
  await getTransport().sendMail(msg);
}
