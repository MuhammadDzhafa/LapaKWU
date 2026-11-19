export const BATAS_BAYAR_TENANT_MS = 60 * 60 * 1000;

export function tenggatBayarTenant(pesanan) {
  return new Date(pesanan.tanggal_pesanan || pesanan.$createdAt).getTime() + BATAS_BAYAR_TENANT_MS;
}
