'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function LupaSandi() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState({ t: '', k: '' });
  const [busy, setBusy] = useState(false);
  const [terkirim, setTerkirim] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ t: '', k: '' });
    try {
      const r = await fetch('/api/lupa-sandi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengirim email reset.');
      setTerkirim(true);
    } catch (er) {
      setMsg({ t: er.message, k: 'err' });
    }
    setBusy(false);
  };

  if (terkirim) {
    return (
      <main className="wrap auth" style={{ maxWidth: 480 }}>
        <h2>Email Terkirim!</h2>
        <div className="card pad" style={{ marginTop: 20 }}>
          <p className="msg ok">
            Jika email <b>{email}</b> terdaftar di LapaKWU, kami telah mengirim tautan untuk membuat kata sandi baru.
          </p>
          <p className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
            Silakan periksa kotak masuk (Inbox) atau folder Spam email kamu. Tautan reset berlaku selama 1 jam.
          </p>
          <div className="row" style={{ marginTop: 24, gap: 10 }}>
            <button
              type="button"
              className="btn out"
              onClick={() => {
                setTerkirim(false);
                setEmail('');
              }}
            >
              Kirim ulang
            </button>
            <Link href="/masuk" className="btn">
              Kembali ke Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap auth" style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/masuk" className="link" style={{ fontSize: '0.9rem' }}>
          ← Kembali ke Login
        </Link>
      </div>
      <h2>Lupa Kata Sandi?</h2>
      <p className="muted">
        Masukkan alamat email yang terdaftar pada akun LapaKWU kamu. Kami akan mengirimkan tautan untuk membuat kata sandi baru.
      </p>
      <form className="card pad" onSubmit={kirim} style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="em">Alamat Email</label>
          <input
            id="em"
            type="email"
            required
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button className="btn lg" style={{ marginTop: 8 }} disabled={busy}>
          {busy ? 'Mengirim…' : 'Kirim Link Reset'}
        </button>
        {msg.t && <p className={'msg ' + msg.k} role="alert">{msg.t}</p>}
      </form>
    </main>
  );
}
