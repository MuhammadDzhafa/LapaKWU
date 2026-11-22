'use client';
import { useEffect, useRef, useState } from 'react';

const kurangiGerak = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/* Percikan kecil berwarna palet saat produk masuk keranjang. */
export function percik(dari) {
  if (!dari || kurangiGerak()) return;
  const r = dari.getBoundingClientRect();
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
  const warna = ['var(--or)', 'var(--ye)', 'var(--bl)', 'var(--ink)', 'var(--cr)'];
  const wadah = document.createElement('div');
  wadah.className = 'fly'; wadah.setAttribute('aria-hidden', 'true');
  wadah.style.cssText = `left:${x0}px;top:${y0}px;width:0;height:0`;
  document.body.appendChild(wadah);
  let sisa = 10;
  for (let i = 0; i < 10; i++) {
    const b = document.createElement('i');
    const u = 5 + Math.random() * 6;
    b.style.cssText = `position:absolute;left:${-u / 2}px;top:${-u / 2}px;width:${u}px;height:${u}px;border-radius:${i % 3 ? '50%' : '2px'};background:${warna[i % warna.length]}`;
    wadah.appendChild(b);
    const sudut = (i / 10) * Math.PI * 2 + Math.random() * 0.6, jarak = 34 + Math.random() * 30;
    const a = b.animate([
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(sudut) * jarak}px,${Math.sin(sudut) * jarak - 10}px) scale(1) rotate(${Math.random() * 240}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${Math.cos(sudut) * jarak * 1.15}px,${Math.sin(sudut) * jarak + 22}px) scale(.2) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    a.onfinish = () => { if (--sisa === 0) wadah.remove(); };
  }
}

