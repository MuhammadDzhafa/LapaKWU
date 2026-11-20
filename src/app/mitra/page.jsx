'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { list, ubah, api, storage, ID, Query, BUCKET, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import { periodeJakarta } from '@/lib/waktu';
import Pesanan from '@/components/Pesanan';
import DompetMitra from '@/components/DompetMitra';
import Rekap from '@/components/Rekap';
import Modal from '@/components/Modal';
import Ikon from '@/components/Ikon';
import { Hitung } from '@/components/Motion';

export default function Lapak() {
  const { akun, peran, pengguna, mitra, memuat, muat: muatSaya, toast } = useSaya();
  const [tab, setTab] = useState('produk');
  const [ps, setPs] = useState(null);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ nama: '', harga: '', kategori: '', deskripsi: '', stok: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [st, setSt] = useState(null);
  const [off, setOff] = useState(null);
  const [edit, setEdit] = useState({});
  const [notifikasi, setNotifikasi] = useState([]);
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
    Promise.all([list('pesanan', [Query.equal('id_mitra', akun.$id)]), list('rekap_penjualan', [Query.equal('id_mitra', akun.$id)])]).then(([o, rk]) => {
      const bln = new Date().toISOString().slice(0, 7), skr = rk.find((x) => x.periode === bln);
      setSt({ baru: o.filter((x) => x.status_pesanan === 'MENUNGGU_KONFIRMASI').length, jual: skr?.total_penjualan || 0 });
    }).catch(() => {});
  }, [akun, peran, muat]);

