export function periodeJakarta(tanggal = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
    .format(tanggal)
    .slice(0, 7);
}
