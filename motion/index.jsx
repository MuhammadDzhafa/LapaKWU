import React from 'react';
import {AbsoluteFill, Composition, Sequence, spring, interpolate, useCurrentFrame, useVideoConfig, registerRoot, Html5Audio, Img, staticFile} from 'remotion';
import {referenceAudio, narration} from './media';
import './style.css';

const colors = ['#FF933E','#FFCB56','#FFE9A9','#73A5CA'];
const clamp = {extrapolateLeft:'clamp', extrapolateRight:'clamp'};
const progress = (value, start, end) => interpolate(value,[start,end],[0,1],clamp);
const sections = [0,6,14,22,30];
const products = [
  ['Minuman Melon','Rp8.000','44%'],
  ['Minuman Jeruk','Rp8.000','16%'],
  ['Minuman Stroberi','Rp9.000','95%'],
  ['Minuman Leci','Rp9.000','72%'],
];

function Background(){
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame/fps;
  const impact = Math.max(...sections.map(mark => Math.max(0,1-Math.abs(mark-t)*5)));
  return <AbsoluteFill className="background">
    <div className="halo warm" style={{transform:'translate('+Math.sin(t*.9)*130+'px,'+Math.cos(t)*65+'px)'}}/>
    <div className="halo cool" style={{transform:'translate('+Math.cos(t*.7)*100+'px,'+Math.sin(t)*80+'px)'}}/>
    <div className="floor" style={{backgroundPosition:'0 '+(frame%70)+'px'}}/>
    <svg width="1920" height="1080" className="nodes">
      {[0,1].map(side => <g key={side} transform={'translate('+(side ? 1500 : -40)+' '+(side ? 470 : 100)+')'}>
        <path d="M0 280H115L178 208H330M115 280L185 430H420M178 208V75L298 0" fill="none" stroke={colors[side*3]} strokeWidth="2"/>
        {[ [115,280],[178,208],[185,430],[330,208],[178,75],[298,0] ].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={4+Math.sin(t*6+i)*2} fill={colors[(i+side)%4]}/>)}
      </g>)}
    </svg>
    <div className="space" style={{transform:'translate('+Math.sin(t*.7)*42+'px,'+Math.cos(t*.9)*36+'px) scale('+(1+.06*Math.sin(t*1.8)+impact*.07)+')'}}>
      {[0,1,2,3,4,5,6,7].map((id)=>{
        const x=[140,1680,290,1550,110,1750,390,1450][id];
        const y=[150,720,840,175,565,380,70,940][id];
        const color=colors[id%4];
        const style={left:x,top:y,'--accent':color,transform:'translateY('+Math.sin(t*(1+id*.09)+id)*48+'px) rotateX('+(28+Math.sin(t)*20)+'deg) rotateY('+(t*37+id*26)+'deg) rotateZ('+((id-3)*19+t*12)+'deg)'};
        return id%3===0 ? <div key={id} className="cube" style={style}>{['translateZ(57px)','rotateY(180deg) translateZ(57px)','rotateY(90deg) translateZ(57px)','rotateY(-90deg) translateZ(57px)','rotateX(90deg) translateZ(57px)','rotateX(-90deg) translateZ(57px)'].map(face=><i key={face} style={{transform:face}}/>)}</div>
          : <div key={id} className={id%3===1?'ring':'hologram'} style={style}>{id%3===2 && <><i/><i/><i/></>}</div>;
      })}
    </div>
    {Array.from({length:37},(_,i)=><i key={i} className="spark" style={{left:(i%2 ? 1420 : 20)+(i*89)%440,top:(i*173+t*(12+i%9))%1080,background:colors[i%4],opacity:.22+.59*progress(Math.sin(t*4+i),-1,1)}}/>)}
    {Array.from({length:6},(_,i)=><div key={i} className="glitch" style={{top:(i*191+Math.floor(t*21)*47)%1080,height:2+i*3,left:i%2 ? 1160 : 0,width:380+i*115,background:colors[i%4],opacity:impact*(i%2 ? .44 : .23)}}/>)}
  </AbsoluteFill>;
}

