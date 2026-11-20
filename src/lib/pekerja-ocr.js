import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const state = globalThis[Symbol.for('lapakwu.ocr')] ??= {};
const AWAL_RESPONS = 'LAPAKWU_OCR ';
const BATAS_BACA = 90_000;
const BATAS_DIAM = 5 * 60_000;

function mulai(python) {
  const proses = spawn(python, ['-u', join(process.cwd(), 'scripts', 'ocr-bukti.py'), '--worker'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const keluaran = createInterface({ input: proses.stdout });
  const pekerja = { proses, python };

  pekerja.tutup = (error = new Error('Pekerja OCR berhenti.')) => {
    if (state.pekerja !== pekerja) return;
    state.pekerja = null;
    clearTimeout(pekerja.timerDiam);
    pekerja.selesai?.(error);
    keluaran.close();
    proses.kill();
  };

  proses.once('error', pekerja.tutup);
  proses.once('exit', () => pekerja.tutup());
  proses.stdin.on('error', pekerja.tutup);
  keluaran.on('line', (line) => {
    const awal = line.indexOf(AWAL_RESPONS);
    if (awal < 0 || !pekerja.selesai) return;
    try {
      const hasil = JSON.parse(line.slice(awal + AWAL_RESPONS.length));
      pekerja.selesai(null, hasil);
    } catch (error) {
      pekerja.tutup(error);
    }
  });
  proses.unref();
  proses.stdin.unref?.();
  proses.stdout.unref?.();
  return pekerja;
}

export async function denganPekerjaOcr(jalankan) {
  const python = process.env.OCR_PYTHON;
  if (!python || state.sibuk) return null;
  state.sibuk = true;
  try {
    return await jalankan(async (path) => {
      if (state.pekerja?.python !== python) {
        state.pekerja?.tutup();
        state.pekerja = mulai(python);
      }
      const pekerja = state.pekerja;
      clearTimeout(pekerja.timerDiam);
      return new Promise((resolve, reject) => {
        const batas = setTimeout(() => pekerja.tutup(new Error('OCR melebihi batas waktu.')), BATAS_BACA);
        pekerja.selesai = (error, hasil) => {
          pekerja.selesai = null;
          clearTimeout(batas);
          if (error) return reject(error);
          pekerja.timerDiam = setTimeout(() => pekerja.tutup(), BATAS_DIAM);
          pekerja.timerDiam.unref();
          resolve(hasil);
        };
        pekerja.proses.stdin.write(JSON.stringify(path) + '\n');
      });
    });
  } finally {
    state.sibuk = false;
  }
}
