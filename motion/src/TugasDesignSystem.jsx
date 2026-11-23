import React from 'react';
import { AbsoluteFill, Audio, Composition, Img, Easing, interpolate, registerRoot, staticFile, useCurrentFrame } from 'remotion';

const ink = '#22313F';
const cream = '#FFF8E6';
const paper = '#FFFDF8';
const yellow = '#FFCB56';
const blue = '#DCEAF4';
const orange = '#FF933E';
const line = '#F0DEB0';
const colors = [[cream, 'Latar'], [yellow, 'Aksi utama'], [orange, 'Aksen'], ['#73A5CA', 'Informasi'], [ink, 'Teks']];
const scenes = [
  {tag:'IDENTITAS PRODUK', head:'Design System\nLapaKWU', desc:'Antarmuka bazar kampus untuk menemukan produk, memesan, dan mengambil pesanan di tenant.', image:'home-hero'},
  {tag:'WARNA', head:'Warna sesuai fungsi', desc:'Krem menjaga permukaan tetap ringan. Kuning menonjolkan aksi utama, biru memberi konteks, dan teks gelap menjaga keterbacaan.'},
  {tag:'TIPOGRAFI', head:'Hierarki yang\nmudah dipindai', desc:'Bricolage Grotesque untuk judul. Plus Jakarta Sans untuk label, status, harga, dan instruksi.'},
  {tag:'KOMPONEN', head:'Dari kartu\nke pilihan', desc:'Kartu menyatukan gambar dan harga. Checkbox memungkinkan beberapa add-on. Tombol utama menunjukkan langkah berikutnya.', image:'addon-panel'},
  {tag:'UMPAN BALIK', head:'Tujuan terlihat\ndalam sekali lihat', desc:'Di Cari tenant, lokasi pengambilan memakai warna kuning dan efek denyut. Nomor serta instruksi tetap terbaca saat animasi dikurangi.', image:'tenant-focus'},
  {tag:'KONSISTENSI', head:'Satu bahasa visual', desc:'Kartu, status, dan tombol dipakai lintas peran. Pembeli melacak pesanan, sementara mitra mengelola stok dan mencatat penjualan.', image:'offline-panel'},
];
const seconds = 6;
const fps = 24;
const span = seconds * fps;
const duration = scenes.length * span;
const screen = (id) => staticFile('tugas-ui/' + id + '.png');
const wrap = {fontFamily:'Segoe UI, Arial, sans-serif', color:ink};
const card = {border:'1px solid ' + line, borderRadius:28, background:paper, boxShadow:'0 14px 34px -22px #61412275'};
function Brand(){
  return <div style={{fontWeight:800,fontSize:27,letterSpacing:-1.1}}>Lapa<span style={{background:orange,padding:'0 7px',borderRadius:7,marginLeft:3}}>KWU</span></div>;
}
function Palette({frame,vertical}){
  return <div style={{display:'grid',gap:vertical ? 18 : 11,width:vertical ? '100%' : 520}}>
    {colors.map(([hex,label],i)=>{
      const a=interpolate(frame,[5+i*3,23+i*3],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.out(Easing.cubic)});
      return <div key={label} style={{...card,display:'flex',alignItems:'center',padding:vertical ? '18px 25px' : '10px 18px',gap:18,opacity:a,transform:'translateX(' + (1-a)*30 + 'px)'}}>
        <div style={{width:vertical ? 86 : 53,height:vertical ? 71 : 45,borderRadius:12,background:hex,border:'1px solid #bba67d66'}}/>
        <b style={{fontSize:vertical ? 37 : 25,flex:1}}>{label}</b><span style={{fontSize:vertical ? 28 : 19,color:'#515D68'}}>{hex}</span>
      </div>;
    })}
  </div>;
}
function TypeSample({vertical}){
  const scale = vertical ? 1.55 : 1;
  return <div style={{...card,width:vertical ? '100%' : 510,padding:28*scale,boxSizing:'border-box'}}>
    <div style={{color:'#2D5F86',fontSize:18*scale,fontWeight:800}}>JUDUL PRODUK</div>
    <div style={{fontSize:58*scale,fontWeight:800,letterSpacing:-2,lineHeight:1.12,marginTop:8}}>Es Teh Lemon</div>
    <div style={{height:1,background:line,margin:'22px 0'}}/>
    <div style={{display:'flex',alignItems:'center',gap:12}}><div style={{background:'#FFE9A9',borderRadius:99,padding:'6px 14px',fontWeight:800,fontSize:25*scale}}>Rp8.000</div><div style={{background:blue,borderRadius:99,padding:'6px 14px',fontWeight:700,fontSize:19*scale}}>Stok 24</div></div>
    <div style={{fontSize:23*scale,marginTop:20}}>Ambil di lapak</div>
  </div>;
}
function Video({vertical=false}){
  const global = useCurrentFrame();
  const i = Math.floor(global/span);
  const frame = global%span;
  const scene = scenes[i];
  const ease = Easing.out(Easing.cubic);
  const arrive = interpolate(frame,[0,19],[0,1],{extrapolateRight:'clamp',easing:ease});
  const exit = interpolate(frame,[span-10,span-1],[1,0],{extrapolateLeft:'clamp'});
  const accent = [yellow,cream,blue,cream,blue,yellow][i];
  const imageHeight = vertical ? [420,0,0,790,820,590][i] : 488;
  return <AbsoluteFill style={{...wrap,background:accent,padding:vertical?'200px 124px 305px 76px':'39px 55px 43px',overflow:'hidden'}}>
    <Audio src={staticFile('tugas-ui/underscoring.wav')} volume={0.55}/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:vertical?55:40}}><div style={{transform:vertical?'scale(1.4)':undefined,transformOrigin:'left center'}}><Brand/></div><div style={{fontSize:vertical?24:17,fontWeight:700}}>DESIGN SYSTEM</div></div>
    <div style={{display:'grid',gridTemplateColumns:vertical?'minmax(0,1fr)':'0.94fr 1.06fr',gap:vertical?32:38,alignItems:'center',alignContent:vertical?'center':undefined,flex:1,opacity:arrive*exit}}>
      <div style={{transform:'translateY(' + (1-arrive)*25 + 'px)'}}>
        <div style={{fontSize:vertical?28:17,letterSpacing:2.3,fontWeight:800,color:'#2D5F86'}}>{scene.tag}</div>
        <div style={{fontSize:vertical?(i===0?98:83):(i===0?70:59),fontWeight:850,lineHeight:1.04,letterSpacing:-2.2,whiteSpace:'pre-line',margin:'14px 0 21px'}}>{scene.head}</div>
        <div style={{fontSize:vertical?35:24,lineHeight:1.38,maxWidth:vertical?800:490}}>{scene.desc}</div>
      </div>
      <div style={{display:'grid',placeItems:'center',transform:'translateX(' + (1-arrive)*22 + 'px)'}}>
        {i===1 ? <Palette frame={frame} vertical={vertical}/> : i===2 ? <TypeSample vertical={vertical}/> : (
          <div style={{...card,width:'100%',height:imageHeight,padding:vertical?22:18,boxSizing:'border-box',display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden'}}>
            <Img src={screen(scene.image)} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:18}}/>
          </div>
        )}
      </div>
    </div>
    <div style={{display:'flex',gap:8}}>{scenes.map((s,n)=><div key={s.tag} style={{flex:1,height:5,borderRadius:99,background:ink,opacity:n===i?1:n<i?.58:.19}}/>)}</div>
  </AbsoluteFill>;
}
registerRoot(()=><>
  <Composition id="LapaKWUDesignSystem" component={Video} width={1280} height={720} durationInFrames={duration} fps={fps}/>
  <Composition id="LapaKWUDesignSystemVertical" component={Video} width={1080} height={1920} durationInFrames={duration} fps={fps} defaultProps={{vertical:true}}/>
</>);