/* Angka yang berhitung naik saat terlihat. */
export function Hitung({ ke, durasi = 1100 }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
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
  const progress = useRef(null);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;

    const selector = '[data-animasi-katalog=""]';
    const pengamat = new IntersectionObserver((entri) => {
      for (const { target, isIntersecting } of entri) {
        if (!isIntersecting) continue;
        target.setAttribute('data-animasi-katalog', 'tampil');
        pengamat.unobserve(target);
      }
    });
    const amati = (elemen) => pengamat.observe(elemen);
    document.querySelectorAll(selector).forEach(amati);

    const perubahanKatalog = new MutationObserver((perubahan) => {
      for (const { addedNodes, removedNodes } of perubahan) {
        for (const node of removedNodes) {
          if (node.isConnected) continue;
          if (node.matches?.(selector)) pengamat.unobserve(node);
          node.querySelectorAll?.(selector).forEach((elemen) => pengamat.unobserve(elemen));
        }
        for (const node of addedNodes) {
          if (!node.isConnected) continue;
          if (node.matches?.(selector)) amati(node);
          node.querySelectorAll?.(selector).forEach(amati);
        }
      }
    });
    perubahanKatalog.observe(document.body, { childList: true, subtree: true });
    return () => {
      perubahanKatalog.disconnect();
      pengamat.disconnect();
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    let y0 = scrollY, rafScroll = 0;
    let gulir = html.hasAttribute('data-scrolled');
    let navTersembunyi = html.getAttribute('data-nav') === 'hide';

    /* progres scroll + status header (mengecil, bersembunyi saat turun, muncul lagi saat naik) */
    const onScroll = () => {
      if (rafScroll) return;
      rafScroll = requestAnimationFrame(() => {
        rafScroll = 0;
        const y = scrollY, maks = html.scrollHeight - innerHeight;
        progress.current?.style.setProperty('--sp', maks > 0 ? (y / maks).toFixed(4) : '0');
        if (gulir !== (y > 24)) html.toggleAttribute('data-scrolled', gulir = y > 24);
        const turun = y > y0 + 6, naik = y < y0 - 6;
        const sembunyi = y >= 220 && !naik && (turun || navTersembunyi);
        if (sembunyi !== navTersembunyi) {
          navTersembunyi = sembunyi;
          if (sembunyi) html.setAttribute('data-nav', 'hide');
          else html.removeAttribute('data-nav');
        }
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

    const klikTambah = (e) => { const t = e.target.closest?.('.plus,.step-btn.plus-btn'); if (t && !t.disabled) percik(t); };
    addEventListener('click', klikTambah);

    return () => {
      removeEventListener('scroll', onScroll); removeEventListener('keydown', kunci);
      removeEventListener('click', klikTambah);
      cancelAnimationFrame(rafScroll);
    };
  }, []);

  /* Dibiarkan aktif walau animasi dikurangi: ini soal keterbacaan, bukan gerak. */
  useEffect(() => {
    /* Tabel jadi kartu di layar sempit: tiap sel membawa nama kolomnya (data-label). */
    let rafT = 0;
    const tabelBerubah = new Set(document.querySelectorAll('table'));
    const beriLabel = () => {
      rafT = 0;
      const tabel = [...tabelBerubah];
      tabelBerubah.clear();
      tabel.forEach((t) => {
        if (!t.isConnected) return;
        const kolom = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        if (!kolom.length) return;
        t.setAttribute('data-kartu', '');
        t.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
          let c = 0;
          [...tr.children].forEach((sel) => {
            const lebar = sel.colSpan || 1;
            if (lebar === 1) sel.setAttribute('data-label', kolom[c] || '');
            c += lebar;
          });
        });
      });
    };
    const jadwal = () => { if (tabelBerubah.size && !rafT) rafT = requestAnimationFrame(beriLabel); };
    jadwal();
    const moT = new MutationObserver((perubahan) => {
      for (const { target, addedNodes } of perubahan) {
        const tabel = target.closest?.('table');
        if (tabel) tabelBerubah.add(tabel);
        for (const node of addedNodes) {
          if (node.matches?.('table')) tabelBerubah.add(node);
          node.querySelectorAll?.('table').forEach((item) => tabelBerubah.add(item));
        }
      }
      jadwal();
    });
    moT.observe(document.body, { childList: true, subtree: true });

    /* Tab yang diketuk digeser ke tengah supaya tab di sebelahnya kelihatan. */
    const klikTab = (e) => {
      const c = e.target.closest?.('.tabs .chip');
      if (c) requestAnimationFrame(() => c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: kurangiGerak() ? 'auto' : 'smooth' }));
    };
    addEventListener('click', klikTab);
    return () => { moT.disconnect(); cancelAnimationFrame(rafT); removeEventListener('click', klikTab); };
  }, []);

  /* Indikator yang meluncur antar tab/menu, dan penunjuk kursor yang mengikuti dengan halus. */
  useEffect(() => {
    let rafG = 0;
    const luncur = () => {
      rafG = 0;
      document.querySelectorAll('.tabs, .dock').forEach((w) => {
        const aktif = w.querySelector('.chip.on, .dock-i[aria-current=page]');
        let p = w.querySelector(':scope > .glide');
        if (!aktif) { if (p) p.style.opacity = 0; return; }
        if (!p) {
          p = document.createElement('span'); p.className = 'glide'; p.setAttribute('aria-hidden', 'true');
          w.appendChild(p); w.setAttribute('data-glide', '');
        }
        p.style.opacity = 1;
        p.style.width = `${aktif.offsetWidth}px`; p.style.height = `${aktif.offsetHeight}px`;
        p.style.transform = `translate(${aktif.offsetLeft}px,${aktif.offsetTop}px)`;
        if (!p.classList.contains('siap')) requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('siap')));
      });
    };
    const jadwalG = () => { if (!rafG) rafG = requestAnimationFrame(luncur); };
    jadwalG();
    const menu = '.tabs, .dock';
    const moG = new MutationObserver((perubahan) => {
      if (perubahan.some(({ target, addedNodes }) => target.closest?.(menu)
        || [...addedNodes].some((node) => node.matches?.(menu) || node.querySelector?.(menu)))) jadwalG();
    });
    moG.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
    addEventListener('resize', jadwalG);
    document.fonts?.ready?.then(jadwalG);

    let bersih = () => {};
    if (!kurangiGerak() && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      const k = document.createElement('div');
      k.className = 'kursor'; k.setAttribute('aria-hidden', 'true');
      document.body.appendChild(k);
      let x = 0, y = 0, tx = 0, ty = 0, rafK = 0, ada = false;
      const putar = () => {
        x += (tx - x) * 0.2; y += (ty - y) * 0.2;
        k.style.transform = `translate3d(${x}px,${y}px,0)`;
        rafK = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(putar) : 0;
      };
      const pindah = (e) => {
        if (e.pointerType === 'touch') return;
        tx = e.clientX; ty = e.clientY;
        if (!ada) { ada = true; x = tx; y = ty; k.classList.add('on'); }
        const el = e.target.closest?.('a,button,.chip,.prod,.stall,label,select,[role=button],[role=tab]');
        k.classList.toggle('besar', !!el);
        k.classList.toggle('teks', !!e.target.closest?.('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea'));
        if (!rafK) rafK = requestAnimationFrame(putar);
      };
      const keluar = () => { ada = false; k.classList.remove('on'); };
      const turun = () => k.classList.add('tekan');
      const naik = () => k.classList.remove('tekan');
      addEventListener('pointermove', pindah, { passive: true });
      document.documentElement.addEventListener('pointerleave', keluar);
      addEventListener('pointerdown', turun, { passive: true });
      addEventListener('pointerup', naik, { passive: true });
      bersih = () => {
        removeEventListener('pointermove', pindah); document.documentElement.removeEventListener('pointerleave', keluar);
        removeEventListener('pointerdown', turun); removeEventListener('pointerup', naik);
        cancelAnimationFrame(rafK); k.remove();
      };
    }
    return () => { moG.disconnect(); cancelAnimationFrame(rafG); removeEventListener('resize', jadwalG); bersih(); };
  }, []);

  return <div ref={progress} className="progress" aria-hidden="true" />;
}