const bln = () => periodeJakarta();
  const muatOff = useCallback(() => list('penjualan_offline', [Query.equal('id_mitra', akun.$id), Query.equal('periode', bln()), Query.limit(500)]).then(setOff).catch(() => setOff([])), [akun]);
  useEffect(() => { if (akun && peran === 'mitra' && tab === 'offline') muatOff(); }, [akun, peran, tab, muatOff]);
  const uid = akun?.$id;
  useEffect(() => {
    if (!uid || peran !== 'mitra') return;
    let aktif = true;
    const periksa = async () => {
      if (document.hidden) return;
      try {
        const hasil = await list('notifikasi', [Query.equal('id_pengguna', uid), Query.equal('sudah_dibaca', false), Query.orderDesc('$createdAt'), Query.limit(10)]);
        if (aktif) setNotifikasi(hasil);
      } catch {}
    };
    periksa();
    const timer = setInterval(periksa, 5000);
    window.addEventListener('focus', periksa);
    return () => { aktif = false; clearInterval(timer); window.removeEventListener('focus', periksa); };
  }, [uid, peran]);
  if (memuat) return <main className="wrap" />;
  if (peran !== 'mitra') return <main className="wrap"><p className="kosong">Halaman ini khusus mitra. <Link className="link" href="/masuk">Masuk atau daftar sebagai mitra</Link></p></main>;
  if (pengguna?.status_akun !== 'AKTIF') return (
    <main className="wrap" style={{ maxWidth: 620 }}><h2>Lapak {mitra?.nama_usaha}</h2>
      <p className="msg">{pengguna?.status_akun === 'DITOLAK' ? `Datamu perlu diperbaiki: ${mitra?.catatan_verifikasi}` : pengguna?.status_akun === 'DIBLOKIR' ? 'Akunmu diblokir admin.' : 'Akunmu menunggu verifikasi email dan persetujuan admin. Setelah disetujui, kamu bisa menambah produk di sini.'}</p></main>);

  const pengantaran = layanan ?? { antar_aktif: mitra?.antar_aktif === true, ongkir: mitra?.ongkir ?? 0 };
  const simpanPengantaran = async (e) => {
    e.preventDefault();
    setSimpanLayanan(true);
    try {
      await api('/api/profil', { aksi: 'pengantaran', ...pengantaran, ongkir: Number(pengantaran.ongkir) });
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
      await api('/api/produk', { aksi: 'tambah', nama: f.nama, harga: +f.harga, kategori: f.kategori, deskripsi: f.deskripsi, stok: +f.stok, ...(id_gambar ? { id_gambar } : {}) });
      setF({ nama: '', harga: '', kategori: '', deskripsi: '', stok: '' }); setFile(null); setPreview(null); e.target.reset(); toast('Produk berhasil ditambahkan.'); await muat();
    } catch (er) { setMsg(er.message); }
  };
  const segarkanStat = () => list('rekap_penjualan', [Query.equal('id_mitra', akun.$id)]).then((rk) => setSt((s) => s && ({ ...s, jual: rk.find((x) => x.periode === bln())?.total_penjualan || 0 }))).catch(() => {});
  // Tap +/−: angka stok berubah langsung di layar, server mencatat stok dan rekap. Gagal -> data dimuat ulang.
  const ketuk = async (p, aksi) => {
    if (aksi === 'jual' && p.stok < 1) return setMsg(`Stok ${p.nama} sudah habis.`);
    setMsg(''); setPs((l) => l.map((x) => (x.$id === p.$id ? { ...x, stok: x.stok + (aksi === 'jual' ? -1 : 1) } : x)));
    try { await api('/api/stok', { aksi, id: p.$id, jumlah: 1 }); if (aksi === 'jual') segarkanStat(); }
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
      const res = await storage.createFile({ bucketId: BUCKET, fileId: ID.unique(), file: fileQris });
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
          <button key={k} role="tab" aria-selected={tab === k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
            <Ikon n={ic} size={16} />{t}
          </button>
        ))}
      </div>

      {msg && <p className="msg" role="status">{msg}</p>}

      {!!notifikasi.length && <section className="card pad stack" aria-live="polite">
        <h3>Notifikasi lapak</h3>
        {notifikasi.map((n) => <div key={n.$id}>
          <b>{n.judul}</b><p style={{ overflowWrap: 'anywhere' }}>{n.pesan}</p>
          <button type="button" className="btn sm out" onClick={async () => {
            setTab('pesanan');
            try {
              await ubah('notifikasi', n.$id, { sudah_dibaca: true });
              setNotifikasi((items) => items.filter((item) => item.$id !== n.$id));
            } catch (error) { toast(error.message, true); }
          }}>Lihat pesanan</button>
        </div>)}
      </section>}
      {tab === 'produk' && <form className="card pad stack" onSubmit={simpanPengantaran}>
        <h3>Pengantaran pesanan</h3>
        <label className="row"><input type="checkbox" role="switch" style={{ width: 'auto' }}
          checked={pengantaran.antar_aktif} disabled={simpanLayanan}
          onChange={(e) => setLayanan({ ...pengantaran, antar_aktif: e.target.checked })} /> Terima pesanan antar</label>
        <div className="field">
          <label htmlFor="ongkir">Ongkir per pesanan (Rp)</label>
          <input id="ongkir" type="number" required min="0" max="999999999" step="1"
            value={pengantaran.ongkir} disabled={simpanLayanan}
            onChange={(e) => setLayanan({ ...pengantaran, ongkir: e.target.value })} />
        </div>
        <button className="btn sm sun" disabled={simpanLayanan}>Simpan pengantaran</button>
      </form>}
      {tab === 'produk' && <div className="split s1">
        <form className="card pad" onSubmit={tambah}><h3>Tambah produk</h3>
          <div className="field"><label htmlFor="pn">Nama</label><input id="pn" required value={f.nama} onChange={set('nama')} /></div>
          <div className="two"><div className="field"><label htmlFor="ph">Harga (Rp)</label><input id="ph" type="number" min="0" required value={f.harga} onChange={set('harga')} /></div>
            <div className="field"><label htmlFor="ps">Stok</label><input id="ps" type="number" min="0" required value={f.stok} onChange={set('stok')} /></div></div>
          <div className="field"><label htmlFor="pk">Kategori</label><input id="pk" required placeholder="Makanan, Fashion, Kerajinan…" value={f.kategori} onChange={set('kategori')} /></div>
          <div className="field"><label htmlFor="pd">Deskripsi</label><textarea id="pd" rows="3" value={f.deskripsi} onChange={set('deskripsi')} /></div>
          <div className="field"><label htmlFor="pg">Foto (jpg, png, webp, maks 5 MB)</label><input id="pg" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
            {preview && <img src={preview} alt="Preview foto produk" style={{ marginTop: 8, width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid #F0DEB0' }} />}
          </div>
          <button className="btn">Simpan produk</button>
        </form>
        <div className="stack">{ps && !ps.length && <p className="kosong">Belum ada produk. Isi formulir untuk menambah produk pertamamu.</p>}
          {(ps || []).map((p) => (
            <div key={p.$id} className="card pad row" style={{ justifyContent: 'space-between' }}>
              <div className="row">{p.id_gambar && <img src={img(p.id_gambar)} alt="" width="56" height="56" style={{ objectFit: 'cover', borderRadius: 8 }} />}
                <div><b>{p.nama}</b><br /><small className="muted">{p.kategori} • {rp(p.harga)}</small></div></div>
              <div className="row"><span className="qty" role="group" aria-label={`Stok ${p.nama}`}><button className="qb" aria-label={`Kurangi stok ${p.nama} (terjual offline)`} disabled={p.stok < 1} onClick={() => ketuk(p, 'jual')}>−</button><b key={p.stok} className="qn" aria-live="polite">{p.stok}</b><button className="qb add" aria-label={`Tambah stok ${p.nama}`} onClick={() => ketuk(p, 'tambah')}>+</button></span>
                <button className="link" onClick={() => harga(p)}>Ubah harga</button><button className="link" onClick={() => stok(p)}>Ubah stok</button><button className="link" onClick={() => hapusP(p)}>Hapus</button></div>
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
