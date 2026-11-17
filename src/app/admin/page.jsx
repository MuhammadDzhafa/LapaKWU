'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { list, hapus, api, Query, rp } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import Rekap from '@/components/Rekap';
import Modal from '@/components/Modal';

const TABS = [['mitra', 'Verifikasi mitra'], ['pengguna', 'Pengguna dan peran'], ['produk', 'Produk'], ['rekap', 'Rekap Penjualan'], ['refund', 'Refund']];

export default function Admin() {
  const { akun, peran, memuat, toast } = useSaya();
  const [tab, setTab] = useState('mitra');
  const [d, setD] = useState({ u: [], m: [], pr: [], ad: [], pb: [], rf: [] });
  const [f, setF] = useState({ peran: 'pembeli' });
  const [modalInfo, setModalInfo] = useState(null);
  const [busyModal, setBusyModal] = useState(false);
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

  const act = async (aksi, id, extra = {}, ok = 'Tersimpan.') => {
    try { await api('/api/admin', { aksi, id, ...extra }); toast(ok); await muat(); return true; } catch (e) { toast(e.message, true); return false; }
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
        <div className="stat"><small>Total pengguna</small><b>{d.u.length}</b></div>
        <div className="stat"><small>Refund menunggu</small><b>{d.rf.length}</b></div>
      </div>
      <div className="tabs">{TABS.map(([k, t]) => <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{t}</button>)}</div>

      {tab === 'mitra' && <div className="scroll"><table><thead><tr><th>Usaha</th><th>Alamat</th><th>Kontak</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {d.m.map((x) => { const u = pg(x.$id); return (
          <tr key={x.$id}><td><b>{x.nama_usaha}</b></td><td>{x.alamat_usaha}</td>
            <td><span className="badge" data-s={u?.kontak_terverifikasi ? 'AKTIF' : 'MENUNGGU'}>{u?.kanal === 'WHATSAPP' ? 'WA' : 'Email'} {u?.kontak_terverifikasi ? 'valid' : 'belum valid'}</span></td>
            <td><span className="badge" data-s={u?.status_akun}>{u?.status_akun || 'MENUNGGU_VERIFIKASI'}</span></td>
            <td><div className="row">
              <button className="btn sm" disabled={u?.status_akun === 'AKTIF'} onClick={() => act('setuju_mitra', x.$id)}>{u?.status_akun === 'AKTIF' ? 'Sudah Aktif' : 'Verifikasi'}</button>
              <button className="btn sm out" onClick={() => tolak(x)}>Minta perbaikan</button>
              <button className="btn sm red" onClick={() => konfirmasiHapusMitra(x)}>Hapus</button>
            </div></td></tr>); })}
        {!d.m.length && <tr><td colSpan="5" className="muted">Belum ada mitra mendaftar.</td></tr>}</tbody></table></div>}

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
    </main>
  );
}
