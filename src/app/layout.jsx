import './globals.css';
import Logo from '@/components/Logo';
import Shell from '@/components/Shell';

export const metadata = {
  title: 'LapaKWU — lapak sekampus dalam satu aplikasi',
  description: 'Belanja produk dari banyak mitra KWU. Pesan antar atau ambil langsung di lapaknya.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#FFCB56" />
        <script dangerouslySetInnerHTML={{ __html: "try{var d=document.documentElement;if(!sessionStorage.getItem('lw-intro')&&!matchMedia('(prefers-reduced-motion:reduce)').matches){sessionStorage.setItem('lw-intro','1');d.setAttribute('data-intro','');d.setAttribute('data-hold','');setTimeout(function(){d.removeAttribute('data-hold')},1050);setTimeout(function(){d.removeAttribute('data-intro')},2300)}}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="curtain" aria-hidden="true"><span className="brand"><Logo /></span></div>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
