'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { list, ubah, hapus, hitungKeranjang, Query, rp } from '@/lib/aw';
import { addOnValid, namaDenganAddOn } from '@/lib/add-on';
import StatusMuat from '@/components/StatusMuat';
import { useSaya } from '@/components/Shell';

export default function Keranjang() {
  const { akun, memuat, keranjang, muatKeranjang } = useSaya();
  const [{ data: produk, untuk: produkDimuat }, setProduk] = useState({ data: new Map(), untuk: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const pesan = sessionStorage.getItem('lapakwu_pesan_add_on');
    if (pesan) {
      setMsg(pesan);
      sessionStorage.removeItem('lapakwu_pesan_add_on');
    }
  }, []);

  const idsProduk = useMemo(() => JSON.stringify([...new Set(keranjang.map((i) => i.id_produk))].sort()), [keranjang]);

  useEffect(() => {
    const ids = JSON.parse(idsProduk);
    if (!akun || !ids.length) return;
    let aktif = true;
    list('produk', [Query.equal('$id', ids), Query.limit(500)])
      .then((ps) => { if (aktif) setProduk({ data: new Map(ps.map((p) => [p.$id, p])), untuk: idsProduk }); })
      .catch((e) => { if (aktif) setMsg(e.message); });
    return () => { aktif = false; };
  }, [akun, idsProduk]);

  const it = keranjang.map((i) => ({ ...i, p: produk.get(i.id_produk) }));

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

  if (memuat) return <main className="wrap"><StatusMuat teks="Memuat keranjang…" /></main>;
  if (!akun) return <main className="wrap"><p className="kosong">Silakan masuk untuk melihat keranjang belanja. <Link className="link" href="/masuk">Masuk</Link></p></main>;
  const total = it.reduce((a, i) => a + i.subtotal, 0);
  return (
    <main className="wrap">
      <h2>Keranjang</h2>
      {msg && <p className="msg err" role="alert">{msg}</p>}
      {!it.length && <p className="kosong">Keranjangmu kosong. <Link className="link" href="/">Lihat katalog</Link></p>}
      <div className="stack">
        {it.map((i) => (
          <div key={i.$id ?? (`produk:${i.id_produk}:${i.add_on ?? ''}:${i.catatan_item ?? ''}`)} className="card pad row" style={{ justifyContent: 'space-between' }}>
            <div><b>{namaDenganAddOn(i.p?.nama || (produkDimuat === idsProduk ? 'Produk dihapus' : 'Memuat produk…'), i.add_on)}</b><br /><small className="muted">{rp(i.p?.harga)} per item</small>
              {i.catatan_item && <small className="catatan-item">Catatan: {i.catatan_item}</small>}
              {i.p && !addOnValid(i.p, i.add_on) && <p className="msg err">Pilihan add-on berubah. Hapus item ini lalu <Link className="link" href={`/produk/${i.id_produk}`}>pilih ulang</Link>.</p>}</div>
            <div className="row">
              <button className="btn out sm" aria-label="Kurangi" onClick={() => ganti(i, -1)} disabled={!i.$id}>−</button>
              <b>{i.jumlah}</b>
              <button className="btn out sm" aria-label="Tambah" onClick={() => ganti(i, 1)} disabled={!i.p || !i.$id || !addOnValid(i.p, i.add_on)}>+</button>
              <b style={{ minWidth: 100, textAlign: 'right' }}>{rp(i.subtotal)}</b>
              <button className="link" onClick={() => ganti(i, -i.jumlah)} disabled={!i.$id}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      {it.length > 0 && <div className="row" style={{ justifyContent: 'space-between', marginTop: 22 }}>
        <h3>Total {rp(total)}</h3><Link className="btn sun" href="/checkout">Lanjut checkout</Link></div>}
    </main>
  );
}
