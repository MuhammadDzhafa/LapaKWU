'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import { list, Query, rp, tgl, api, img } from '@/lib/aw';

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

// Modal konfirmasi / input — menggantikan alert() / confirm() / prompt() bawaan browser
function Modal({ judul, pesan, withInput, inputLabel, onOk, onBatal, busy }) {
  const [val, setVal] = useState('');
  return (
    <div role="dialog" aria-modal="true" onClick={onBatal}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <b style={{ fontSize: '1.05rem', display: 'block', marginBottom: 8 }}>{judul}</b>
        {pesan && <p style={{ margin: '0 0 14px', color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>{pesan}</p>}
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
  const [modalAksi, setModalAksi] = useState(null); // { id, aksi, judul, pesan, withInput }
  const [busyAksi, setBusyAksi] = useState(false);
  const [sekarang, setSekarang] = useState(Date.now());
  const cancellingRef = useRef(new Set());

  useEffect(() => {
    const timer = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const muat = useCallback(async () => {
    const ps = await list('pesanan', [
      Query.equal(sebagai === 'mitra' ? 'id_mitra' : 'id_pembeli', uid),
      Query.orderDesc('$createdAt'),
    ]);
    if (!ps.length) return setD([]);
    const ids = ps.map((p) => p.$id);
    const [dt, by] = await Promise.all([
      list('detail_pesanan', [Query.equal('id_pesanan', ids)]),
      list('pembayaran', [Query.equal('id_pesanan', ids)]),
    ]);
    const pid = [...new Set(dt.map((x) => x.id_produk))];
    const pr = pid.length ? await list('produk', [Query.equal('$id', pid)]) : [];
    setD(ps.map((p) => ({
      ...p,
      bayar: by.find((x) => x.id_pesanan === p.$id),
      items: dt.filter((x) => x.id_pesanan === p.$id).map((x) => ({
        ...x,
        nama: pr.find((y) => y.$id === x.id_produk)?.nama || 'Produk dihapus',
      })),
    })));
  }, [uid, sebagai]);

  useEffect(() => { muat().catch((e) => setMsg(e.message)); }, [muat]);

  // Auto-cancel pesanan offline > 30 menit
  useEffect(() => {
    if (!d || !d.length) return;
    d.forEach((p) => {
      const isOffline = p.bayar?.metode === 'BAYAR_DI_TEMPAT';
      const isMenunggu = p.bayar?.status_pembayaran === 'MENUNGGU';
      const isActive = ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan);
      if (isOffline && isMenunggu && isActive) {
        const orderTime = new Date(p.tanggal_pesanan || p.$createdAt).getTime();
        if (orderTime + 30 * 60 * 1000 - sekarang <= 0 && !cancellingRef.current.has(p.$id)) {
          cancellingRef.current.add(p.$id);
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
        const isOff = p.bayar?.metode === 'BAYAR_DI_TEMPAT';
        return mintaKonfirmasi(p.$id, 'konfirmasi_bayar', 'Konfirmasi pembayaran',
          isOff ? 'Konfirmasi bahwa pembeli telah membayar langsung di tenant/lapak?' : 'Konfirmasi bahwa bukti transfer QRIS valid dan dana sudah masuk ke rekening/QRIS tokomu?');
      }
      mintaKonfirmasi(p.$id, aksi, label, `Ubah status pesanan menjadi "${label}"?`);
    };
    return <button key={aksi} className={`btn sm ${cls}`} onClick={onClick}>{label}</button>;
  };

  return (
    <div className="stack">
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
        const isQris = p.bayar?.metode === 'QRIS';
        const isMenungguBayar = p.bayar?.status_pembayaran === 'MENUNGGU';
        const isActiveOrder = ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan);

        let sisaMenit = 0, sisaDetik = 0, sudahLewat30Menit = false;
        if (isOffline && isMenungguBayar) {
          const orderTime = new Date(p.tanggal_pesanan || p.$createdAt).getTime();
          const sisaMs = orderTime + 30 * 60 * 1000 - sekarang;
          if (sisaMs > 0) { sisaMenit = Math.floor(sisaMs / 60000); sisaDetik = Math.floor((sisaMs % 60000) / 1000); }
          else sudahLewat30Menit = true;
        }

        return (
          <article key={p.$id} className="card pad">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Pesanan {p.$id.slice(-6)} • {tgl(p.tanggal_pesanan)}</b>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge" data-s={p.status_pesanan}>{LABEL[p.status_pesanan] || p.status_pesanan}</span>
                {p.bayar && (() => {
                  let teksBayar = p.bayar.status_pembayaran === 'MENUNGGU'
                    ? (isOffline ? 'Belum bayar di tenant' : 'Verifikasi bukti transfer')
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

            <ul className="lines" style={{ margin: '10px 0' }}>
              {p.items.map((i) => (
                <li key={i.$id}>
                  <span>{i.nama} × {i.jumlah}</span>
                  <span>{rp(i.subtotal)}</span>
                </li>
              ))}
            </ul>

            <p className="muted" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              {`Ambil di lapak: ${p.lokasi_pengambilan || '-'}`}
              {p.alasan_pembatalan ? ` • Alasan batal: ${p.alasan_pembatalan}` : ''}
            </p>

            {/* PREVIEW BUKTI PEMBAYARAN (QRIS) */}
            {p.bayar?.id_bukti && (
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px dashed #cbd5e1', marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                    <img src={img(p.bayar.id_bukti)} alt="Thumbnail Bukti Transfer"
                      onClick={() => setModalGambar(img(p.bayar.id_bukti))}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', background: '#fff' }} />
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

            {/* COUNTDOWN 30 MENIT — hanya untuk pembayaran di tempat */}
            {isOffline && isMenungguBayar && isActiveOrder && (
              <div style={{ marginBottom: 12 }}>
                {!sudahLewat30Menit ? (
                  <div className="msg" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '8px 12px', fontSize: '0.85rem' }}>
                    ⏱️ Batas waktu pembayaran di tenant: <b>{sisaMenit} menit {sisaDetik < 10 ? '0' + sisaDetik : sisaDetik} detik</b> (maksimal 30 menit dari checkout).
                  </div>
                ) : (
                  <div className="msg err" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                    ⚠️ Batas waktu 30 menit pembayaran di tenant telah kedaluwarsa. Pesanan dibatalkan.
                  </div>
                )}
              </div>
            )}

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b>{rp(p.total_harga)}</b>
                <span className="muted" style={{ marginLeft: 6, fontSize: '0.85rem' }}>
                  ({isOffline ? 'Bayar di tenant' : 'QRIS Mitra'})
                </span>
              </div>

              <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {/* TOMBOL INVOICE: Muncul otomatis saat pembayaran sudah Lunas (BERHASIL) */}
                {p.bayar?.status_pembayaran === 'BERHASIL' && (
                  <button
                    type="button"
                    className="btn sm out"
                    onClick={() => setModalInvoice(p)}
                    style={{ borderColor: '#059669', color: '#047857', fontWeight: 700 }}
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
                    {p.bayar?.status_pembayaran === 'MENUNGGU' && (isQris || !sudahLewat30Menit) && (
                      isOffline
                        ? tombol(p, 'konfirmasi_bayar', '✓ Konfirmasi Bayar di Tenant', 'sun')
                        : tombol(p, 'konfirmasi_bayar', '✓ Konfirmasi Pembayaran QRIS', 'sun')
                    )}
                    {p.status_pesanan === 'MENUNGGU_KONFIRMASI' && (
                      <>
                        {p.bayar?.status_pembayaran === 'BERHASIL' && tombol(p, 'terima', 'Terima')}
                        {tombol(p, 'tolak', 'Tolak', 'red')}
                      </>
                    )}
                    {p.status_pesanan === 'DIPROSES' && (
                      <>
                        {tombol(p, 'siap', 'Siap diambil')}
                        {tombol(p, 'tolak', 'Batalkan', 'red')}
                      </>
                    )}
                    {['DIKIRIM', 'SIAP_DIAMBIL'].includes(p.status_pesanan) && (
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
              <b style={{ fontSize: '1.05rem', color: '#1e3a8a' }}>Preview Bukti Pembayaran</b>
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
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f1f5f9', paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, color: '#B8500A', fontSize: '1.4rem' }}>Lapa<b style={{ color: '#FF933E' }}>KWU</b></h3>
                <small className="muted" style={{ fontWeight: 600 }}>INVOICE PEMBAYARAN RESMI</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge" data-s="BERHASIL" style={{ fontSize: '0.85rem' }}>
                  ✓ LUNAS
                </span>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                  No: <b>INV-{modalInvoice.$id.slice(-6).toUpperCase()}</b>
                </div>
              </div>
            </div>

            {/* Info Transaksi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0', fontSize: '0.88rem' }}>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>TANGGAL TRANSAKSI</span>
                <b>{tgl(modalInvoice.tanggal_pesanan)}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>METODE PEMBAYARAN</span>
                <b>{modalInvoice.bayar?.metode === 'QRIS' ? 'QRIS DANA (LapaKWU)' : 'Bayar di Lapak'}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>LOKASI PENGAMBILAN</span>
                <b>{modalInvoice.lokasi_pengambilan || 'Tenant Lapak Mitra'}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>STATUS PESANAN</span>
                <b style={{ color: '#047857' }}>{LABEL[modalInvoice.status_pesanan] || modalInvoice.status_pesanan}</b>
              </div>
            </div>

            {/* Rincian Produk */}
            <div style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '12px 0', margin: '14px 0' }}>
              <b style={{ fontSize: '0.9rem', display: 'block', marginBottom: 8, color: '#334155' }}>Rincian Pembelian:</b>
              <ul className="lines" style={{ margin: 0 }}>
                {modalInvoice.items.map((i) => (
                  <li key={i.$id} style={{ padding: '6px 0', fontSize: '0.9rem' }}>
                    <span>{i.nama} × {i.jumlah}</span>
                    <b>{rp(i.subtotal)}</b>
                  </li>
                ))}
              </ul>
            </div>

            {/* Total Pembayaran */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>Total Dibayar</span>
              <b style={{ fontSize: '1.3rem', color: '#047857' }}>{rp(modalInvoice.total_harga)}</b>
            </div>

            {/* Catatan footer */}
            <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.4 }}>
              Terima kasih telah berbelanja di LapaKWU. Tunjukkan invoice ini saat mengambil pesanan di lapak mitra.
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
