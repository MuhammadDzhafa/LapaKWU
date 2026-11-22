import Link from 'next/link';
import Logo from '@/components/Logo';
import { LABEL_WA, TAUTAN_WA } from '@/lib/kontak';

const EM = process.env.NEXT_PUBLIC_KONTAK_EMAIL?.trim() || 'lapakwu@gmail.com';

export default function Footer({ tampilkanTautanTamu }) {
  return (
    <footer className="foot">
      <div className="wrap fgrid">
        <div>
          <Link href="/" className="brand"><Logo /></Link>
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
          {tampilkanTautanTamu && <>
            <Link href="/masuk">Masuk atau daftar</Link>
            <Link href="/mitra/tata-cara">Buka lapak sebagai mitra</Link>
          </>}
          <Link href="/profil">Profil saya</Link>
          <Link href="/pesanan">Pesanan saya</Link>
        </div>
        <div>
          <h4>Hubungi kami</h4>
          <a href={TAUTAN_WA} target="_blank" rel="noreferrer">WhatsApp {LABEL_WA}</a>
          <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EM)}`} target="_blank" rel="noopener noreferrer">{EM}</a>
          <p style={{ marginTop: 8 }}><small>Kampus UPI di Cibiru, Bandung</small></p>
        </div>
      </div>
      <div className="wrap fbawah"><small>© 2026 LapaKWU. All rights reserved.</small></div>
    </footer>
  );
}
