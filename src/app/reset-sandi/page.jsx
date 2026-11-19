'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const EyeIcon = ({ show }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {show
      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
    }
  </svg>
);

function ResetForm() {
  const sp = useSearchParams();
  const r = useRouter();
  const token = sp.get('token');
  const userId = sp.get('userId');

  const [sandi, setSandi] = useState('');
  const [showP, setShowP] = useState(false);
  const [msg, setMsg] = useState({ t: '', k: '' });
  const [busy, setBusy] = useState(false);
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    if (!token || !userId) {
      setMsg({ t: 'Tautan reset tidak valid atau tidak lengkap.', k: 'err' });
    }
  }, [token, userId]);

  const kirim = async (e) => {
    e.preventDefault();
    if (!token || !userId) return;
    setBusy(true);
    setMsg({ t: '', k: '' });

    try {
      const res = await fetch('/api/reset-sandi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, userId, sandi }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal mengatur kata sandi baru.');

      setSelesai(true);
      setTimeout(() => {
        r.push('/masuk');
      }, 2500);
    } catch (er) {
      setMsg({ t: er.message, k: 'err' });
    }
    setBusy(false);
  };

  if (!token || !userId) {
    return (
      <main className="wrap auth" style={{ maxWidth: 480 }}>
        <h2>Tautan Tidak Valid</h2>
        <div className="card pad" style={{ marginTop: 20 }}>
          <p className="msg err">Tautan reset kata sandi tidak valid atau parameter tidak lengkap.</p>
          <p className="muted" style={{ fontSize: '0.9rem' }}>Silakan minta tautan reset kata sandi baru.</p>
          <div style={{ marginTop: 20 }}>
            <Link href="/lupa-sandi" className="btn">Minta Tautan Baru</Link>
          </div>
        </div>
      </main>
    );
  }

  if (selesai) {
    return (
      <main className="wrap auth" style={{ maxWidth: 480 }}>
        <h2>Kata Sandi Berhasil Diperbarui!</h2>
        <div className="card pad" style={{ marginTop: 20 }}>
          <p className="msg ok">Kata sandi baru berhasil disimpan. Kamu akan dialihkan ke halaman Login dalam beberapa detik…</p>
          <div style={{ marginTop: 20 }}>
            <Link href="/masuk" className="btn">Masuk Sekarang</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap auth" style={{ maxWidth: 480 }}>
      <h2>Buat Kata Sandi Baru</h2>
      <p className="muted">Masukkan kata sandi baru untuk akunmu. Minimal 8 karakter.</p>
      <form className="card pad" onSubmit={kirim} style={{ marginTop: 20 }}>
        <div className="field" style={{ position: 'relative' }}>
          <label htmlFor="sp">Kata Sandi Baru</label>
          <input
            id="sp"
            type={showP ? 'text' : 'password'}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowP(!showP)}
            aria-label={showP ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5E6A75', paddingTop: 22 }}
          >
            <EyeIcon show={showP} />
          </button>
        </div>
        <button className="btn lg" style={{ marginTop: 12 }} disabled={busy || sandi.length < 8}>
          {busy ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}
        </button>
        {msg.t && <p className={'msg ' + msg.k} role="alert">{msg.t}</p>}
      </form>
    </main>
  );
}

export default function ResetSandi() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <ResetForm />
    </Suspense>
  );
}
