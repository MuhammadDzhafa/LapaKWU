export function hitungKomisi(nominal) {
  const persen = Number(process.env.KOMISI_PERSEN ?? 5);
  if (!Number.isFinite(persen) || persen < 0 || persen > 100) throw new Error('KOMISI_PERSEN harus antara 0 dan 100.');
  const amount = Number(nominal);
  return Math.sign(amount) * Math.round(Math.abs(amount) * persen) / 100;
}
