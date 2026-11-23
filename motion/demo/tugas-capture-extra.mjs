import puppeteer from 'puppeteer-core';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';

const base = 'http://localhost:3000';
const out = resolve('public/tugas-ui');
const live=process.argv.includes('--live');
const mobile=process.argv.includes('--mobile');
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
const liveDir=resolve(mobile?'public/demo/mobile':'public/demo/live');
const ffmpeg=resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const chrome = [
  process.env.CAPTURE_CHROME,
  resolve('node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(candidate=>candidate && existsSync(candidate));
if(!chrome) throw new Error('Set CAPTURE_CHROME to the path of a Chromium browser.');
const merchants = [
  {$id:'demo-mitra',nama_usaha:'Dapur Nusantara',alamat_usaha:'Area bazar kampus',nomor_tenant:12,id_qris:'demo-qris.png'},
  {$id:'demo-mitra2',nama_usaha:'Kreasi Mahasiswa',alamat_usaha:'Area bazar kampus',nomor_tenant:27},
];
const products = [
  ['Es Teh Lemon',8000,'Minuman','7rptxbtRdVW27QXHsk4X9.jpg'],
  ['Keripik Pisang',15000,'Camilan'],
  ['Roti Cokelat',12000,'Makanan'],
  ['Gantungan Kunci',18000,'Kerajinan'],
].map(([nama,harga,kategori,id_gambar],i)=>({$id:'demo-produk-'+i,nama,harga,kategori,id_gambar,stok:24-i*4,id_mitra:merchants[i===3?1:0].$id,deskripsi:'Produk pilihan bazar kampus.', ...(i === 0 ? {pilihan_add_on:['Lemon ekstra','Selasih'],harga_add_on:{'Lemon ekstra':1000,Selasih:1500}} : {})}));
const order = {$id:'demo-pesanan-1',id_mitra:'demo-mitra',id_pembeli:'demo-pembeli',tanggal_pesanan:new Date().toISOString(),jenis_pemesanan:'OFFLINE',total_harga:23000,status_pesanan:'SIAP_DIAMBIL',lokasi_pengambilan:'Stan 12 · Area bazar kampus'};
const reports = [174000,138000,86000,132000,105000,64000].map((value,i)=>{
  const when = new Date();
  when.setDate(1);
  when.setMonth(when.getMonth()-i);
  return {$id:'demo-rekap-'+i,periode:when.getFullYear()+'-'+String(when.getMonth()+1).padStart(2,'0'),id_mitra:'demo-mitra',total_penjualan:value,total_digital:value-24000,total_offline:24000,jumlah_transaksi:9-i,jumlah_offline:3,total_komisi:0,status_pencairan:'BELUM'};
});
const incoming = {...order,$id:'demo-pesanan-2',status_pesanan:'MENUNGGU_KONFIRMASI'};
const tables = {
  produk:products,
  mitra:merchants,
  keranjang:[{$id:'demo-pembeli',id_pembeli:'demo-pembeli',total_harga:23000}],
  item_keranjang:products.slice(0,2).map((p,i)=>({$id:'demo-item-'+i,id_produk:p.$id,id_keranjang:'demo-pembeli',jumlah:1,subtotal:p.harga,...(i===0?{add_on:'Lemon ekstra',subtotal:p.harga+1000}:{})})),
  pesanan:[order,incoming],
  detail_pesanan:[order,incoming].flatMap(item=>products.slice(0,2).map((p,i)=>({$id:item.$id+'-detail-'+i,id_pesanan:item.$id,id_produk:p.$id,jumlah:1,harga_satuan:p.harga,subtotal:p.harga}))),
  pembayaran:[{$id:'demo-bayar',id_pesanan:order.$id,metode:'QRIS',jumlah:23000,status_pembayaran:'BERHASIL'}],
  rekap_penjualan:reports,
};
const qr = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="146"><rect width="220" height="146" rx="12" fill="#dceaf4"/><path d="M77 34h24v24H77zm42 0h24v24h-24zM77 74h24v24H77zm42 0h24v24h-24z" fill="none" stroke="#2d5f86" stroke-width="6"/><text x="110" y="126" font-size="14" fill="#2d5f86" text-anchor="middle" font-family="sans-serif">QRIS DEMO</text></svg>');

await mkdir(out,{recursive:true});
const browser = await puppeteer.launch({executablePath:chrome,headless:chrome.includes('headless-shell')?'shell':true,args:['--no-sandbox','--disable-gpu']});
let role = null;
const manifest = {deviceScaleFactor:2,pages:{}};
try {
  const page = await browser.newPage();
  await page.setViewport(mobile ? {width:390,height:780,deviceScaleFactor:1,isMobile:true,hasTouch:true} : live ? {width:1280,height:720,deviceScaleFactor:1} : {width:1440,height:1000,deviceScaleFactor:2});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:live?'no-preference':'reduce'}]);
  await page.setRequestInterception(true);
  page.on('request',async (request)=>{
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    const respond = (data,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(data)});
    const route = url.pathname;
    if (route === '/api/auth/saya') {
      if (!role) return respond({},401);
      return respond({$id:'demo-'+role,peran:role,name:role==='mitra'?'Mitra Demo':'Pembeli Demo',pengguna:{status_akun:'AKTIF'},pembeli:{alamat:'Area bazar kampus'},mitra:role==='mitra'?merchants[0]:null});
    }
    if(route==='/api/admin' && JSON.parse(request.postData() ?? '{}').aksi === 'daftar_pencairan') return respond({pencairan:[]});
    if(route==='/api/admin') return respond({offset:0,u:merchants.map(m=>({$id:m.$id,nama:m.nama_usaha,email:'mitra@lapakwu.example',status_akun:'AKTIF'})),m:merchants,pr:products,ad:[],pb:[],rf:[],qris:[],peran:{'demo-mitra':'mitra','demo-mitra2':'mitra'}});
    if (route === '/api/db/list') {
      const {tabel,queries=[]} = JSON.parse(request.postData() ?? '{}');
      let rows=tables[tabel] ?? [];
      for(const {type,col,val} of queries){
        if(type==='eq') rows=rows.filter(row=>[].concat(val).includes(row[col]));
      }
      return respond({rows});
    }
    if(route==='/api/dompet') return respond({tersedia:125000,tertahan:23000,riwayat:[{id:'demo-penarikan',nominal:25000,status:'DICAIRKAN',created_at:'2026-11-10'}]});
    if(route==='/api/db/ubah'){
      const {tabel,id,data}=JSON.parse(request.postData() ?? '{}');
      const row=['item_keranjang','keranjang'].includes(tabel) && tables[tabel].find(item=>item.$id===id);
      if(!row) return respond({},404);
      Object.assign(row,data);
      return respond(row);
    }
    if(route.startsWith('/api/db/')){
      const [, , , table,id] = route.split('/');
      const row = tables[table]?.find(item=>item.$id===id);
      return respond(row ?? {},row ? 200 : 404);
    }
    if(route.startsWith('/api/file/')){
      if(route.endsWith('demo-qris.png')) return request.respond({status:200,contentType:'image/svg+xml',body:qr});
      const id = route.split('/').at(-1);
      return products.some(p=>p.id_gambar===id) ? request.continue({url:base+'/uploads/'+id}) : respond({},404);
    }
    if(url.origin===base && route.startsWith('/api/')) return respond({});
    if(request.resourceType()==='image' && (url.origin!==base || /qris/i.test(route))) {
      return request.respond({status:200,contentType:'image/svg+xml',body:qr});
    }
    return request.continue();
  });
  await page.evaluateOnNewDocument(()=>{
    const install=()=>{
      if(document.getElementById('demo-hide-dev')) return;
      const style=document.createElement('style');
      style.id='demo-hide-dev';
      style.textContent='nextjs-portal{display:none!important}';
      document.head?.append(style);
    };
    document.addEventListener('DOMContentLoaded',install,{once:true});
  });
  const settle = async () => {
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].filter(image=>image.loading!=='lazy').map(image=>image.decode().catch(()=>{})));
      for(const link of document.querySelectorAll('footer a[href*="mail.google.com"], footer a[href*="wa.me"]')){
        link.textContent=link.href.includes('mail.google.com')?'halo@lapakwu.example':'WhatsApp · Demo';
        link.removeAttribute('href');
      }
      window.scrollTo(0,0);
    });
    await page.addStyleTag({content:'nextjs-portal{display:none!important} *{caret-color:transparent!important} img[alt="QRIS LapaKWU"]{object-fit:contain}'});
  };
  const open = async (url,selector) => {
    console.log('Opening',url);
    await page.goto(base+url,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForSelector(selector,{visible:true,timeout:12000});
    await settle();
  };
  const save = async (name,cutouts) => {
    await page.evaluate(()=>window.scrollTo(0,0));
    const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
    const entry={...dimensions,cutouts:{}};
    manifest.pages[name]=entry;
    await page.screenshot({path:resolve(out,name+'-full.png'),fullPage:true});
    for(const [file,selector] of Object.entries(cutouts)){
      const element=await page.$(selector);
      if(!element) { console.log('Missing:',file,selector); continue; }
      const dimensions=await element.evaluate(el=>{
        const {x,y,width,height}=el.getBoundingClientRect();
        return {x:x+window.scrollX,y:y+window.scrollY,width,height};
      });
      if(dimensions.width<=0 || dimensions.height<=0) continue;
      entry.cutouts[file]=dimensions;
      await element.screenshot({path:resolve(out,file+'.png'),omitBackground:true});
    }
    await writeFile(resolve(out,'layout.json'),JSON.stringify(manifest,null,2)+'\n');
    console.log('Captured '+name,Object.keys(entry.cutouts));
  };
  if(live){
    await mkdir(liveDir,{recursive:true});
    const cdp=await page.createCDPSession();
    const clips=only ? JSON.parse(await readFile(resolve(liveDir,'clips.json'),'utf8')) : {};
    const position=async (selector,block='center')=>{
      await page.waitForSelector(selector,{visible:true});
      await page.$eval(selector,(el,block)=>el.scrollIntoView({block,behavior:'instant'}),block);
      await wait(450);
    };
    const clickText=async(text)=>{
      const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),{},text);
      await handle.asElement().click();
    };
    const record=async(name,action,{lead=760,tail=2320}={})=>{
      if(only&&!only.includes(name)) {
        if(name==='reports'&&only.includes('wallet')) await action();
        return;
      }
      const frames=[];
      const collect=({data,metadata,sessionId})=>{
        frames.push({data:Buffer.from(data,'base64'),t:metadata.timestamp});
        void cdp.send('Page.screencastFrameAck',{sessionId});
      };
      cdp.on('Page.screencastFrame',collect);
      const start=Date.now()/1000;
      let actionTime;
      await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:mobile?390:1280,maxHeight:mobile?780:720,everyNthFrame:1});
      try {
        await wait(lead);
        actionTime=Date.now()/1000;
        await action();
        await wait(tail);
      } finally {
        await cdp.send('Page.stopScreencast');
        cdp.off('Page.screencastFrame',collect);
      }
      if(frames.length<2) throw new Error('Too few live frames for '+name);
      const count=Math.ceil((Date.now()/1000-start)*30);
      const proc=spawn(ffmpeg,['-v','error','-y','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart','-f','mp4',resolve(liveDir,name+'.mp4')],{stdio:['pipe','ignore','inherit']});
      const finished=new Promise((resolve,reject)=>{
        proc.on('error',reject);
        proc.on('exit',code=>code===0?resolve():reject(new Error('FFmpeg failed for '+name)));
      });
      let i=0;
      for(let frame=0;frame<count;frame++){
        while(i+1<frames.length&&frames[i+1].t<=start+frame/30)i++;
        if(!proc.stdin.write(frames[i].data)) await once(proc.stdin,'drain');
      }
      proc.stdin.end();
      await finished;
      clips[name]={file:name+'.mp4',frames:count,action:Math.round((actionTime-start)*30),captures:frames.length};
      await writeFile(resolve(liveDir,'clips.json'),JSON.stringify(clips,null,2)+'\n');
      console.log('Live clip',name,clips[name]);
    };
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.hero2');
    await wait(2500);
    await page.evaluate(()=>sessionStorage.removeItem('lw-intro'));
    await record('open',()=>page.reload({waitUntil:'domcontentloaded'}),{lead:380,tail:2900});
    await settle();
    await record('catalog',()=>page.$eval('.grid',el=>el.scrollIntoView({block:'center',behavior:'smooth'})));
    await position('.searchcard');
    await record('search',async()=>{
      await page.$eval('input[type="search"]',el=>el.focus({preventScroll:true}));
      await page.keyboard.type('Es Teh',{delay:88});
      await page.waitForFunction(()=>document.querySelectorAll('.prod').length===1);
      await page.$eval('.grid',el=>el.scrollIntoView({block:'center',behavior:'smooth'}));
    });
    role='pembeli';
    await open('/keranjang','main .stack .card');
    await position('main .stack .card');
    await record('cart',async()=>{
      const plus=await page.waitForFunction(()=>[...document.querySelectorAll('main button')].find(el=>el.textContent.trim()==='+'));
      await plus.asElement().click();
      await page.waitForFunction(()=>document.querySelector('main h3')?.textContent.includes('31.000'));
    });
    await open('/checkout','main aside li');
    await position('main fieldset:nth-of-type(2)');
    await record('payment',async()=>{
      await page.$eval('input[type="file"]',el=>el.scrollIntoView({block:'center',behavior:'smooth'}));
      await wait(580);
      await page.$eval('input[type="file"]',async el=>{
        const canvas=document.createElement('canvas');
        canvas.width=640;canvas.height=320;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff8e6';ctx.fillRect(0,0,640,320);
        ctx.fillStyle='#ffcb56';ctx.fillRect(0,0,640,72);
        ctx.fillStyle='#22313f';ctx.font='bold 34px sans-serif';ctx.fillText('Bukti Pembayaran · DEMO',36,50);
        ctx.font='24px sans-serif';ctx.fillText('Contoh berkas untuk demonstrasi',36,135);
        ctx.fillText('LapaKWU',36,200);
        const file=new File([await new Promise(resolve=>canvas.toBlob(resolve))],'bukti-demo.png',{type:'image/png'});
        const data=new DataTransfer();
        data.items.add(file);
        el.files=data.files;
        el.dispatchEvent(new Event('change',{bubbles:true}));
        window.scrollBy({top:310,behavior:'smooth'});
      });
      await page.waitForSelector('img[alt="Preview Bukti Pembayaran"]');
    });
    await position('main fieldset:nth-of-type(2)');
    await record('cash',async()=>{const methods=await page.$$('input[name="metode"]');await methods[1].click();});
    await open('/pesanan','main h2');
    await page.waitForFunction(()=>document.querySelector('main').textContent.includes('Dapur Nusantara'));
    if(mobile) {
      await record('orders',()=>page.$eval('main h2',el=>el.scrollIntoView({block:'start',behavior:'smooth'})));
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    }
    await record('map',()=>clickText('Cari tenant'));
    role='mitra';
    await open('/mitra','main .stats');
    await record('partner',()=>page.$eval('main .split',el=>el.scrollIntoView({block:'center',behavior:'smooth'})));
    await record('reports',async()=>{
      await clickText('Rekap Penjualan');
      await page.waitForSelector('.rekap-charts',{visible:true});
      await page.$eval('.rekap-charts',el=>el.scrollIntoView({block:'center',behavior:'smooth'}));
    });
    if(!only||only.includes('reports')||only.includes('wallet')) await page.waitForSelector('.rekap-charts',{visible:true});
    await record('wallet',async()=>{
      await clickText('Dompet Mitra');
      await page.waitForSelector('.wallet-form',{visible:true});
      await page.$eval('.wallet-form',el=>el.scrollIntoView({block:'center',behavior:'smooth'}));
    });
  } else {

  role='admin';
  await open('/admin','main .atur-tenant');
  await save('admin',{'admin-panel':'main'});
  role='pembeli';
  await open('/keranjang','main .stack .card');
  await save('cart',{'cart-panel':'main','cart-button':'main a[href*="checkout"]'});
  await open('/checkout','main aside li');
  const cash=(await page.$$('input[name="metode"]'))[1];
  if(cash){await cash.click(); await save('cash',{'cash-panel':'main'});}
  role=null;
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await open('/','.prod');
  await page.screenshot({path:resolve(out,'mobile-home.png')});

  }
} finally {
  await browser.close();
}

