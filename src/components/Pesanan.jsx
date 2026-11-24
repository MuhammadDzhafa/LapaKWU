'use client';
import { namaDenganAddOn } from '@/lib/add-on';
import { useCallback, useEffect, useState, useRef } from 'react';
import { list, Query, rp, tgl, api, img } from '@/lib/aw';
import { mulaiPengambilan, tenggatBayarTenant } from '@/lib/pembayaran-tenant';
import { TAUTAN_WA } from '@/lib/kontak';
import { bolehLihatDenah, nomorTenantValid } from '@/lib/tenant';
import { formatJadwalAmbil } from '@/lib/waktu';
import DenahTenant from '@/components/DenahTenant';

const waktuPesanan = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Jakarta', hourCycle: 'h23',
});

const BAYAR = {
  BERHASIL: 'Lunas',
  MENUNGGU: 'Verifikasi bayar',
  GAGAL: 'Gagal / Dibatalkan',
  REFUND_DIAJUKAN: 'Refund diproses',
  DIKEMBALIKAN: 'Dana dikembalikan',
};

const LABEL = {
  MENUNGGU_KONFIRMASI: 'Menunggu konfirmasi',
  DIPROSES: 'Diproses',
  DIKIRIM: 'Dikirim',
  SIAP_DIAMBIL: 'Siap diambil',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

// Pelacak tahap pesanan: pembeli dan mitra langsung tahu pesanan sedang di mana.
function Lacak({ status, antar }) {
  const idx = { MENUNGGU_KONFIRMASI: 0, DIPROSES: 1, DIKIRIM: 2, SIAP_DIAMBIL: 2, SELESAI: 3 }[status];
  if (idx === undefined) return null;
  const langkah = ['Dipesan', 'Diproses', antar ? 'Dikirim' : 'Siap diambil', 'Selesai'];
  const tamat = status === 'SELESAI';
  return (
    <ol className="lacak" aria-label="Tahap pesanan">
      {langkah.map((nama, i) => {
        const done = tamat || i < idx;
        return (
          <li key={nama} className={done ? 'done' : i === idx ? 'now' : ''} aria-current={!tamat && i === idx ? 'step' : undefined}>
            <i aria-hidden="true">{done ? '✓' : ''}</i><span>{nama}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Modal konfirmasi / input — menggantikan alert() / confirm() / prompt() bawaan browser
function Modal({ judul, pesan, withInput, inputLabel, onOk, onBatal, busy }) {
  const [val, setVal] = useState('');
  return (
    <div role="dialog" aria-modal="true" onClick={onBatal}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <b style={{ fontSize: '1.05rem', display: 'block', marginBottom: 8 }}>{judul}</b>
        {pesan && <p style={{ margin: '0 0 14px', color: 'var(--ink)', fontSize: '0.95rem', lineHeight: 1.5 }}>{pesan}</p>}
        {withInput && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>{inputLabel || 'Keterangan'}</label>
            <textarea rows={3} value={val} onChange={(e) => setVal(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn sm out" onClick={onBatal} disabled={busy}>Batal</button>
          <button className="btn sm sun" onClick={() => onOk(val)} disabled={busy || (withInput && !val.trim())}>
            {busy ? 'Memproses…' : 'Ya, lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pesanan({ uid, sebagai }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [modalGambar, setModalGambar] = useState(null);
  const [modalInvoice, setModalInvoice] = useState(null);
  const [idDenah, setIdDenah] = useState(null);
  const [modalAksi, setModalAksi] = useState(null); // { id, aksi, judul, pesan, withInput }
  const [busyAksi, setBusyAksi] = useState(false);
  const [sekarang, setSekarang] = useState(Date.now());
  const percobaanBatal = useRef(new Map());
  const versiMuat = useRef(0);

  const adaTenggat = d?.some((p) => p.bayar?.metode === 'BAYAR_DI_TEMPAT'
    && p.bayar.status_pembayaran === 'MENUNGGU'
    && ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan));

  useEffect(() => {
    if (!adaTenggat) return;
    const perbarui = () => { if (!document.hidden) setSekarang(Date.now()); };
    perbarui();
    const timer = setInterval(perbarui, 1000);
    document.addEventListener('visibilitychange', perbarui);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', perbarui);
    };
  }, [adaTenggat]);

  const muat = useCallback(async () => {
    const versi = ++versiMuat.current;
    const ps = await list('pesanan', [
      Query.equal(sebagai === 'mitra' ? 'id_mitra' : 'id_pembeli', uid),
      Query.orderDesc('tanggal_pesanan'),
    ]);
    if (!ps.length) {
      if (versi === versiMuat.current) setD([]);
      return;
    }
    const ids = ps.map((p) => p.$id);
    const mitraIds = [...new Set(ps.map((p) => p.id_mitra))];
    const [dt, by, mitra] = await Promise.all([
      list('detail_pesanan', [Query.equal('id_pesanan', ids), Query.limit(500)]),
      list('pembayaran', [Query.equal('id_pesanan', ids)]),
      list('mitra', [Query.equal('$id', mitraIds)]),
    ]);
    if (versi !== versiMuat.current) return;
    setSekarang(Date.now());
    const lapak = new Map(mitra.map((m) => [m.$id, m]));
    const pembayaranPerPesanan = new Map(by.map((x) => [x.id_pesanan, x]));
    const detailPerPesanan = new Map();
    for (const x of dt) {
      const items = detailPerPesanan.get(x.id_pesanan) ?? [];
      items.push({ ...x, nama: namaDenganAddOn(x.nama_produk || 'Produk dihapus', x.add_on) });
      detailPerPesanan.set(x.id_pesanan, items);
    }
    setD(ps.map((p) => ({
      ...p,
      lapak: lapak.get(p.id_mitra),
      bayar: pembayaranPerPesanan.get(p.$id),
      items: detailPerPesanan.get(p.$id) ?? [],
    })));
  }, [uid, sebagai]);

  useEffect(() => {
    let aktif = true;
    muat().catch((e) => { if (aktif) setMsg(e.message); });
    const timer = setInterval(() => {
      if (!document.hidden) muat().catch(() => {});
    }, 15000);
    return () => { aktif = false; versiMuat.current++; clearInterval(timer); };
  }, [muat]);

  // Periksa pesanan bayar di tempat ketika hitung mundur habis.
  useEffect(() => {
    if (!d || !d.length) return;
    d.forEach((p) => {
      const isOffline = p.bayar?.metode === 'BAYAR_DI_TEMPAT';
      const isMenunggu = p.bayar?.status_pembayaran === 'MENUNGGU';
      const isActive = ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan);
      if (isOffline && isMenunggu && isActive) {
        if (sekarang >= tenggatBayarTenant(p) && sekarang >= (percobaanBatal.current.get(p.$id) || 0)) {
          percobaanBatal.current.set(p.$id, sekarang + 15000);
          api('/api/pesanan', { id: p.$id, aksi: 'batal_kedaluwarsa' }).then(() => muat()).catch(() => {});
        }
      }
    });
  }, [d, sekarang, muat]);

  // Tampilkan modal konfirmasi lalu jalankan aksi
  const mintaKonfirmasi = (id, aksi, judul, pesan, withInput = false) => {
    setMsg('');
    setModalAksi({ id, aksi, judul, pesan, withInput });
  };

  const jalankanAksi = async (alasan) => {
    if (!modalAksi) return;
    setBusyAksi(true);
    try {
      await api('/api/pesanan', { id: modalAksi.id, aksi: modalAksi.aksi, alasan });
      setModalAksi(null);
      setMsg('');
      await muat();
    } catch (e) {
      setMsg(e.message);
      setModalAksi(null);
    }
    setBusyAksi(false);
  };

  const tombol = (p, aksi, label, cls = '') => {
    const onClick = () => {
      if (aksi === 'tolak') return mintaKonfirmasi(p.$id, 'tolak', 'Tolak / Batalkan pesanan', 'Berikan alasan penolakan untuk pembeli.', true);
      if (aksi === 'batal') return mintaKonfirmasi(p.$id, 'batal', 'Batalkan pesanan?', 'Pesanan akan dibatalkan dan stok dikembalikan. Lanjutkan?');
      if (aksi === 'konfirmasi_bayar') {
        return mintaKonfirmasi(p.$id, 'konfirmasi_bayar', 'Konfirmasi pembayaran',
          'Pembeli sudah membayar di tenant? Konfirmasi pembayaran sekaligus selesaikan pesanan.');
      }
      mintaKonfirmasi(p.$id, aksi, label, `Ubah status pesanan menjadi "${label}"?`);
    };
    return <button key={aksi} className={`btn sm ${cls}`} onClick={onClick}>{label}</button>;
  };

  const pesananDenah = d?.find((p) => p.$id === idDenah);
  const denahAktif = sebagai === 'pembeli' && pesananDenah
    && nomorTenantValid(pesananDenah.lapak?.nomor_tenant) && bolehLihatDenah(pesananDenah, sekarang);
  useEffect(() => {
    if (idDenah && !denahAktif) setIdDenah(null);
  }, [idDenah, denahAktif]);

  return (
    <div className="stack">
      {denahAktif && <DenahTenant nomor={pesananDenah.lapak.nomor_tenant} nama={pesananDenah.lapak.nama_usaha} onClose={() => setIdDenah(null)} />}
      {/* Modal konfirmasi aksi */}
      {modalAksi && (
        <Modal
          judul={modalAksi.judul}
          pesan={modalAksi.pesan}
          withInput={modalAksi.withInput}
          inputLabel="Alasan"
          busy={busyAksi}
          onOk={jalankanAksi}
          onBatal={() => setModalAksi(null)}
        />
      )}

      {msg && <p className="msg err" role="alert">{msg}</p>}
      {d && !d.length && (
        <p className="kosong">
          {sebagai === 'mitra' ? 'Belum ada pesanan masuk.' : 'Belum ada pesanan. Pilih produk dari katalog untuk mulai.'}
        </p>
      )}

      {(d || []).map((p) => {
        const isOffline = p.bayar?.metode === 'BAYAR_DI_TEMPAT';
        const isMenungguBayar = p.bayar?.status_pembayaran === 'MENUNGGU';
        const isActiveOrder = ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan);

        const waktu = new Date(p.tanggal_pesanan || p.$createdAt);
        const sisaMs = tenggatBayarTenant(p) - sekarang;
        const sisaTotalDetik = Math.max(0, Math.ceil(sisaMs / 1000));
        const sisaMenit = Math.floor(sisaTotalDetik / 60);
        const sisaDetik = sisaTotalDetik % 60;
        const kedaluwarsa = sisaMs <= 0;
        const jadwalAmbil = p.waktu_pengambilan;
        const sudahTanggalAmbil = !jadwalAmbil || sekarang >= mulaiPengambilan(p);
        const lunas = p.bayar?.status_pembayaran === 'BERHASIL';
        const nomor = p.lapak?.nomor_tenant;
        const adaNomor = nomorTenantValid(nomor);
        const antar = p.jenis_pemesanan === 'ONLINE';
        const tampilDenah = !antar && sebagai === 'pembeli' && bolehLihatDenah(p, sekarang);

        return (
          <article key={p.$id} className="card pad">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Pesanan {p.$id.slice(-6)} {Number.isFinite(waktu.getTime()) && (
                <>• <time dateTime={waktu.toISOString()}>{waktuPesanan.format(waktu)} WIB</time></>
              )}</b>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge" data-s={p.status_pesanan}>{LABEL[p.status_pesanan] || p.status_pesanan}</span>
                {p.bayar && (() => {
                  let teksBayar = p.bayar.status_pembayaran === 'MENUNGGU'
                    ? (isOffline ? 'Belum bayar di tenant' : 'Menunggu verifikasi admin')
                    : (BAYAR[p.bayar.status_pembayaran] || p.bayar.status_pembayaran);

                  // Cegah duplikasi jika teks sama persis dengan status pesanan
                  if (teksBayar.toLowerCase() === (LABEL[p.status_pesanan] || '').toLowerCase()) return null;

                  return (
                    <span className="badge" data-s={p.bayar.status_pembayaran}>
                      {teksBayar}
                    </span>
                  );
                })()}
              </div>
            </div>

            <Lacak status={p.status_pesanan} antar={antar} />

            {jadwalAmbil && <p><b>Pre-order · Ambil di lapak</b><br />{formatJadwalAmbil(jadwalAmbil)}</p>}
            <ul className="lines" style={{ margin: '10px 0' }}>
              {p.items.map((i) => (
                <li key={i.$id}>
                  <span>{i.nama} × {i.jumlah}{i.catatan_item && <small className="catatan-item">Catatan: {i.catatan_item}</small>}</span>
                  <span>{rp(i.subtotal)}</span>
                </li>
              ))}
            </ul>

            {antar && <p className="muted" style={{ overflowWrap: 'anywhere' }}><b>Antar ke</b> {p.alamat_pengiriman} · Ongkir {rp(p.ongkir)}</p>}
            {p.catatan_pembeli && <p className="muted" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><b>Catatan pembeli</b> {p.catatan_pembeli}</p>}
            {(!antar && (sebagai !== 'pembeli' || !isOffline || tampilDenah)) && <p className="muted" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              {adaNomor ? `Ambil di lapak: Tenant ${nomor}` : 'Nomor tenant belum ditetapkan'}
              {p.lapak?.nama_usaha && ` · ${p.lapak.nama_usaha}`}
              {p.alasan_pembatalan ? ` • Alasan batal: ${p.alasan_pembatalan}` : ''}
            </p>}

            {/* PREVIEW BUKTI PEMBAYARAN (QRIS) */}
            {sebagai === 'pembeli' && p.bayar?.metode === 'QRIS' && (
              <p>
                <a className="btn sm out" target="_blank" rel="noopener noreferrer"
                  href={`${TAUTAN_WA}?text=${encodeURIComponent(
                    `Halo Admin LapaKWU, saya ingin menanyakan pembayaran QRIS.\nKode pesanan: ${p.$id}\nLapak: ${p.lapak?.nama_usaha || 'Mitra LapaKWU'}\nNominal pesanan: ${rp(p.bayar.jumlah)}`
                    + (isMenungguBayar ? '\nSaya akan lampirkan bukti pembayaran di chat ini.' : '')
                  )}`}>{isMenungguBayar ? 'Chat admin untuk konfirmasi QRIS' : 'Chat admin soal pembayaran'}</a>
              </p>
            )}
            {sebagai === 'mitra' && p.bayar?.id_bukti_admin && (
              <p>
                <button type="button" className="btn sm out" onClick={() => setModalGambar(img(p.bayar.id_bukti_admin))}>
                  Lihat bukti QRIS dari admin
                </button>
              </p>
            )}
            {sebagai === 'pembeli' && p.bayar?.id_bukti && (
              <div style={{ background: 'var(--tint)', padding: 10, borderRadius: 8, border: '1px dashed var(--line)', marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                    <img src={img(p.bayar.id_bukti)} alt="Thumbnail Bukti Transfer"
                      onClick={() => setModalGambar(img(p.bayar.id_bukti))}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer', background: '#fff' }} />
                    <div>
                      <b style={{ fontSize: '0.9rem' }}>Bukti Pembayaran Pembeli</b>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {p.bayar.status_pembayaran === 'BERHASIL' ? '✓ Pembayaran dikonfirmasi' : 'Menunggu konfirmasi dana masuk'}
                      </div>
                      {p.bayar.status_ocr && <small className="muted">
                        {p.bayar.status_ocr === 'COCOK' ? 'OCR cocok dengan data pembayaran.' : 'Bukti perlu pemeriksaan manual.'}
                      </small>}
                    </div>
                  </div>
                  <button type="button" className="btn sm out" onClick={() => setModalGambar(img(p.bayar.id_bukti))} style={{ fontSize: '0.8rem' }}>
                    🔍 Lihat Preview Bukti
                  </button>
                </div>
              </div>
            )}

            {isOffline && isMenungguBayar && isActiveOrder && (
              <div style={{ marginBottom: 12 }}>
                {!kedaluwarsa ? (
                  <div className="msg" style={{ background: 'var(--tint)', border: '1px solid var(--ye)', color: 'var(--ink)', padding: '8px 12px', fontSize: '0.85rem' }}>
                    {jadwalAmbil
                      ? <>Bayar di lapak pada <b>{formatJadwalAmbil(jadwalAmbil)}</b>.</>
                      : <>⏱️ Sisa waktu bayar di tenant <b>{sisaMenit} menit {String(sisaDetik).padStart(2, '0')} detik</b> dari batas 1 jam.</>}
                  </div>
                ) : (
                  <div className="msg err" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                    ⚠️ Batas pembayaran sudah habis. Pembatalan sedang diproses.
                  </div>
                )}
              </div>
            )}

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b>{rp(p.total_harga)}</b>
                <span className="muted" style={{ marginLeft: 6, fontSize: '0.85rem' }}>
                  ({isOffline ? 'Bayar di tenant' : 'QRIS'})
                </span>
              </div>

              <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {tampilDenah && adaNomor && <button type="button" className="btn sm sun" onClick={() => setIdDenah(p.$id)}>Cari tenant</button>}
                {/* TOMBOL INVOICE: Muncul otomatis saat pembayaran sudah Lunas (BERHASIL) */}
                {p.bayar?.status_pembayaran === 'BERHASIL' && (
                  <button
                    type="button"
                    className="btn sm out"
                    onClick={() => setModalInvoice(p)}
                    style={{ borderColor: 'var(--bl-d)', color: 'var(--bl-d)', fontWeight: 700 }}
                  >
                    🧾 Lihat Invoice
                  </button>
                )}

                {/* PEMBELI: tombol batal hanya untuk bayar di tempat */}
                {sebagai === 'pembeli' && isOffline && ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan) && (
                  tombol(p, 'batal', 'Batalkan pesanan', 'out')
                )}

                {/* MITRA ACTIONS */}
                {sebagai === 'mitra' && (
                  <>
                    {isMenungguBayar && isOffline && isActiveOrder && sudahTanggalAmbil && !kedaluwarsa &&
                      tombol(p, 'konfirmasi_bayar', 'Konfirmasi bayar dan selesaikan', 'sun')}
                    {p.status_pesanan === 'MENUNGGU_KONFIRMASI' && (
                      <>
                        {!isOffline && lunas && tombol(p, 'terima', 'Terima')}
                        {(isOffline || lunas) && tombol(p, 'tolak', 'Tolak', 'red')}
                      </>
                    )}
                    {p.status_pesanan === 'DIPROSES' && (
                      <>
                        {!isOffline && lunas && (antar ? tombol(p, 'kirim', 'Kirim pesanan') : tombol(p, 'siap', 'Siap diambil'))}
                        {tombol(p, 'tolak', 'Batalkan', 'red')}
                      </>
                    )}
                    {lunas && sudahTanggalAmbil && (['DIKIRIM', 'SIAP_DIAMBIL'].includes(p.status_pesanan) || (isOffline && isActiveOrder)) && (
                      tombol(p, 'selesai', 'Selesaikan pesanan', 'sun')
                    )}
                  </>
                )}
              </span>
            </div>
          </article>
        );
      })}

      {/* MODAL PREVIEW BUKTI PEMBAYARAN PENUH */}
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
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <b style={{ fontSize: '1.05rem', color: 'var(--bl-d)' }}>Preview Bukti Pembayaran</b>
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
              <a
                href={modalGambar}
                target="_blank"
                rel="noopener noreferrer"
                className="btn sm"
              >
                Buka di Tab Baru ↗
              </a>
              <button
                type="button"
                className="btn sm out"
                onClick={() => setModalGambar(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL INVOICE PEMBAYARAN */}
      {modalInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalInvoice(null)}
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
              borderRadius: 16,
              padding: 24,
              maxWidth: 540,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Header Invoice */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--line)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, color: '#B8500A', fontSize: '1.4rem' }}>Lapa<b style={{ color: '#FF933E' }}>KWU</b></h3>
                <small className="muted" style={{ fontWeight: 600 }}>INVOICE PEMBAYARAN RESMI</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge" data-s="BERHASIL" style={{ fontSize: '0.85rem' }}>
                  ✓ LUNAS
                </span>
                <div style={{ fontSize: '0.8rem', color: 'var(--mute)', marginTop: 4 }}>
                  No: <b>INV-{modalInvoice.$id.slice(-6).toUpperCase()}</b>
                </div>
              </div>
            </div>

            {/* Info Transaksi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0', fontSize: '0.88rem' }}>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>TANGGAL TRANSAKSI</span>
                <b>{tgl(modalInvoice.tanggal_pesanan)}</b>
                {modalInvoice.waktu_pengambilan && <small className="catatan-item">Ambil {formatJadwalAmbil(modalInvoice.waktu_pengambilan)}</small>}
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>METODE PEMBAYARAN</span>
                <b>{modalInvoice.bayar?.metode === 'QRIS' ? 'QRIS LapaKWU' : 'Bayar di Lapak'}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>LOKASI PENGAMBILAN</span>
                <b>{modalInvoice.jenis_pemesanan === 'ONLINE' ? modalInvoice.alamat_pengiriman : nomorTenantValid(modalInvoice.lapak?.nomor_tenant) ? `Tenant ${modalInvoice.lapak.nomor_tenant}` : 'Nomor tenant belum ditetapkan'}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>STATUS PESANAN</span>
                <b style={{ color: 'var(--bl-d)' }}>{LABEL[modalInvoice.status_pesanan] || modalInvoice.status_pesanan}</b>
              </div>
            </div>

            {/* Rincian Produk */}
            <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '12px 0', margin: '14px 0' }}>
              <b style={{ fontSize: '0.9rem', display: 'block', marginBottom: 8, color: 'var(--ink)' }}>Rincian Pembelian:</b>
              <ul className="lines" style={{ margin: 0 }}>
                {modalInvoice.items.map((i) => (
                  <li key={i.$id} style={{ padding: '6px 0', fontSize: '0.9rem' }}>
                    <span>{i.nama} × {i.jumlah}{i.catatan_item && <small className="catatan-item">Catatan: {i.catatan_item}</small>}</span>
                    <b>{rp(i.subtotal)}</b>
                  </li>
                ))}
              </ul>
            </div>

            {/* Total Pembayaran */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>Total Dibayar</span>
              <b style={{ fontSize: '1.3rem', color: 'var(--bl-d)' }}>{rp(modalInvoice.total_harga)}</b>
            </div>

            {/* Catatan footer */}
            <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.4 }}>
              {modalInvoice.jenis_pemesanan === 'ONLINE' ? 'Ongkir ' + rp(modalInvoice.ongkir) + ' sudah termasuk dalam total.' : 'Tunjukkan invoice ini saat mengambil pesanan di lapak mitra.'}
            </p>

            {/* Tombol aksi */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn sm out"
                onClick={() => window.print()}
              >
                🖨️ Cetak / Unduh PDF
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => setModalInvoice(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
