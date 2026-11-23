from pathlib import Path
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

out = Path('output/pdf/LapaKWU-Rancangan-UI.pdf')
assets = Path('motion/public/tugas-ui')
for name, file in [('UI','segoeui.ttf'),('Bold','segoeuib.ttf'),('Semi','seguisb.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts') / file)))
W,H = landscape(A4)
c=Canvas(str(out),pagesize=(W,H),pageCompression=1)
c.setTitle('LapaKWU | Rancangan User Interface')
c.setSubject('Halaman utama, user flow, dan pedoman visual LapaKWU')
ink='#22313F'; cream='#FFF8E6'; paper='#FFFDF8'; gold='#FFCB56'; orange='#FF933E'
blue='#DCEAF4'; blue_text='#2D5F86'; line='#F0DEB0'; muted='#505E69'
M=42
CONTENT=W-2*M
gap=18
half=(CONTENT-gap)/2

def box(x,y,w,h,bg,stroke=None,r=16):
    c.setFillColor(HexColor(bg))
    if stroke: c.setStrokeColor(HexColor(stroke))
    c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=int(bool(stroke)))

def text(x,y,s,size=13,font='UI',color=ink):
    c.setFont(font,size); c.setFillColor(HexColor(color)); c.drawString(x,H-y-size,s)

def para(x,y,w,s,size=12,color=ink,leading=None,font='UI'):
    p=Paragraph(escape(s),ParagraphStyle('body',fontName=font,fontSize=size,leading=leading or size*1.38,textColor=HexColor(color)))
    _,h=p.wrap(w,H)
    p.drawOn(c,x,H-y-h)
    return h

def rule(x,y,w,col=line):
    c.setStrokeColor(HexColor(col)); c.setLineWidth(.8)
    c.line(x,H-y,x+w,H-y)

def brand(x,y):
    text(x,y,'Lapa',18,'Bold')
    box(x+39,y+1,43,25,orange,r=6)
    text(x+44,y+1,'KWU',16,'Bold')

def base(n, chapter, title=None, intro=None):
    box(0,0,W,H,cream,r=0)
    brand(M,25)
    text(M+101,31,'RANCANGAN USER INTERFACE',9.5,'Bold',blue_text)
    rule(M,61,CONTENT)
    if title:
        text(M,80,chapter.upper(),10.5,'Bold',blue_text)
        text(M,98,title,31,'Bold')
        para(M,143,CONTENT,intro,12.3,muted)
    rule(M,H-42,CONTENT)
    text(M,H-33,'LapaKWU  /  Proyek Tugas Besar Kelompok',9,'Semi',muted)
    c.setFont('Bold',9); c.setFillColor(HexColor(blue_text))
    c.drawRightString(W-M,26,f'{n:02} / 07')

def image(name,x,y,w,h,crop=None):
    with Image.open(assets / (name+'.png')) as source:
        im=source.convert('RGB')
    if crop:
        a,b,d,e=crop
        im=im.crop((round(a*im.width),round(b*im.height),round(d*im.width),round(e*im.height)))
    im.thumbnail((round(w*2.5),round(h*2.5)),Image.Resampling.LANCZOS)
    scale=min(w/im.width,h/im.height)
    iw=im.width*scale; ih=im.height*scale
    c.drawImage(ImageReader(im),x+(w-iw)/2,H-y-(h+ih)/2,iw,ih)

def panel(x,y,w,h,title,route,desc,pic,crop=None):
    box(x,y,w,h,paper,line)
    text(x+15,y+12,title,17,'Bold')
    text(x+15,y+38,route,10,'Semi',blue_text)
    box(x+15,y+60,w-30,h-125,'#FFFFFF',r=10)
    image(pic,x+22,y+65,w-44,h-135,crop)
    para(x+15,y+h-53,w-30,desc,11,muted,15)

def chip(x,y,w,label,bg=gold):
    box(x,y,w,28,bg,r=10)
    text(x+12,y+5,label,12,'Bold')

base(1,'')
box(M,91,CONTENT,294,gold,r=23)
text(M+23,115,'TUGAS USER INTERFACE',12,'Bold',blue_text)
text(M+23,141,'Rancangan UI',45,'Bold')
text(M+23,200,'LapaKWU',53,'Bold')
para(M+24,272,300,'Marketplace bazar kampus untuk pembeli, mitra penjual, dan admin.',17)
box(M+355,130,378,201,paper,line,r=16)
image('home-hero',M+365,143,358,174)
for i,(role,desc) in enumerate([
    ('Pembeli','Mencari produk, memesan, dan menemukan lokasi pengambilan.'),
    ('Mitra','Mengelola produk, stok, pesanan masuk, dan penjualan di lapak.'),
    ('Admin','Memverifikasi mitra, menetapkan tenant, dan memantau rekap.')]):
    x=M+i*(CONTENT/3)
    text(x,415,role,18,'Bold')
    para(x,445,CONTENT/3-22,desc,12,muted)
para(M,514,CONTENT,'Tampilan diambil dari aplikasi LapaKWU dengan produk dan akun demo.',10,muted)
c.showPage()

base(2,'Pembeli / Penemuan','Dari katalog ke pilihan produk','Pencarian dan kategori membantu pembeli mempersempit pilihan. Add-on dapat dipilih lebih dari satu.')
third=(CONTENT-2*gap)/3
panel(M,177,third,343,'Cari produk','/', 'Cari produk atau lapak. Kartu menampilkan kategori, nama, harga, dan aksi tambah.', 'search-composite')
panel(M+third+gap,177,third,343,'Detail produk','/produk/[id]', 'Lihat foto, harga, stok, dan jumlah. Pilih beli langsung atau tambah ke keranjang.', 'product-full',(0,.05,1,.73))
panel(M+2*(third+gap),177,third,343,'Pilihan add-on','/  •  /produk/[id]', 'Pilih beberapa opsi, lihat biaya tambahannya, lalu isi catatan bila perlu.', 'addon-panel')
c.showPage()

