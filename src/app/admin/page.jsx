'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { api, rp, img, tgl } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import StatusMuat from '@/components/StatusMuat';
import Modal from '@/components/Modal';
import Ikon from '@/components/Ikon';
import { Hitung } from '@/components/Motion';
import { JUMLAH_TENANT } from '@/lib/tenant';

const Rekap = dynamic(() => import('@/components/Rekap'), { loading: () => <StatusMuat teks="Memuat rekap penjualan…" /> });

const TABS = [
  ['mitra', 'Verifikasi mitra', 'store'],
  ['qris', 'Verifikasi QRIS', 'qr'],
  ['pencairan', 'Pencairan Mitra', 'cash'],
  ['pengguna', 'Pengguna dan peran', 'users'],
  ['produk', 'Produk', 'box'],
  ['rekap', 'Rekap Penjualan', 'chart'],
  ['refund', 'Refund', 'undo'],
];

export default function Admin() {
  const { akun, peran, memuat, toast } = useSaya();
  const [tab, setTab] = useState('mitra');
  const [d, setD] = useState({ u: [], m: [], pr: [], ad: [], pb: [], rf: [], qris: [] });
  const [cariMitra, setCariMitra] = useState('');
  const [batasMitra, setBatasMitra] = useState(25);
  const [galatMuat, setGalatMuat] = useState('');
  const [muatLanjutan, setMuatLanjutan] = useState(false);
  const [pencairan, setPencairan] = useState([]);
  const [menambah, setMenambah] = useState(false);
  const [f, setF] = useState({ peran: 'pembeli' });
  const [modalInfo, setModalInfo] = useState(null);
  const [busyModal, setBusyModal] = useState(false);
  const [modalGambar, setModalGambar] = useState(null);
  const [simpanTenant, setSimpanTenant] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const muat = useCallback(async (offset = 0, append = false) => {
    if (!append) setGalatMuat('');
    try {
      const data = await api('/api/admin', { aksi: 'muat', offset });
      setD((sebelumnya) => append
        ? Object.fromEntries(['u', 'm', 'pr', 'ad', 'pb', 'rf', 'qris'].map((key) => [key, [...(sebelumnya[key] || []), ...(data[key] || [])]]).concat([['hasMore', data.hasMore], ['offset', data.offset], ['peran', { ...sebelumnya.peran, ...data.peran }]]))
        : data);
    } catch (e) {
      if (!append) setGalatMuat(e.message);
      toast(e.message, true);
    }
  }, [toast]);
  useEffect(() => { if (peran === 'admin') void muat(); }, [peran, muat]);

  const muatPencairan = useCallback(async () => {
    const data = await api('/api/admin', { aksi: 'daftar_pencairan' });
    setPencairan(data.pencairan);
  }, []);

  const pencairanTerbuka = tab === 'pencairan';
  useEffect(() => {
    if (peran !== 'admin') return;
    const segarkan = () => { if (!document.hidden) muatPencairan().catch(() => {}); };
    segarkan();
    const timer = setInterval(segarkan, pencairanTerbuka ? 15000 : 30000);
    return () => clearInterval(timer);
  }, [peran, pencairanTerbuka, muatPencairan]);

  const act = async (aksi, id, extra = {}, ok = 'Tersimpan.') => {
    try {
      const hasil = await api('/api/admin', { aksi, id, ...extra });
      toast(typeof ok === 'function' ? ok(hasil) : ok);
      void muat();
      return true;
    } catch (e) { toast(e.message, true); return false; }
  };
  const aturTenant = async (e, mitra) => {
    e.preventDefault();
    const nilai = new FormData(e.currentTarget).get('nomor_tenant');
    setSimpanTenant(mitra.$id);
    await act('atur_tenant', mitra.$id, { nomor_tenant: nilai === '' ? null : Number(nilai) }, 'Nomor tenant diperbarui.');
    setSimpanTenant(null);
  };
  const tolak = (x) => {
    setModalInfo({
      judul: `Minta Perbaikan untuk ${x.nama_usaha}`,
      pesan: `Tuliskan catatan perbaikan atau dokumen yang perlu dilengkapi oleh mitra ${x.nama_usaha}:`,
      tipe: 'input',
      inputType: 'textarea',
      inputLabel: 'Catatan perbaikan',
      inputPlaceholder: 'Contoh: Harap unggah foto lapak yang lebih jelas...',
      tombolOk: 'Kirim Catatan',
      warnaOk: 'sun',
      onOk: async (c) => {
        if (!c?.trim()) return;
        setBusyModal(true);
        await act('tolak_mitra', x.$id, { catatan: c.trim() }, 'Catatan perbaikan dikirim ke mitra.');
        setBusyModal(false);
        setModalInfo(null);
      },
    });
  };

  const konfirmasiHapusMitra = (x) => {
    setModalInfo({
      judul: `Hapus Pendaftaran Mitra?`,
      pesan: `Yakin ingin menghapus data pendaftaran mitra "${x.nama_usaha}"? Data mitra ini akan dihapus dari sistem.`,
      warnaOk: 'red',
      tombolOk: 'Hapus Mitra',
      onOk: async () => {
        setBusyModal(true);
        await act('hapus_mitra', x.$id, {}, 'Mitra dihapus.');
        setBusyModal(false);
        setModalInfo(null);
      },
    });
  };

  const konfirmasiUbahPeran = (u, peranBaru) => {
    setModalInfo({
      judul: `Ubah Peran Pengguna?`,
      pesan: `Ubah peran akun ${u.nama} (${u.email}) menjadi "${peranBaru}"?`,
      warnaOk: 'sun',
      tombolOk: 'Ubah Peran',
      onOk: async () => {
        setBusyModal(true);
        await act('ubah_peran', u.$id, { peran: peranBaru }, `Peran ${u.nama} diubah jadi ${peranBaru}.`);
        setBusyModal(false);
        setModalInfo(null);
      },
    });
  };

  const konfirmasiHapusPengguna = (u) => {
    setModalInfo({
      judul: `Hapus Akun Pengguna?`,
      pesan: `Hapus akun ${u.nama} (${u.email})? Jika akun punya riwayat pesanan, aksesnya akan dinonaktifkan dan data kontak dianonimkan agar riwayat transaksi tetap tersimpan.`,
      warnaOk: 'red',
      tombolOk: 'Hapus Akun',
      onOk: async () => {
        setBusyModal(true);
        await act('hapus', u.$id, {}, (hasil) => hasil.dianonimkan
          ? 'Akun dinonaktifkan dan dianonimkan; riwayat transaksi dipertahankan.'
          : 'Akun pengguna dihapus.');
        setBusyModal(false);
        setModalInfo(null);
      },
    });
  };

  const konfirmasiHapusProduk = (pr) => {
    setModalInfo({
      judul: `Hapus Produk?`,
      pesan: `Apakah kamu yakin ingin menghapus produk "${pr.nama}"?`,
      warnaOk: 'red',
      tombolOk: 'Hapus Produk',
      onOk: async () => {
        setBusyModal(true);
        try {
          await api('/api/admin', { aksi: 'hapus_produk', id: pr.$id });
          toast('Produk dihapus.');
          await muat();
        } catch (e) {
          toast(e.message, true);
        }
        setBusyModal(false);
        setModalInfo(null);
      },
    });
  };

  useEffect(() => {
    if (!modalGambar) return undefined;
    const esc = (e) => e.key === 'Escape' && setModalGambar(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [modalGambar]);

  const nama = Object.fromEntries(d.m.map((x) => [x.$id, x.nama_usaha]));
  const penggunaPerId = new Map(d.u.map((x) => [x.$id, x]));
  const pg = (id) => penggunaPerId.get(id);
  const tambah = async (e) => {
    e.preventDefault();
    if (menambah) return;
    const form = e.currentTarget;
    const nilai = Object.fromEntries(new FormData(form));
    setMenambah(true);
    try {
      if (await act('tambah', undefined, nilai, 'Pengguna ditambahkan.')) {
        form.reset();
        setF({ peran: 'pembeli' });
      }
    } finally {
      setMenambah(false);
    }
  };

  if (memuat) return <main className="wrap"><StatusMuat teks="Memuat panel admin…" /></main>;
  if (peran !== 'admin') return <main className="wrap"><p className="kosong">Halaman ini khusus admin. <Link className="link" href="/masuk">Masuk</Link></p></main>;
  const kataMitra = cariMitra.trim().toLowerCase();
  const mitraCocok = d.m.filter((m) => m.nama_usaha.toLowerCase().includes(kataMitra) || String(m.nomor_tenant ?? '') === kataMitra);
  const tenantTerisi = new Map(d.m.filter((m) => m.nomor_tenant).map((m) => [m.nomor_tenant, m.$id]));
  const nMitra = d.m.filter((x) => pg(x.$id)?.status_akun !== 'AKTIF').length;
  const nQris = (d.qris || []).length;
  const nRefund = d.rf.length;
  const nTindak = nMitra + nQris + nRefund + pencairan.length;
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
          <h2>Panel admin</h2>
          <p>Semua yang perlu kamu cek hari ini ada di sini.</p>
        </div>
        <span className={'todo' + (nTindak ? '' : ' ok')} role="status">
          {nTindak ? `${nTindak} hal perlu tindakan` : 'Semua sudah beres'}
        </span>
      </div>
      <div className="stats">
        <button type="button" className="stat" onClick={() => setTab('mitra')}><i className="si"><Ikon n="store" size={22} /></i><small>Mitra menunggu</small><b><Hitung ke={nMitra} /></b></button>
        <button type="button" className="stat" onClick={() => setTab('qris')}><i className="si"><Ikon n="qr" size={22} /></i><small>QRIS menunggu</small><b><Hitung ke={nQris} /></b></button>
        <button type="button" className="stat" onClick={() => setTab('pengguna')}><i className="si"><Ikon n="users" size={22} /></i><small>Total pengguna</small><b><Hitung ke={d.u.length} /></b></button>
        <button type="button" className="stat" onClick={() => setTab('refund')}><i className="si"><Ikon n="undo" size={22} /></i><small>Refund menunggu</small><b><Hitung ke={nRefund} /></b></button>
      </div>
      <div className="tabs" role="tablist" aria-label="Bagian panel admin">{TABS.map(([k, t, ic]) => (
        <button key={k} role="tab" aria-selected={tab === k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
          <Ikon n={ic} size={16} />{t}{k === 'pencairan' && pencairan.length > 0 && <em className="cnt">{pencairan.length}{pencairan.length === 50 ? '+' : ''}</em>}
        </button>
      ))}</div>

      {galatMuat && <p className="msg err" role="status">{galatMuat} <button className="link" type="button" onClick={() => muat()}>Coba lagi</button></p>}

      {tab === 'pencairan' && (
        <section className="card pad stack">
          <div className="row wallet-heading">
            <h3>Pengajuan pencairan</h3>
            <button className="btn sm out" type="button" onClick={() => muatPencairan().catch((e) => toast(e.message, true))}>Muat ulang</button>
          </div>
          <p className="muted">Pindai QRIS mitra untuk membayar sesuai nominal. Konfirmasi setelah pembayaran berhasil.</p>
          {!pencairan.length && <p className="kosong">Belum ada pengajuan yang menunggu.</p>}
          <div className="wallet-grid">
            {pencairan.map((x) => (
              <article className="card pad stack" key={x.id}>
                <b>{x.nama_usaha} · {rp(x.nominal)}</b>
                <small className="muted">{tgl(x.created_at)} · #{x.id.slice(-8)}</small>
                <button className="wallet-qr" type="button" onClick={() => setModalGambar({ src: img(x.id_qris), judul: 'QRIS pencairan ' + x.nama_usaha, qris: true })} aria-label={'Perbesar QRIS ' + x.nama_usaha}>
                  <img loading="lazy" decoding="async" src={img(x.id_qris)} alt={'QRIS pencairan ' + x.nama_usaha} />
                </button>
                <button className="btn sun sm" type="button" onClick={() => setModalInfo({
                  judul: 'Konfirmasi pencairan',
                  pesan: 'Pastikan pembayaran ' + rp(x.nominal) + ' ke QRIS ' + x.nama_usaha + ' sudah berhasil.',
                  tombolOk: 'Sudah dibayar',
                  onOk: async () => {
                    setBusyModal(true);
                    if (await act('konfirmasi_pencairan', x.id, { sudah_dibayar: true }, 'Pencairan manual berhasil dicatat.')) {
                      setPencairan((items) => items.filter((item) => item.id !== x.id));
                      setModalInfo(null);
                    }
                    setBusyModal(false);
                  },
                })}>Konfirmasi sudah dibayar</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'qris' && (
        <div className="stack">
          <div className="card pad info-card">
            <div className="info-in">
              <span className="info-ic" aria-hidden="true"><Ikon n="qr" size={22} /></span>
              <div>
                <b>Verifikasi pembayaran QRIS LapaKWU</b>
                <p className="muted">
                  PayHook dapat menandai dana masuk jika nominal dan referensi transaksi cocok dengan hasil OCR.
                  Cocokkan bukti dan nominal dengan dana yang benar-benar masuk sebelum menyetujui pembayaran.
                </p>
              </div>
            </div>
          </div>

          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>No. Pesanan</th>
                  <th>Pembeli</th>
                  <th>Lapak Tujuan</th>
                  <th>Nominal</th>
                  <th>Bukti Transfer</th>
                  <th>Tindakan Admin</th>
                </tr>
              </thead>
              <tbody>
                {(d.qris || []).map((x) => {
                  const pembeliUser = pg(x.pesanan?.id_pembeli);
                  const namaMitra = nama[x.pesanan?.id_mitra] || 'Mitra Toko';
                  return (
                    <tr key={x.$id}>
                      <td><b>#{x.id_pesanan.slice(-6)}</b></td>
                      <td>
                        <b>{pembeliUser?.nama || 'Pembeli'}</b>
                        <br />
                        <small className="muted">{pembeliUser?.email}</small>
                      </td>
                      <td>{namaMitra}</td>
                      <td><b style={{ color: 'var(--bl-d)' }}>{rp(x.jumlah)}</b></td>
                      <td>
                        {x.id_bukti ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img
                              src={img(x.id_bukti)}
                              alt="Bukti Transfer"
                              onClick={() => setModalGambar({ src: img(x.id_bukti), judul: 'Bukti transfer' })}
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)' }}
                            />
                            <button
                              type="button"
                              className="link"
                              style={{ fontSize: '0.8rem' }}
                              onClick={() => setModalGambar({ src: img(x.id_bukti), judul: 'Bukti transfer' })}
                            >
                              Lihat Bukti
                            </button>
                          </div>
                        ) : (
                          <span className="muted"><small>Tanpa file</small></span>
                        )}
                        {x.status_ocr && <small className="muted" style={{ display: 'block' }}>
                          {x.status_ocr === 'COCOK' ? 'OCR cocok' : 'Perlu tinjauan manual'}
                          {x.hasil_ocr?.tanggal && ' · ' + tgl(x.hasil_ocr.tanggal)}
                        </small>}
                        {x.dana_terdeteksi && <small className="muted">Dana masuk terdeteksi oleh PayHook.</small>}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="btn sm sun"
                            onClick={() => act('verifikasi_qris', x.$id, {}, 'Pembayaran QRIS berhasil diverifikasi Lunas! Mitra dan pembeli telah dikabari.')}
                          >
                            ✓ Konfirmasi Lunas
                          </button>
                          <button
                            className="btn sm red"
                            onClick={() => act('tolak_qris', x.$id, { catatan: 'Bukti transfer tidak valid / dana tidak masuk ke QRIS LapaKWU.' }, 'Pembayaran ditolak.')}
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!(d.qris || []).length && (
                  <tr>
                    <td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Tidak ada pembayaran QRIS yang sedang menunggu verifikasi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'mitra' && <section className="stack">
        <div className="field saring-daftar">
          <label htmlFor="cari-mitra">Cari mitra</label>
          <input id="cari-mitra" type="search" placeholder="Nama usaha atau nomor tenant" value={cariMitra} onChange={(e) => { setCariMitra(e.target.value); setBatasMitra(25); }} />
        </div>
        {d.offset === undefined && !galatMuat && <StatusMuat teks="Memuat data mitra…" />}
        {d.offset !== undefined && <div className="scroll"><table><thead><tr><th>Usaha</th><th>Nomor tenant</th><th>Kontak</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {mitraCocok.slice(0, batasMitra).map((x) => { const u = pg(x.$id); return (
          <tr key={x.$id}><td><b>{x.nama_usaha}</b></td>
            <td><form className="row" onSubmit={(e) => aturTenant(e, x)} style={{ flexWrap: 'nowrap' }}>
              <select key={x.nomor_tenant ?? 'kosong'} name="nomor_tenant" aria-label={`Nomor tenant ${x.nama_usaha}`} defaultValue={x.nomor_tenant ?? ''} disabled={simpanTenant !== null}>
                <option value="">Belum ditetapkan</option>
                {Array.from({ length: JUMLAH_TENANT }, (_, i) => i + 1).map((nomor) => (
                  <option key={nomor} value={nomor} disabled={tenantTerisi.has(nomor) && tenantTerisi.get(nomor) !== x.$id}>{nomor}</option>
                ))}
              </select>
              <button className="btn sm" disabled={simpanTenant !== null}>Simpan</button>
            </form></td>
            <td><span className="badge" data-s={u?.kontak_terverifikasi ? 'AKTIF' : 'MENUNGGU'}>{u?.kanal === 'WHATSAPP' ? 'WA' : 'Email'} {u?.kontak_terverifikasi ? 'valid' : 'belum valid'}</span></td>
            <td><span className="badge" data-s={u?.status_akun}>{u?.status_akun || 'MENUNGGU_VERIFIKASI'}</span></td>
            <td><div className="row">
              <button className="btn sm" disabled={u?.status_akun === 'AKTIF'} onClick={() => act('setuju_mitra', x.$id)}>{u?.status_akun === 'AKTIF' ? 'Sudah Aktif' : 'Verifikasi'}</button>
              <button className="btn sm out" onClick={() => tolak(x)}>Minta perbaikan</button>
              <button className="btn sm red" onClick={() => konfirmasiHapusMitra(x)}>Hapus</button>
            </div></td></tr>); })}
        {!mitraCocok.length && <tr><td colSpan="5" className="muted">{kataMitra ? 'Mitra tidak ditemukan di data yang dimuat.' : 'Belum ada mitra mendaftar.'}</td></tr>}</tbody></table></div>}
        {mitraCocok.length > batasMitra && <button className="btn out sm" type="button" onClick={() => setBatasMitra((batas) => batas + 25)}>Tampilkan lebih banyak mitra</button>}
      </section>}

      {tab === 'pengguna' && <div className="stack">
        <form className="card pad" onSubmit={tambah}><h3>Tambah pengguna</h3>
          <div className="two"><div className="field"><label htmlFor="an">Nama</label><input id="an" name="nama" required /></div>
            <div className="field"><label htmlFor="ae">Email</label><input id="ae" name="email" type="email" required /></div></div>
          <div className="two"><div className="field"><label htmlFor="ap">Kata sandi sementara</label><input id="ap" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="field"><label htmlFor="ar">Peran</label><select id="ar" name="peran" value={f.peran} onChange={set('peran')}><option value="pembeli">Pembeli</option><option value="mitra">Mitra</option><option value="admin">Admin</option></select></div></div>
          {f.peran === 'mitra' && <div className="field"><label htmlFor="au">Nama usaha</label><input id="au" name="nama_usaha" required /></div>}
          <button className="btn" disabled={menambah} aria-busy={menambah}>{menambah ? 'Menambahkan…' : 'Tambah pengguna'}</button></form>
        <div className="scroll"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
          {d.u.map((x) => (
            <tr key={x.$id}><td>{x.nama}</td><td>{x.email}</td>
              <td>{x.$id === akun.$id ? 'admin (kamu)' : <select aria-label={`Peran ${x.nama}`} value={d.peran?.[x.$id] ?? 'pembeli'} onChange={(e) => konfirmasiUbahPeran(x, e.target.value)}><option value="pembeli">pembeli</option><option value="mitra">mitra</option><option value="admin">admin</option></select>}</td>
              <td><span className="badge" data-s={x.status_akun}>{x.status_akun}</span></td>
              <td>{x.$id !== akun.$id && <div className="row">{x.status_akun === 'DIBLOKIR' ? <button className="btn sm" onClick={() => act('aktifkan', x.$id)}>Aktifkan</button> : <button className="btn sm out" onClick={() => act('blokir', x.$id)}>Blokir</button>}
                <button className="btn sm red" onClick={() => konfirmasiHapusPengguna(x)}>Hapus</button></div>}</td></tr>))}</tbody></table></div></div>}

      {tab === 'produk' && <div className="scroll"><table><thead><tr><th>Produk</th><th>Mitra</th><th>Harga</th><th>Stok</th><th></th></tr></thead><tbody>
        {d.pr.map((x) => <tr key={x.$id}><td>{x.nama}</td><td>{nama[x.id_mitra]}</td><td>{rp(x.harga)}</td><td>{x.stok}</td>
          <td><button className="link" onClick={() => konfirmasiHapusProduk(x)}>Hapus</button></td></tr>)}
        {!d.pr.length && <tr><td colSpan="5" className="muted">Belum ada produk.</td></tr>}</tbody></table></div>}

      {tab === 'rekap' && <Rekap nama={nama} />}

      {tab === 'refund' && <div className="stack"><p className="muted">Refund dilakukan manual melalui kanal pembayaran di luar aplikasi. Tandai selesai hanya setelah dana benar-benar dikirim kepada pembeli.</p><div className="scroll"><table><thead><tr><th>Pesanan</th><th>Metode</th><th>Jumlah</th><th></th></tr></thead><tbody>
        {d.rf.map((x) => <tr key={x.$id}><td>{x.id_pesanan.slice(-6)}</td><td>{x.metode.replaceAll('_', ' ')}</td><td>{rp(x.jumlah)}</td>
          <td><button className="btn sm sun" onClick={() => act('refund', x.$id, { sudah_ditransfer: true }, 'Refund manual sudah dicatat.')}>Dana sudah ditransfer</button></td></tr>)}
        {!d.rf.length && <tr><td colSpan="4" className="muted">Tidak ada refund yang menunggu.</td></tr>}</tbody></table></div></div>}
      {d.hasMore && <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}><button className="btn out" type="button" disabled={muatLanjutan} onClick={async () => { setMuatLanjutan(true); await muat((d.offset || 0) + 500, true); setMuatLanjutan(false); }}>{muatLanjutan ? 'Memuat…' : 'Muat 500 data berikutnya'}</button></div>}

      {/* MODAL PREVIEW BUKTI TRANSFER */}
      {modalGambar && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-label={modalGambar.judul} onClick={() => setModalGambar(null)}>
          <div className={modalGambar.qris ? "modal-box lightbox lightbox-qris" : "modal-box lightbox"} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>{modalGambar.judul}</b>
              <button type="button" className="modal-x" aria-label="Tutup pratinjau" onClick={() => setModalGambar(null)}>✕</button>
            </div>
            <img src={modalGambar.src} alt={modalGambar.judul} />
            <div className="modal-aksi">
              <a href={modalGambar.src} target="_blank" rel="noopener noreferrer" className="btn sm">Buka di tab baru ↗</a>
              <button type="button" className="btn sm out" onClick={() => setModalGambar(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
