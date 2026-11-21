'use client';
import Link from 'next/link';
import { TAUTAN_WA } from '@/lib/kontak';

const pesanWA = () => {
  const teks = encodeURIComponent(
    `Halo Admin LapaKWU 👋\n\nSaya ingin mendaftar sebagai Mitra di LapaKWU.\n\nBerikut data saya:\n- Nama: [NAMA LENGKAP]\n- Nama Usaha: [NAMA LAPAK/USAHA]\n- Jenis Produk: [contoh: Makanan, Fashion, Kerajinan]\n- Nomor WA Aktif: [NOMOR WA]\n\nSaya sudah membaca syarat & ketentuan mitra LapaKWU dan siap melengkapi dokumen yang dibutuhkan.\n\nTerima kasih! 🙏`
  );
  window.open(TAUTAN_WA + '?text=' + teks, '_blank', 'noopener,noreferrer');
};

export default function TataCaraMitra() {
  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" className="link" style={{ fontSize: '0.9rem' }}>{'<-'} Kembali ke Beranda</Link>
      </div>
      <h2>Cara Menjadi Mitra LapaKWU</h2>
      <p className="muted" style={{ maxWidth: '56ch' }}>
        Punya produk untuk dijual? Bergabunglah sebagai Mitra LapaKWU dan mulai jangkau lebih banyak pembeli di kampus.
      </p>

      <section style={{ marginTop: 40 }}>
        <h3>Langkah Pendaftaran</h3>
        <div className="steps" style={{ marginTop: 20 }}>
          {[
            { n: 1, judul: 'Baca Syarat & Ketentuan', isi: 'Pastikan kamu memenuhi persyaratan menjadi Mitra LapaKWU di bawah ini sebelum mendaftar.' },
            { n: 2, judul: 'Siapkan Dokumen', isi: 'Siapkan foto lapak atau produk, nomor WhatsApp aktif, dan QRIS untuk pencairan.' },
            { n: 3, judul: 'Konfirmasi via WhatsApp', isi: 'Tekan tombol di bawah untuk mengirim pesan ke Admin. Pesan sudah terisi otomatis, tinggal lengkapi data dalam kurung siku.' },
            { n: 4, judul: 'Verifikasi & Aktivasi', isi: 'Admin akan memverifikasi dan mengaktifkan akunmu sebagai Mitra dalam 1x24 jam kerja.' },
          ].map(({ n, judul, isi }) => (
            <div key={n} className="step">
              <i>{n}</i>
              <h3>{judul}</h3>
              <p className="muted">{isi}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card pad" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>Syarat & Ketentuan Mitra</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>Memiliki usaha/produk yang halal dan legal.</li>
          <li>Bersedia mengunggah foto produk yang jelas dan representatif.</li>
          <li>Memiliki QRIS aktif untuk menerima pencairan.</li>
          <li>Aktif merespons pesanan masuk dalam waktu maksimal 1 jam.</li>
          <li>Bertanggung jawab atas kualitas dan ketersediaan produk yang dijual.</li>
          <li>Tidak menjual produk terlarang, berbahaya, atau melanggar hukum.</li>
        </ul>
      </section>

      <section className="card pad" style={{ marginTop: 20, background: 'var(--bl-s)', border: '1px solid var(--bl)' }}>
        <h3 style={{ marginBottom: 16, color: 'var(--bl-d)' }}>Dokumen yang Perlu Disiapkan</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16 }}>
          {[
            { ikon: '🏪', label: 'Foto Lapak', desc: 'Foto lapak atau produk yang akan dijual' },
            { ikon: '📱', label: 'Nomor WhatsApp', desc: 'Nomor WA aktif untuk notifikasi pesanan' },
            { ikon: '💳', label: 'QRIS pencairan', desc: 'Gambar QRIS tujuan pencairan saldo' },
          ].map(({ ikon, label, desc }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid var(--bl)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{ikon}</div>
              <b style={{ display: 'block', marginBottom: 4 }}>{label}</b>
              <small className="muted">{desc}</small>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 40, textAlign: 'center' }}>
        <div className="card pad" style={{ background: 'var(--tint)', border: '2px solid var(--ye)' }}>
          <p style={{ fontSize: '1rem', marginBottom: 4 }}>
            <b>Tidak ada form online.</b> Pendaftaran Mitra dilakukan langsung melalui Admin.
          </p>
          <p className="muted" style={{ marginBottom: 24 }}>
            Tekan tombol di bawah untuk membuka WhatsApp. Pesan sudah terisi otomatis — tinggal lengkapi data dalam kurung siku [ ].
          </p>
          <button className="btn sun lg" onClick={pesanWA}>
            Konfirmasi ke Admin via WhatsApp
          </button>
          <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>
            Admin akan membalas dalam 1x24 jam kerja. Pastikan nomor WhatsApp kamu aktif.
          </p>
        </div>
      </section>
    </main>
  );
}
