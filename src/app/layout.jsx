import './globals.css';
import Shell from '@/components/Shell';

export const metadata = {
  title: 'LapaKWU — lapak sekampus dalam satu aplikasi',
  description: 'Belanja produk dari banyak mitra KWU. Pesan antar atau ambil langsung di lapaknya.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <head>
        <meta name="theme-color" content="#FFCB56" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet" />
      </head>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
