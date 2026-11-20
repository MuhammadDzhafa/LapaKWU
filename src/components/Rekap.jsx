'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { list, Query, rp } from '@/lib/aw';

const warna = ['#17657d', '#b8500a'];

function GrafikRekap({ bulanan, puncak, digital, offline }) {
  const titik = bulanan.map(([periode, total], i) => ({
    periode, total, x: bulanan.length === 1 ? 180 : 30 + i * 300 / (bulanan.length - 1),
    y: 126 - (Math.max(0, total) / puncak) * 108,
  }));
  const kanal = [{ nama: 'Digital', nilai: digital }, { nama: 'Offline', nilai: offline }];
  const totalKanal = digital + offline;
  const sudut = totalKanal > 0 ? digital / totalKanal * 360 : 0;
  const [tahun, bulan] = bulanan.at(-1)[0].split('-').map(Number);
  const nilaiBulanan = new Map(bulanan);
  const radar = Array.from({ length: 6 }, (_, i) => {
    const periode = new Date(Date.UTC(tahun, bulan - 6 + i, 1)).toISOString().slice(0, 7);
    return [periode, nilaiBulanan.get(periode) ?? 0];
  });
  const puncakRadar = Math.max(1, ...radar.map(([, nilai]) => nilai));
  const posisi = (indeks, skala) => {
    const sudut = indeks * Math.PI * 2 / radar.length - Math.PI / 2;
    return [180 + Math.cos(sudut) * skala, 96 + Math.sin(sudut) * skala];
  };

  return <div className="rekap-charts">
    <figure className="rekap-grafik">
      <figcaption><h3>Tren penjualan bulanan</h3></figcaption>
      <svg viewBox="0 0 360 160" role="img" aria-label="Grafik garis total penjualan per bulan">
        {[18, 54, 90, 126].map((y) => <line key={y} x1="30" x2="330" y1={y} y2={y} stroke="#d6dce2" />)}
        <polyline fill="none" stroke={warna[0]} strokeWidth="3" points={titik.map(({ x, y }) => [x, y].join(',')).join(' ')} />
        {titik.map(({ x, y, periode, total }, i) => <g key={periode}>
          <circle cx={x} cy={y} r="4" fill={warna[0]}><title>{periode} · {rp(total)}</title></circle>
          {(i === 0 || i === titik.length - 1 || i % 3 === 0) && <text x={x} y="147" fontSize="11" textAnchor="middle">{periode}</text>}
        </g>)}
      </svg>
    </figure>
    <figure className="rekap-grafik">
      <figcaption><h3>Porsi penjualan per kanal</h3></figcaption>
      {totalKanal > 0 ? <div className="rekap-pie" role="img" aria-label={'Grafik lingkaran penjualan digital ' + Math.round(sudut / 3.6) + ' persen'}
        style={{ background: 'conic-gradient(' + warna[0] + ' 0deg ' + sudut + 'deg, ' + warna[1] + ' ' + sudut + 'deg 360deg)' }} /> : <p>Belum ada nilai penjualan per kanal.</p>}
      <ul className="lines">{kanal.map(({ nama, nilai }, i) => <li key={nama}><b style={{ color: warna[i] }}>{nama}</b><span>{rp(nilai)}</span></li>)}</ul>
    </figure>
    <figure className="rekap-grafik">
      <figcaption><h3>Perbandingan enam bulan terakhir</h3></figcaption>
      <svg viewBox="0 0 360 192" role="img" aria-label="Grafik radar total penjualan per bulan">
          {[16, 32, 48, 64].map((jari) => <polygon key={jari} points={radar.map((_, i) => posisi(i, jari).join(',')).join(' ')} fill="none" stroke="#d6dce2" />)}
          {radar.map(([periode], i) => {
            const [x, y] = posisi(i, 64);
            return <line key={periode} x1="180" y1="96" x2={x} y2={y} stroke="#d6dce2" />;
          })}
          <polygon points={radar.map(([, nilai], i) => posisi(i, Math.max(0, nilai) / puncakRadar * 64).join(',')).join(' ')}
            fill={warna[0]} fillOpacity=".25" stroke={warna[0]} strokeWidth="2" />
          {radar.map(([periode, nilai], i) => {
            const [x, y] = posisi(i, 78);
            return <text key={periode} x={x} y={y + 4} fontSize="11" textAnchor="middle"><title>{rp(nilai)}</title>{periode}</text>;
          })}
      </svg>
    </figure>
  </div>;
}

