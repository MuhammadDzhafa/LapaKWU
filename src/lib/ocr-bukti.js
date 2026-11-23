import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { denganPekerjaOcr } from './pekerja-ocr.js';
import { MERCHANT_QRIS } from './bukti-pembayaran.js';

export async function bacaBukti(buffer, originalName) {
  return denganPekerjaOcr(async (baca) => {
    let folder;
    try {
      folder = await mkdtemp(join(tmpdir(), 'lapakwu-ocr-'));
      const ekstensi = extname(originalName || '.jpg') || '.jpg';
      // PaddleOCR lebih konsisten membaca bukti WebP setelah didekode ke PNG.
      const webp = ekstensi.toLowerCase() === '.webp';
      const path = join(folder, `bukti${webp ? '.png' : ekstensi}`);
      const gambar = webp ? await sharp(buffer, { limitInputPixels: 12_000_000 }).png().toBuffer() : buffer;
      await writeFile(path, gambar);
      const hasil = await baca(path);
      return Array.isArray(hasil) && hasil.every((line) => typeof line === 'string') ? hasil : null;
    } catch (error) {
      console.warn('[ocr] Pemeriksaan bukti gagal:', error.code || error.message);
      return null;
    } finally {
      if (folder) await rm(folder, { recursive: true, force: true }).catch(() => {});
    }
  });
}

const normal = (text) => text.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const merchantQris = normal(MERCHANT_QRIS);

export function rupiahDalamSen(raw) {
  const value = raw.replace(/\s/g, '').replace(/[.,]$/, '');
  if (/^\d+(?:[.,]\d{2})?$/.test(value)) return Math.round(Number(value.replace(',', '.')) * 100);
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/.test(value)) return Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100);
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(value)) return Math.round(Number(value.replace(/,/g, '')) * 100);
  return null;
}

export function periksaBukti(lines, total) {
  if (!lines?.length) return { status: 'DITOLAK', temuan: [`Bukti tidak terbaca. Unggah gambar yang menampilkan merchant ${MERCHANT_QRIS} dan nominal pembayaran.`] };
  const teks = lines.join('\n');
  const jumlahTransfer = /^(?:nominal|jumlah|total)(?:\s+(?:transfer|pembayaran|transaksi))?\b/i;
  const berlabel = lines.flatMap((line, i) => {
    if (!jumlahTransfer.test(line) || /\b(?:biaya|saldo)\b/i.test(line)) return [];
    return [/(?:IDR|RP)|\d/i.test(line) ? line : (lines[i + 1] || '')];
  });
  const angka = (text) => [...text.matchAll(/\b(?:IDR|RP)\.?\s*(\d[\d.,]*)/gi)]
    .map((m) => rupiahDalamSen(m[1])).filter(Number.isSafeInteger);
  const nominalBerlabel = angka(berlabel.join('\n'));
  const nominal = [...new Set(nominalBerlabel.length
    ? nominalBerlabel
    : angka(lines.filter((line) => !/\b(?:biaya|saldo)\b/i.test(line)).join('\n')))];
  const nominalCocok = nominal.length === 1 && nominal[0] === Math.round(total * 100);
  const labelPenerima = /^(?:merchant name|nama (?:penerima|merchant|toko)|merchant|toko|penerima|tujuan|kepada|dibayar ke|transfer ke)(?:\s*:\s*|\s+|$)/i;
  const penerimaTerbaca = lines.flatMap((line, i) => {
    const label = line.match(labelPenerima);
    if (!label) return [];
    const inline = line.slice(label[0].length).trim();
    return [inline || lines[i + 1] || ''];
  });
  const kandidatPenerima = penerimaTerbaca.length ? penerimaTerbaca : lines;
  const penerimaCocok = kandidatPenerima.some((line) => normal(line) === merchantQris);
  const temuan = [];
  if (!nominal.length) temuan.push('Nominal pembayaran tidak ditemukan.');
  else if (nominal.length > 1) temuan.push('Nominal pembayaran tidak dapat dipastikan karena ada beberapa jumlah berbeda.');
  else if (!nominalCocok) temuan.push('Nominal pembayaran tidak sama dengan total pesanan.');
  if (!penerimaCocok) temuan.push(`Nama merchant harus terbaca sebagai ${MERCHANT_QRIS}.`);
  const referensi = teks.match(/(?:no\.?[ \t]*)?(?:referensi|reference|ref\.?|id transaksi)[ \t]*[:#]?[ \t]*(?:\r?\n)?[ \t]*([A-Z0-9-]{8,64})\b/i)?.[1]?.toUpperCase();
  return {
    status: temuan.length ? 'DITOLAK' : 'COCOK',
    temuan,
    data: { nominal: nominal.length === 1 ? nominal[0] / 100 : null, penerima_cocok: penerimaCocok },
    ...(referensi ? { referensi } : {}),
  };
}
