'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ambil, tambahKeranjang, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function Detail() {
  const { id } = useParams();
  const r = useRouter();
  const { akun, peran, toast } = useSaya();
  const [p, setP] = useState(null);
  const [mt, setMt] = useState(null);
  const [n, setN] = useState(1);

  useEffect(() => {
    ambil('produk', id).then(async (x) => { setP(x); setMt(await ambil('mitra', x.id_mitra).catch(() => null)); }).catch(() => setP(false));
    const t = setInterval(() => { if (!document.hidden) ambil('produk', id).then(setP).catch(() => {}); }, 15000); // stok mengikuti penjualan offline mitra
    return () => clearInterval(t);
  }, [id]);

  const cek = () => {
    if (!akun) { r.push('/masuk'); return false; }
    if (peran !== 'pembeli') { toast('Pembelian hanya untuk akun pembeli.', true); return false; }
    return true;
  };
  const keranjang = async () => {
    if (!cek()) return;
    try { const j = await tambahKeranjang(akun.$id, p, n); toast(`Keranjang: ${j} × ${p.nama}`); } catch (e) { toast(e.message, true); }
  };
  const beli = () => { if (cek()) r.push(`/checkout?beli=${id}&jml=${n}`); };

  if (p === null) return <main className="wrap"><div className="skel" style={{ maxWidth: 420 }} /></main>;
  if (p === false) return <main className="wrap"><p className="kosong">Produk tidak ditemukan atau sudah dihapus.</p></main>;
  return (
    <main className="wrap split">
      <div className="card ph">{p.id_gambar ? <img src={img(p.id_gambar)} alt={p.nama} /> : <span>{p.nama[0]}</span>}</div>
      <div className="stack">
        <h2 style={{ marginBottom: 0 }}>{p.nama}</h2>
        <p className="muted">{p.kategori} • dijual oleh <b>{mt?.nama_usaha || 'Mitra'}</b></p>
        <span className="tag" style={{ fontSize: '1.4rem' }}>{rp(p.harga)}</span>
        <p>{p.deskripsi || 'Belum ada deskripsi.'}</p>
        <p><span className="badge" data-s={p.stok > 0 ? 'AKTIF' : 'DIBATALKAN'}>{p.stok > 0 ? `Stok ${p.stok}` : 'Stok habis'}</span>{mt?.alamat_usaha && <small className="muted"> &nbsp;Lapak di {mt.alamat_usaha}</small>}</p>
        {p.stok > 0 ? (<>
          <div className="row">
            <label htmlFor="jml"><b>Jumlah</b></label>
            <button className="btn out sm" aria-label="Kurangi" onClick={() => setN(Math.max(1, n - 1))}>−</button>
            <input id="jml" type="number" min="1" max={p.stok} value={n} style={{ width: 80, textAlign: 'center' }} onChange={(e) => setN(Math.max(1, Math.min(p.stok, +e.target.value || 1)))} />
            <button className="btn out sm" aria-label="Tambah" onClick={() => setN(Math.min(p.stok, n + 1))}>+</button>
            <b style={{ marginLeft: 8 }}>{rp(p.harga * n)}</b>
          </div>
          <div className="row">
            <button className="btn sun lg" onClick={beli}>Beli sekarang</button>
            <button className="btn out lg" onClick={keranjang}>Tambah ke keranjang</button>
          </div>
        </>) : <p className="msg err">Produk ini sedang habis.</p>}
      </div>
    </main>
  );
}
