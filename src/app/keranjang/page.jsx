'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { list, ubah, hapus, hitungKeranjang, Query, rp } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function Keranjang() {
  const { akun, peran, memuat } = useSaya();
  const [it, setIt] = useState(null);
  const [msg, setMsg] = useState('');

  const muat = useCallback(async () => {
    const x = await list('item_keranjang', [Query.equal('id_keranjang', akun.$id)]);
    const ps = x.length ? await list('produk', [Query.equal('$id', x.map((i) => i.id_produk))]) : [];
    setIt(x.map((i) => ({ ...i, p: ps.find((p) => p.$id === i.id_produk) })));
  }, [akun]);
  useEffect(() => { if (akun) muat().catch((e) => setMsg(e.message)); }, [akun, muat]);

  const ganti = async (i, d) => {
    // Guard: verifikasi kepemilikan item keranjang
    if (i.id_keranjang !== akun.$id) return setMsg('Item ini bukan milikmu.');
    const j = i.jumlah + d;
    try {
      if (j < 1) await hapus('item_keranjang', i.$id);
      else if (!i.p) return setMsg('Produk ini sudah dihapus mitra. Hapus dari keranjang.');
      else if (j > i.p.stok) return setMsg(`Stok ${i.p.nama} tersisa ${i.p.stok}.`);
      else await ubah('item_keranjang', i.$id, { jumlah: j, subtotal: j * i.p.harga });
      await hitungKeranjang(akun.$id); setMsg(''); muat();
    } catch (e) { setMsg(e.message); }
  };

  if (memuat) return <main className="wrap" />;
  if (peran !== 'pembeli') return <main className="wrap"><p className="kosong">Masuk sebagai pembeli untuk memakai keranjang. <Link className="link" href="/masuk">Masuk</Link></p></main>;
  const total = (it || []).reduce((a, i) => a + i.subtotal, 0);
  return (
    <main className="wrap">
      <h2>Keranjang</h2>
      {msg && <p className="msg err" role="alert">{msg}</p>}
      {it && !it.length && <p className="kosong">Keranjangmu kosong. <Link className="link" href="/">Lihat katalog</Link></p>}
      <div className="stack">
        {(it || []).map((i) => (
          <div key={i.$id} className="card pad row" style={{ justifyContent: 'space-between' }}>
            <div><b>{i.p?.nama || 'Produk dihapus'}</b><br /><small className="muted">{rp(i.p?.harga)} per item</small></div>
            <div className="row">
              <button className="btn out sm" aria-label="Kurangi" onClick={() => ganti(i, -1)}>−</button>
              <b>{i.jumlah}</b>
              <button className="btn out sm" aria-label="Tambah" onClick={() => ganti(i, 1)} disabled={!i.p}>+</button>
              <b style={{ minWidth: 100, textAlign: 'right' }}>{rp(i.subtotal)}</b>
              <button className="link" onClick={() => ganti(i, -i.jumlah)}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      {it?.length > 0 && <div className="row" style={{ justifyContent: 'space-between', marginTop: 22 }}>
        <h3>Total {rp(total)}</h3><Link className="btn sun" href="/checkout">Lanjut checkout</Link></div>}
    </main>
  );
}
