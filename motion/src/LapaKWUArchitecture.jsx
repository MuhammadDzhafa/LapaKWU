import React from 'react';
import { AbsoluteFill, Audio, Composition, interpolate, registerRoot, staticFile, useCurrentFrame } from 'remotion';

const bg='#101923', card='#192632', rim='#35485B', text='#FFF8E6', muted='#CBD8E3';
const sun='#FFCB56', sky='#83C4EE', orange='#FFAA6A', mint='#92DEBC';
const fps=24, beat=96;
const sections=[
  {title:'Pengguna membuka LapaKWU',detail:'Pembeli, mitra, dan admin masuk lewat antarmuka web yang sama.',color:sun},
  {title:'Next.js menghubungkan UI dan API',detail:'API memeriksa sesi dan peran, lalu menjalankan aturan bisnis.',color:sky},
  {title:'Data diproses sesuai jenisnya',detail:'PostgreSQL untuk transaksi. Backblaze B2 untuk file. OCR membaca bukti QRIS.',color:mint},
  {title:'Checkout mencatat pesanan',detail:'API mengecek stok dan mencatat pesanan beserta pembayaran dalam transaksi.',color:orange},
  {title:'Pesanan diproses sampai selesai',detail:'QRIS diperiksa admin. Pembayaran di lapak dikonfirmasi mitra.',color:sun},
];