function Brand(){ return <span className="brand">Lapa<b>KWU</b></span>; }

function Intro(){
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bounce = spring({frame,fps,config:{damping:10,stiffness:145}});
  return <div className="intro" style={{opacity:progress(frame,0,9),transform:'scale('+(.58+bounce*.42)+')'}}>
    <div className="awning"/><Brand/><div className="subtitle">Aplikasi Bazar Gabungan</div>
  </div>;
}

function Product({index}){
  const [name,price,position] = products[index];
  return <div className="product"><Img src={staticFile('products/7rptxbtRdVW27QXHsk4X9.jpg')} style={{objectPosition:position+' center'}}/><b>{name}</b><small>{price}</small><span>+</span></div>;
}

function Phone({stage,t}){
  const phase = t%2;
  const enter = progress(phase,0,.22);
  const views=['Katalog','Pencarian Produk','Keranjang','Pesanan'];
  return <div className="phone" style={{transform:'perspective(1050px) rotateY('+(-11+Math.sin(t*1.6)*9)+'deg) rotateZ('+Math.sin(t*1.85)*4+'deg) translateY('+Math.sin(t*2.3)*9+'px)'}}>
    <div className="notch"/><div className="screen">
      <Brand/><div className="phone-title">{views[stage]}</div>
      <div style={{opacity:enter,transform:'translateY('+((1-enter)*22)+'px)'}}>
        {stage<2 ? <><div className="search">{stage===1?'⌕  Minuman':'⌕  Cari produk'}</div><div className="products">{(stage===0?[0,1,2,3]:[0,2]).map(id=><Product index={id} key={id}/>)}</div></>
          : stage===2 ? <><div className="basket"><Product index={0}/></div><div className="row"><b>Jumlah</b><b>1</b></div><div className="button">Buat Pesanan</div></>
          : <><div className="success">✓</div><div className="row"><b>Pesanan diterima</b></div><div className="search">Menunggu diambil</div></>}
      </div>
      <div className="homebar"/>
    </div>
  </div>;
}

function Order(){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const t=frame/fps;
  const stage=Math.min(3,Math.floor(t/2));
  return <div className="order layout">
    <div className="copy"><h1>Katalog Lengkap</h1><h2>Pesan Sebelum Datang</h2>
      <div className="steps">{['Katalog','Pencarian','Keranjang','Pesanan'].map((label,i)=><div key={label} className={i===stage?'active':''}><i/>{label}</div>)}</div>
    </div><Phone stage={stage} t={t}/>
  </div>;
}

function Icon({type}){
  return <svg className="icon" width="85" height="85" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    {type==='clock' ? <><circle cx="24" cy="24" r="18"/><path d="M24 13v12l8 4"/></> :
     type==='cash' ? <><rect x="4" y="13" width="40" height="22" rx="4"/><circle cx="24" cy="24" r="5"/><path d="M10 24h2m24 0h2"/></> :
     type==='upload' ? <><path d="M24 32V8m-9 9 9-9 9 9M7 30v9h34v-9"/></> :
     <><rect x="5" y="5" width="13" height="13" rx="2"/><rect x="30" y="5" width="13" height="13" rx="2"/><rect x="5" y="30" width="13" height="13" rx="2"/><path d="M25 5v19H5m38 1H32v8h11v10H24v-8m8 8v-4M11 11h1m24 0h1M11 36h1"/></>}
  </svg>;
}

function Payment(){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const t=frame/fps;
  const upload=progress(t,3.2,4.6);
  return <div className="payment layout centered">
    <h1>Pembayaran Fleksibel: QRIS &amp; Tunai</h1>
    <div className="payments">
      <div className="panel pay warm-card"><Icon type={t<3.2?'qr':'upload'}/><h3>QRIS</h3><div className="chip">{upload===1?'✓ Bukti terunggah':'Unggah bukti pembayaran'}</div><div className="meter"><i style={{width:(upload*100)+'%'}}/></div></div>
      <div className="panel pay cool-card"><Icon type={t<6?'cash':'clock'}/><h3>Tunai</h3><div className="chip">Bayar ke tenant · Maks. 1 jam</div><div className="meter"><i style={{width:((1-progress(t,6,8)*.23)*100)+'%'}}/></div></div>
    </div>
  </div>;
}

