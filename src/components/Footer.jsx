import Link from 'next/link';

const WA = process.env.NEXT_PUBLIC_KONTAK_WA;
const EM = process.env.NEXT_PUBLIC_KONTAK_EMAIL;

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap fgrid">
        <div>
          <Link href="/" className="brand">Lapa<b>KWU</b></Link>
          <p style={{ marginTop: 12 }}>Satu tempat untuk belanja dari banyak lapak mitra kewirausahaan. Pesan antar atau ambil langsung di lapaknya.</p>
        </div>
        <div>
          <h4>Jelajah</h4>
          <Link href="/">Katalog produk</Link>
          <Link href="/#mitra">Lapak mitra</Link>
          <Link href="/#cara">Cara belanja</Link>
        </div>
        <div>
          <h4>Akun</h4>
          <Link href="/masuk">Masuk atau daftar</Link>
          <Link href="/masuk?daftar=mitra">Buka lapak sebagai mitra</Link>
          <Link href="/profil">Profil saya</Link>
          <Link href="/pesanan">Pesanan saya</Link>
        </div>
        <div>
          <h4>Hubungi kami</h4>
          {WA && <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer">WhatsApp +{WA}</a>}
          {EM && <a href={`mailto:${EM}`}>{EM}</a>}
          {!WA && !EM && <p>Hubungi admin lewat menu masuk.</p>}
          <p style={{ marginTop: 8 }}><small>Kampus UPI di Cibiru, Bandung</small></p>
        </div>
      </div>
      <div className="wrap fbawah"><small>© 2026 LapaKWU. All rights reserved.</small></div>
    </footer>
  );
}
