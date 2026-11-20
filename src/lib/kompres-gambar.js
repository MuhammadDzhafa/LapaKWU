import sharp from 'sharp';

const ekstensi = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
const MAKS_PIKSEL = 32_000_000;
const SISI_FOTO_PRODUK = 1600;

export async function kompresGambar(buffer, jenis) {
  const gambar = sharp(buffer, { animated: true, limitInputPixels: MAKS_PIKSEL, failOn: 'truncated' });
  const { format, pages = 1 } = await gambar.metadata();
  if (!Object.hasOwn(ekstensi, format) || (jenis === 'bukti-pembayaran' && format === 'gif')) {
    throw new Error('Format gambar tidak didukung.');
  }

  const fotoProduk = jenis === 'gambar' && pages === 1;
  if (pages === 1) gambar.autoOrient();
  if (fotoProduk) gambar.resize(SISI_FOTO_PRODUK, SISI_FOTO_PRODUK, { fit: 'inside', withoutEnlargement: true });
  const hasil = await gambar.webp(fotoProduk ? { quality: 82 } : { lossless: true }).timeout({ seconds: 10 }).toBuffer();
  return hasil.length < buffer.length
    ? { buffer: hasil, ekstensi: 'webp', tipe: 'image/webp' }
    : { buffer, ekstensi: ekstensi[format], tipe: 'image/' + format };
}
