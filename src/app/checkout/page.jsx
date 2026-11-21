'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { list, ambil, api, storage, Query, rp } from '@/lib/aw';
import { MAKS_BUKTI_PEMBAYARAN, PESAN_UKURAN_BUKTI } from '@/lib/bukti-pembayaran';
import { useSaya } from '@/components/Shell';

export default function Checkout() {
  const { akun, pengguna, selesaiCheckout, toast } = useSaya();
  const [lg, setLg] = useState(null); // beli langsung: { id, jumlah }
  const r = useRouter();
  const [it, setIt] = useState(null);
  const [mitras, setMitras] = useState({});
  const [f, setF] = useState({ metode: 'QRIS', pengantaran: 'AMBIL', alamat: '', catatan: '' });
  const [fileBukti, setFileBukti] = useState(null);
  const [previewBukti, setPreviewBukti] = useState(null);
  const [qrisError, setQrisError] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const mengirim = useRef(false);
  const checkoutId = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });


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
        return setIt([{ $id: 'langsung', id_produk: p.$id, id_mitra: p.id_mitra, nama: p.nama, jumlah, harga: p.harga, subtotal: jumlah * p.harga }]);
      }
      const x = await list('item_keranjang', [Query.equal('id_keranjang', akun.$id)]);
      const ps = x.length ? await list('produk', [Query.equal('$id', x.map((i) => i.id_produk)), Query.limit(500)]) : [];
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
          harga: prod?.harga || 0,
          subtotal: i.jumlah * (prod?.harga || 0),
        };
      }));
    })().catch((e) => setMsg(e.message));
  }, [akun]);

  useEffect(() => {
    if (!fileBukti) {
      setPreviewBukti(null);
      return;
    }
    const url = URL.createObjectURL(fileBukti);
    setPreviewBukti(url);
    return () => URL.revokeObjectURL(url);
  }, [fileBukti]);

  const handleFileBukti = (e) => {
    const file = e.target.files[0];
    let galat = '';
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      galat = 'Format bukti pembayaran harus JPG, PNG, atau WebP.';
    } else if (file && file.size > MAKS_BUKTI_PEMBAYARAN) {
      galat = PESAN_UKURAN_BUKTI;
    }
    if (galat) e.target.value = '';
    setFileBukti(galat ? null : file || null);
    setMsg(galat);
  };

  const pesan = async (e) => {
    e.preventDefault();
    if (mengirim.current) return;
    mengirim.current = true;
    setBusy(f.metode === 'QRIS' ? 'Mengunggah bukti…' : 'Membuat pesanan…');
    setMsg('');

    let id_bukti = null;
    const isQris = f.metode === 'QRIS';

    if (isQris) {
      if (!fileBukti) {
        setMsg('Wajib mengunggah bukti pembayaran untuk metode QRIS.');
        mengirim.current = false;
        setBusy('');
        return;
      }
      try {
        const fileRes = await storage.createFile({ file: fileBukti, jenis: 'bukti-pembayaran' });
        id_bukti = fileRes.$id;
      } catch (errUpload) {
        setMsg('Gagal mengunggah bukti pembayaran: ' + errUpload.message);
        mengirim.current = false;
        setBusy('');
        return;
      }
    }

    setBusy(isQris ? 'Memeriksa bukti pembayaran…' : 'Membuat pesanan…');
    try {
      checkoutId.current ||= sessionStorage.getItem('lapakwu_checkout_request') || crypto.randomUUID();
      sessionStorage.setItem('lapakwu_checkout_request', checkoutId.current);
      const { alamat, ...data } = f;
      const hasil = await api('/api/checkout', { ...data, ...(antar ? { alamat } : {}), id_bukti, langsung: lg, request_id: checkoutId.current, total_diharapkan: totalSen });
      sessionStorage.removeItem('lapakwu_checkout_request');
      checkoutId.current = null;
      selesaiCheckout(akun.$id, hasil.itemTerpesan);
      toast('Pesanan berhasil dibuat.');
      r.push('/pesanan');
    } catch (er) {
      setMsg(er.message);
    }
    mengirim.current = false;
    setBusy('');
  };

  if (!akun) {
    return (
      <main className="wrap">
        <p className="kosong">Silakan <a href="/masuk" className="link">masuk</a> terlebih dahulu untuk melakukan checkout.</p>
      </main>
    );
  }

  const idsMitra = [...new Set((it || []).map((item) => item.id_mitra))];
  const bisaAntar = idsMitra.length > 0 && idsMitra.every((id) => mitras[id]?.antar_aktif === true);
  const antar = f.pengantaran === 'ANTAR';
  const ongkir = antar ? idsMitra.reduce((sum, id) => sum + (mitras[id]?.ongkir ?? 0), 0) : 0;
  const totalSen = (it || []).reduce((sum, item) => sum + item.jumlah * Math.round(item.harga * 100), ongkir * 100);
  const total = totalSen / 100;
  const opsi = (k, v, t) => (
    <label className="row">
      <input type="radio" style={{ width: 'auto' }} name={k} checked={f[k] === v} onChange={() => setF({ ...f, [k]: v })} />
      {t}
    </label>
  );

  return (
    <main className="wrap split">
      <form className="stack" onSubmit={pesan}>
        <h2>{lg ? 'Beli sekarang' : 'Checkout'}</h2>
        {lg && <p className="msg">Kamu membeli langsung satu produk. Isi keranjangmu tidak berubah.</p>}
        {pengguna && pengguna.status_akun !== 'AKTIF' && (
          <p className="msg err">Akunmu belum aktif. <a className="link" href="/verifikasi">Verifikasi dulu</a> sebelum memesan.</p>
        )}

        <fieldset className="card pad stack"><legend><b>Terima pesanan</b></legend>
          {opsi('pengantaran', 'AMBIL', 'Ambil di lapak')}
          {bisaAntar ? <label className="row"><input type="radio" style={{ width: 'auto' }} name="pengantaran"
            checked={antar} onChange={() => setF({ ...f, pengantaran: 'ANTAR', metode: 'QRIS' })} /> Antar ke alamat</label>
            : <small className="muted">Pengantaran tersedia jika semua mitra dalam checkout menerima pesanan antar.</small>}
          {antar && <div className="field">
            <label htmlFor="alamat-antar">Alamat pengiriman</label>
            <textarea id="alamat-antar" required maxLength={500} value={f.alamat} onChange={set('alamat')} />
            {idsMitra.map((id) => <small key={id}>{mitras[id]?.nama_usaha} · Ongkir {rp(mitras[id]?.ongkir)}</small>)}
          </div>}
          <div className="field">
            <label htmlFor="catatan-pembeli">Catatan untuk mitra (opsional)</label>
            <textarea id="catatan-pembeli" maxLength={500} value={f.catatan} onChange={set('catatan')} />
          </div>
        </fieldset>

        <fieldset className="card pad"><legend><b>Metode pembayaran</b></legend>
          {opsi('metode', 'QRIS', '💳 Transfer / QRIS (bayar sekarang, upload bukti)')}
          {!antar && opsi('metode', 'BAYAR_DI_TEMPAT', '💵 Bayar langsung di lapak mitra')}
        </fieldset>

        {/* QRIS LapaKWU dan bukti pembayaran */}
        {f.metode === 'QRIS' && (
          <div className="card pad stack" style={{ border: '2px solid var(--bl-d)', background: 'var(--bl-s)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>📲</span>
              <div>
                <b style={{ color: 'var(--bl-d)', fontSize: '1.05rem', display: 'block' }}>QRIS Resmi LapaKWU</b>
                <small className="muted">Bayar dengan aplikasi bank atau dompet digital yang mendukung QRIS.</small>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1.5px solid var(--bl)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: 'var(--bl-d)', color: '#fff', fontSize: '0.78rem', fontWeight: 800, padding: '2px 10px', borderRadius: 99, marginBottom: 8 }}>
                LapaKWU, Service
              </div>
              <div style={{ margin: '4px 0 12px 0', fontSize: '1.05rem' }}>
                Total Pembayaran: <b style={{ color: 'var(--bl-d)', fontSize: '1.25rem' }}>{rp(total)}</b>
              </div>

              {process.env.NEXT_PUBLIC_QRIS_URL && !qrisError ? (
                <div>
                  <img
                    src={process.env.NEXT_PUBLIC_QRIS_URL}
                    alt="QRIS LapaKWU"
                    onError={() => setQrisError(true)}
                    style={{ maxWidth: 240, width: '100%', height: 'auto', borderRadius: 8, border: '2px solid var(--line)', padding: 8, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <a href={process.env.NEXT_PUBLIC_QRIS_URL} target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: '0.85rem' }}>
                      Buka Gambar QRIS Penuh ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ border: '2px dashed var(--bl)', borderRadius: 10, padding: 16, background: 'var(--tint)', maxWidth: 300, margin: '0 auto' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 4 }}>📱</div>
                  <b style={{ color: 'var(--bl-d)', display: 'block', fontSize: '0.95rem' }}>Scan QRIS LapaKWU</b>
                  <p className="muted" style={{ fontSize: '0.82rem', margin: '6px 0 10px' }}>
                    Silakan scan QRIS LapaKWU di ponsel Anda senilai <b>{rp(total)}</b>.
                  </p>
                  <small style={{ color: 'var(--bl-d)', fontSize: '0.78rem' }}>
                    💡 Taruh file barcode QRIS Anda di folder <code>public/qris.png</code> atau isi link gambar online di <code>NEXT_PUBLIC_QRIS_URL</code>.
                  </small>
                </div>
              )}

              <p className="muted" style={{ fontSize: '0.82rem', margin: '12px 0 0', lineHeight: 1.5 }}>
                Unggah bukti yang menampilkan nominal, nama merchant, dan tanggal yang sama dengan hari pemesanan. Jam transaksi bebas dan tidak harus terbaca. Pembayaran menunggu konfirmasi admin.
              </p>
            </div>

            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="bukti" style={{ fontWeight: 600, color: 'var(--bl-d)' }}>
                Upload Bukti Pembayaran / Transfer <span style={{ color: 'var(--coral)' }}>* (Wajib)</span>
              </label>
              <input
                id="bukti"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={handleFileBukti}
              />
              <small className="muted">Format JPG, PNG, atau WebP (maks. 2 MB).</small>

              {fileBukti && previewBukti && (
                <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid var(--bl)', textAlign: 'center' }}>
                  <b style={{ fontSize: '0.9rem', color: 'var(--bl-d)', display: 'block', marginBottom: 8 }}>Preview Bukti Pembayaran Anda:</b>
                  <img
                    src={previewBukti}
                    alt="Preview Bukti Pembayaran"
                    style={{ maxWidth: 220, maxHeight: 220, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--line)' }}
                  />
                  <div style={{ marginTop: 6 }}>
                    <small className="muted">{fileBukti?.name} ({Math.round(fileBukti.size / 1024)} KB)</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INFO WAKTU 1 jam (OFFLINE) */}
        {f.metode === 'BAYAR_DI_TEMPAT' && (
          <div className="card pad" style={{ border: '2px solid var(--or)', background: 'var(--tint)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: '1.4rem' }}>⏱️</span>
              <div>
                <b style={{ color: 'var(--ink)', fontSize: '1rem', display: 'block', marginBottom: 4 }}>
                  Ketentuan Pembayaran Offline di Lapak / Tenant
                </b>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink)', lineHeight: 1.5 }}>
                  Setelah checkout, kamu diberikan <b>waktu 1 jam</b> untuk datang dan membayar langsung di tenant/lapak mitra.
                  Jika melebihi 1 jam dan pembayaran belum dikonfirmasi oleh mitra, pesanan akan <b>otomatis dibatalkan</b> oleh sistem.
                </p>
              </div>
            </div>
          </div>
        )}

        {msg && <p className="msg err" role="alert">{msg}</p>}
        <button className="btn sun" disabled={busy || !it?.length || pengguna?.status_akun !== 'AKTIF' || (antar && !bisaAntar)}>
          {busy || `Bayar dan pesan ${rp(total)}`}
        </button>
      </form>

      <aside className="card pad" style={{ position: 'sticky', top: 84, alignSelf: 'start', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: 12 }}>Ringkasan Pesanan</h3>
        {it && !it.length && <p className="muted">Keranjang kosong.</p>}
        
        {/* Section ringkasan pesanan dengan max-height dan scrollable */}
        <div style={{ overflowY: 'auto', maxHeight: 280, paddingRight: 6, margin: '8px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <ul className="lines" style={{ margin: '8px 0' }}>
            {(it || []).map((i) => (
              <li key={i.$id} style={{ padding: '6px 0' }}>
                <span style={{ fontSize: '0.92rem' }}>{i.nama} × {i.jumlah}</span>
                <b style={{ fontSize: '0.92rem' }}>{rp(i.subtotal)}</b>
              </li>
            ))}
          </ul>
        </div>

        {antar && <div className="row" style={{ justifyContent: 'space-between' }}><span>Total ongkir</span><b>{rp(ongkir)}</b></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 4 }}>
          <span style={{ fontWeight: 700, fontSize: '1.02rem' }}>Total Pembayaran</span>
          <b style={{ fontSize: '1.2rem', color: 'var(--or-d)' }}>{rp(total)}</b>
        </div>

        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
          <small>
            Produk dari mitra berbeda dipisah menjadi satu pesanan per mitra. {f.metode === 'QRIS' ? 'Admin memeriksa pembayaran sebelum mitra memproses pesanan.' : 'Mitra mengonfirmasi pembayaran di lapak.'}
          </small>
        </p>
      </aside>
    </main>
  );
}
