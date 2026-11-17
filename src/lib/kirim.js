// Pengiriman gratis: email via Brevo (300/hari), WhatsApp via Fonnte (free plan 1.000 pesan/bulan).
const batas = () => ({ signal: AbortSignal.timeout(8000) });

export const normHp = (v) => {
  let n = String(v || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  return /^62\d{8,13}$/.test(n) ? n : null;
};

export async function kirimEmail(to, subjek, teks) {
  const key = process.env.BREVO_API_KEY, dari = process.env.EMAIL_PENGIRIM;
  if (!key || !dari) return false;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #F0DEB0;background:#FFF8E6;border-radius:12px"><h2 style="margin:0 0 12px;color:#B8500A">LapaKWU</h2><p style="font-size:15px;line-height:1.5;color:#22313F">${String(teks).replace(/\n/g, '<br>')}</p></div>`;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json' }, ...batas(),
      body: JSON.stringify({ sender: { name: 'LapaKWU', email: dari }, to: [{ email: to }], subject: subjek, htmlContent: html }),
    });
    return r.ok;
  } catch { return false; }
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
