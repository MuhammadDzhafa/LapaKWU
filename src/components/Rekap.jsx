'use client';
import { useCallback, useEffect, useState } from 'react';
import { list, Query, rp } from '@/lib/aw';

// Mode mitra: rekap penjualan milik sendiri. Mode admin (tanpa mitraId): semua mitra.
export default function Rekap({ mitraId, nama = {} }) {
  const [d, setD] = useState(null);
  const muat = useCallback(() => list('rekap_penjualan', [...(mitraId ? [Query.equal('id_mitra', mitraId)] : []), Query.orderDesc('periode')]).then(setD).catch(() => setD([])), [mitraId]);
  useEffect(() => { muat(); }, [muat]);

  if (!d) return <p className="kosong">Memuat rekap…</p>;
  if (!d.length) return <p className="kosong">Data belum tersedia. Rekap terisi otomatis setiap pesanan berstatus Selesai.</p>;
  const sum = (k) => d.reduce((a, r) => a + (r[k] || 0), 0);
  return (<>
    <div className="scroll"><table>
      <thead><tr>{!mitraId && <th>Mitra</th>}<th>Periode</th><th>Transaksi</th><th>Penjualan</th><th>Dari offline</th><th>Komisi</th></tr></thead>
      <tbody>{d.map((r) => (
        <tr key={r.$id}>{!mitraId && <td>{nama[r.id_mitra] || r.id_mitra.slice(-6)}</td>}
          <td>{r.periode}</td><td>{r.jumlah_transaksi}</td><td>{rp(r.total_penjualan)}</td>
          <td>{rp(r.total_offline)} <small className="muted">({r.jumlah_offline || 0} pcs)</small></td>
          <td>{rp(r.total_komisi)}</td>
        </tr>))}</tbody>
      <tfoot><tr><th colSpan={mitraId ? 1 : 2}>Total</th><th>{sum('jumlah_transaksi')}</th><th>{rp(sum('total_penjualan'))}</th><th>{rp(sum('total_offline'))}</th><th>{rp(sum('total_komisi'))}</th></tr></tfoot>
    </table></div>
    <p className="muted" style={{ marginTop: 10 }}><small>Penjualan offline (tombol − di Produk dan stok) ikut menambah total penjualan dan jumlah transaksi. Komisi dihitung dari penjualan yang dibayar via QRIS.</small></p>
  </>);
}
