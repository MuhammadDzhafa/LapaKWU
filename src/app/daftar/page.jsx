'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { account, ID, api } from '@/lib/aw';

// Untuk menjadi Mitra, user harus melalui alur khusus via /mitra/tata-cara (lihat Task 6)

const EyeIcon = ({ show }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {show
      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
    }
  </svg>
);

export default function Daftar() {
  const r = useRouter();
  const [f, setF] = useState({ email: '', password: '', nama: '', telp: '', kanal: 'EMAIL' });
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const nameRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lapakwu_prefill');
      if (raw) {
        const { email, dariLogin } = JSON.parse(raw);
        setF((x) => ({ ...x, email: email || '' }));
        if (dariLogin) {
          setInfo('Email belum terdaftar. Silakan lengkapi nama untuk menyelesaikan pendaftaran akun barumu.');
        }
        sessionStorage.removeItem('lapakwu_prefill');
        setTimeout(() => nameRef.current?.focus(), 150);
      }
    } catch {}
  }, []);

  const kirim = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await account.create({ userId: ID.unique(), email: f.email, password: f.password, name: f.nama });
      // Always register as pembeli
      await api('/api/profil', { aksi: 'daftar', peran: 'pembeli', kanal: f.kanal, no_telepon: f.telp });

      // Check checkout intent
      const intent = sessionStorage.getItem('lapakwu_checkout_intent');
      if (intent) {
        const { productId, quantity } = JSON.parse(intent);
        sessionStorage.removeItem('lapakwu_checkout_intent');
        location.href = `/checkout?beli=${productId}&jml=${quantity}`;
        return;
      }

      location.href = '/verifikasi?kirim=1';
    } catch (er) {
      setMsg(er.message || 'Pendaftaran gagal. Coba lagi.');
      setBusy(false);
    }
  };

  return (
    <main className="wrap auth" style={{ maxWidth: 520 }}>
      <h2>Buat akun LapaKWU</h2>
      {info && (
        <div style={{ background: 'var(--tint)', border: '1.5px solid var(--or)', borderRadius: '16px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.25rem' }}>👋</span>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink)', fontWeight: 600 }}>{info}</p>
        </div>
      )}
      <form className="card pad" onSubmit={kirim}>
        <div className="field">
          <label htmlFor="n">Nama lengkap</label>
          <input ref={nameRef} id="n" required autoComplete="name" maxLength={100} value={f.nama} onChange={set('nama')} />
        </div>
        <div className="field">
          <label htmlFor="e">Email</label>
          <input id="e" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </div>
        <div className="field" style={{ position: 'relative' }}>
          <label htmlFor="p">Kata sandi (min. 8 karakter)</label>
          <input
            id="p"
            type={showPass ? 'text' : 'password'}
            minLength={8}
            required
            autoComplete="new-password"
            style={{ paddingRight: 44 }}
            value={f.password}
            onChange={set('password')}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5E6A75', paddingTop: 22 }}
            aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            <EyeIcon show={showPass} />
          </button>
        </div>
        <fieldset className="field">
          <legend>Verifikasi akun lewat</legend>
          <div className="opsi">
            {[['EMAIL', 'Email', 'Kode dikirim ke emailmu'], ['WHATSAPP', 'WhatsApp', 'Kode dikirim ke nomor WA']].map(([v, t, d]) => (
              <label key={v}>
                <input type="radio" name="kanal" value={v} checked={f.kanal === v} onChange={set('kanal')} />
                <b>{t}</b><small className="muted">{d}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="t">{f.kanal === 'WHATSAPP' ? 'Nomor WhatsApp' : 'No. telepon (opsional)'}</label>
          <input id="t" type="tel" inputMode="tel" placeholder="0812xxxxxxxx" required={f.kanal === 'WHATSAPP'} value={f.telp} onChange={set('telp')} />
        </div>
        <p className="muted"><small>Kamu hanya perlu memverifikasi lewat salah satu.</small></p>
        <button className="btn lg" disabled={busy}>{busy ? 'Memproses…' : 'Buat akun dan kirim kode'}</button>
        {msg && <p className="msg err" role="alert">{msg}</p>}
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Sudah punya akun?{' '}
        <Link href="/masuk">Masuk di sini</Link>
      </p>
    </main>
  );
}
