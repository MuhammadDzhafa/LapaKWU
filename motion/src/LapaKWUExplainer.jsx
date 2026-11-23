import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, Easing, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';

const ink='#22313F', cream='#FFF8E6', white='#FFFDF8', sun='#FFCB56', orange='#FF933E', blue='#DCEAF4', blueInk='#2D5F86', border='#F0DEB0';
const font='Bricolage Grotesque, Segoe UI, sans-serif';
const body='Plus Jakarta Sans, Segoe UI, sans-serif';
const fps=24, segment=144;
const media=(name)=>staticFile('tugas-ui/'+name);
const pop=(f,a,b)=>interpolate(f,[a,b],[0,1],{easing:Easing.bezier(.2,.8,.2,1),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
const panel={background:white,border:'2px solid '+border,borderRadius:34,boxShadow:'0 22px 50px -24px #30271661'};
const pill={borderRadius:120,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center'};

const chapters=[
  {label:'DESIGN SYSTEM',title:'Dari katalog\nke lapak',desc:'Ikuti satu pesanan untuk melihat cara desain LapaKWU bekerja.',fill:sun},
  {label:'WARNA',title:'Warna menandai\nlangkah berikutnya',desc:'Tombol kuning menonjolkan aksi. Biru membantu membedakan informasi.',fill:cream},
  {label:'TIPOGRAFI',title:'Yang penting\nterbaca dulu',desc:'Bricolage Grotesque untuk judul. Plus Jakarta Sans untuk informasi dan instruksi.',fill:blue},
  {label:'KOMPONEN',title:'Satu sentuhan,\ntotal berubah',desc:'Checkbox untuk memilih beberapa add-on. Harga diperbarui sebelum pembeli melanjutkan.',fill:cream},
  {label:'UMPAN BALIK',title:'Ke mana\nambil pesanan?',desc:'Di Cari tenant, nomor tujuan berdenyut kuning. Slot lainnya tetap putih.',fill:blue},
  {label:'KONSISTENSI',title:'Pola yang sama\ndi tiap peran',desc:'Tombol, kartu, dan status tetap familier dari pembelian sampai pengelolaan lapak.',fill:sun},
];
function Brand(){
  return <div style={{fontFamily:font,fontSize:39,fontWeight:850,letterSpacing:-2}}>Lapa<span style={{background:orange,padding:'1px 8px',borderRadius:8,marginLeft:3}}>KWU</span></div>;
}
function Enter({f,delay=14,distance=52,children,style}){
  const p=pop(f,delay,delay+21);
  return <div style={{...style,opacity:p,transform:'translateY('+distance*(1-p)+'px)'}}>{children}</div>;
}
function Opening({f}){
  const p=pop(f,16,44);
  return <div style={{position:'relative',height:670}}>
    <div style={{position:'absolute',left:85,top:10,width:600,height:600,borderRadius:340,background:'#FFE9A9',opacity:p,transform:'scale('+(.72+.28*p)+')'}}/>
    <Enter f={f} delay={17} style={{...panel,position:'absolute',top:95,left:0,width:852,overflow:'hidden',padding:12,boxSizing:'border-box'}}>
      <Img src={media('home-hero.png')} style={{width:'100%',display:'block',borderRadius:22}}/>
    </Enter>
    <Enter f={f} delay={39} style={{position:'absolute',left:45,top:516,display:'flex',gap:17}}>
      {['Cari produk','Pesan','Ambil di tenant'].map((label,i)=><div key={label} style={{...pill,background:i===0?ink:white,color:i===0?white:ink,padding:'15px 23px',fontSize:28}}>{label}</div>)}
    </Enter>
  </div>;
}
const swatches=[{label:'Krem',value:cream},{label:'Kuning',value:sun},{label:'Oranye',value:orange},{label:'Biru',value:'#73A5CA'},{label:'Teks',value:ink}];
function ColorScene({f}){
  const isBlue=f>=81;
  return <div style={{height:670}}>
    <div style={{display:'flex',gap:13}}>
      {swatches.map(({label,value},i)=><Enter key={label} f={f} delay={13+i*4} distance={36} style={{flex:1}}>
        <div style={{...panel,padding:'10px 10px 13px',borderRadius:22,textAlign:'center'}}>
          <div style={{height:100,borderRadius:16,background:value,border:'1px solid #aa957755'}}/>
          <div style={{fontWeight:800,fontSize:23,marginTop:9}}>{label}</div>
          <div style={{fontSize:20,color:'#465562',marginTop:2}}>{value}</div>
        </div>
      </Enter>)}
    </div>
    <Enter f={f} delay={36} style={{...panel,marginTop:38,padding:'36px 42px'}}>
      <div style={{fontFamily:font,fontSize:47,fontWeight:850}}>Es Teh Lemon</div>
      <div style={{display:'flex',gap:20,alignItems:'center',marginTop:25}}>
        <span style={{...pill,fontSize:27,padding:'11px 21px',background:blue,color:blueInk,boxShadow:isBlue?'0 0 0 7px #73A5CA55':undefined}}>Stok 24</span>
        <span style={{...pill,fontSize:27,padding:'11px 21px',background:'#FFE9A9'}}>Rp8.000</span>
      </div>
      <div style={{...pill,fontSize:32,padding:'15px 29px',background:sun,marginTop:29,boxShadow:isBlue?undefined:'0 0 0 7px #FFCB5655'}}>Tambah ke keranjang</div>
    </Enter>
  </div>;
}
function TypeScene({f}){
  const tags=[['Judul produk',ink],['Harga','#A95312'],['Status',blueInk]];
  return <div style={{position:'relative',height:670}}>
    <Enter f={f} delay={16} style={{...panel,position:'absolute',left:12,top:8,width:384,height:622,display:'grid',placeItems:'center',overflow:'hidden'}}>
      <Img src={media('search-result.png')} style={{width:358,height:590,objectFit:'contain',borderRadius:25}}/>
    </Enter>
    {tags.map(([label,tint],i)=><Enter key={label} f={f} delay={38+i*13} distance={30} style={{position:'absolute',top:116+i*130,left:430,width:408}}>
      <div style={{...panel,display:'flex',alignItems:'center',gap:16,padding:'23px 27px',fontSize:32,fontWeight:800,color:tint}}>
        <div style={{width:37,height:3,background:tint,borderRadius:99}}/>{label}
      </div>
    </Enter>)}
  </div>;
}
const money=(amount)=>'Rp'+amount.toLocaleString('id-ID');
function AddOn({f}){
  const chosen=[f>=55,f>=88];
  const total=8000+(chosen[0]?1000:0)+(chosen[1]?1500:0);
  return <div style={{height:670,position:'relative'}}>
    <Enter f={f} delay={12} style={{...panel,padding:'31px 38px'}}>
      <div style={{fontFamily:font,fontSize:49,fontWeight:850}}>Es Teh Lemon</div>
      <div style={{fontSize:28,fontWeight:700,marginTop:13}}>Pilih add-on</div>
      {['Lemon ekstra','Selasih'].map((name,i)=><div key={name} style={{background:chosen[i]?'#FFF0C9':'#fff',border:'2px solid '+(chosen[i]?'#C78924':border),borderRadius:20,display:'flex',alignItems:'center',gap:17,padding:'18px 20px',marginTop:16,fontSize:29}}>
        <div style={{width:38,height:38,borderRadius:8,background:chosen[i]?sun:white,border:'2px solid '+(chosen[i]?'#A95312':'#8795A3'),textAlign:'center',fontSize:28,fontWeight:900}}>{chosen[i]?'✓':''}</div>
        <div style={{flex:1,fontWeight:700}}>{name}</div><b>+{money(i===0?1000:1500)}</b>
      </div>)}
      <div style={{...pill,background:sun,fontSize:31,width:'100%',marginTop:29,height:78,gap:38}}>Tambah pembelian <b>{money(total)}</b></div>
    </Enter>
    {[55,88].map((tap,i)=>{
      const p=pop(f,tap-5,tap+13);
      return <div key={tap} style={{position:'absolute',top:183+i*83,left:52,width:55,height:55,border:'5px solid #B8500A',borderRadius:'50%',opacity:f<tap-5?0:1-p,transform:'scale('+(.65+p*1.65)+')'}}/>;
    })}
  </div>;
}
function MapScene({f}){
  const pulse=1+(Math.sin((f-48)/6)+1)*.24;
  const p=pop(f,46,63);
  return <div style={{height:670,position:'relative'}}>
    <Enter f={f} delay={13} style={{...panel,position:'absolute',left:68,top:0,width:704,padding:13,boxSizing:'border-box'}}>
      <div style={{position:'relative'}}>
        <Img src={media('tenant-focus.png')} style={{display:'block',width:'100%',borderRadius:18}}/>
        <div style={{position:'absolute',left:'23.3%',top:'29.6%',width:40,height:40,opacity:p,transform:'translate(-50%, -50%) scale('+pulse+')',borderRadius:13,border:'4px solid #C06B19',boxShadow:'0 0 14px #F3922E',pointerEvents:'none'}}/>
      </div>
    </Enter>
    <Enter f={f} delay={52} style={{position:'absolute',right:4,top:254}}>
      <div style={{...pill,background:sun,border:'2px solid #A95312',padding:'12px 20px',fontSize:28,boxShadow:'0 10px 24px #6f471446'}}>← Tenant 12</div>
    </Enter>
  </div>;
}
function Consistency({f}){
  return <div style={{height:670,position:'relative'}}>
    <Enter f={f} delay={13} style={{...panel,position:'absolute',left:0,top:0,width:630,padding:23}}>
      <span style={{...pill,background:blue,color:blueInk,padding:'8px 16px',fontSize:23}}>Pembeli</span>
      <Img src={media('checkout-payment.png')} style={{width:'100%',display:'block',marginTop:13,borderRadius:16}}/>
    </Enter>
    <Enter f={f} delay={32} style={{...panel,position:'absolute',right:0,top:245,width:681,padding:23}}>
      <span style={{...pill,background:'#FFE9A9',padding:'8px 16px',fontSize:23}}>Mitra</span>
      <Img src={media('offline-panel.png')} style={{width:'100%',display:'block',marginTop:12,maxHeight:330,objectFit:'contain'}}/>
    </Enter>
  </div>;
}
const illustrations=[Opening,ColorScene,TypeScene,AddOn,MapScene,Consistency];
function Explainer(){
  const frame=useCurrentFrame();
  const i=Math.floor(frame/segment), f=frame%segment;
  const ch=chapters[i];
  const Visual=illustrations[i];
  const title=pop(f,1,20);
  const entrance=i===0?0:1-pop(f,0,11);
  const exit=i===chapters.length-1?0:pop(f,segment-12,segment-1);
  const stripe=entrance>0?-1100*(1-entrance):1080*(1-exit);
  const stripeVisible=entrance>0||exit>0;
  return <AbsoluteFill style={{background:ch.fill,color:ink,fontFamily:body,overflow:'hidden'}}>
    <Audio src={media('explainer-foley.wav')} volume={0.94}/>
    <div style={{position:'absolute',top:0,left:0,right:0,height:112,background:'repeating-linear-gradient(90deg,#FF933E 0 68px,#FFF8E6 68px 136px)',borderRadius:'0 0 46px 46px'}}/>
    <div style={{position:'absolute',top:180,left:74,right:121,display:'flex',alignItems:'center',justifyContent:'space-between'}}><Brand/><div style={{fontWeight:800,fontSize:25}}>DESIGN SYSTEM</div></div>
    <div style={{position:'absolute',top:305,left:74,right:121,opacity:title,transform:'translateY('+(1-title)*34+'px)'}}>
      <div style={{fontWeight:850,fontSize:27,color:blueInk,letterSpacing:3}}>{ch.label}</div>
      <div style={{fontFamily:font,fontWeight:850,fontSize:i===0?103:87,lineHeight:1.045,letterSpacing:-4,whiteSpace:'pre-line',marginTop:14}}>{ch.title}</div>
    </div>
    <div style={{position:'absolute',left:74,right:121,top:640}}><Visual f={f}/></div>
    <Enter f={f} delay={18} distance={25} style={{position:'absolute',top:1400,left:74,right:121}}>
      <div style={{height:3,background:ink,opacity:.18,marginBottom:22}}/>
      <div style={{fontSize:38,lineHeight:1.28,fontWeight:600}}>{ch.desc}</div>
    </Enter>
    {stripeVisible&&<div style={{position:'absolute',inset:0,transform:'translateX('+stripe+'px)',background:'repeating-linear-gradient(90deg,#FF933E 0 90px,#FFF8E6 90px 180px)'}}/>}
  </AbsoluteFill>;
}
registerRoot(()=><Composition id="LapaKWUExplainer" component={Explainer} width={1080} height={1920} fps={fps} durationInFrames={chapters.length*segment}/>);
