import { tenggatBayarTenant } from './pembayaran-tenant.js';

export const JUMLAH_TENANT = 90;

export function nomorTenantValid(nomor) {
  return Number.isInteger(nomor) && nomor >= 1 && nomor <= JUMLAH_TENANT;
}

export function bolehLihatDenah(pesanan, sekarang) {
  if (pesanan.status_pesanan === 'DIBATALKAN') return false;
  if (pesanan.bayar?.metode === 'QRIS') return true;
  return pesanan.bayar?.metode === 'BAYAR_DI_TEMPAT'
    && pesanan.bayar.status_pembayaran === 'MENUNGGU'
    && ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(pesanan.status_pesanan)
    && sekarang < tenggatBayarTenant(pesanan);
}
