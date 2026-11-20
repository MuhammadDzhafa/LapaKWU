'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ambil, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function Detail() {
  const { id } = useParams();
  const r = useRouter();
  const { akun, peran, toast, keranjang, ubahItemKeranjang } = useSaya();
  const [p, setP] = useState(null);
  const [mt, setMt] = useState(null);
  const [n, setN] = useState(1);
  const [inputVal, setInputVal] = useState('1');

  const inCartQty = useMemo(() => {
    return (keranjang || []).find((i) => i.id_produk === id)?.jumlah || 0;
  }, [keranjang, id]);

  useEffect(() => {
    ambil('produk', id).then(async (x) => { setP(x); setMt(await ambil('mitra', x.id_mitra).catch(() => null)); }).catch(() => setP(false));
    const t = setInterval(() => {
      if (document.hidden) return;
      ambil('produk', id).then(async (produk) => {
        setP(produk);
        setMt(await ambil('mitra', produk.id_mitra));
      }).catch(() => {});
    }, 30000); // stok mengikuti penjualan offline mitra
    return () => clearInterval(t);
  }, [id]);

  const updateQty = (val) => {
    const maxStok = p?.stok || 1;
    const clamped = Math.max(1, Math.min(maxStok, val));
    setN(clamped);
    setInputVal(String(clamped));
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const maxStok = p?.stok || 1;
      setN(Math.min(maxStok, parsed));
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputVal, 10);
    if (isNaN(parsed) || parsed < 1) {
      updateQty(1);
    } else {
      updateQty(parsed);
    }
  };

  const cek = () => {
    return true;
  };
  const tambahKeKeranjang = async () => {
    if (!akun) {
      sessionStorage.setItem('lapakwu_checkout_intent', JSON.stringify({ productId: id, quantity: n }));
      r.push('/masuk');
      return;
    }
    if (!cek()) return;
    await ubahItemKeranjang(p, n);
  };
  const beli = () => {
    if (!akun) {
      sessionStorage.setItem('lapakwu_checkout_intent', JSON.stringify({ productId: id, quantity: n }));
      r.push('/masuk');
      return;
    }
    if (!cek()) return;
    r.push(`/checkout?beli=${id}&jml=${n}`);
  };

  if (p === null) return <main className="wrap"><div className="skel" style={{ maxWidth: 420 }} /></main>;
  if (p === false) return <main className="wrap"><p className="kosong">Produk tidak ditemukan atau sudah dihapus.</p></main>;
  return (
    <main className="wrap split">
      <div className="card ph">{p.id_gambar ? <img src={img(p.id_gambar)} alt={p.nama} /> : <span>{p.nama[0]}</span>}</div>
      <div className="stack">
        <h2 style={{ marginBottom: 0 }}>{p.nama}</h2>
        <p className="muted">{p.kategori} • dijual oleh <b>{mt?.nama_usaha || 'Mitra'}</b></p>
        <p className="muted">{mt?.antar_aktif ? 'Siap diantar + ' + rp(mt.ongkir) + ' ongkir per pesanan' : 'Ambil di lapak'}</p>
        <span className="tag" style={{ fontSize: '1.4rem' }}>{rp(p.harga)}</span>
        <p>{p.deskripsi || 'Belum ada deskripsi.'}</p>
        <p><span className="badge" data-s={p.stok > 0 ? 'AKTIF' : 'DIBATALKAN'}>{p.stok > 0 ? `Stok ${p.stok}` : 'Stok habis'}</span>{mt?.alamat_usaha && <small className="muted"> &nbsp;Lapak di {mt.alamat_usaha}</small>}</p>
        {p.stok > 0 ? (<>
          <div className="row">
            <label htmlFor="jml"><b>Jumlah</b></label>
            <button type="button" className="btn out sm" aria-label="Kurangi" disabled={n <= 1} onClick={() => updateQty(n - 1)}>−</button>
            <input
              id="jml"
              type="number"
              min="1"
              max={p.stok}
              value={inputVal}
              style={{ width: 80, textAlign: 'center' }}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
            />
            <button type="button" className="btn out sm" aria-label="Tambah" disabled={n >= p.stok} onClick={() => updateQty(n + 1)}>+</button>
            <b style={{ marginLeft: 8 }}>{rp(p.harga * n)}</b>
          </div>
          {inCartQty > 0 && (
            <div style={{ background: 'var(--tint)', border: '1px solid var(--or)', padding: '10px 16px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span>✓ <b>{inCartQty}</b> produk sudah ada di keranjangmu</span>
              <Link href="/keranjang" className="link" style={{ fontSize: '0.92rem' }}>Buka Keranjang →</Link>
            </div>
          )}
          <div className="row">
            <button className="btn sun lg" onClick={beli}>Beli sekarang</button>
            <button className="btn out lg" onClick={tambahKeKeranjang}>+ Tambah ke keranjang</button>
          </div>
        </>) : <p className="msg err">Produk ini sedang habis.</p>}
      </div>
    </main>
  );
}
