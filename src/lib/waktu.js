export const TANGGAL_PRE_ORDER = '2026-11-24';
export const HARI_PRE_ORDER = Date.parse(TANGGAL_PRE_ORDER + 'T00:00:00+07:00');
export const MULAI_PRE_ORDER = Date.parse(TANGGAL_PRE_ORDER + 'T08:00:00+07:00');
export const AKHIR_PRE_ORDER = Date.parse(TANGGAL_PRE_ORDER + 'T18:00:00+07:00');
export const JAM_PRE_ORDER = '08.00–18.00 WIB';

export function waktuPreOrder(tanggal, sekarang = new Date()) {
  return tanggal === TANGGAL_PRE_ORDER && sekarang.getTime() < AKHIR_PRE_ORDER ? new Date(MULAI_PRE_ORDER) : null;
}

export function jadwalPreOrder(waktu) {
  return [HARI_PRE_ORDER, MULAI_PRE_ORDER].includes(new Date(waktu).getTime());
}

export function formatJadwalAmbil(waktu) {
  const tanggal = formatTanggalAmbil(waktu);
  return jadwalPreOrder(waktu) ? tanggal + ', ' + JAM_PRE_ORDER : tanggal + ' (WIB)';
}

export function formatTanggalAmbil(waktu) {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long' }).format(new Date(waktu));
}

export function periodeJakarta(tanggal = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
    .format(tanggal)
    .slice(0, 7);
}
