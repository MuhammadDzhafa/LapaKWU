'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { hapus, api, rp, img, tgl } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import Rekap from '@/components/Rekap';
import Modal from '@/components/Modal';
import { JUMLAH_TENANT } from '@/lib/tenant';

const TABS = [
  ['mitra', 'Verifikasi mitra'],
  ['qris', 'Verifikasi QRIS'],
  ['pencairan', 'Pencairan Mitra'],
  ['pengguna', 'Pengguna dan peran'],
  ['produk', 'Produk'],
  ['rekap', 'Rekap Penjualan'],
  ['refund', 'Refund'],
];

export default function Admin() {
  const { akun, peran, memuat, toast } = useSaya();
  const [tab, setTab] = useState('mitra');
  const [d, setD] = useState({ u: [], m: [], pr: [], ad: [], pb: [], rf: [], qris: [] });
  const [pencairan, setPencairan] = useState([]);
  const [f, setF] = useState({ peran: 'pembeli' });
  const [modalInfo, setModalInfo] = useState(null);
  const [busyModal, setBusyModal] = useState(false);
  const [modalGambar, setModalGambar] = useState(null);
  const [simpanTenant, setSimpanTenant] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const muat = useCallback(async () => {
    try {
      const data = await api('/api/admin', { aksi: 'muat' });
      setD(data);
    } catch (e) {
      toast(e.message, true);
    }
  }, [toast]);
  useEffect(() => { if (peran === 'admin') muat().catch((e) => toast(e.message, true)); }, [peran, muat, toast]);

  const muatPencairan = useCallback(async () => {
    const data = await api('/api/admin', { aksi: 'daftar_pencairan' });
    setPencairan(data.pencairan);
  }, []);

  useEffect(() => {
    if (peran !== 'admin') return;
    const segarkan = () => muatPencairan().catch(() => {});
    segarkan();
    const timer = setInterval(segarkan, 15000);
    return () => clearInterval(timer);
  }, [peran, muatPencairan]);

  const act = async (aksi, id, extra = {}, ok = 'Tersimpan.') => {
    try { await api('/api/admin', { aksi, id, ...extra }); toast(ok); await muat(); return true; } catch (e) { toast(e.message, true); return false; }
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
      inputPlaceholder: 'Contoh: Harap unggah foto lapak yang lebih jelas atau perbarui alamat...',
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
      pesan: `Apakah kamu yakin ingin menghapus akun ${u.nama} (${u.email})? Tindakan ini tidak dapat dibatalkan.`,
      warnaOk: 'red',
      tombolOk: 'Hapus Akun',
      onOk: async () => {
        setBusyModal(true);
        await act('hapus', u.$id, {}, 'Akun pengguna dihapus.');
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
          await hapus('produk', pr.$id);
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

  const nama = Object.fromEntries(d.m.map((x) => [x.$id, x.nama_usaha]));
  const pg = (id) => d.u.find((x) => x.$id === id);
  const peranDari = (id) => (d.ad.some((x) => x.$id === id) ? 'admin' : d.m.some((x) => x.$id === id) ? 'mitra' : 'pembeli');
  const tambah = async (e) => { e.preventDefault(); if (await act('tambah', undefined, f, 'Pengguna ditambahkan.')) { setF({ peran: 'pembeli' }); e.target.reset(); } };

  if (memuat) return <main className="wrap" />;
  if (peran !== 'admin') return <main className="wrap"><p className="kosong">Halaman ini khusus admin. <Link className="link" href="/masuk">Masuk</Link></p></main>;
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
      <h2>Panel admin</h2>
      <div className="stats">
        <div className="stat"><small>Mitra menunggu</small><b>{d.m.filter((x) => pg(x.$id)?.status_akun !== 'AKTIF').length}</b></div>
        <div className="stat"><small>QRIS menunggu</small><b>{(d.qris || []).length}</b></div>
        <div className="stat"><small>Total pengguna</small><b>{d.u.length}</b></div>
        <div className="stat"><small>Refund menunggu</small><b>{d.rf.length}</b></div>
      </div>
      <div className="tabs">{TABS.map(([k, t]) => (
        <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
          {t}{k === 'pencairan' && pencairan.length > 0 && ` (${pencairan.length}${pencairan.length === 50 ? '+' : ''})`}
        </button>
      ))}</div>

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
                <button className="wallet-qr" type="button" onClick={() => setModalGambar(img(x.id_qris))} aria-label={'Perbesar QRIS ' + x.nama_usaha}>
                  <img src={img(x.id_qris)} alt={'QRIS pencairan ' + x.nama_usaha} />
                </button>
                <button className="btn sun sm" type="button" onClick={() => setModalInfo({
                  judul: 'Konfirmasi pencairan',
                  pesan: 'Pastikan pembayaran ' + rp(x.nominal) + ' ke QRIS ' + x.nama_usaha + ' sudah berhasil.',
                  tombolOk: 'Sudah dibayar',
                  onOk: async () => {
                    setBusyModal(true);
                    if (await act('konfirmasi_pencairan', x.id, {}, 'Pencairan berhasil dikonfirmasi.')) {
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
          <div className="card pad" style={{ background: 'var(--bl-s)', border: '1px solid var(--bl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.4rem' }}>📲</span>
              <div>
                <b style={{ color: 'var(--bl-d)' }}>Verifikasi pembayaran QRIS LapaKWU</b>
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
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
                              onClick={() => setModalGambar(img(x.id_bukti))}
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)' }}
                            />
                            <button
                              type="button"
                              className="link"
                              style={{ fontSize: '0.8rem' }}
                              onClick={() => setModalGambar(img(x.id_bukti))}
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

      {tab === 'mitra' && <div className="scroll"><table><thead><tr><th>Usaha</th><th>Alamat</th><th>Nomor tenant</th><th>Kontak</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {d.m.map((x) => { const u = pg(x.$id); return (
          <tr key={x.$id}><td><b>{x.nama_usaha}</b></td><td>{x.alamat_usaha}</td>
            <td><form className="row" onSubmit={(e) => aturTenant(e, x)} style={{ flexWrap: 'nowrap' }}>
              <select key={x.nomor_tenant ?? 'kosong'} name="nomor_tenant" aria-label={`Nomor tenant ${x.nama_usaha}`} defaultValue={x.nomor_tenant ?? ''} disabled={simpanTenant !== null}>
                <option value="">Belum ditetapkan</option>
                {Array.from({ length: JUMLAH_TENANT }, (_, i) => i + 1).map((nomor) => (
                  <option key={nomor} value={nomor} disabled={d.m.some((m) => m.$id !== x.$id && m.nomor_tenant === nomor)}>{nomor}</option>
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
        {!d.m.length && <tr><td colSpan="6" className="muted">Belum ada mitra mendaftar.</td></tr>}</tbody></table></div>}

      {tab === 'pengguna' && <div className="stack">
        <form className="card pad" onSubmit={tambah}><h3>Tambah pengguna</h3>
          <div className="two"><div className="field"><label htmlFor="an">Nama</label><input id="an" required onChange={set('nama')} /></div>
            <div className="field"><label htmlFor="ae">Email</label><input id="ae" type="email" required onChange={set('email')} /></div></div>
          <div className="two"><div className="field"><label htmlFor="ap">Kata sandi sementara</label><input id="ap" type="text" minLength={8} required onChange={set('password')} /></div>
            <div className="field"><label htmlFor="ar">Peran</label><select id="ar" value={f.peran} onChange={set('peran')}><option value="pembeli">Pembeli</option><option value="mitra">Mitra</option><option value="admin">Admin</option></select></div></div>
          {f.peran === 'mitra' && <div className="field"><label htmlFor="au">Nama usaha</label><input id="au" required onChange={set('nama_usaha')} /></div>}
          <button className="btn">Tambah pengguna</button></form>
        <div className="scroll"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
          {d.u.map((x) => (
            <tr key={x.$id}><td>{x.nama}</td><td>{x.email}</td>
              <td>{x.$id === akun.$id ? 'admin (kamu)' : <select aria-label={`Peran ${x.nama}`} value={peranDari(x.$id)} onChange={(e) => konfirmasiUbahPeran(x, e.target.value)}><option value="pembeli">pembeli</option><option value="mitra">mitra</option><option value="admin">admin</option></select>}</td>
              <td><span className="badge" data-s={x.status_akun}>{x.status_akun}</span></td>
              <td>{x.$id !== akun.$id && <div className="row">{x.status_akun === 'DIBLOKIR' ? <button className="btn sm" onClick={() => act('aktifkan', x.$id)}>Aktifkan</button> : <button className="btn sm out" onClick={() => act('blokir', x.$id)}>Blokir</button>}
                <button className="btn sm red" onClick={() => konfirmasiHapusPengguna(x)}>Hapus</button></div>}</td></tr>))}</tbody></table></div></div>}

      {tab === 'produk' && <div className="scroll"><table><thead><tr><th>Produk</th><th>Mitra</th><th>Harga</th><th>Stok</th><th></th></tr></thead><tbody>
        {d.pr.map((x) => <tr key={x.$id}><td>{x.nama}</td><td>{nama[x.id_mitra]}</td><td>{rp(x.harga)}</td><td>{x.stok}</td>
          <td><button className="link" onClick={() => konfirmasiHapusProduk(x)}>Hapus</button></td></tr>)}
        {!d.pr.length && <tr><td colSpan="5" className="muted">Belum ada produk.</td></tr>}</tbody></table></div>}

      {tab === 'rekap' && <Rekap nama={nama} />}

      {tab === 'refund' && <div className="scroll"><table><thead><tr><th>Pesanan</th><th>Metode</th><th>Jumlah</th><th></th></tr></thead><tbody>
        {d.rf.map((x) => <tr key={x.$id}><td>{x.id_pesanan.slice(-6)}</td><td>{x.metode.replaceAll('_', ' ')}</td><td>{rp(x.jumlah)}</td>
          <td><button className="btn sm sun" onClick={() => act('refund', x.$id, {}, 'Refund dicatat.')}>Tandai sudah dikembalikan</button></td></tr>)}
        {!d.rf.length && <tr><td colSpan="4" className="muted">Tidak ada refund yang menunggu.</td></tr>}</tbody></table></div>}

      {/* MODAL PREVIEW BUKTI TRANSFER */}
      {modalGambar && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalGambar(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <b style={{ fontSize: '1.05rem', color: 'var(--bl-d)' }}>Pratinjau gambar QRIS</b>
              <button
                type="button"
                onClick={() => setModalGambar(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>
            <img
              src={modalGambar}
              alt="Bukti Transfer Penuh"
              style={{
                width: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--tint)',
              }}
            />
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 10 }}>
              <a href={modalGambar} target="_blank" rel="noopener noreferrer" className="btn sm">
                Buka di Tab Baru ↗
              </a>
              <button type="button" className="btn sm out" onClick={() => setModalGambar(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