base(3,'Pembeli / Pembelian','Keranjang dan checkout','Pembeli mengecek item dan jumlah sebelum menentukan cara menerima pesanan dan membayar.')
panel(M,177,half,343,'Keranjang','/keranjang','Ubah jumlah item, cek subtotal, lalu lanjut ke checkout.', 'cart-panel',(0,0,1,.75))
panel(M+half+gap,177,half,343,'Checkout','/checkout','Pilih Ambil di lapak atau Antar ke alamat. Opsi antar menggunakan QRIS. Untuk ambil, tersedia juga bayar di lapak.', 'cash-panel',(0,0,1,.88))
c.showPage()

base(4,'Pembeli / Pengambilan','Pantau pesanan dan cari tenant','Riwayat pesanan memberi konteks status, pembayaran, dan langkah pengambilan.')
panel(M,177,half,343,'Riwayat pesanan','/pesanan','Status dan rincian pembayaran tampil per pesanan. Untuk pengambilan yang memenuhi syarat, tombol Cari tenant muncul.', 'orders-panel',(0,0,1,.82))
panel(M+half+gap,177,half,343,'Denah pengambilan','/pesanan  •  Cari tenant','Nomor tujuan disorot kuning dan berdenyut. Instruksi tetap terlihat ketika perangkat mengurangi animasi.', 'tenant-focus')
c.showPage()

base(5,'Operasional / Mitra & admin','Kelola lapak dan verifikasi mitra','Navigasi berbasis tab memisahkan pengelolaan katalog, pencatatan transaksi, dan tugas administrasi.')
panel(M,177,half,343,'Penjualan offline','/mitra  •  Produk dan stok','Tombol − dan + mengoreksi stok. Untuk penjualan, isi jumlah terjual pada dialog khusus agar stok dan rekap diperbarui bersama.', 'offline-panel')
panel(M+half+gap,177,half,343,'Verifikasi & nomor tenant','/admin  •  Verifikasi mitra','Admin memeriksa status akun serta menetapkan nomor tenant. Tab lainnya mencakup verifikasi QRIS, pencairan, dan rekap.', 'admin-panel',(0,0,1,.88))
c.showPage()

base(6,'Navigasi','Alur pengguna','Alur utama berdasarkan peran. Setiap baris menunjukkan langkah berurutan dan pilihan penting.')
flows=[
    ('PEMBELI',gold,['Beranda & cari','Pilih produk / add-on','Keranjang / beli langsung','Checkout & bayar','Pesanan & pengambilan'],
     'Checkout bercabang ke ambil di lapak (QRIS atau bayar di tempat) atau antar (QRIS). Jika diperlukan, masuk dengan akun pembeli.'),
    ('MITRA',blue,['Masuk sebagai mitra','Produk dan stok','Catat penjualan offline','Isi jumlah dan simpan','Cek penjualan di rekap'],
     'Pesanan dari pembeli ditangani melalui tab Pesanan. Koreksi stok dan pencatatan penjualan punya aksi tersendiri.'),
    ('ADMIN','#FFE9A9',['Masuk sebagai admin','Verifikasi mitra','Pilih nomor tenant','Simpan penetapan','Pantau rekap'],
     'Verifikasi QRIS, pencairan dan refund tersedia di tab terpisah sesuai tindakan yang diperlukan.')
]
for j,(role,bg,steps,note) in enumerate(flows):
    y=179+j*116
    box(M,y,CONTENT,108,paper,line)
    chip(M+12,y+10,89,role,bg)
    x=M+108
    width=(CONTENT-108-12-16*4)/5
    for i,step in enumerate(steps):
        box(x,y+9,width,48,bg,r=9)
        para(x+7,y+16,width-14,step,10.8,ink,12.7,'Semi')
        if i<4:
            text(x+width+2,y+21,'›',16,'Bold',blue_text)
        x+=width+16
    para(M+15,y+66,CONTENT-30,note,10.6,muted,14)
c.showPage()

base(7,'Design system','Konsistensi visual dan interaksi','Warna, tipografi, dan pola aksi yang sama diterapkan pada layar pembeli, mitra, dan admin.')
box(M,177,471,343,paper,line)
swatches=[('Latar',cream),('Aksi utama',gold),('Aksen',orange),('Informasi','#73A5CA'),('Teks',ink)]
for i,(name,hx) in enumerate(swatches):
    x=M+16+i*90
    box(x,197,73,33,hx,line,r=8)
    text(x,236,name,10,'Bold')
    text(x,253,hx,9,'UI',muted)
rule(M+16,278,439)
for y,t,d in [
    (291,'Tipografi','Bricolage Grotesque untuk judul dan Plus Jakarta Sans untuk isi, label, serta instruksi.'),
    (353,'Komponen','Kartu berbingkai tipis, tombol membulat, lencana status, dan dialog untuk aksi terfokus.'),
    (415,'Umpan balik & aksesibilitas','Status diberi label teks. Sorotan tenant tetap kuning saat prefers-reduced-motion menonaktifkan animasi.')
]:
    text(M+16,y,t,14,'Bold')
    para(M+16,y+23,430,d,10.5,muted,13)
panel(M+489,177,CONTENT-489,343,'Tampilan ponsel','Beranda  •  lebar layar 390 px','Konten tersusun vertikal dan aksi utama tetap terlihat pada layar sempit.', 'mobile-home')
c.showPage()
c.save()
print(out)