function Partner(){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const t=frame/fps;
  const stage=t<2.7?0:t<5.65?1:2;
  const starts=[0,2.7,5.65];
  const entry=progress(t,starts[stage],starts[stage]+.27);
  const balance=Math.round(progress(t,5.85,7.15)*25)*1000;
  return <div className="partner layout centered">
    <h1>Cari Tenant &amp; Dompet Mitra</h1>
    <div className="panel partner-panel" style={{opacity:entry,transform:'perspective(900px) translateY('+((1-entry)*36)+'px) rotateX('+((1-entry)*20)+'deg)'}}>
      {stage===0 ? <><h3>Denah bazar</h3><div className="map">{Array.from({length:8},(_,i)=><div key={i} className={i===6?'lit':''} style={i===6?{boxShadow:'0 0 '+(13+Math.sin(t*10)*7)+'px #FF933E'}:{}}><i/>Stan {i+1}</div>)}</div></>
        : stage===1 ? <><h3>Dasbor Mitra</h3><div className="dashboard"><div className="chip">Kelola Stok</div><div className="chip">Kelola Pesanan</div></div>{['Minuman Melon','Pesanan masuk','Siap diambil'].map((item,i)=><div key={item} className="row"><b>{item}</b><span>{['Stok tersedia','Diproses','✓ Terkonfirmasi'][i]}</span></div>)}</>
        : <><h3>Dompet Mitra</h3><div className="balance">Rp{new Intl.NumberFormat('id-ID').format(balance)}</div><div className="button">Cairkan mulai Rp10.000</div><div className="wallet-note">Saldo tersedia setelah pesanan selesai</div></>}
    </div>
  </div>;
}

function Scene({children,duration}){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const t=frame/fps;
  const entry=progress(t,0,.28);
  const exit=1-progress(t,duration-.23,duration);
  return <AbsoluteFill style={{opacity:entry*exit,transform:'translateY('+((1-entry)*22)+'px) scale('+(.97+entry*.03)+')'}}>{children}</AbsoluteFill>;
}

function Sound({voice}){
  const {fps}=useVideoConfig();
  return <>
    <Html5Audio src={staticFile(referenceAudio)} volume={frame=>(voice ? .28 : .85)*(1-progress(frame,29.3*fps,30*fps))}/>
    {voice && narration.map(({start,rate,file})=><Sequence key={file} from={Math.round(start*fps)} premountFor={fps}><Html5Audio src={staticFile(file)} playbackRate={rate}/></Sequence>)}
  </>;
}

function Showcase(){
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Background/>
    <Sequence durationInFrames={6*fps} premountFor={fps}><Scene duration={6}><Intro/></Scene></Sequence>
    <Sequence from={6*fps} durationInFrames={8*fps} premountFor={fps}><Scene duration={8}><Order/></Scene></Sequence>
    <Sequence from={14*fps} durationInFrames={8*fps} premountFor={fps}><Scene duration={8}><Payment/></Scene></Sequence>
    <Sequence from={22*fps} durationInFrames={8*fps} premountFor={fps}><Scene duration={8}><Partner/></Scene></Sequence>
    <Sound voice/>
  </AbsoluteFill>;
}
function CleanBackground(){return <AbsoluteFill><Background/><Sound/></AbsoluteFill>;}

registerRoot(()=> <>
  <Composition id="LapaKWU-Showcase" width={1920} height={1080} fps={30} durationInFrames={900} component={Showcase}/>
  <Composition id="LapaKWU-Background" width={1920} height={1080} fps={30} durationInFrames={900} component={CleanBackground}/>
</>);
