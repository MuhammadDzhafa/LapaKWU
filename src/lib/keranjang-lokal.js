const kunci = (uid) => `lapakwu:keranjang:${uid}`;

export function bacaKeranjangLokal(uid) {
  try {
    const items = JSON.parse(localStorage.getItem(kunci(uid)));
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  }
}

export function simpanKeranjangLokal(uid, items) {
  try {
    localStorage.setItem(kunci(uid), JSON.stringify(items));
  } catch {
    // Keranjang tetap dapat digunakan saat penyimpanan browser tidak tersedia.
  }
}