function Label({x,y,color=sun,children}){
  return <text x={x} y={y} fill={color} fontSize="25" fontWeight="760" letterSpacing="2.5">{children}</text>;
}
function Box({x,y,w,h,color,active,code,title,lines=[]}){
  return <g>
    <rect x={x} y={y} width={w} height={h} rx="21" fill={card} stroke={active?color:rim} strokeWidth={active?3:2}/>
    <rect x={x+17} y={y+19} width="49" height="42" rx="11" fill={color}/>
    <text x={x+41.5} y={y+41} fill={bg} fontSize={code.length>2?17:23} fontWeight="850" textAnchor="middle" dominantBaseline="central">{code}</text>
    <text x={x+77} y={y+48} fill={text} fontSize={title.length>11?26:30} fontWeight="760">{title}</text>
    {lines.map((line,i)=><g key={line}>
      <circle cx={x+24} cy={y+83+i*33} r="3.5" fill={color}/>
      <text x={x+38} y={y+91+i*33} fill={muted} fontSize="23">{line}</text>
    </g>)}
  </g>;
}
function Arrow({path,active,color,progress}){
  return <g fill="none">
    <path d={path} stroke={active?color:rim} strokeWidth={active?4:3} strokeLinecap="round" strokeLinejoin="round" markerEnd={active?'url(#brightArrow)':'url(#mutedArrow)'}/>
    {active&&<path d={path} pathLength="1" stroke="#FFFFFF" strokeOpacity=".75" strokeWidth="5" strokeDasharray=".10 1" strokeDashoffset={-progress} strokeLinecap="round"/>}
  </g>;
}
function Architecture(){
  const frame=useCurrentFrame();
  const phase=Math.min(sections.length-1,Math.floor(frame/beat));
  const local=frame%beat;
  const info=sections[phase];
  const p=(local%48)/48;
  const intro=interpolate(frame,[0,16],[0,1],{extrapolateRight:'clamp'});
  const titleOpacity=interpolate(local,[0,10],[.35,1],{extrapolateRight:'clamp'});
  const focusStep=phase===3?(local<48?0:1):phase===4?Math.min(4,2+Math.floor(local/32)):-1;
  const roles=[['P','Pembeli',sky],['M','Mitra',mint],['A','Admin',sun]];
  const stack=['Next.js 15','React 19','JavaScript','Node.js','PostgreSQL'];
  const order=[['Pilih','produk'],['Checkout'],['Stok','tercatat'],['Siap /','dikirim'],['Selesai']];
  return <AbsoluteFill style={{background:bg}}>
    <Audio src={staticFile('tugas-ui/architecture-bed.wav')} volume={.8}/>
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{display:'block',fontFamily:'Segoe UI, Arial, sans-serif'}} role="img" aria-label="Diagram arsitektur LapaKWU">
      <defs>
        <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#68829D" opacity=".24"/></pattern>
        <linearGradient id="header" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#24364B"/><stop offset="1" stopColor="#182635"/></linearGradient>
        <marker id="brightArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M1 0L8 4 1 8Z" fill={info.color}/></marker>
        <marker id="mutedArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M1 0L8 4 1 8Z" fill={rim}/></marker>
      </defs>
      <rect width="1080" height="1920" fill="url(#grid)"/>
      <rect width="1080" height="14" fill={sun}/>
      <g opacity={intro}>
        <rect x="54" y="132" width="930" height="211" rx="30" fill="url(#header)" stroke={rim} strokeWidth="2"/>
        <Label x={78} y={175}>SYSTEM DESIGN</Label>
        <text x="77" y="245" fontSize="70" fontWeight="860" fill={text} letterSpacing="-3">Lapa<tspan fill={sun}>KWU</tspan></text>
        <text x="79" y="291" fontSize="31" fill={muted}>Arsitektur marketplace bazar kampus</text>
        {stack.map((item,i)=><g key={item} transform={'translate('+(55+i*188)+' 363)'}>
          <rect width="178" height="57" rx="15" fill={card} stroke={rim} strokeWidth="2"/>
          <text x="89" y="29" fill={text} textAnchor="middle" dominantBaseline="central" fontSize="23" fontWeight="720">{item}</text>
        </g>)}

        <Label x={56} y={477} color={phase===0?sun:muted}>PENGGUNA</Label>
        {roles.map(([code,name,color],i)=><Box key={name} x={55+i*314} y={497} w={302} h={78} code={code} title={name} color={color} active={phase===0}/>)}
        <Arrow path="M519 578V626" active={phase===0} color={info.color} progress={p}/>

        <rect x="54" y="630" width="930" height="284" rx="26" fill="#121E29" stroke={phase===1?sky:rim} strokeDasharray="9 6" strokeWidth="2"/>
        <Label x={77} y={671} color={phase===1?sky:muted}>APLIKASI NEXT.JS</Label>
        <Box x={76} y={695} w={411} h={190} code="UI" title="Web Frontend" color={sky} active={phase===1}
          lines={['React dan App Router','Katalog, checkout, pesanan','Dashboard mitra & admin']}/>
        <Box x={550} y={695} w={411} h={190} code="API" title="Aturan bisnis" color={orange} active={phase===1||phase===3}
          lines={['Next.js Route Handlers','Cek sesi, peran, dan stok','Checkout dan pembayaran']}/>
        <Arrow path="M490 788H545" active={phase===1} color={info.color} progress={p}/>
        <Arrow path="M755 886V944H202V1004" active={phase===2||phase===3} color={info.color} progress={p}/>
        <Arrow path="M755 886V962H519V1004" active={phase===2} color={info.color} progress={p}/>
        <Arrow path="M755 886V975H838V1004" active={phase===2} color={info.color} progress={p}/>

        <Label x={57} y={936} color={phase===2?mint:muted}>DATA & LAYANAN</Label>
        <Box x={55} y={1011} w={296} h={169} code="DB" title="PostgreSQL" color={sky} active={phase===2||phase===3}
          lines={['Akun, produk, stok','Pesanan dan rekap']}/>
        <Box x={371} y={1011} w={296} h={169} code="B2" title="Backblaze B2" color={mint} active={phase===2}
          lines={['Gambar produk','File bukti pembayaran']}/>
        <Box x={687} y={1011} w={296} h={169} code="OCR" title="PaddleOCR" color={sun} active={phase===2}
          lines={['LapaKWU, Service','Cek total pesanan']}/>
        <rect x="55" y="1194" width="928" height="53" rx="16" fill={card} stroke={rim}/>
        <text x="80" y="1228" fill={muted} fontSize="24"><tspan fontWeight="740" fill={text}>Autentikasi</tspan>   JWT dalam cookie  ·  Sandi di-hash dengan bcrypt</text>

        <rect x="54" y="1275" width="930" height="211" rx="25" fill="#141F2A" stroke={phase>=3?info.color:rim} strokeWidth="2"/>
        <Label x={77} y={1319} color={phase>=3?info.color:muted}>CERITA SATU PESANAN</Label>
        {order.map((item,i)=>{
          const x=145+i*185;
          const active=focusStep===i;
          const complete=focusStep>i;
          return <g key={item[0]}>
            {i<4&&<path d={'M'+(x+26)+' 1377h133'} stroke={complete?sun:rim} strokeWidth="4" strokeLinecap="round"/>}
            {active&&<circle cx={x} cy="1377" r={31+Math.sin(local/6)*3} fill="none" stroke={sun} strokeWidth="2" opacity=".8"/>}
            <circle cx={x} cy="1377" r="24" fill={active||complete?sun:card} stroke={active||complete?sun:rim} strokeWidth="2"/>
            <text x={x} y="1378" fill={active||complete?bg:text} fontSize="24" fontWeight="800" textAnchor="middle" dominantBaseline="central">{i+1}</text>
            {item.map((line,n)=><text key={line} x={x} y={1428+n*26} fill={active?sun:text} fontSize="24" textAnchor="middle" fontWeight={active?780:610}>{line}</text>)}
          </g>;
        })}

        <g opacity={titleOpacity}>
          <rect x="54" y="1510" width="930" height="138" rx="25" fill={card} stroke={info.color} strokeWidth="2"/>
          <rect x="55" y="1531" width="7" height="96" rx="3" fill={info.color}/>
          <text x="80" y="1561" fill={info.color} fontSize="33" fontWeight="790">{info.title}</text>
          <text x="80" y="1611" fill={text} fontSize="23.5">{info.detail}</text>
        </g>
        {sections.map((s,i)=><rect key={s.title} x={55+i*187} y="1673" width="178" height="5" rx="2.5" fill={i===phase?info.color:i<phase?muted:rim}/>)}
      </g>
    </svg>
  </AbsoluteFill>;
}
registerRoot(()=><Composition id="LapaKWUArchitecture" component={Architecture} width={1080} height={1920} fps={fps} durationInFrames={sections.length*beat}/>);
