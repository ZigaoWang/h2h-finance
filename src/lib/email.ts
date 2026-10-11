import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

type Mail = { to: string; subject: string; text: string; html: string };

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

export async function sendMail(mail: Mail) {
  if (!transport) {
    // Local development without SMTP: print the message instead of sending it.
    console.info(`\n[mail] To: ${mail.to}\n[mail] ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...mail });
}

const COPY = {
  en: {
    subject: (code: string) => `${code} is your H2H Finance sign-in code`,
    intro: "Use this code to sign in to H2H Finance:",
    expiry: "It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.",
  },
  zh: {
    subject: (code: string) => `H2H 财务登录验证码：${code}`,
    intro: "请使用以下验证码登录 H2H 财务：",
    expiry: "验证码 10 分钟内有效。如果不是你本人操作，请忽略此邮件。",
  },
};

export function signInCodeMail(to: string, code: string, locale: "en" | "zh"): Mail {
  const copy = COPY[locale];
  return {
    to,
    subject: copy.subject(code),
    text: `${copy.intro}\n\n${code}\n\n${copy.expiry}`,
    html: `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f6f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#18181b">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:32px">
    <p style="margin:0 0 24px;font-size:14px;font-weight:600">Heart to Heart · Finance</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">${copy.intro}</p>
    <p style="margin:0 0 24px;font-size:32px;font-weight:600;letter-spacing:6px;font-variant-numeric:tabular-nums">${code}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a">${copy.expiry}</p>
  </div>
</body></html>`,
  };
}
