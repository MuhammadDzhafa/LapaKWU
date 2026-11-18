'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function Verifikasi() {
  const { akun, pengguna, peran, memuat, muat } = useSaya();
  const [kode, setKode] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [msg, setMsg] = useState({ t: '', k: '' });
  const [tunggu, setTunggu] = useState(0);
  const [busy, setBusy] = useState(false);
  const otomatis = useRef(false);
  const wa = pengguna?.kanal === 'WHATSAPP';

  const kirim = async () => {
    setBusy(true); setMsg({ t: '', k: '' });
    try {
      const d = await api('/api/verifikasi', { aksi: 'kirim' });
      setTujuan(d.tujuan || '');
      if (d.bantuan) {
        setKode(d.bantuan);
        setMsg({ t: d.pesan || `Kode pengujian: ${d.bantuan}`, k: 'ok' });
      } else {
        setMsg({ t: 'Kode terkirim. Berlaku 10 menit.', k: 'ok' });
      }
      setTunggu(60);
    }
    catch (e) { setMsg({ t: e.message, k: 'err' }); }
    setBusy(false);
  };
  useEffect(() => {
    if (pengguna && !pengguna.kontak_terverifikasi && !otomatis.current && new URLSearchParams(location.search).get('kirim')) { otomatis.current = true; kirim(); }
  }, [pengguna]);
  useEffect(() => { if (tunggu > 0) { const t = setTimeout(() => setTunggu(tunggu - 1), 1000); return () => clearTimeout(t); } }, [tunggu]);

  const cek = async (e) => {
    e.preventDefault(); setBusy(true); setMsg({ t: '', k: '' });
    try { await api('/api/verifikasi', { aksi: 'cek', kode }); await muat(); setMsg({ t: 'Akunmu terverifikasi.', k: 'ok' }); }
    catch (er) { setMsg({ t: er.message, k: 'err' }); }
    setBusy(false);
  };

  if (memuat) return <main className="wrap" />;
  if (!akun) return <main className="wrap"><p className="kosong"><Link className="link" href="/masuk">Masuk</Link> dulu untuk memverifikasi akun.</p></main>;
  if (pengguna?.kontak_terverifikasi) return (
    <main className="wrap" style={{ maxWidth: 560 }}><h2>Akun terverifikasi</h2>
      <p className="msg ok">{peran === 'mitra' ? 'Tinggal menunggu persetujuan admin sebelum kamu bisa menambah produk.' : 'Akunmu sudah aktif dan siap dipakai belanja.'}</p>
      <Link className="btn" href={peran === 'mitra' ? '/mitra' : '/'}>{peran === 'mitra' ? 'Ke lapak saya' : 'Mulai belanja'}</Link></main>);
  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <h2>Verifikasi lewat {wa ? 'WhatsApp' : 'email'}</h2>
      <p className="muted">{tujuan ? `Kami mengirim kode 6 digit ke ${tujuan}.` : `Kami akan mengirim kode 6 digit ke ${wa ? 'nomor WhatsApp' : 'email'}-mu.`}</p>
      <form className="card pad" onSubmit={cek}>
        <div className="field"><label htmlFor="k">Kode verifikasi</label>
          <input id="k" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••" value={kode} onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))} /></div>
        <div className="row">
          <button className="btn" disabled={busy || kode.length !== 6}>Verifikasi</button>
          <button type="button" className="btn out" disabled={busy || tunggu > 0} onClick={kirim}>{tunggu > 0 ? `Kirim ulang (${tunggu} dtk)` : tujuan ? 'Kirim ulang kode' : 'Kirim kode'}</button>
        </div>
        {msg.t && <p className={'msg ' + msg.k} role="status">{msg.t}</p>}
      </form>
    </main>
  );
}
