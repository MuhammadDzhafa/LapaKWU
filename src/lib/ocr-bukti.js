import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
let sedangMembaca = false;

export async function bacaBukti(buffer, originalName) {
  const python = process.env.OCR_PYTHON;
  if (!python || sedangMembaca) return null;
  sedangMembaca = true;
  const folder = await mkdtemp(join(process.env.TMPDIR || '/tmp', 'lapakwu-ocr-'));
  const path = join(folder, `bukti${extname(originalName || '.jpg') || '.jpg'}`);
  try {
    await writeFile(path, buffer);
    const { stdout } = await execFileAsync(python, [join(process.cwd(), 'scripts', 'ocr-bukti.py'), path], {
      timeout: 60_000, maxBuffer: 512 * 1024, windowsHide: true,
    });
    // Library native dapat menulis log ke stdout sebelum baris JSON.
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
    return Array.isArray(result) && result.every((line) => typeof line === 'string') ? result : null;
  } catch {
    console.warn('[ocr] Bukti tidak dapat dibaca. Diteruskan ke pemeriksaan manual.');
    return null;
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => {});
    sedangMembaca = false;
  }
}

const normal = (text) => text.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const bulan = 'JAN FEB MAR APR MEI JUN JUL AGU SEP OKT NOV DES'.split(' ');
const bulanInggris = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');

export function rupiahDalamSen(raw) {
  const value = raw.replace(/\s/g, '').replace(/[.,]$/, '');
  if (/^\d+(?:[.,]\d{2})?$/.test(value)) return Math.round(Number(value.replace(',', '.')) * 100);
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/.test(value)) return Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100);
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(value)) return Math.round(Number(value.replace(/,/g, '')) * 100);
  return null;
}

function tanggalBukti(lines) {
  const cocok = lines.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/)
    || lines.match(/\b(\d{1,2})[ /.-]+(\d{1,2}|[a-z]{3,9})[ /.-]+(\d{4})\b/i);
  if (!cocok) return null;
  let [, hari, month, tahun] = cocok;
  if (hari.length === 4) [hari, tahun] = [tahun, hari];
  if (!/^\d+$/.test(month)) {
    const prefix = month.slice(0, 3).toUpperCase();
    month = Math.max(bulan.indexOf(prefix), bulanInggris.indexOf(prefix)) + 1;
  }
  const date = new Date(Date.UTC(+tahun, +month - 1, +hari));
  return date.getUTCMonth() === +month - 1 && date.getUTCDate() === +hari ? date.toISOString().slice(0, 10) : null;
}

export function periksaBukti(lines, total, now = new Date(), penerima = process.env.OCR_NAMA_PENERIMA || '') {
  if (!lines?.length) return { status: 'PERLU_TINJAUAN', temuan: ['OCR tidak tersedia atau gambar tidak terbaca.'] };
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
  const nominalCocok = nominal.includes(Math.round(total * 100));
  const nama = normal(penerima);
  const labelPenerima = /^(?:nama (?:penerima|merchant)|penerima|tujuan|kepada|dibayar ke|transfer ke)(?:\s*:\s*|\s+|$)/i;
  const penerimaTerbaca = lines.flatMap((line, i) => {
    const label = line.match(labelPenerima);
    return label ? [line.slice(label[0].length).trim() || lines[i + 1] || ''] : [];
  });
  const penerimaCocok = Boolean(nama && (penerimaTerbaca.length ? penerimaTerbaca : lines)
    .some((line) => normal(line) === nama));
  const tanggal = tanggalBukti(teks);
  const tanggalJakarta = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(date);
  const hariIni = tanggalJakarta(now);
  const kemarin = tanggalJakarta(new Date(now.getTime() - 86_400_000));
  const temuan = [];
  if (!nominalCocok) temuan.push('Nominal checkout belum ditemukan pada bukti.');
  if (!penerimaCocok) temuan.push('Nama penerima QRIS belum cocok atau belum dikonfigurasi.');
  if (!tanggal || tanggal < kemarin || tanggal > hariIni) temuan.push('Tanggal transaksi belum terbaca atau di luar rentang pemeriksaan.');
  const referensi = teks.match(/(?:no\.?[ \t]*)?(?:referensi|reference|ref\.?|id transaksi)[ \t]*[:#]?[ \t]*(?:\r?\n)?[ \t]*([A-Z0-9-]{8,64})\b/i)?.[1]?.toUpperCase();
  return {
    status: temuan.length ? 'PERLU_TINJAUAN' : 'COCOK',
    temuan,
    data: { nominal: nominalCocok ? total : (nominal.length === 1 ? nominal[0] / 100 : null), penerima_cocok: penerimaCocok, tanggal },
    ...(referensi ? { referensi } : {}),
  };
}
