'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { account } from '@/lib/aw';

const EyeIcon = ({ show }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {show
      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
    }
  </svg>
);

export default function Masuk() {
  const r = useRouter();
  const [f, setF] = useState({ email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const kirim = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await account.createEmailPasswordSession({ email: f.email, password: f.password });

      // Determine role and redirect accordingly
      const me = await account.get();

      if (me.peran === 'admin') {
        location.href = '/admin';
        return;
      }

      const intent = sessionStorage.getItem('lapakwu_checkout_intent');
      if (intent) {
        const { productId, quantity } = JSON.parse(intent);
        sessionStorage.removeItem('lapakwu_checkout_intent');
        location.href = `/checkout?beli=${productId}&jml=${quantity}`;
        return;
      }

      location.href = '/';
    } catch (er) {
      const errMsg = er.message || '';
      const isNotFound =
        er.notFound === true ||
        er.code === 404 ||
        er.type === 'user_not_found' ||
        errMsg.toLowerCase().includes('belum terdaftar') ||
        errMsg.toLowerCase().includes('user with the requested id could not be found');

      if (isNotFound) {
        sessionStorage.setItem('lapakwu_prefill', JSON.stringify({ email: f.email, password: f.password, dariLogin: true }));
        r.push('/daftar');
        return;
      }

      setMsg(errMsg || 'Login gagal. Periksa kembali email dan kata sandi.');
      setBusy(false);
    }
  };

  return (
    <main className="wrap auth" style={{ maxWidth: 480 }}>
      <h2>Masuk ke LapaKWU</h2>
      <form className="card pad" onSubmit={kirim}>
        <div className="field">
          <label htmlFor="e">Email</label>
          <input id="e" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </div>
        <div className="field" style={{ position: 'relative' }}>
          <label htmlFor="p">Kata sandi</label>
          <input
            id="p"
            type={showPass ? 'text' : 'password'}
            minLength={8}
            required
            autoComplete="current-password"
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
        <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 12 }}>
          <Link href="/lupa-sandi" className="muted" style={{ fontSize: '0.875rem' }}>Lupa Kata Sandi?</Link>
        </div>
        <button className="btn lg" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
        {msg && <p className="msg err" role="alert">{msg}</p>}
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Belum punya akun?{' '}
        <Link
          href="/daftar"
          onClick={() => {
            if (f.email || f.password) {
              sessionStorage.setItem('lapakwu_prefill', JSON.stringify({ email: f.email, password: f.password }));
            }
          }}
        >
          Daftar di sini
        </Link>
      </p>
    </main>
  );
}
