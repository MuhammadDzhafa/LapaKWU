'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { list, ubah, hapus, hitungKeranjang, Query, rp } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function Keranjang() {
  const { akun, memuat, keranjang, muatKeranjang } = useSaya();
  const [it, setIt] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!akun) return;
    let aktif = true;
    const muatProduk = async () => {
      const ps = keranjang.length ? await list('produk', [Query.equal('$id', keranjang.map((i) => i.id_produk))]) : [];
      if (aktif) setIt(keranjang.map((i) => ({ ...i, p: ps.find((p) => p.$id === i.id_produk) })));
    };
    muatProduk().catch((e) => { if (aktif) setMsg(e.message); });
    return () => { aktif = false; };
  }, [akun, keranjang]);

  const ganti = async (i, d) => {
    if (!i.$id) return;
    // Guard: verifikasi kepemilikan item keranjang
    if (i.id_keranjang !== akun.$id) return setMsg('Item ini bukan milikmu.');
    const j = i.jumlah + d;
    try {
      if (j < 1) await hapus('item_keranjang', i.$id);
      else if (!i.p) return setMsg('Produk ini sudah dihapus mitra. Hapus dari keranjang.');
      else if (j > i.p.stok) return setMsg(`Stok ${i.p.nama} tersisa ${i.p.stok}.`);
      else await ubah('item_keranjang', i.$id, { jumlah: j, subtotal: j * i.p.harga });
      await hitungKeranjang(akun.$id);
      setMsg('');
      await muatKeranjang(akun.$id);
    } catch (e) { setMsg(e.message); }
  };

  if (memuat) return <main className="wrap" />;
  if (!akun) return <main className="wrap"><p className="kosong">Silakan masuk untuk melihat keranjang belanja. <Link className="link" href="/masuk">Masuk</Link></p></main>;
  const total = (it || []).reduce((a, i) => a + i.subtotal, 0);
  return (
    <main className="wrap">
      <h2>Keranjang</h2>
      {msg && <p className="msg err" role="alert">{msg}</p>}
      {it && !it.length && <p className="kosong">Keranjangmu kosong. <Link className="link" href="/">Lihat katalog</Link></p>}
      <div className="stack">
        {(it || []).map((i) => (
          <div key={i.$id ?? ('produk:' + i.id_produk)} className="card pad row" style={{ justifyContent: 'space-between' }}>
            <div><b>{i.p?.nama || 'Produk dihapus'}</b><br /><small className="muted">{rp(i.p?.harga)} per item</small></div>
            <div className="row">
              <button className="btn out sm" aria-label="Kurangi" onClick={() => ganti(i, -1)} disabled={!i.$id}>−</button>
              <b>{i.jumlah}</b>
              <button className="btn out sm" aria-label="Tambah" onClick={() => ganti(i, 1)} disabled={!i.p || !i.$id}>+</button>
              <b style={{ minWidth: 100, textAlign: 'right' }}>{rp(i.subtotal)}</b>
              <button className="link" onClick={() => ganti(i, -i.jumlah)} disabled={!i.$id}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      {it?.length > 0 && <div className="row" style={{ justifyContent: 'space-between', marginTop: 22 }}>
        <h3>Total {rp(total)}</h3><Link className="btn sun" href="/checkout">Lanjut checkout</Link></div>}
    </main>
  );
}
