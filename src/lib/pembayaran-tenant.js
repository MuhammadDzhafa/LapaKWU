import { AKHIR_PRE_ORDER, MULAI_PRE_ORDER, jadwalPreOrder } from './waktu.js';

export const BATAS_BAYAR_TENANT_MS = 60 * 60 * 1000;

export const DURASI_TANGGAL_AMBIL_MS = 24 * BATAS_BAYAR_TENANT_MS;

export function mulaiPengambilan(pesanan) {
  if (!pesanan.waktu_pengambilan) return null;
  return jadwalPreOrder(pesanan.waktu_pengambilan) ? MULAI_PRE_ORDER : new Date(pesanan.waktu_pengambilan).getTime();
}

export function tenggatBayarTenant(pesanan) {
  if (jadwalPreOrder(pesanan.waktu_pengambilan)) return AKHIR_PRE_ORDER;
  if (pesanan.waktu_pengambilan) return new Date(pesanan.waktu_pengambilan).getTime() + DURASI_TANGGAL_AMBIL_MS;
  return new Date(pesanan.tanggal_pesanan || pesanan.$createdAt).getTime() + BATAS_BAYAR_TENANT_MS;
}
