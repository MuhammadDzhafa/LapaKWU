'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { account, api } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

const EyeIcon = ({ show }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {show
      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
    }
  </svg>
);

const tampilHp = (v) => (v ? '0' + String(v).replace(/^62/, '') : '');
const NAMA_PERAN = { pembeli: 'Pembeli', mitra: 'Mitra', admin: 'Admin' };
const NAMA_STATUS = { AKTIF: 'Aktif', MENUNGGU_VERIFIKASI: 'Menunggu verifikasi', DITOLAK: 'Ditolak', DIBLOKIR: 'Diblokir' };

/* Satu baris data: nilai di atas, tombol "Ubah …" di bawahnya, form terbuka dengan animasi. */
function Baris({ id, label, nilai, kosong, tombol, buka, setBuka, onSimpan, kunci, children, catatan, simpan = 'Simpan', ikon }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const terbuka = buka === id;
  const kirim = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await onSimpan(); setBuka(null); } catch (er) { setMsg(er.message || 'Gagal menyimpan.'); }
    setBusy(false);
  };
  return (
    <div className={'br' + (terbuka ? ' open' : '')}>
      <div className="br-ico" aria-hidden="true">{ikon}</div>
      <div className="br-main">
        <small className="br-label">{label}</small>
        <div className={'br-val' + (nilai ? '' : ' kosong')} key={nilai}>{nilai || kosong}</div>
        {kunci
          ? <small className="br-note">{kunci}</small>
          : <button type="button" className="br-btn" aria-expanded={terbuka} aria-controls={'ed-' + id} onClick={() => { setMsg(''); setBuka(terbuka ? null : id); }}>
              <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M3 14.5V17h2.5l7.4-7.4-2.5-2.5L3 14.5zm11.7-6.7a.9.9 0 0 0 0-1.3l-1.2-1.2a.9.9 0 0 0-1.3 0l-1 1 2.5 2.5 1-1z" fill="currentColor" /></svg>
              {terbuka ? 'Batal' : tombol}
            </button>}
        <div className="ed" id={'ed-' + id} inert={!terbuka}>
          <form className="ed-in" onSubmit={kirim}>
            {children}
            {catatan && <small className="muted ed-cat">{catatan}</small>}
            {msg && <p className="msg err" role="alert">{msg}</p>}
            <div className="row">
              <button className="btn sm" disabled={busy}>{busy ? 'Menyimpan…' : simpan}</button>
              <button type="button" className="btn sm out" onClick={() => setBuka(null)}>Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const I = {
  user: <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4 21c1-4.2 4-6 8-6s7 1.8 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  mail: <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  phone: <svg viewBox="0 0 24 24" width="20" height="20"><rect x="7" y="2.5" width="10" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 18.5h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  pin: <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>,
  shop: <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9.500 5.500 4h13L20 9.500M4 9.500c0 1.700 1.300 2.500 2.700 2.500S9.300 11.200 9.300 9.500c0 1.700 1 2.500 2.700 2.500s2.700-.8 2.700-2.500c0 1.700 1.200 2.500 2.600 2.500S20 11.200 20 9.500M5.500 12v8h13v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  bank: <svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  lock: <svg viewBox="0 0 24 24" width="20" height="20"><rect x="5" y="10.500" width="14" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" fill="none" stroke="currentColor" strokeWidth="2" /></svg>,
  out: <svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

export default function Profil() {
  const { akun, pengguna, pembeli, mitra, peran, memuat, muat, toast, keluar, galatProfil } = useSaya();
  const [buka, setBuka] = useState(null);
  const [f, setF] = useState({});
  const [yakin, setYakin] = useState(false);
  const [showSL, setShowSL] = useState(false);
  const [showSB, setShowSB] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [resetParams, setResetParams] = useState({ token: '', userId: '' });
  const [pakeOtp, setPakeOtp] = useState(false);
  const [mintaOtpBusy, setMintaOtpBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');

  const kirimOtp = async () => {
    setMintaOtpBusy(true);
    setOtpInfo('');
    try {
      const res = await fetch('/api/auth/otp-sandi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aksi: 'minta_otp' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal mengirim OTP.');
      setPakeOtp(true);
      setOtpInfo(d.pesan || `Kode OTP telah dikirim ke email ${d.email || email}. Cek kotak masuk atau spam.`);
      toast(`Kode OTP dikirim ke ${d.email || email}`);
    } catch (err) {
      toast(err.message, true);
    } finally {
      setMintaOtpBusy(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const isResetParam = sp.get('reset') === '1' || (sp.get('token') && sp.get('userId'));
      if (isResetParam) {
        setIsReset(true);
        setResetParams({ token: sp.get('token') || '', userId: sp.get('userId') || '' });
        setBuka('sandi');
      }
    }
  }, []);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const mulai = (isi) => () => setF((x) => ({ ...x, ...isi }));

  if (memuat) return (
    <main className="wrap profil"><div className="pf-grid">
      <div className="skel-box" style={{ height: 320 }} /><div className="stack"><div className="skel-box" style={{ height: 300 }} /><div className="skel-box" style={{ height: 180 }} /></div>
    </div></main>
  );
  if (!akun) return (
    <main className="wrap profil"><div className="kosong-kartu">
      <h2>Kamu belum masuk</h2><p className="muted">Masuk dulu untuk melihat dan mengubah data profilmu.</p>
      <Link className="btn" href="/masuk">Masuk</Link></div></main>
  );

  const nama = pengguna?.nama || akun.name || akun.email;
  const email = pengguna?.email || akun.email;
  const telp = tampilHp(pengguna?.no_telepon);
  const wa = pengguna?.kanal === 'WHATSAPP';
  const awal = (nama.trim()[0] || '?').toUpperCase();
  const terverif = !!pengguna?.kontak_terverifikasi;

  // Profil di database belum terbaca: tetap tampilkan data akun supaya tidak seolah-olah belum masuk.
  if (!pengguna) return (
    <main className="wrap profil"><div className="kosong-kartu">
      <div className="avatar big" aria-hidden="true">{awal}</div>
      <h2>{nama}</h2><p className="muted">{email}</p>
      <p className="msg err" role="alert">{galatProfil || 'Data profilmu belum bisa dibaca.'} Coba muat ulang. Kalau masih sama, keluar lalu masuk lagi.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => { location.reload(); }}>Muat ulang</button>
        <button className="btn out" onClick={keluar}>Keluar</button>
      </div></div></main>
  );

  const simpanData = (aksi, body, sukses) => async () => {
    const d = await api('/api/profil', { aksi, ...body });
    await muat();
    toast(sukses);
    if (d.verifikasi) setTimeout(() => { location.href = '/verifikasi?kirim=1'; }, 900);
  };

  return (
    <main className="wrap profil">
      <div className="pf-grid">
        {/* ── Kartu identitas ── */}
        <aside className="idcard">
          <div className="awn" aria-hidden="true" />
          <div className="idbody">
            <div className="avatar big" aria-hidden="true">{awal}</div>
            <h2 className="idnama">{nama}</h2>
            <p className="idmail">{email}</p>
            <div className="row idbadge">
              <span className="badge" data-s="AKTIF">{NAMA_PERAN[peran] || 'Akun'}</span>
              <span className="badge" data-s={pengguna.status_akun}>{NAMA_STATUS[pengguna.status_akun] || pengguna.status_akun}</span>
            </div>
            <p className={'idver ' + (terverif ? 'ok' : 'no')}>
              <i aria-hidden="true">{terverif ? '✓' : '!'}</i>
              {wa ? 'WhatsApp' : 'Email'} {terverif ? 'sudah terverifikasi' : 'belum terverifikasi'}
            </p>
            {!terverif && <Link href="/verifikasi?kirim=1" className="btn sm" style={{ marginBottom: 14 }}>Verifikasi sekarang</Link>}
            <nav className="idlinks" aria-label="Pintasan akun">
              {peran === 'pembeli' && <><Link href="/pesanan">Pesanan saya</Link><Link href="/keranjang">Keranjang</Link></>}
              {peran === 'mitra' && <Link href="/mitra">Lapak saya</Link>}
              {peran === 'admin' && <Link href="/admin">Panel admin</Link>}
            </nav>
          </div>
        </aside>

        {/* ── Rincian ── */}
        <div className="pf-col">
          <section className="pcard" style={{ '--i': 1 }} aria-labelledby="h-akun">
            <h3 id="h-akun">Data akun</h3>

            <Baris id="nama" ikon={I.user} label="Nama" nilai={nama} tombol="Ubah nama" buka={buka} setBuka={(v) => { if (v === 'nama') mulai({ nama })(); setBuka(v); }}
              onSimpan={simpanData('nama', { nama: f.nama }, 'Nama diubah.')}>
              <div className="field"><label htmlFor="in-nama">Nama baru</label><input id="in-nama" required maxLength={100} autoComplete="name" value={f.nama ?? ''} onChange={set('nama')} /></div>
            </Baris>

            <Baris id="email" ikon={I.mail} label="Email" nilai={email} tombol="Ubah email" buka={buka} setBuka={(v) => { if (v === 'email') mulai({ email: '', sandiEmail: '' })(); setBuka(v); }}
              catatan={!wa ? 'Setelah email diganti, kamu perlu memverifikasi email barunya.' : ''}
              onSimpan={async () => {
                await account.updateEmail({ email: f.email, password: f.sandiEmail });
                await simpanData('email', {}, 'Email diubah.')();
              }}>
              <div className="field"><label htmlFor="in-email">Email baru</label><input id="in-email" type="email" required autoComplete="email" value={f.email ?? ''} onChange={set('email')} /></div>
              <div className="field"><label htmlFor="in-se">Kata sandi saat ini</label><input id="in-se" type="password" required autoComplete="current-password" value={f.sandiEmail ?? ''} onChange={set('sandiEmail')} /></div>
            </Baris>

            <Baris id="telp" ikon={I.phone} label={wa ? 'Nomor WhatsApp' : 'Nomor telepon'} nilai={telp} kosong="Belum diisi" tombol={telp ? 'Ubah nomor telepon' : 'Tambah nomor telepon'} buka={buka}
              setBuka={(v) => { if (v === 'telp') mulai({ telp })(); setBuka(v); }}
              catatan={wa ? 'Nomor WhatsApp dipakai untuk verifikasi, jadi nomor baru perlu diverifikasi lagi.' : ''}
              onSimpan={simpanData('telepon', { no_telepon: f.telp }, 'Nomor telepon disimpan.')}>
              <div className="field"><label htmlFor="in-telp">Nomor baru</label><input id="in-telp" type="tel" inputMode="tel" placeholder="0812xxxxxxxx" autoComplete="tel" required={wa} value={f.telp ?? ''} onChange={set('telp')} /></div>
            </Baris>
          </section>

          {(peran === 'mitra' || peran === 'pembeli') && (
            <section className="pcard" style={{ '--i': 2 }} aria-labelledby="h-lapak">
              <h3 id="h-lapak">{peran === 'mitra' ? 'Data lapak' : 'Pengiriman'}</h3>
              {peran === 'mitra' && (
                <Baris id="usaha" ikon={I.shop} label="Nama usaha" nilai={mitra?.nama_usaha} tombol="Ubah nama usaha" buka={buka} setBuka={(v) => { if (v === 'usaha') mulai({ usaha: mitra?.nama_usaha || '' })(); setBuka(v); }}
                  onSimpan={simpanData('detail', { nama_usaha: f.usaha }, 'Nama usaha diubah.')}>
                  <div className="field"><label htmlFor="in-usaha">Nama usaha baru</label><input id="in-usaha" required value={f.usaha ?? ''} onChange={set('usaha')} /></div>
                </Baris>)}
              <Baris id="alamat" ikon={I.pin} label={peran === 'mitra' ? 'Alamat lapak' : 'Alamat pengiriman'} nilai={peran === 'mitra' ? mitra?.alamat_usaha : pembeli?.alamat} kosong="Belum diisi"
                tombol="Ubah alamat" buka={buka} setBuka={(v) => { if (v === 'alamat') mulai({ alamat: (peran === 'mitra' ? mitra?.alamat_usaha : pembeli?.alamat) || '' })(); setBuka(v); }}
                onSimpan={simpanData('detail', { alamat: f.alamat }, 'Alamat diubah.')}>
                <div className="field"><label htmlFor="in-alamat">Alamat baru</label><input id="in-alamat" required value={f.alamat ?? ''} onChange={set('alamat')} /></div>
              </Baris>
              {peran === 'mitra' && (
                <div className="br">
                  <div className="br-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 3h7v7H3zm2 2v3h3V5zm8-2h7v7h-7zm2 2v3h3V5zM3 14h7v7H3zm2 2v3h3v-3zm10 0h2v2h-2zm3 0h2v4h-2zm-3 3h2v2h-2zm5-1h1v2h-1z" fill="currentColor"/></svg>
                  </div>
                  <div className="br-main">
                    <small className="br-label">QRIS Toko</small>
                    <div className="br-val">
                      {mitra?.id_qris ? 'Sudah diunggah' : 'Belum diunggah'}
                    </div>
                    <Link href="/mitra" className="br-btn">
                      Kelola QRIS di Lapak Saya →
                    </Link>
                  </div>
                </div>)}
            </section>
          )}

          <section className="pcard" style={{ '--i': 3 }} aria-labelledby="h-aman">
            <h3 id="h-aman">Keamanan</h3>
            <Baris id="sandi" ikon={I.lock} label="Kata sandi" nilai="••••••••" tombol="Ganti kata sandi" buka={buka} setBuka={(v) => { if (v === 'sandi') { mulai({ sl: '', sb: '', otp: '' })(); setPakeOtp(false); setOtpInfo(''); } setBuka(v); }}
              onSimpan={async () => {
                if (isReset && resetParams.token) {
                  const res = await fetch('/api/reset-sandi', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ token: resetParams.token, userId: resetParams.userId || akun?.$id, sandi: f.sb }),
                  });
                  const d = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(d.error || 'Gagal mengatur kata sandi baru.');
                  toast('Kata sandi berhasil diperbarui.');
                } else if (pakeOtp) {
                  if (!f.otp || !f.sb) throw new Error('Isi kode OTP dan kata sandi baru.');
                  const res = await fetch('/api/auth/otp-sandi', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ aksi: 'verifikasi_otp', kode: f.otp, sandiBaru: f.sb }),
                  });
                  const d = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(d.error || 'Gagal memverifikasi OTP.');
                  toast('Kata sandi berhasil diubah.');
                  setPakeOtp(false);
                  setOtpInfo('');
                } else {
                  await account.updatePassword({ password: f.sb, oldPassword: f.sl });
                  toast('Kata sandi berhasil diubah.');
                }
              }}>
              {pakeOtp ? (
                <>
                  {otpInfo && <p className="msg ok" style={{ marginBottom: 12 }}>{otpInfo}</p>}
                  <div className="field">
                    <label htmlFor="in-otp">Kode OTP (6 digit dari email)</label>
                    <input
                      id="in-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="Contoh: 123456"
                      autoComplete="one-time-code"
                      value={f.otp ?? ''}
                      onChange={set('otp')}
                    />
                  </div>
                  <div className="field" style={{ position: 'relative' }}>
                    <label htmlFor="in-sb">Kata sandi baru (min. 8 karakter)</label>
                    <input
                      id="in-sb"
                      type={showSB ? 'text' : 'password'}
                      minLength={8}
                      required
                      autoComplete="new-password"
                      style={{ paddingRight: 44 }}
                      value={f.sb ?? ''}
                      onChange={set('sb')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSB(!showSB)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5E6A75', paddingTop: 22 }}
                      aria-label={showSB ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'}
                    >
                      <EyeIcon show={showSB} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
                    <button type="button" className="link" onClick={() => setPakeOtp(false)} style={{ fontSize: '0.85rem' }}>
                      ← Ingat kata sandi lama
                    </button>
                    <button type="button" className="link" onClick={kirimOtp} disabled={mintaOtpBusy} style={{ fontSize: '0.85rem' }}>
                      {mintaOtpBusy ? 'Mengirim…' : 'Kirim ulang OTP'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {!isReset && (
                    <div className="field" style={{ position: 'relative' }}>
                      <label htmlFor="in-sl">Kata sandi lama</label>
                      <input
                        id="in-sl"
                        type={showSL ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        style={{ paddingRight: 44 }}
                        value={f.sl ?? ''}
                        onChange={set('sl')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSL(!showSL)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5E6A75', paddingTop: 22 }}
                        aria-label={showSL ? 'Sembunyikan kata sandi lama' : 'Tampilkan kata sandi lama'}
                      >
                        <EyeIcon show={showSL} />
                      </button>
                    </div>
                  )}
                  <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 12 }}>
                    <button
                      type="button"
                      className="link"
                      onClick={kirimOtp}
                      disabled={mintaOtpBusy}
                      style={{ fontSize: '0.85rem' }}
                    >
                      {mintaOtpBusy ? 'Mengirim kode…' : 'Lupa kata sandi lama? Kirim kode OTP ke email →'}
                    </button>
                  </div>
                  <div className="field" style={{ position: 'relative' }}>
                    <label htmlFor="in-sb">{isReset ? 'Kata sandi baru' : 'Kata sandi baru (min. 8 karakter)'}</label>
                    <input
                      id="in-sb"
                      type={showSB ? 'text' : 'password'}
                      minLength={8}
                      required
                      autoComplete="new-password"
                      style={{ paddingRight: 44 }}
                      value={f.sb ?? ''}
                      onChange={set('sb')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSB(!showSB)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5E6A75', paddingTop: 22 }}
                      aria-label={showSB ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'}
                    >
                      <EyeIcon show={showSB} />
                    </button>
                  </div>
                </>
              )}
            </Baris>

            <div className={'br keluar' + (yakin ? ' open' : '')}>
              <div className="br-ico" aria-hidden="true">{I.out}</div>
              <div className="br-main">
                <small className="br-label">Sesi</small>
                <div className="br-val">Masuk di perangkat ini</div>
                <button type="button" className="br-btn danger" aria-expanded={yakin} onClick={() => setYakin(!yakin)}>{yakin ? 'Batal' : 'Keluar dari akun'}</button>
                <div className="ed" inert={!yakin}>
                  <div className="ed-in">
                    <p>Keluar dari LapaKWU di perangkat ini?</p>
                    <div className="row"><button className="btn sm red" onClick={keluar}>Ya, keluar</button><button className="btn sm out" onClick={() => setYakin(false)}>Tetap di sini</button></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
