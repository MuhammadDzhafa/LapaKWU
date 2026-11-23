import analysis from '../public/demo/audio/beat-data.json';

export const FPS=30;
export const TOTAL=55*FPS;
export const MUSIC={src:'demo/audio/music.wav',volume:.68};
const {t0,T,hits}=analysis;

export const beatT = (n)=>t0+n*T;
export const beatF = (n)=>Math.round(beatT(n)*FPS);

function accentNear(seconds, preferred){
  const candidates=hits.filter(hit=>hit.k==='kick'||hit.k==='snare');
  const ranked=candidates.map(hit=>({
    hit,
    score:Math.abs(hit.t-seconds)+(preferred && hit.k!==preferred ? .075 : 0),
  })).sort((a,b)=>a.score-b.score);
  if (!ranked.length) throw new Error('No analyzed kick or snare events');
  const hit=ranked[0].hit;
  return {...hit,beat:(hit.t-t0)/T};
}

const stories=[
  {id:'open',at:0,actionAt:2.7,chapter:'Demo aplikasi',kicker:'Aplikasi bazar gabungan',title:'Satu tempat untuk satu bazar.',caption:'Temukan produk, pesan, dan kelola stan dengan LapaKWU.',page:'home',crop:'home-hero',mode:'brand',tone:'d-gold'},
  {id:'catalog',at:5.2,actionAt:8.2,chapter:'Pengunjung',kicker:'Katalog',title:'Jelajahi berbagai stan.',caption:'Lihat produk dan harga dari berbagai stan dalam satu katalog.',page:'home',crop:'catalog-grid',focus:'catalog-grid',mode:'wide',tone:'d-cream'},
  {id:'search',at:11,actionAt:13.6,chapter:'Pengunjung',kicker:'Pencarian & filter',title:'Temukan produk incaran.',caption:'Cari produk berdasarkan nama atau saring berdasarkan kategori.',page:'search',crop:'search-result',focus:'search-panel',interaction:true,tone:'d-blue'},
  {id:'cart',at:16.8,actionAt:19.3,chapter:'Pengunjung',kicker:'Keranjang',title:'Atur pesananmu.',caption:'Cek jumlah barang dan total sebelum lanjut ke pembayaran.',page:'cart',crop:'cart-button',interaction:true,tone:'d-cream'},
  {id:'payment',at:22.5,actionAt:25.4,chapter:'Pembayaran',kicker:'Checkout',title:'Bayar dengan QRIS.',caption:'Pilih QRIS dan unggah bukti pembayaran di checkout.',page:'checkout',crop:'checkout-payment',interaction:true,tone:'d-gold'},
  {id:'cash',at:28.1,actionAt:29.7,chapter:'Pembayaran',kicker:'Tunai',title:'Bayar di stan.',caption:'Pilih tunai dan bayar langsung ke tenant dalam satu jam.',page:'cash',crop:'cash-panel',tone:'d-blue'},
  {id:'orders',at:31.45,actionAt:33,chapter:'Pengunjung',kicker:'Pesanan',title:'Pantau status pesanan.',caption:'Lihat pesanan yang masih diproses dan yang siap diambil.',page:'orders',crop:'orders-panel',mode:'wide',tone:'d-cream'},
  {id:'map',at:35.1,actionAt:37.4,chapter:'Pengunjung',kicker:'Denah bazar',title:'Cari lokasi tenant.',caption:'Buka denah untuk menemukan stan tujuan di lokasi bazar.',page:'home',crop:'tenant-map',mode:'wide',tone:'d-gold'},
  {id:'partner',at:39.6,actionAt:41.2,chapter:'Mitra',kicker:'Dasbor Mitra',title:'Kelola stan dan pesanan.',caption:'Atur produk, stok, dan pesanan dari Dasbor Mitra.',page:'partner',crop:'partner-stats',mode:'wide',tone:'d-blue'},
  {id:'reports',at:43.25,actionAt:44.75,chapter:'Mitra',kicker:'Rekap penjualan',title:'Baca tren penjualan.',caption:'Lihat grafik penjualan dan ringkasan performa stan.',page:'reports',crop:'reports-line',focus:'reports-chart',mode:'wide',tone:'d-ink'},
  {id:'wallet',at:46.9,actionAt:48.9,chapter:'Mitra',kicker:'Dompet Mitra',title:'Pantau dan cairkan saldo.',caption:'Cairkan saldo mulai Rp10.000 setelah pesanan selesai.',page:'wallet',crop:'wallet-panel',focus:'wallet-button',interaction:true,tone:'d-cream'},
  {id:'end',at:51.2,actionAt:52.5,chapter:'Demo aplikasi',kicker:'LapaKWU',title:'Bazar gabungan, dalam satu aplikasi.',caption:'Untuk pengunjung dan mitra bazar.',page:'home',mode:'end',tone:'d-ink'},
];

const marked=stories.map((shot,index)=>{
  const cut=index?accentNear(shot.at,index%2?'kick':'snare'):null;
  const action=accentNear(shot.actionAt,'snare');
  const from=cut?beatF(cut.beat):0;
  return {...shot,from,cut,actionHit:action,action:beatF(action.beat)-from};
});

export const SHOTS=marked.map((shot,index)=>({
  ...shot,
  duration:(marked[index+1]?.from ?? TOTAL)-shot.from,
}));

export const SFX=SHOTS.flatMap((shot,index)=>{
  const cues=[];
  if(index&&index%2===1) cues.push({id:shot.id+'-whoosh',label:'Whoosh',from:Math.max(0,shot.from-6),duration:15,src:'demo/audio/sfx/fs-855733.mp3',volume:.43});
  if(shot.interaction) cues.push({id:shot.id+'-click',label:'Click',from:shot.from+shot.action,duration:2,src:'demo/audio/sfx/fs-640020.mp3',volume:.47});
  return cues;
});

export const SYNC_EVENTS=SHOTS.flatMap((shot)=>[
  ...(shot.cut?[{id:shot.id,kind:'cut',frame:shot.from,t:shot.cut.t,beat:shot.cut.beat,drum:shot.cut.k}]:[]),
  ...(shot.crop?[{id:shot.id,kind:'reveal',frame:shot.from+shot.action,t:shot.actionHit.t,beat:shot.actionHit.beat,drum:shot.actionHit.k}]:[]),
]);
