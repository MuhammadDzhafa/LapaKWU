import { queryDatabase } from './db.js';

export const MINIMAL_PENARIKAN = 10_000;

export async function saldoDompet(idMitra) {
  const { rows: [saldo] } = await queryDatabase(`
    WITH penjualan AS (
      SELECT ps.status_pesanan, bayar.jumlah
      FROM pesanan ps
      JOIN LATERAL (
        SELECT jumlah FROM pembayaran
        WHERE id_pesanan = ps.id AND metode = 'QRIS' AND status_pembayaran = 'BERHASIL'
        ORDER BY created_at, id LIMIT 1
      ) bayar ON TRUE
      WHERE ps.id_mitra = $1 AND ps.status_pesanan <> 'DIBATALKAN'
    )
    SELECT GREATEST(0,
      COALESCE((SELECT SUM(jumlah) FROM penjualan WHERE status_pesanan = 'SELESAI'), 0)
      - COALESCE((SELECT SUM(nominal) FROM pencairan_dompet
        WHERE id_mitra = $1 AND status IN ('DIAJUKAN', 'DICAIRKAN')), 0)
      - COALESCE((SELECT SUM(total_digital - total_komisi) FROM rekap_penjualan
        WHERE id_mitra = $1 AND status_pencairan = 'DICAIRKAN'), 0)
    ) AS tersedia,
    COALESCE((SELECT SUM(jumlah) FROM penjualan WHERE status_pesanan <> 'SELESAI'), 0) AS tertahan
  `, [idMitra]);
  return { tersedia: Number(saldo.tersedia), tertahan: Number(saldo.tertahan) };
}
