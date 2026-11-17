'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { list, ambil, api, storage, ID, BUCKET, Query, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function Checkout() {
  const { akun, peran, pengguna, pembeli } = useSaya();
  const [lg, setLg] = useState(null); // beli langsung: { id, jumlah }
  const r = useRouter();
  const [it, setIt] = useState(null);
  const [mitras, setMitras] = useState({});
  const [f, setF] = useState({ metode: 'QRIS' });
  const [fileBukti, setFileBukti] = useState(null);
  const [previewBukti, setPreviewBukti] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // set tidak digunakan langsung di JSX, opsi() dipakai untuk radio metode pembayaran

  useEffect(() => {
    if (!akun) return;
    const q = new URLSearchParams(location.search);
    (async () => {
      if (q.get('beli')) {
        const p = await ambil('produk', q.get('beli'));
        const jumlah = Math.max(1, Math.min(+q.get('jml') || 1, p.stok));
        setLg({ id: p.$id, jumlah });
        const mt = await ambil('mitra', p.id_mitra).catch(() => null);
        if (mt) setMitras({ [p.id_mitra]: mt });
        return setIt([{ $id: 'langsung', id_produk: p.$id, id_mitra: p.id_mitra, nama: p.nama, jumlah, subtotal: jumlah * p.harga }]);
      }
      const x = await list('item_keranjang', [Query.equal('id_keranjang', akun.$id)]);
      const ps = x.length ? await list('produk', [Query.equal('$id', x.map((i) => i.id_produk))]) : [];
      const mIds = [...new Set(ps.map((p) => p.id_mitra).filter(Boolean))];
      const mList = await Promise.all(mIds.map((mid) => ambil('mitra', mid).catch(() => null)));
      const mMap = {};
      mList.filter(Boolean).forEach((m) => { mMap[m.$id] = m; });
      setMitras(mMap);
      setIt(x.map((i) => {
        const prod = ps.find((p) => p.$id === i.id_produk);
        return {
          ...i,
          id_mitra: prod?.id_mitra,
          nama: prod?.nama || 'Produk',
          subtotal: i.jumlah * (prod?.harga || 0),
        };
      }));
    })().catch((e) => setMsg(e.message));
  }, [akun]);

  const handleFileBukti = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFileBukti(null);
      setPreviewBukti(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMsg('Format bukti pembayaran harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg('Ukuran bukti pembayaran maksimal 5 MB.');
      return;
    }
    setMsg('');
    setFileBukti(file);
    setPreviewBukti(URL.createObjectURL(file));
  };

  const pesan = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');

    let id_bukti = null;
    const isQris = f.metode === 'QRIS';

    if (isQris) {
      if (!fileBukti) {
        setMsg('Wajib mengunggah bukti pembayaran untuk metode QRIS.');
        setBusy(false);
        return;
      }
      try {
        const fileRes = await storage.createFile({ bucketId: BUCKET, fileId: ID.unique(), file: fileBukti });
        id_bukti = fileRes.$id;
      } catch (errUpload) {
        setMsg('Gagal mengunggah bukti pembayaran: ' + errUpload.message);
        setBusy(false);
        return;
      }
    }

    try {
      await api('/api/checkout', { metode: f.metode, id_bukti, langsung: lg });
      r.push('/pesanan');
    } catch (er) {
      setMsg(er.message);
    }
    setBusy(false);
  };

  if (peran && peran !== 'pembeli') {
    return <main className="wrap"><p className="kosong">Checkout hanya untuk akun pembeli.</p></main>;
  }

  const total = (it || []).reduce((a, i) => a + i.subtotal, 0);
  const opsi = (k, v, t) => (
    <label className="row">
      <input type="radio" style={{ width: 'auto' }} name={k} checked={f[k] === v} onChange={() => setF({ ...f, [k]: v })} />
      {t}
    </label>
  );

  // Hitung total belanja per mitra untuk scan QRIS masing-masing mitra
  const perMitra = {};
  (it || []).forEach((item) => {
    const mid = item.id_mitra;
    if (mid) perMitra[mid] = (perMitra[mid] || 0) + item.subtotal;
  });

  return (
    <main className="wrap split">
      <form className="stack" onSubmit={pesan}>
        <h2>{lg ? 'Beli sekarang' : 'Checkout'}</h2>
        {lg && <p className="msg">Kamu membeli langsung satu produk. Isi keranjangmu tidak berubah.</p>}
        {pengguna && pengguna.status_akun !== 'AKTIF' && (
          <p className="msg err">Akunmu belum aktif. <a className="link" href="/verifikasi">Verifikasi dulu</a> sebelum memesan.</p>
        )}

        {/* INFO: Semua pesanan ambil di lapak mitra */}
        <div className="card pad" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.3rem' }}>🏪</span>
            <div>
              <b style={{ color: '#14532d', display: 'block' }}>Ambil sendiri di lapak mitra</b>
              <small className="muted">Semua pesanan diambil langsung di tenant/lapak mitra. Pilih cara pembayaranmu di bawah.</small>
            </div>
          </div>
        </div>

        <fieldset className="card pad"><legend><b>Metode pembayaran</b></legend>
          {opsi('metode', 'QRIS', '💳 Transfer / QRIS (bayar sekarang, upload bukti)')}
          {opsi('metode', 'BAYAR_DI_TEMPAT', '💵 Bayar langsung di lapak mitra')}
        </fieldset>

        {/* QRIS DARI MITRA & UPLOAD BUKTI (ONLINE) */}
        {f.metode === 'QRIS' && (
          <div className="card pad stack" style={{ border: '2px solid #2563eb', background: '#f0f7ff', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>📲</span>
              <div>
                <b style={{ color: '#1e40af', fontSize: '1rem', display: 'block' }}>QRIS Mitra Toko</b>
                <small className="muted">Silakan scan QRIS mitra pemilik produk di bawah ini untuk membayar langsung ke mitra:</small>
              </div>
            </div>

            {Object.entries(perMitra).map(([mid, subtot]) => {
              const m = mitras[mid];
              return (
                <div key={mid} style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                  <b style={{ fontSize: '1.05rem', color: '#1e3a8a' }}>{m?.nama_usaha || 'Lapak Mitra'}</b>
                  <div style={{ margin: '4px 0 10px 0', fontSize: '0.95rem' }}>
                    Total yang harus dibayar: <b style={{ color: '#047857' }}>{rp(subtot)}</b>
                  </div>

                  {m?.id_qris ? (
                    <div>
                      <img src={img(m.id_qris)} alt={`QRIS ${m.nama_usaha}`}
                        style={{ maxWidth: 240, width: '100%', height: 'auto', borderRadius: 8, border: '2px solid #cbd5e1', padding: 6, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }} />
                      <div style={{ marginTop: 6 }}>
                        <a href={img(m.id_qris)} target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: '0.85rem' }}>
                          Buka Gambar QRIS Penuh ↗
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="msg" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', textAlign: 'left', fontSize: '0.85rem' }}>
                      ⚠️ <b>Mitra belum mengunggah gambar barcode QRIS.</b> Hubungi mitra untuk informasi pembayaran, lalu upload buktinya di bawah.
                    </div>
                  )}
                </div>
              );
            })}

            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="bukti" style={{ fontWeight: 600, color: '#1e3a8a' }}>
                Upload Bukti Pembayaran / Transfer <span style={{ color: '#dc2626' }}>* (Wajib)</span>
              </label>
              <input
                id="bukti"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={handleFileBukti}
              />
              <small className="muted">Format JPG, PNG, atau WebP (maks. 5 MB). Mitra akan memeriksa bukti ini sebelum mengonfirmasi pesananmu.</small>

              {previewBukti && (
                <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #93c5fd', textAlign: 'center' }}>
                  <b style={{ fontSize: '0.9rem', color: '#1e40af', display: 'block', marginBottom: 8 }}>Preview Bukti Pembayaran Anda:</b>
                  <img
                    src={previewBukti}
                    alt="Preview Bukti Pembayaran"
                    style={{ maxWidth: 220, maxHeight: 220, objectFit: 'contain', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ marginTop: 6 }}>
                    <small className="muted">{fileBukti?.name} ({Math.round(fileBukti.size / 1024)} KB)</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INFO WAKTU 30 MENIT (OFFLINE) */}
        {f.metode === 'BAYAR_DI_TEMPAT' && (
          <div className="card pad" style={{ border: '2px solid #f59e0b', background: '#fffbeb', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: '1.4rem' }}>⏱️</span>
              <div>
                <b style={{ color: '#92400e', fontSize: '1rem', display: 'block', marginBottom: 4 }}>
                  Ketentuan Pembayaran Offline di Lapak / Tenant
                </b>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#78350f', lineHeight: 1.5 }}>
                  Setelah checkout, kamu diberikan <b>waktu 30 menit</b> untuk datang dan membayar langsung di tenant/lapak mitra.
                  Jika melebihi 30 menit dan pembayaran belum dikonfirmasi oleh mitra, pesanan akan <b>otomatis dibatalkan</b> oleh sistem.
                </p>
              </div>
            </div>
          </div>
        )}

        {msg && <p className="msg err" role="alert">{msg}</p>}
        <button className="btn sun" disabled={busy || !it?.length}>
          {busy ? 'Memproses…' : `Bayar dan pesan ${rp(total)}`}
        </button>
      </form>

      <aside className="card pad">
        <h3>Ringkasan</h3>
        {it && !it.length && <p className="muted">Keranjang kosong.</p>}
        <ul className="lines">
          {(it || []).map((i) => (
            <li key={i.$id}>
              <span>{i.nama} × {i.jumlah}</span>
              <b>{rp(i.subtotal)}</b>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          <small>
            Produk dari mitra berbeda dipecah menjadi satu pesanan per mitra. Mitra akan memeriksa pembayaran dan mengonfirmasi pesananmu.
          </small>
        </p>
      </aside>
    </main>
  );
}
