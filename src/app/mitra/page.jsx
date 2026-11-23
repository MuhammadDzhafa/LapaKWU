'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { list, api, storage, ID, Query, BUCKET, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import { periodeJakarta } from '@/lib/waktu';
import StatusMuat from '@/components/StatusMuat';
import Modal from '@/components/Modal';
import { kategoriProduk } from '@/lib/kategori';
import { hargaAddOn, perubahanStok, stokPilihan } from '@/lib/add-on';
import PilihKategoriProduk from '@/components/PilihKategoriProduk';
import InputVarian from '@/components/InputVarian';
import Ikon from '@/components/Ikon';
import { Hitung } from '@/components/Motion';

const Pesanan = dynamic(() => import('@/components/Pesanan'), { loading: () => <StatusMuat teks="Memuat pesanan…" /> });
const DompetMitra = dynamic(() => import('@/components/DompetMitra'), { loading: () => <StatusMuat teks="Memuat dompet…" /> });
const Rekap = dynamic(() => import('@/components/Rekap'), { loading: () => <StatusMuat teks="Memuat rekap penjualan…" /> });

const varianKosong = () => [{ nama: '', harga: 0, stok: 0 }];
const siapkanVarian = (daftar) => daftar.map(({ nama, harga, stok }) => ({
  nama, harga: Number(harga), ...(stok == null || stok === '' ? {} : { stok: Number(stok) }),
}));

