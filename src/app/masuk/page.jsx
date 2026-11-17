'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { account, ID, api } from '@/lib/aw';

export default function Masuk() {
  const r = useRouter();
  const [mode, setMode] = useState('masuk');
  const [f, setF] = useState({ peran: 'pembeli', kanal: 'EMAIL' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (new URLSearchParams(location.search).get('daftar') === 'mitra') { setMode('daftar'); setF((x) => ({ ...x, peran: 'mitra' })); }
  }, []);

  const kirim = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      if (mode === 'daftar') {
        await account.create({ userId: ID.unique(), email: f.email, password: f.password, name: f.nama });
        await account.createEmailPasswordSession({ email: f.email, password: f.password });
        await api('/api/profil', { aksi: 'daftar', peran: f.peran, kanal: f.kanal, no_telepon: f.telp, alamat: f.alamat, nama_usaha: f.usaha });
        location.href = '/verifikasi?kirim=1';
      } else {
        await account.createEmailPasswordSession({ email: f.email, password: f.password });
        location.href = '/';
      }
    } catch (er) { setMsg(er.message); setBusy(false); }
  };

  const mitra = f.peran === 'mitra';
  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <h2>{mode === 'masuk' ? 'Masuk ke LapaKWU' : mitra ? 'Buka lapak di LapaKWU' : 'Buat akun LapaKWU'}</h2>
      <div className="tabs">
        <button className={'chip' + (mode === 'masuk' ? ' on' : '')} onClick={() => setMode('masuk')}>Masuk</button>
        <button className={'chip' + (mode === 'daftar' ? ' on' : '')} onClick={() => setMode('daftar')}>Daftar</button>
      </div>
      <form className="card pad" onSubmit={kirim}>
        {mode === 'daftar' && <>
          <div className="field"><label htmlFor="n">Nama lengkap</label><input id="n" required onChange={set('nama')} /></div>
          <div className="field"><label htmlFor="r">Daftar sebagai</label>
            <select id="r" value={f.peran} onChange={set('peran')}><option value="pembeli">Pembeli</option><option value="mitra">Mitra (penjual)</option></select></div>
          {mitra && <div className="field"><label htmlFor="u">Nama usaha</label><input id="u" required onChange={set('usaha')} /></div>}
          <div className="field"><label htmlFor="a">{mitra ? 'Alamat lapak (lokasi pengambilan)' : 'Alamat pengiriman'}</label><input id="a" required onChange={set('alamat')} /></div>
        </>}
        <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required onChange={set('email')} /></div>
        <div className="field"><label htmlFor="p">Kata sandi (min. 8 karakter)</label><input id="p" type="password" minLength={8} required onChange={set('password')} /></div>
        {mode === 'daftar' && <>
          <fieldset className="field"><legend>Verifikasi akun lewat</legend>
            <div className="opsi">
              {[['EMAIL', 'Email', 'Kode dikirim ke emailmu'], ['WHATSAPP', 'WhatsApp', 'Kode dikirim ke nomor WA']].map(([v, t, d]) => (
                <label key={v}><input type="radio" name="kanal" value={v} checked={f.kanal === v} onChange={set('kanal')} /><b>{t}</b><small className="muted">{d}</small></label>
              ))}
            </div></fieldset>
          <div className="field"><label htmlFor="t">{f.kanal === 'WHATSAPP' ? 'Nomor WhatsApp' : 'No. telepon (opsional)'}</label>
            <input id="t" type="tel" inputMode="tel" placeholder="0812xxxxxxxx" required={f.kanal === 'WHATSAPP'} onChange={set('telp')} /></div>
          <p className="muted"><small>{mitra ? 'Pesanan baru akan diberitahukan lewat kanal yang kamu pilih. ' : ''}Kamu hanya perlu memverifikasi lewat salah satu.</small></p>
        </>}
        <button className="btn lg" disabled={busy}>{busy ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Buat akun dan kirim kode'}</button>
        {msg && <p className="msg err" role="alert">{msg}</p>}
      </form>
      {mode === 'daftar' && mitra && <p className="muted" style={{ marginTop: 12 }}>Akun mitra bisa berjualan setelah kodenya terverifikasi dan datanya disetujui admin.</p>}
    </main>
  );
}
