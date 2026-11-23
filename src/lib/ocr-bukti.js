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
  const jumlahTransfer = /^(?:nominal|jumlah|total|kamu membayar)\b/i;
  const bukanPembayaran = /\b(?:biaya|saldo|penghematan|hemat|diskon|cashback)\b/i;
  const angka = (line, berikutnya) => {
    if (bukanPembayaran.test(line)) return [];
    const angkaTerpisah = berikutnya?.match(/^\s*(\d+(?:[ \t]*[.,][ \t]*\d+)*)\s*$/);
    const teksNominal = angkaTerpisah && /\b(?:IDR|RP)\.?\s*$/i.test(line)
      ? `${line} ${angkaTerpisah[1]}`
      : line;
    return [...teksNominal.matchAll(/\b(?:IDR|RP)\.?\s*(\d+(?:[ \t]*[.,][ \t]*\d+)*)/gi)]
      .map((m) => rupiahDalamSen(m[1])).filter(Number.isSafeInteger);
  };
  const indeksBukanPembayaran = new Set();
  lines.forEach((line, i) => {
    if (!bukanPembayaran.test(line)) return;
    indeksBukanPembayaran.add(i);
    if (!/\b(?:IDR|RP)\.?\s*\d/i.test(line) && /^\s*(?:IDR|RP)\.?\s*(?:\d|$)/i.test(lines[i + 1] || '')) {
      indeksBukanPembayaran.add(i + 1);
    }
  });
  const berlabel = lines.flatMap((line, i) => {
    if (!jumlahTransfer.test(line) || indeksBukanPembayaran.has(i)) return [];
    if (/\b(?:IDR|RP)(?=\W|\d|$)/i.test(line)) return angka(line, lines[i + 1]);
    if (indeksBukanPembayaran.has(i + 1)) return [];
    return angka(lines[i + 1] || '', lines[i + 2]);
  });
  const nominal = [...new Set(berlabel.length ? berlabel : lines.flatMap((line, i) => (
    indeksBukanPembayaran.has(i) ? [] : angka(line, lines[i + 1])
  )))];
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
