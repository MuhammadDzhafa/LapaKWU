'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSaya } from '@/components/Shell';
import { addOnValid, hargaAddOn, hargaSatuanProduk, MAKS_CATATAN_ITEM, simpanPilihanAddOn } from '@/lib/add-on';
import { rp } from '@/lib/aw';

export default function PilihAddOn({ produk, jumlah = 1, onTutup, onBeli }) {
  const dialog = useRef(null);
  const mengirim = useRef(false);
  const judul = useId();
  const catatanId = useId();
  const router = useRouter();
  const { akun, memuat, ubahItemKeranjang } = useSaya();
  const [terpilih, setTerpilih] = useState([]);
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    const elemen = dialog.current;
    elemen.showModal();
    return () => elemen.close();
  }, []);

  const pilihan = simpanPilihanAddOn(terpilih);
  const valid = addOnValid(produk, pilihan) && jumlah <= produk.stok;
  const tambah = async (e) => {
    e.preventDefault();
    if (!valid || memuat || mengirim.current) return;
    if (onBeli) return onBeli(pilihan);
    if (!akun) {
      sessionStorage.removeItem('lapakwu_checkout_intent');
      sessionStorage.setItem('lapakwu_add_on_intent', JSON.stringify({ id: produk.$id, jumlah, pilihan, catatan: catatan.trim() }));
      router.push('/masuk');
      return;
    }
    mengirim.current = true;
    setSibuk(true);
    setPesan('');
    try {
      const hasil = await ubahItemKeranjang(produk, jumlah, pilihan, catatan.trim());
      if (hasil > 0) onTutup();
      else setPesan('Produk belum masuk ke keranjang. Periksa ketersediaan stok dan coba lagi.');
    } finally {
      mengirim.current = false;
      setSibuk(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby={judul} className="denah-modal add-on-dialog" onCancel={(e) => { e.preventDefault(); if (!sibuk) onTutup(); }}>
      <div className="modal-head">
        <h3 id={judul}>{produk.nama}</h3>
        <button type="button" className="modal-x" aria-label="Tutup" disabled={sibuk} onClick={onTutup}>✕</button>
      </div>
      <form className="stack" onSubmit={tambah}>
        <fieldset className="add-on-pilihan" disabled={sibuk}>
          <legend>Pilih add-on (boleh lebih dari satu)</legend>
          {(produk.pilihan_add_on || []).map((nama) => (
            <label key={nama}>
              <input type="checkbox" name="add-on" value={nama} checked={terpilih.includes(nama)} onChange={(e) => {
                const { checked } = e.target;
                setTerpilih((sebelumnya) => checked ? [...sebelumnya, nama] : sebelumnya.filter((item) => item !== nama));
              }} />
              <span>{nama}</span>
              {hargaAddOn(produk, nama) > 0 && <b className="add-on-tambahan">+{rp(hargaAddOn(produk, nama))}</b>}
            </label>
          ))}
        </fieldset>
        {!onBeli && <div className="field">
          <label htmlFor={catatanId}>Catatan (opsional)</label>
          <textarea id={catatanId} rows={2} maxLength={MAKS_CATATAN_ITEM} placeholder="Misalnya, jangan terlalu manis" value={catatan} disabled={sibuk} onChange={(e) => setCatatan(e.target.value)} />
        </div>}
        {pesan && <p className="msg err" role="alert">{pesan}</p>}
        <button className="btn sun" disabled={!valid || sibuk || memuat}>
          <span>{sibuk ? 'Menambahkan…' : onBeli ? 'Beli sekarang' : 'Tambah pembelian'}</span>
          <b>{rp(jumlah * hargaSatuanProduk(produk, pilihan))}</b>
        </button>
      </form>
    </dialog>
  );
}
