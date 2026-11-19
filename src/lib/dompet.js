import { agregasi } from './db';

export const MINIMAL_PENARIKAN = 10_000;

export async function saldoDompet(idMitra) {
  const [penjualan] = await agregasi('pesanan', [
    { $match: { id_mitra: idMitra, status_pesanan: { $ne: 'DIBATALKAN' } } },
    { $lookup: {
      from: 'pembayaran', localField: '_id', foreignField: 'id_pesanan', as: 'pembayaran',
      pipeline: [{ $match: { metode: 'QRIS', status_pembayaran: 'BERHASIL' } }, { $limit: 1 }],
    } },
    { $unwind: '$pembayaran' },
    { $group: {
      _id: '$status_pesanan',
      sen: { $sum: { $round: [{ $multiply: ['$pembayaran.jumlah', 100] }, 0] } },
    } },
    { $group: {
      _id: null,
      tersedia: { $sum: { $cond: [{ $eq: ['$_id', 'SELESAI'] }, '$sen', 0] } },
      tertahan: { $sum: { $cond: [{ $eq: ['$_id', 'SELESAI'] }, 0, '$sen'] } },
    } },
  ]);
  const [pencairan] = await agregasi('pencairan_dompet', [
    { $match: { id_mitra: idMitra, status: { $in: ['DIAJUKAN', 'DICAIRKAN'] } } },
    { $group: { _id: null, sen: { $sum: { $multiply: ['$nominal', 100] } } } },
  ]);
  const [lama] = await agregasi('rekap_penjualan', [
    { $match: { id_mitra: idMitra, status_pencairan: 'DICAIRKAN' } },
    { $group: { _id: null, sen: { $sum: { $round: [
      { $multiply: [{ $subtract: [{ $ifNull: ['$total_digital', 0] }, { $ifNull: ['$total_komisi', 0] }] }, 100] },
      0,
    ] } } } },
  ]);
  return {
    tersedia: Math.max(0, (penjualan?.tersedia ?? 0) - (pencairan?.sen ?? 0) - (lama?.sen ?? 0)) / 100,
    tertahan: (penjualan?.tertahan ?? 0) / 100,
  };
}