export default function Lapak() {
  const { akun, peran, pengguna, mitra, memuat, muat: muatSaya, toast } = useSaya();
  const [tab, setTab] = useState('produk');
  const [ps, setPs] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [cariProduk, setCariProduk] = useState('');
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ nama: '', harga: '', kategori_list: [''], deskripsi: '', stok: '', pilihan_add_on: varianKosong() });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [st, setSt] = useState(null);
  const [off, setOff] = useState(null);
  const [edit, setEdit] = useState({});
  const [layanan, setLayanan] = useState(null);
  const [simpanLayanan, setSimpanLayanan] = useState(false);

  // Modal State pengganti alert/confirm/prompt
  const [modalInfo, setModalInfo] = useState(null);
  const [busyModal, setBusyModal] = useState(false);

  // QRIS State
  const [fileQris, setFileQris] = useState(null);
  const [previewQris, setPreviewQris] = useState(null);
  const [busyQris, setBusyQris] = useState(false);

  const muat = useCallback(async () => setPs(await list('produk', [Query.equal('id_mitra', akun.$id), Query.orderDesc('$createdAt')])), [akun]);
  useEffect(() => {
    if (!akun || peran !== 'mitra') return;
    muat().catch((e) => setMsg(e.message));
    const kontrol = new AbortController();
    fetch('/api/kategori', { signal: kontrol.signal }).then(async (res) => {
      if (!res.ok) throw new Error('Daftar kategori gagal dimuat.');
      setKategori((await res.json()).kategori);
    }).catch((e) => { if (e.name !== 'AbortError') setMsg(e.message); });
    Promise.all([list('pesanan', [Query.equal('id_mitra', akun.$id)]), list('rekap_penjualan', [Query.equal('id_mitra', akun.$id)])]).then(([o, rk]) => {
      const bln = new Date().toISOString().slice(0, 7), skr = rk.find((x) => x.periode === bln);
      setSt({ baru: o.filter((x) => x.status_pesanan === 'MENUNGGU_KONFIRMASI').length, jual: skr?.total_penjualan || 0 });
    }).catch(() => {});
    return () => kontrol.abort();
  }, [akun, peran, muat]);

  const bln = () => periodeJakarta();
  const muatOff = useCallback(() => list('penjualan_offline', [Query.equal('id_mitra', akun.$id), Query.equal('periode', bln()), Query.limit(500)]).then(setOff).catch(() => setOff([])), [akun]);
  useEffect(() => { if (akun && peran === 'mitra' && tab === 'offline') muatOff(); }, [akun, peran, tab, muatOff]);
  useEffect(() => {
    const bukaPesanan = () => { if (location.hash === '#pesanan') setTab('pesanan'); };
    bukaPesanan();
    window.addEventListener('hashchange', bukaPesanan);
    window.addEventListener('popstate', bukaPesanan);
    return () => {
      window.removeEventListener('hashchange', bukaPesanan);
      window.removeEventListener('popstate', bukaPesanan);
    };
  }, []);
  if (memuat) return <main className="wrap"><StatusMuat teks="Memuat lapak…" /></main>;
  if (peran !== 'mitra') return <main className="wrap"><p className="kosong">Halaman ini khusus mitra. <Link className="link" href="/masuk">Masuk atau daftar sebagai mitra</Link></p></main>;
  if (pengguna?.status_akun !== 'AKTIF') return (
    <main className="wrap" style={{ maxWidth: 620 }}><h2>Lapak {mitra?.nama_usaha}</h2>
      <p className="msg">{pengguna?.status_akun === 'DITOLAK' ? `Datamu perlu diperbaiki: ${mitra?.catatan_verifikasi}` : pengguna?.status_akun === 'DIBLOKIR' ? 'Akunmu diblokir admin.' : 'Akunmu menunggu verifikasi email dan persetujuan admin. Setelah disetujui, kamu bisa menambah produk di sini.'}</p></main>);

  const kataProduk = cariProduk.trim().toLowerCase();
  const produkCocok = (ps ?? []).filter((p) => [p.nama, ...kategoriProduk(p), ...(p.pilihan_add_on ?? [])].some((nilai) => nilai?.toLowerCase().includes(kataProduk)));
  const punyaVarian = f.pilihan_add_on.some(({ nama }) => nama.trim());
  const totalVarian = f.pilihan_add_on.reduce((total, { nama, stok }) => total + (nama.trim() ? Number(stok || 0) : 0), 0);
  const pengantaran = layanan ?? { antar_aktif: mitra?.antar_aktif === true, ongkir: mitra?.ongkir ?? 0 };
  const simpanPengantaran = async (e) => {
    e.preventDefault();
    setSimpanLayanan(true);
    try {
      await api('/api/profil', {
        aksi: 'pengantaran',
        antar_aktif: pengantaran.antar_aktif,
        ...(pengantaran.antar_aktif ? { ongkir: Number(pengantaran.ongkir) } : {}),
      });
      await muatSaya();
      setLayanan(null);
      toast('Pengaturan pengantaran disimpan.');
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSimpanLayanan(false);
    }
  };

  const tambah = async (e) => {
    e.preventDefault(); setMsg('');
    if (file) {
      const izinTipe = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const izinUkuran = file.size <= 5 * 1024 * 1024;
      if (!izinTipe) return setMsg('Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
      if (!izinUkuran) return setMsg('Ukuran foto maksimal 5 MB.');
    }
    try {
      let id_gambar;
      if (file) id_gambar = (await storage.createFile({ bucketId: BUCKET, fileId: ID.unique(), file })).$id;
      await api('/api/produk', { aksi: 'tambah', nama: f.nama, harga: +f.harga, kategori_list: f.kategori_list, deskripsi: f.deskripsi, stok: punyaVarian ? totalVarian : +f.stok, pilihan_add_on: siapkanVarian(f.pilihan_add_on.map((v) => ({ ...v, stok: v.stok || 0 }))), ...(id_gambar ? { id_gambar } : {}) });
      setF({ nama: '', harga: '', kategori_list: [''], deskripsi: '', stok: '', pilihan_add_on: varianKosong() }); setFile(null); setPreview(null); e.target.reset(); toast('Produk berhasil ditambahkan.'); await muat();
    } catch (er) { setMsg(er.message); }
  };
  const segarkanStat = () => list('rekap_penjualan', [Query.equal('id_mitra', akun.$id)]).then((rk) => setSt((s) => s && ({ ...s, jual: rk.find((x) => x.periode === bln())?.total_penjualan || 0 }))).catch(() => {});
  // Tap +/−: angka stok berubah langsung di layar, server mencatat stok dan rekap. Gagal -> data dimuat ulang.
  const ketuk = async (p, aksi, varian = '') => {
    if (aksi === 'jual' && stokPilihan(p, varian) < 1) return setMsg(`Stok ${varian || p.nama} sudah habis.`);
    setMsg(''); setPs((l) => l.map((x) => x.$id === p.$id ? { ...x, ...perubahanStok(x, varian, aksi === 'jual' ? -1 : 1) } : x));
    try { await api('/api/stok', { aksi, id: p.$id, jumlah: 1, varian }); if (aksi === 'jual') segarkanStat(); }
    catch (e) { setMsg(e.message); muat(); }
  };
  const koreksi = async (nama, id, baru) => {
    try { const r = await api('/api/stok', { aksi: 'koreksi', id, baru }); setMsg(`${r.dikembalikan} pcs ${nama} dikembalikan ke stok, rekap ikut dikoreksi.`); setEdit({}); await Promise.all([muat(), muatOff(), segarkanStat()]); }
    catch (e) { setMsg(e.message); }
  };
  const stok = (p) => {
    setModalInfo({
      judul: `Ubah Stok ${p.nama}`,
      pesan: `Masukkan jumlah stok fisik produk ${p.nama} yang tersedia saat ini:`,
      tipe: 'input',
      inputType: 'number',
      inputLabel: 'Jumlah stok (pcs)',
      inputDefault: p.stok,
      tombolOk: 'Simpan Stok',
      onOk: async (v) => {
        if (v === null || isNaN(+v) || +v < 0) return;
        setBusyModal(true);
        try {
          await api('/api/produk', { aksi: 'ubah', id: p.$id, stok: +v });
          await muat();
          setMsg(`Stok ${p.nama} berhasil diubah.`);
          setModalInfo(null);
        } catch (e) {
          setMsg(e.message);
          setModalInfo(null);
        }
        setBusyModal(false);
      },
    });
  };

  const harga = (p) => {
    setModalInfo({
      judul: `Ubah Harga ${p.nama}`,
      pesan: `Masukkan harga jual baru untuk produk ${p.nama}:`,
      tipe: 'input',
      inputType: 'number',
      inputLabel: 'Harga baru (Rp)',
      inputDefault: p.harga,
      tombolOk: 'Simpan Harga',
      onOk: async (v) => {
        if (v === null || isNaN(+v) || +v < 0) return;
        setBusyModal(true);
        try {
          await api('/api/produk', { aksi: 'ubah', id: p.$id, harga: +v });
          await muat();
          setMsg(`Harga ${p.nama} berhasil diubah.`);
          setModalInfo(null);
        } catch (e) {
          setMsg(e.message);
          setModalInfo(null);
        }
        setBusyModal(false);
      },
    });
  };

  const ubahAddOn = (p) => {
    setModalInfo({
      judul: `Ubah varian ${p.nama}`,
      pesan: p.stok_varian
        ? `Stok katalog: ${p.stok} pcs.${p.stok_belum_dialokasikan ? ` Alokasikan juga ${p.stok_belum_dialokasikan} pcs stok retur yang belum punya varian.` : ''}`
        : `Isi stok setiap varian untuk membagi stok saat ini (${p.stok} pcs).`,
      tipe: 'input',
      inputType: 'varian',
      inputLabel: 'Varian dan stok (opsional)',
      inputDefault: p.pilihan_add_on?.length ? p.pilihan_add_on.map((nama) => ({
        nama, harga: hargaAddOn(p, nama), stok: p.stok_varian ? stokPilihan(p, nama) : '',
      })) : varianKosong(),
      inputOpsional: true,
      tombolOk: 'Simpan varian',
      onOk: async (nilai) => {
        setBusyModal(true);
        try {
          await api('/api/produk', { aksi: 'ubah', id: p.$id, pilihan_add_on: siapkanVarian(nilai), stok_diharapkan: p.$updatedAt });
          await muat();
          setModalInfo(null);
          toast('Varian berhasil disimpan.');
        } catch (e) {
          toast(e.message, true);
          await muat();
          setModalInfo(null);
        } finally {
          setBusyModal(false);
        }
      },
    });
  };

  const ubahKategori = (p) => {
    const kategori = kategoriProduk(p);
    setModalInfo({
      judul: `Ubah kategori ${p.nama}`,
      tipe: 'input',
      inputType: 'kategori',
      inputDefault: kategori.length ? kategori : [''],
      tombolOk: 'Simpan kategori',
      onOk: async (nilai) => {
        setBusyModal(true);
        try {
          await api('/api/produk', { aksi: 'ubah', id: p.$id, kategori_list: nilai });
          await muat();
          setModalInfo(null);
          toast('Kategori produk berhasil disimpan.');
        } catch (e) {
          setModalInfo((info) => info && ({ ...info, pesan: e.message }));
        } finally {
          setBusyModal(false);
        }
      },
    });
  };

  const hapusP = (p) => {
    setModalInfo({
      judul: `Hapus Produk ${p.nama}?`,
      pesan: `Apakah kamu yakin ingin menghapus produk "${p.nama}"? Produk yang dihapus tidak akan muncul lagi di katalog lapak.`,
      warnaOk: 'red',
      tombolOk: 'Hapus Produk',
      onOk: async () => {
        setBusyModal(true);
        try {
          await api('/api/produk', { aksi: 'hapus', id: p.$id });
          await muat();
          setMsg(`Produk ${p.nama} berhasil dihapus.`);
          setModalInfo(null);
        } catch (e) {
          setMsg(e.message);
          setModalInfo(null);
        }
        setBusyModal(false);
      },
    });
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) { setFile(null); setPreview(null); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleFileQris = (e) => {
    const f = e.target.files[0];
    if (!f) { setFileQris(null); setPreviewQris(null); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      return setMsg('Format QRIS tidak didukung. Gunakan JPG, PNG, atau WebP.');
    }
    if (f.size > 5 * 1024 * 1024) {
      return setMsg('Ukuran foto QRIS maksimal 5 MB.');
    }
    setMsg('');
    setFileQris(f);
    setPreviewQris(URL.createObjectURL(f));
  };

  const simpanQris = async (e) => {
    e.preventDefault();
    if (!fileQris) return;
    setBusyQris(true);
    setMsg('');
    try {
      const res = await storage.createFile({ bucketId: BUCKET, fileId: ID.unique(), file: fileQris, jenis: 'qris' });
      await api('/api/profil', { aksi: 'detail', id_qris: res.$id });
      setFileQris(null);
      setPreviewQris(null);
      if (muatSaya) await muatSaya();
      setMsg('QRIS toko berhasil disimpan.');
    } catch (err) {
      setMsg(err.message);
    }
    setBusyQris(false);
  };

  const hapusQris = () => {
    setModalInfo({
      judul: 'Hapus Barcode QRIS Toko?',
      pesan: 'Gambar barcode QRIS tokomu akan dihapus. Unggah QRIS baru sebelum mengajukan pencairan berikutnya.',
      warnaOk: 'red',
      tombolOk: 'Hapus QRIS',
      onOk: async () => {
        setBusyModal(true);
        try {
          await api('/api/profil', { aksi: 'hapus_qris' });
          if (muatSaya) await muatSaya();
          setMsg('QRIS toko berhasil dihapus.');
          setModalInfo(null);
        } catch (err) {
          setMsg(err.message);
          setModalInfo(null);
        }
        setBusyModal(false);
      },
    });
  };

  return (
    <main className="wrap">
      {modalInfo && (
        <Modal
          judul={modalInfo.judul}
          pesan={modalInfo.pesan}
          tipe={modalInfo.tipe}
          inputType={modalInfo.inputType}
          inputLabel={modalInfo.inputLabel}
          inputDefault={modalInfo.inputDefault}
          kategori={kategori}
          inputOpsional={modalInfo.inputOpsional}
          inputPlaceholder={modalInfo.inputPlaceholder}
          tombolOk={modalInfo.tombolOk}
          warnaOk={modalInfo.warnaOk}
          busy={busyModal}
          onOk={modalInfo.onOk}
          onBatal={() => setModalInfo(null)}
        />
      )}
      <div className="dash-head">
        <div>
          <h2>Lapak {mitra?.nama_usaha}</h2>
          <p>Atur produk, stok, dan pesanan masuk dari sini.</p>
        </div>
        {st && <span className={'todo' + (st.baru ? '' : ' ok')} role="status">{st.baru ? `${st.baru} pesanan baru` : 'Belum ada pesanan baru'}</span>}
      </div>
      {st && <div className="stats">
        <button type="button" className="stat" onClick={() => setTab('pesanan')}><i className="si"><Ikon n="inbox" size={22} /></i><small>Pesanan baru</small><b><Hitung ke={Number(st.baru) || 0} /></b></button>
        <div className="stat"><i className="si"><Ikon n="chart" size={22} /></i><small>Penjualan bulan ini</small><b>{rp(st.jual)}</b></div>
      </div>}
      {!mitra?.id_qris && (
        <div className="msg" style={{ background: 'var(--tint)', border: '1px solid var(--ye)', color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>⚠️ <b>Barcode QRIS toko belum diunggah.</b> Unggah QRIS untuk menerima pencairan saldo.</span>
          <button type="button" className="btn sm" onClick={() => setTab('qris')} style={{ whiteSpace: 'nowrap' }}>Upload QRIS Sekarang</button>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Bagian lapak">
        {[
          ['produk', 'Produk dan stok', 'box'],
          ['offline', 'Terjual offline', 'tag'],
          ['pesanan', 'Pesanan masuk', 'inbox'],
          ['qris', 'QRIS Toko', 'qr'],
          ['dompet', 'Dompet Mitra', 'wallet'],
          ['rekap', 'Rekap Penjualan', 'chart'],
        ].map(([k, t, ic]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => {
            if (k !== 'pesanan' && location.hash === '#pesanan') history.replaceState(null, '', location.pathname + location.search);
            setTab(k);
          }}>
            <Ikon n={ic} size={16} />{t}
          </button>
        ))}
      </div>

      {msg && <p className="msg" role="status">{msg}</p>}

      {tab === 'produk' && <form className="card pad stack pengaturan-antar" onSubmit={simpanPengantaran}>
        <h3>Pengantaran pesanan</h3>
        <label className="row"><input type="checkbox" role="switch" style={{ width: 'auto' }}
          checked={pengantaran.antar_aktif} disabled={simpanLayanan}
          onChange={(e) => setLayanan({ ...pengantaran, antar_aktif: e.target.checked })} /> Terima pesanan antar</label>
        <div className="field">
          <label htmlFor="ongkir">Ongkir per pesanan (Rp)</label>
          <input id="ongkir" type="number" required min="0" max="999999999" step="1"
            value={pengantaran.ongkir} disabled={!pengantaran.antar_aktif || simpanLayanan}
            onChange={(e) => setLayanan({ ...pengantaran, ongkir: e.target.value })} />
        </div>
        <button className="btn sm sun" disabled={simpanLayanan}>Simpan pengantaran</button>
      </form>}
      {tab === 'produk' && <div className="split s1">
        <form className="card pad" onSubmit={tambah}><h3>Tambah produk</h3>
          <div className="field"><label htmlFor="pn">Nama</label><input id="pn" required value={f.nama} onChange={set('nama')} /></div>
          <div className="two"><div className="field"><label htmlFor="ph">Harga (Rp)</label><input id="ph" type="number" min="0" required value={f.harga} onChange={set('harga')} /></div>
            <div className="field"><label htmlFor="ps">Total stok (pcs)</label><input id="ps" type="number" min="0" required={!punyaVarian} readOnly={punyaVarian} value={punyaVarian ? totalVarian : f.stok} onChange={set('stok')} /></div></div>
          <PilihKategoriProduk kategori={kategori} nilai={f.kategori_list} onUbah={(kategori_list) => setF((prev) => ({ ...prev, kategori_list }))} />
          <div className="field"><label htmlFor="pd">Deskripsi</label><textarea id="pd" rows="3" value={f.deskripsi} onChange={set('deskripsi')} /></div>
          <InputVarian judul="Varian dan stok (opsional)" nilai={f.pilihan_add_on} onUbah={(pilihan_add_on) => setF((prev) => ({ ...prev, pilihan_add_on }))} />
          <div className="field"><label htmlFor="pg">Foto (jpg, png, webp, maks 5 MB)</label><input id="pg" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
            {preview && <img src={preview} alt="Preview foto produk" style={{ marginTop: 8, width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid #F0DEB0' }} />}
          </div>
          <button className="btn">Simpan produk</button>
        </form>
        <div className="stack">
          {ps === null && !msg && <StatusMuat teks="Memuat produk…" />}
          {ps === null && msg && <button className="btn out sm" type="button" onClick={() => { setMsg(''); muat().catch((e) => setMsg(e.message)); }}>Muat ulang produk</button>}
          {ps && !ps.length && <p className="kosong">Belum ada produk. Isi formulir untuk menambah produk pertamamu.</p>}
          {ps?.length > 0 && <div className="field saring-daftar">
            <label htmlFor="cari-produk-mitra">Cari produk lapak</label>
            <input id="cari-produk-mitra" type="search" placeholder="Nama, kategori, atau varian" value={cariProduk} onChange={(e) => setCariProduk(e.target.value)} />
          </div>}
          {ps?.length > 0 && !produkCocok.length && <p className="kosong">Produk tidak ditemukan.</p>}
          {produkCocok.map((p) => (
            <div key={p.$id} className="card pad row" style={{ justifyContent: 'space-between' }}>
              <div className="row">{p.id_gambar && <img src={img(p.id_gambar)} alt="" loading="lazy" decoding="async" width="56" height="56" style={{ objectFit: 'cover', borderRadius: 8 }} />}
                <div><b>{p.nama}</b><br /><small className="muted">{kategoriProduk(p).join(' · ')} • {rp(p.harga)}</small>
                  {p.pilihan_add_on?.length > 0 && <small className="muted" style={{ display: 'block' }}>{p.pilihan_add_on.map((nama) => {
                    const harga = hargaAddOn(p, nama);
                    return harga > 0 ? `${nama} (+${rp(harga)})` : nama;
                  }).join(', ')}</small>}</div></div>
              <div className="stack">
                {p.stok_varian && <b>Total stok {p.stok} pcs</b>}
                {(p.stok_belum_dialokasikan > 0) && <small className="muted">{p.stok_belum_dialokasikan} pcs retur belum dialokasikan</small>}
                {(p.stok_varian ? p.pilihan_add_on : ['']).map((nama) => (
                  <div className="row" key={nama}>
                    {nama && <span>{nama}</span>}
                    <span className="qty" role="group" aria-label={`Stok ${nama || p.nama}`}>
                      <button className="qb" aria-label={`Kurangi stok ${nama || p.nama} (terjual offline)`} disabled={stokPilihan(p, nama) < 1} onClick={() => ketuk(p, 'jual', nama)}>−</button>
                      <b className="qn" aria-live="polite">{stokPilihan(p, nama)}</b>
                      <button className="qb add" aria-label={`Tambah stok ${nama || p.nama}`} onClick={() => ketuk(p, 'tambah', nama)}>+</button>
                    </span>
                  </div>
                ))}
                <div className="row">
                  <button className="link" onClick={() => harga(p)}>Ubah harga</button>
                  {!p.stok_varian && <button className="link" onClick={() => stok(p)}>Ubah stok</button>}
                  <button className="link" onClick={() => ubahKategori(p)}>Ubah kategori</button>
                  <button className="link" onClick={() => ubahAddOn(p)}>Ubah varian</button>
                  <button className="link" onClick={() => hapusP(p)}>Hapus</button>
                </div>
              </div>
            </div>))}
        </div></div>}

      {tab === 'offline' && (() => {
        if (!off || !ps) return <p className="kosong">Memuat…</p>;
        const per = {};
        for (const l of off) { const o = (per[l.id_produk] ??= { id: l.id_produk, nama: l.nama_produk, jml: 0, uang: 0 }); o.jml += l.jumlah; o.uang += l.subtotal; }
        const baris = Object.values(per);
        if (!baris.length) return <p className="kosong">Belum ada penjualan offline bulan ini. Tekan − di tab Produk dan stok setiap ada pembeli di lapak.</p>;
        return (<>
          <div className="scroll"><table>
            <thead><tr><th>Produk</th><th>Terjual offline (bulan ini)</th><th>Pendapatan</th><th></th></tr></thead>
            <tbody>{baris.map((r) => { const v = edit[r.id] ?? r.jml; return (
              <tr key={r.id}><td>{r.nama}</td>
                <td><input type="number" min="0" max={r.jml} value={v} aria-label={`Jumlah terjual offline ${r.nama}`} style={{ width: 80 }} onChange={(e) => setEdit({ ...edit, [r.id]: e.target.value })} /></td>
                <td>{rp(r.uang)}</td>
                <td>{+v !== r.jml && <button className="btn sm sun" onClick={() => koreksi(r.nama, r.id, +v)}>Simpan koreksi</button>}</td></tr>); })}</tbody>
            <tfoot><tr><th>Total</th><th>{baris.reduce((a, r) => a + r.jml, 0)}</th><th>{rp(baris.reduce((a, r) => a + r.uang, 0))}</th><th></th></tr></tfoot>
          </table></div>
          <p className="muted" style={{ marginTop: 10 }}><small>Salah pencet −? Turunkan angka terjual lalu simpan. Stok bertambah kembali dan rekap penjualan ikut dikoreksi otomatis. Angka hanya bisa diturunkan; untuk menambah penjualan, tekan −.</small></p>
        </>);
      })()}

      {tab === 'pesanan' && <Pesanan uid={akun.$id} sebagai="mitra" />}

      {tab === 'dompet' && <DompetMitra bukaQris={() => setTab('qris')} punyaQris={Boolean(mitra?.id_qris)} />}

      {tab === 'qris' && (
        <div className="card pad stack" style={{ maxWidth: 560 }}>
          <h3>Pengaturan QRIS Toko</h3>
          <p className="muted" style={{ fontSize: '0.875rem' }}>
            Admin menggunakan QRIS toko ini untuk mencairkan saldo dompetmu.
            Pastikan QRIS aktif dan dapat dipindai.
          </p>

          {mitra?.id_qris ? (
            <div style={{ textAlign: 'center', padding: '12px', background: 'var(--tint)', borderRadius: 8, border: '1px solid var(--line)' }}>
              <b style={{ display: 'block', marginBottom: 8, color: 'var(--bl-d)' }}>QRIS Toko Aktif Saat Ini</b>
              <img
                src={img(mitra.id_qris)}
                alt="QRIS Toko"
                style={{ maxWidth: 240, width: '100%', height: 'auto', borderRadius: 8, border: '2px solid var(--line)', padding: 6, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              />
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn sm red"
                  onClick={hapusQris}
                >
                  Hapus Gambar QRIS
                </button>
              </div>
            </div>
          ) : (
            <div className="msg" style={{ background: 'var(--tint)', border: '1px solid var(--ye)', color: 'var(--ink)' }}>
              ⚠️ Belum ada gambar QRIS toko. Unggah foto QRIS tokomu melalui formulir di bawah.
            </div>
          )}

          <form onSubmit={simpanQris} className="stack" style={{ marginTop: 14 }}>
            <b>{mitra?.id_qris ? 'Ganti dengan QRIS Baru' : 'Unggah QRIS Toko'}</b>
            <div className="field">
              <label htmlFor="qris-in">Pilih File Foto QRIS (JPG, PNG, WebP, maks. 5 MB)</label>
              <input
                id="qris-in"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={handleFileQris}
              />
              {previewQris && (
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <small className="muted" style={{ display: 'block', marginBottom: 4 }}>Preview QRIS yang dipilih:</small>
                  <img
                    src={previewQris}
                    alt="Preview QRIS Baru"
                    style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--bl)' }}
                  />
                </div>
              )}
            </div>
            <button className="btn sun" disabled={busyQris || !fileQris}>
              {busyQris ? 'Menyimpan QRIS…' : 'Simpan QRIS Toko'}
            </button>
          </form>
        </div>
      )}

      {tab === 'rekap' && <Rekap mitraId={akun.$id} />}
    </main>
  );
}
