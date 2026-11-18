// Email via Nodemailer (SMTP Gmail) — gratis.
// WhatsApp via Fonnte (free plan 1.000 pesan/bulan).
// PENTING: Gunakan process.env.EMAIL_USER dan process.env.EMAIL_PASS. Jangan hardcode!
import nodemailer from 'nodemailer';

const batas = () => ({ signal: AbortSignal.timeout(8000) });

export const normHp = (v) => {
  let n = String(v || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  return /^62\d{8,13}$/.test(n) ? n : null;
};

// Singleton nodemailer transporter untuk SMTP Gmail
let _transporter = null;
export function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : null;
  if (!user || !pass) return null;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass, // App Password Gmail (16 digit)
    },
  });
  return _transporter;
}

export async function kirimEmail(to, subjek, teks) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[kirimEmail] EMAIL_USER atau EMAIL_PASS belum diset di .env');
    return false;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #F0DEB0;background:#FFF8E6;border-radius:12px"><h2 style="margin:0 0 12px;color:#B8500A">LapaKWU</h2><p style="font-size:15px;line-height:1.5;color:#22313F">${String(teks).replace(/\n/g, '<br>')}</p></div>`;
  try {
    await transporter.sendMail({
      from: `"LapaKWU" <${process.env.EMAIL_USER}>`,
      to,
      subject: subjek,
      text: teks,
      html,
    });
    return true;
  } catch (e) {
    console.error('[kirimEmail] Nodemailer error:', e?.message || e);
    return false;
  }
}

export async function sendResetPasswordEmail(to, resetUrl) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[sendResetPasswordEmail] EMAIL_USER atau EMAIL_PASS belum diset di .env');
    return false;
  }
  const subjek = 'Reset Kata Sandi Akun LapaKWU';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;border:1px solid #F0DEB0;background:#FFF8E6;border-radius:14px;color:#22313F">
      <h2 style="margin:0 0 16px;color:#B8500A">LapaKWU</h2>
      <p style="font-size:15px;line-height:1.6">Halo,</p>
      <p style="font-size:15px;line-height:1.6">Kami menerima permintaan untuk mereset kata sandi akun LapaKWU kamu. Klik tombol di bawah ini untuk membuat kata sandi baru:</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" style="background:#FF933E;color:#22313F;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:99px;display:inline-block;box-shadow:0 4px 12px rgba(184,80,10,0.3)">
          Reset Kata Sandi
        </a>
      </div>
      <p style="font-size:13px;line-height:1.5;color:#5E6A75">Atau salin tautan berikut ke browsermu:<br><a href="${resetUrl}" style="color:#2D5F86;word-break:break-all">${resetUrl}</a></p>
      <p style="font-size:13px;line-height:1.5;color:#5E6A75;margin-top:20px">Tautan ini berlaku selama 1 jam. Jika kamu tidak merasa meminta reset kata sandi, silakan abaikan email ini.</p>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: `"LapaKWU" <${process.env.EMAIL_USER}>`,
      to,
      subject: subjek,
      text: `Reset kata sandi LapaKWU kamu di: ${resetUrl}`,
      html,
    });
    return true;
  } catch (e) {
    console.error('[sendResetPasswordEmail] Nodemailer error:', e?.message || e);
    return false;
  }
}

export async function kirimWA(nomor, pesan) {
  const token = process.env.FONNTE_TOKEN;
  if (!token || !nomor) return false;
  try {
    const r = await fetch('https://api.fonnte.com/send', {
      method: 'POST', headers: { Authorization: token }, ...batas(),
      body: new URLSearchParams({ target: nomor, message: pesan, countryCode: '62' }),
    });
    const d = await r.json().catch(() => ({}));
    return r.ok && d.status !== false;
  } catch { return false; }
}

// Kabari pengguna lewat kanal yang ia pilih saat mendaftar (EMAIL atau WHATSAPP).
export const kabari = (pg, judul, pesan) =>
  pg.kanal === 'WHATSAPP' ? kirimWA(pg.no_telepon, `*${judul}*\n${pesan}\n\n_LapaKWU_`) : kirimEmail(pg.email, judul, pesan);
