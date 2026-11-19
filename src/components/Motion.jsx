'use client';
import { useEffect, useRef, useState } from 'react';

const kurangiGerak = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Elemen yang muncul pelan-pelan saat masuk layar. Jenis gerakannya beda per elemen,
   supaya tidak semuanya "naik sambil memudar" dengan cara yang sama. */
const REVEAL = [
  ['.sec > .wrap > h2, .sec > .wrap > .sub, main.wrap > h2', 'head'],
  ['.grid > .prod', 'pop'],
  ['.step', 'tilt'],
  ['.stall', 'slide'],
  ['.band', 'rise'],
  ['.stat', 'rise'],
  ['.stack > .card, .scroll', 'rise'],
  ['.fgrid > div', 'rise'],
];
const SEMUA = REVEAL.map(([s]) => s).join(',');
const jenis = (el) => REVEAL.find(([s]) => el.matches(s))?.[1] || 'rise';

/* Bola kecil terbang dari tombol "+" menuju keranjang. */
export function terbang(dari) {
  if (!dari || kurangiGerak()) return;
  const a = dari.getBoundingClientRect();
  const tujuan = document.querySelector('.floating-cart-bar .cart-bar-icon-wrap');
  const b = tujuan?.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b ? b.left + b.width / 2 : innerWidth / 2, y1 = b ? b.top + b.height / 2 : innerHeight - 48;
  const luar = document.createElement('div'), dalam = document.createElement('i');
  luar.className = 'fly'; luar.setAttribute('aria-hidden', 'true'); luar.appendChild(dalam);
  luar.style.cssText = `left:${x0 - 11}px;top:${y0 - 11}px`;
  document.body.appendChild(luar);
  const dur = 720;
  luar.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${x1 - x0}px)` }], { duration: dur, easing: 'linear', fill: 'forwards' });
  const sel = dalam.animate(
    [{ transform: 'translateY(0) scale(1)' }, { transform: `translateY(${y1 - y0}px) scale(.35)` }],
    { duration: dur, easing: 'cubic-bezier(.35,-.55,.65,1)', fill: 'forwards' },
  );
  sel.onfinish = () => {
    luar.remove();
    tujuan?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
}

/* Angka yang berhitung naik saat terlihat. */
export function Hitung({ ke, durasi = 1100 }) {
  const ref = useRef(null);
  const [n, setN] = useState(kurangiGerak() ? ke : 0);
  const dari = useRef(0);
  useEffect(() => {
    if (kurangiGerak()) { setN(ke); return; }
    const el = ref.current;
    let raf, mulai;
    const jalan = (t) => {
      mulai ??= t;
      const k = Math.min(1, (t - mulai) / durasi);
      const nilai = Math.round(dari.current + (ke - dari.current) * (1 - Math.pow(1 - k, 4)));
      setN(nilai); if (k === 1) dari.current = ke;
      if (k < 1) raf = requestAnimationFrame(jalan);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); raf = requestAnimationFrame(jalan); } });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ke, durasi]);
  return <span ref={ref}>{n}</span>;
}

export default function Motion() {
  useEffect(() => {
    const html = document.documentElement;
    const gerak = !kurangiGerak();
    let y0 = scrollY, tick = false;

    /* progres scroll + status header (mengecil, bersembunyi saat turun, muncul lagi saat naik) */
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        tick = false;
        const y = scrollY, maks = html.scrollHeight - innerHeight;
        html.style.setProperty('--sp', maks > 0 ? (y / maks).toFixed(4) : '0');
        y > 24 ? html.setAttribute('data-scrolled', '') : html.removeAttribute('data-scrolled');
        const turun = y > y0 + 6, naik = y < y0 - 6;
        if (y < 220 || naik) html.removeAttribute('data-nav');
        else if (turun && !document.querySelector('.nav-sidebar.open')) html.setAttribute('data-nav', 'hide');
        if (turun || naik) y0 = y;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* pintasan: tekan "/" untuk mencari produk */
    const kunci = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable) return;
      const cari = document.querySelector('.searchcard input');
      if (cari) { e.preventDefault(); cari.focus(); cari.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
    addEventListener('keydown', kunci);

    if (!gerak) return () => { removeEventListener('scroll', onScroll); removeEventListener('keydown', kunci); };

    /* reveal saat scroll */
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      el.setAttribute('data-in', '');
      const tunda = parseFloat(el.style.getPropertyValue('--d')) || 0;
      setTimeout(() => { el.removeAttribute('data-rv'); el.removeAttribute('data-in'); el.style.removeProperty('--d'); }, 1300 + tunda); // kembalikan transisi hover milik komponen
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    const tandai = (el, awal) => {
      if (el.hasAttribute('data-rv') || el.closest('[data-rv-skip]')) return;
      // konten yang sudah terlihat saat halaman pertama dimuat sudah punya animasi masuk sendiri
      if (awal && el.getBoundingClientRect().top < innerHeight * 0.92) return;
      const sib = [...(el.parentElement?.children || [])].filter((c) => c.matches(SEMUA));
      const i = Math.max(0, sib.indexOf(el));
      el.style.setProperty('--d', `${(i % 4) * 70}ms`);
      el.style.setProperty('--r', i % 2 ? '3deg' : '-3deg');
      el.setAttribute('data-rv', jenis(el));
      io.observe(el);
    };
    const pindai = (akar, awal) => {
      if (akar.nodeType !== 1) return;
      if (akar.matches(SEMUA)) tandai(akar, awal);
      akar.querySelectorAll(SEMUA).forEach((el) => tandai(el, awal));
    };
    pindai(document.body, true);
    // MutationObserver berjalan sebelum frame digambar, jadi konten baru tidak sempat berkedip
    const mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => pindai(n, false))));
    mo.observe(document.body, { childList: true, subtree: true });

    /* spotlight kursor di kartu + cahaya di hero + tombol magnetik */
    let raf = 0, magnet = null;
    const bergerak = (e) => {
      if (e.pointerType === 'touch') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = e.target.closest?.('.prod,.step,.stat,.stack>.card,.pcard,.stall,.idcard');
        if (t) { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`); }
        const h = e.target.closest?.('.hero2');
        if (h) { const r = h.getBoundingClientRect(); h.style.setProperty('--gx', `${e.clientX - r.left}px`); h.style.setProperty('--gy', `${e.clientY - r.top}px`); }
        const btn = e.target.closest?.('.btn.lg');
        if (magnet && magnet !== btn) { magnet.style.removeProperty('translate'); magnet = null; }
        if (btn) {
          const r = btn.getBoundingClientRect();
          btn.style.translate = `${((e.clientX - r.left) / r.width - 0.5) * 10}px ${((e.clientY - r.top) / r.height - 0.5) * 8}px`;
          magnet = btn;
        }
      });
    };
    addEventListener('pointermove', bergerak, { passive: true });

    /* riak air saat menekan tombol */
    const tekan = (e) => {
      const el = e.target.closest?.('.btn,.chip,.plus,.step-btn,.qb,.br-btn');
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
      const dot = document.createElement('span');
      dot.className = 'riak'; dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
      el.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    };
    addEventListener('pointerdown', tekan, { passive: true });

    return () => {
      removeEventListener('scroll', onScroll); removeEventListener('keydown', kunci);
      removeEventListener('pointermove', bergerak); removeEventListener('pointerdown', tekan);
      io.disconnect(); mo.disconnect(); cancelAnimationFrame(raf);
    };
  }, []);

  return <div className="progress" aria-hidden="true" />;
}