function unduhCsv(baris) {
  const csv = baris.map((row) => row.map((value) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rekap-penjualan-lapakwu.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cetakPdf(laporan) {
  const frame = document.createElement('iframe');
  frame.title = 'Cetak rekap penjualan';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  frame.onload = () => {
    const halaman = frame.contentWindow;
    halaman.addEventListener('afterprint', () => frame.remove(), { once: true });
    halaman.focus();
    halaman.print();
  };
  frame.srcdoc = `<!doctype html><html lang="id"><meta charset="utf-8">
    <title>Rekap Penjualan LapaKWU</title><style>
    @page{size:A4;margin:15mm}
    body{font:11pt system-ui,sans-serif;color:#22313f}
    h2,h3{margin:0 0 10px}
    .rekap-grafik{margin:0 0 20px;break-inside:avoid}\n    .rekap-charts svg{width:100%;max-height:165px}\n    .rekap-pie{width:100px;height:100px;border-radius:50%;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .rekap-baris{display:grid;grid-template-columns:70px 1fr 105px;align-items:center;gap:8px;margin:5px 0;break-inside:avoid}
    .rekap-isi{display:block;height:12px;background:#ffcb56;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    table{border-collapse:collapse;width:100%;table-layout:auto}
    th,td{padding:7px 5px;border-bottom:1px solid #c6cdd4;text-align:left;overflow-wrap:anywhere}
    thead{display:table-header-group} tfoot{display:table-row-group} tr{break-inside:avoid}
    </style><body><h2>Rekap Penjualan LapaKWU</h2>${laporan.innerHTML}</body></html>`;
  document.body.append(frame);
}

// Mode mitra: rekap penjualan milik sendiri. Mode admin (tanpa mitraId): semua mitra.
export default function Rekap({ mitraId, nama = {} }) {
  const [d, setD] = useState(null);
  const [halaman, setHalaman] = useState(0);
  const [adaLanjutan, setAdaLanjutan] = useState(true);
  const [muatLanjutan, setMuatLanjutan] = useState(false);
  const laporan = useRef(null);
  const muat = useCallback(async (offset = 0, append = false) => {
    try {
      const hasil = await list('rekap_penjualan', [...(mitraId ? [Query.equal('id_mitra', mitraId)] : []), Query.orderDesc('periode'), Query.limit(500), Query.offset(offset)]);
      setD((sebelumnya) => append ? [...(sebelumnya || []), ...hasil] : hasil);
      setAdaLanjutan(hasil.length === 500);
      setHalaman(offset);
    } catch { setD((sebelumnya) => sebelumnya || []); }
  }, [mitraId]);
  useEffect(() => { muat(); }, [muat]);

  if (!d) return <p className="kosong">Memuat rekap…</p>;
  if (!d.length) return <p className="kosong">Data belum tersedia. Rekap terisi otomatis setiap pesanan berstatus Selesai.</p>;
  const sum = (k) => d.reduce((a, r) => a + (r[k] || 0), 0);
  const namaMitra = (id) => nama[id] || id?.slice(-6) || '';
  const perBulan = new Map();
  for (const row of d) perBulan.set(row.periode, (perBulan.get(row.periode) || 0) + (row.total_penjualan || 0));
  const bulanTerakhir = [...perBulan].slice(0, 12).reverse();
  const puncak = bulanTerakhir.reduce((max, [, total]) => Math.max(max, total), 1);
  const eksporCsv = () => unduhCsv([
    [...(!mitraId ? ['Mitra'] : []), 'Periode', 'Transaksi', 'Total Penjualan (Rp)', 'Komisi Platform (Rp)', 'Penjualan Offline (Rp)', 'Jumlah Offline (pcs)'],
    ...d.map((r) => [...(!mitraId ? [namaMitra(r.id_mitra)] : []), r.periode, r.jumlah_transaksi ?? 0, r.total_penjualan ?? 0, r.total_komisi ?? 0, r.total_offline ?? 0, r.jumlah_offline ?? 0]),
    [...(!mitraId ? [''] : []), 'Total', sum('jumlah_transaksi'), sum('total_penjualan'), sum('total_komisi'), sum('total_offline'), sum('jumlah_offline')],
  ]);
  return (<section className="stack">
    <div className="row rekap-toolbar">
      <button type="button" className="btn sm out" onClick={() => cetakPdf(laporan.current)}>Ekspor PDF</button>
      <button type="button" className="btn sm out" onClick={eksporCsv}>Unduh CSV</button>
    </div>
    <div ref={laporan}>
      <figure className="rekap-grafik">
        <figcaption><h3>Total penjualan per bulan</h3></figcaption>
        {bulanTerakhir.map(([periode, total]) => (
          <div className="rekap-baris" key={periode}>
            <span>{periode}</span>
            <span className="rekap-lintasan" aria-hidden="true"><span className="rekap-isi" style={{ width: Math.max(0, total / puncak * 100) + '%' }} /></span>
            <b>{rp(total)}</b>
          </div>
        ))}
      </figure>
      <GrafikRekap bulanan={bulanTerakhir} puncak={puncak} digital={sum('total_digital')} offline={sum('total_offline')} />
      <div className="scroll"><table>
        <thead><tr>{!mitraId && <th>Mitra</th>}<th>Periode</th><th>Transaksi</th><th>Total Penjualan</th><th>Komisi platform</th><th>Dari offline</th></tr></thead>
        <tbody>{d.map((r) => (
          <tr key={r.$id}>{!mitraId && <td>{namaMitra(r.id_mitra)}</td>}
            <td>{r.periode}</td><td>{r.jumlah_transaksi}</td><td>{rp(r.total_penjualan)}</td><td>{rp(r.total_komisi)}</td>
            <td>{rp(r.total_offline)} <small className="muted">({r.jumlah_offline || 0} pcs)</small></td>
          </tr>))}</tbody>
        <tfoot><tr><th colSpan={mitraId ? 1 : 2}>Total</th><th>{sum('jumlah_transaksi')}</th><th>{rp(sum('total_penjualan'))}</th><th>{rp(sum('total_komisi'))}</th><th>{rp(sum('total_offline'))}</th></tr></tfoot>
      </table></div>
    </div>
    <p className="muted" style={{ marginTop: 10 }}><small>Penjualan offline (tombol − di Produk dan stok) ikut menambah total penjualan dan jumlah transaksi.</small></p>
    {adaLanjutan && d.length > 0 && d.length % 500 === 0 && <div className="row" style={{ justifyContent: 'center' }}><button type="button" className="btn sm out" disabled={muatLanjutan} onClick={async () => { setMuatLanjutan(true); await muat(halaman + 500, true); setMuatLanjutan(false); }}>{muatLanjutan ? 'Memuat…' : 'Muat rekap berikutnya'}</button></div>}
  </section>);
}
