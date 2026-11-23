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

out = Path('output/pdf/LapaKWU-Rancangan-UI-Lengkap.pdf')
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
    c.drawRightString(W-M,26,f'{n:02} / 16')

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

def note(x,y,w,title,desc,bg=blue,h=57):
    box(x,y,w,h,bg,r=12)
    text(x+13,y+7,title,11,'Bold',blue_text)
    para(x+13,y+23,w-26,desc,10.5,ink,13)

def pair(left,right,y=173,h=346):
    panel(M,y,half,h,*left)
    panel(M+half+gap,y,half,h,*right)

def triple(items,y=173,h=350):
    w=(CONTENT-2*gap)/3
    for i,item in enumerate(items):
        panel(M+i*(w+gap),y,w,h,*item)

def flow(x,y,w,steps,bg=blue,h=48):
    space=16
    cell=(w-space*(len(steps)-1))/len(steps)
    for i,step in enumerate(steps):
        box(x,y,cell,h,bg,r=9)
        para(x+8,y+11,cell-16,step,10.7,ink,13,'Semi')
        if i<len(steps)-1:
            text(x+cell+3,y+12,'›',16,'Bold',blue_text)
        x+=cell+space

def lane(y,title,desc,steps,bg=blue):
    box(M,y,CONTENT,107,paper,line,r=14)
    text(M+14,y+9,title,13,'Bold',blue_text)
    flow(M+14,y+29,CONTENT-28,steps,bg,44)
    para(M+14,y+78,CONTENT-28,desc,10.5,muted,13)

base(1,'')
box(M,91,CONTENT,294,gold,r=23)
text(M+23,115,'PROYEK TUGAS BESAR KELOMPOK',12,'Bold',blue_text)
text(M+23,141,'Rancangan UI',45,'Bold')
text(M+23,200,'LapaKWU',53,'Bold')
para(M+24,272,307,'Marketplace bazar kampus untuk mencari produk, mengelola lapak, dan mengatur pengambilan pesanan.',16)
box(M+355,130,378,201,paper,line,r=16)
image('home-hero',M+365,143,358,174)
for i,(label,detail) in enumerate([
    ('02–03','Peran, navigasi, dan akses akun.'),
    ('04–11','Halaman pembeli, mitra, dan admin.'),
    ('12–16','User flow, sistem visual, dan skenario interaksi.')]):
    x=M+i*(CONTENT/3)
    text(x,415,label,20,'Bold')
    para(x,449,CONTENT/3-20,detail,12,muted)
para(M,514,CONTENT,'Tangkapan layar aplikasi menggunakan akun, produk, dan bukti pembayaran demo.',10,muted)
c.showPage()

base(2,'Struktur aplikasi','Peran dan peta navigasi','Prioritas navigasi mengikuti tugas utama pengguna di bazar kampus.')
navigation=[
  ('Pembeli','Menemukan produk dan menyelesaikan pesanan dengan jelas.',
   ['Beranda','Detail produk','Keranjang','Checkout','Riwayat pesanan','Cari tenant'],
   'Masuk, daftar, dan verifikasi tersedia saat pengguna membutuhkan akun. Profil menyimpan data akun.'),
  ('Mitra','Menjaga stok akurat serta mengetahui pesanan yang perlu ditangani.',
   ['Produk dan stok','Terjual offline','Pesanan masuk','QRIS Toko','Dompet Mitra','Rekap Penjualan'],
   'Semua bagian diakses lewat tab /mitra. Koreksi stok dan penjualan offline memiliki tindakan terpisah.'),
  ('Admin','Memeriksa transaksi dan menjaga informasi tenant tetap benar.',
   ['Verifikasi mitra','Verifikasi QRIS','Pencairan Mitra','Pengguna dan peran','Produk & kategori','Rekap & refund'],
   'Tab /admin mengelompokkan tugas verifikasi, pengelolaan katalog, laporan, dan pencairan.'),
]
for i,(role,goal,items,summary) in enumerate(navigation):
    w=(CONTENT-2*gap)/3
    x=M+i*(w+gap)
    box(x,176,w,346,paper,line)
    text(x+15,190,role,21,'Bold')
    para(x+15,226,w-30,goal,11.4,muted,14)
    for j,item in enumerate(items):
        box(x+14,276+j*27,w-28,23,[ '#FFF0C9',blue,'#F7E9D4'][i],r=6)
        text(x+23,278+j*27,item,11,'Semi')
    para(x+15,449,w-30,summary,10.3,muted,13)
c.showPage()

base(3,'Akses akun','Masuk dan daftar','Halaman publik dapat dijelajahi sebelum pengguna masuk. Akun diperlukan untuk melanjutkan pemesanan.')
pair(
    ('Masuk','/masuk','Email dan kata sandi berada dalam satu formulir. Tautan lupa kata sandi tersedia di layar yang sama.','signin-panel'),
    ('Daftar dan verifikasi','/daftar  •  /verifikasi','Pendaftaran meminta data akun dan kanal verifikasi. Setelah akun dibuat, pengguna diarahkan untuk memasukkan kode.','signup-panel'))
c.showPage()

base(4,'Pembeli / Penemuan','Dari katalog ke pilihan produk','Pencarian, kategori, dan informasi stok membantu pembeli menilai produk sebelum memesan.')
triple([
    ('Cari produk','/','Cari produk atau lapak dan sempitkan hasil dengan filter kategori.','search-composite'),
    ('Detail produk','/produk/[id]','Foto, harga, stok, jumlah, dan aksi beli tersedia dalam satu tampilan.','product-full',(.09,.045,.91,.55)),
    ('Pilihan add-on','/  •  /produk/[id]','Checkbox mendukung beberapa pilihan. Tambahan harga dan catatan diperlihatkan sebelum item ditambahkan.','addon-panel'),
])
c.showPage()

base(5,'Pembeli / Pemesanan','Keranjang dan checkout','Pembeli memeriksa item dan total, lalu menentukan cara menerima pesanan serta metode bayar.')
pair(
    ('Keranjang','/keranjang','Jumlah tiap item bisa diubah. Ringkasan harga dan tombol lanjut ke checkout berada dekat daftar belanja.','cart-panel',(0,0,1,.73)),
    ('Checkout','/checkout','Pilih ambil di lapak atau antar ke alamat. Bayar di lapak tersedia untuk pengambilan. Pesanan antar menggunakan QRIS.','cash-panel',(0,0,1,.88)))
c.showPage()

base(6,'Pembeli & admin / Pembayaran','Bukti QRIS dan verifikasi','Layar pembeli menjelaskan syarat bukti. Admin memiliki tampilan untuk mencocokkan bukti dengan dana masuk.')
pair(
    ('Unggah bukti QRIS','/checkout  •  QRIS','OCR mencocokkan merchant LapaKWU, Service dan nominal dengan total checkout. Tanggal dan jam bukti tidak menjadi syarat.','qris-upload'),
    ('Periksa pembayaran','/admin  •  Verifikasi QRIS','Admin melihat nominal, bukti, dan hasil OCR. Pembayaran disetujui setelah dana masuk diperiksa.','qris-admin-summary'))
c.showPage()

base(7,'Pembeli / Pemenuhan','Status pesanan dan denah','Status menjawab kapan pesanan diproses. Denah menjawab ke mana pembeli harus pergi untuk mengambilnya.')
pair(
    ('Riwayat pesanan','/pesanan','Setiap kartu memuat urutan status dan rincian bayar. Label membedakan pesanan diproses, siap diambil, atau dikirim.','orders-panel',(0,0,1,.82)),
    ('Cari tenant','/pesanan  •  Cari tenant','Tombol muncul untuk pengambilan yang memenuhi syarat. Slot tujuan berdenyut kuning, disertai nomor dan instruksi.','tenant-focus'))
c.showPage()

base(8,'Mitra / Inventaris','Kelola produk dan stok','Koreksi stok dipisahkan dari penjualan offline agar perubahan persediaan tidak ikut menambah rekap.')
triple([
    ('Produk dan stok','/mitra  •  Produk dan stok','Mitra dapat mengubah stok, harga, kategori, dan add-on dari daftar produk. Tombol − dan + hanya mengubah stok.','partner-stock',(0,0,1,.72)),
    ('Catat penjualan','/mitra  •  Produk dan stok','Masukkan jumlah terjual sekaligus. Penyimpanan mengurangi stok dan menambah rekap.','offline-panel'),
    ('Koreksi penjualan','/mitra  •  Terjual offline','Kurangi jumlah yang salah tercatat. Saat disimpan, stok dikembalikan dan rekap disesuaikan.','offline-history-panel'),
])
c.showPage()

base(9,'Mitra / Keuangan','Pantau rekap dan dompet','Rekap menjelaskan penjualan. Dompet menampilkan dana tersedia, dana tertahan, dan riwayat pencairan.')
pair(
    ('Rekap penjualan','/mitra  •  Rekap Penjualan','Grafik dan tabel memperlihatkan total per periode serta porsi digital dan offline.','reports-panel',(0,0,1,.74)),
    ('Dompet mitra','/mitra  •  Dompet Mitra','Mitra memeriksa saldo dan pengajuan pencairan. QRIS Toko tersedia di tab terpisah.','wallet-card'))
c.showPage()

base(10,'Mitra / Pemenuhan','Pesanan masuk dan QRIS toko','Mitra menangani pesanan pembeli dan mengatur QRIS untuk pencairan melalui tab yang berbeda.')
pair(
    ('Pesanan masuk','/mitra  •  Pesanan masuk','Buka kartu pesanan untuk melihat status dan tindakan yang tersedia sesuai metode bayar dan cara penerimaan.','mitra-orders-panel'),
    ('QRIS toko','/mitra  •  QRIS Toko','Mitra dapat melihat atau mengganti QRIS toko yang digunakan admin saat mencairkan saldo dompet.','mitra-qris-panel'))
c.showPage()

base(11,'Admin / Pengawasan','Verifikasi mitra dan operasional','Panel admin mengumpulkan tindakan yang memerlukan pemeriksaan atau otorisasi.')
panel(M,173,471,347,'Panel admin','/admin  •  Verifikasi mitra','Cari mitra, lihat status akun, dan pilih nomor tenant. Nomor yang dipakai lapak lain ditandai di pemilih.','admin-panel',(0,0,1,.90))
x=M+489
w=CONTENT-489
box(x,173,w,347,paper,line)
text(x+15,186,'Tab operasional',17,'Bold')
for i,(title,detail) in enumerate([
  ('Verifikasi QRIS','Bukti, status OCR, dan konfirmasi lunas.'),
  ('Pencairan dan refund','Periksa pengajuan atau catat tindak lanjut.'),
  ('Pengguna dan katalog','Kelola peran, produk, dan kategori.'),
  ('Rekap penjualan','Tinjau transaksi lintas lapak per periode.'),
]):
    y=224+i*66
    text(x+15,y,title,12,'Bold',blue_text)
    para(x+15,y+18,w-30,detail,10.5,muted,13)
    if i<3: rule(x+15,y+52,w-30)
c.showPage()

base(12,'User flow / Pembeli','Dari pencarian hingga pesanan diterima','Jalur checkout bercabang sesuai cara menerima pesanan dan metode pembayaran.')
flow(M,176,CONTENT,['Beranda dan cari produk','Pilih add-on / jumlah','Keranjang atau beli langsung','Masuk bila diperlukan','Checkout'],gold,54)
cx=M+CONTENT-(CONTENT-64)/10
c.setStrokeColor(HexColor(blue_text)); c.setLineWidth(1.2)
c.line(cx,H-230,cx,H-265)
c.line(M+(CONTENT-2*gap)/6,H-265,cx,H-265)
for i,(label,steps,summary) in enumerate([
    ('Ambil + QRIS',['Unggah bukti','Admin verifikasi','Ambil di tenant'],'Gunakan Cari tenant saat syarat pengambilan terpenuhi.'),
    ('Ambil + bayar di lapak',['Buat pesanan','Bayar ke mitra','Mitra konfirmasi'],'Denah tersedia pada jendela pembayaran yang berlaku.'),
    ('Antar + QRIS',['Isi alamat','Unggah bukti','Lacak pengiriman'],'Biaya antar termasuk dalam total checkout.'),
]):
    w=(CONTENT-2*gap)/3; x=M+i*(w+gap)
    c.setStrokeColor(HexColor(blue_text)); c.line(x+w/2,H-265,x+w/2,H-280)
    box(x,280,w,153,paper,line)
    text(x+12,291,label,13,'Bold',blue_text)
    for k,s in enumerate(steps): text(x+12,318+k*19,f'{k+1}. {s}',11,'Semi')
    para(x+12,383,w-24,summary,10.4,muted,13)
note(M,453,CONTENT,'Titik temu / Riwayat pesanan','Pembeli mengecek status, mengikuti instruksi, lalu menyelesaikan pengambilan atau menerima pengiriman.',blue,64)
c.showPage()

base(13,'User flow / Mitra','Kelola stok dan tangani pesanan','Setelah masuk, mitra memilih tugas dari tab dashboard.')
lane(175,'Koreksi stok','Gunakan hitung stok fisik untuk koreksi persediaan. Rekap penjualan tidak ikut berubah.',
    ['Produk dan stok','Pilih produk','Tekan − / + atau Ubah stok','Cek stok terbaru'],blue)
lane(291,'Penjualan offline','Jika catatan keliru, buka Terjual offline, turunkan jumlah, dan simpan koreksi.',
    ['Produk dan stok','Catat penjualan offline','Isi jumlah dan simpan','Cek penjualan di rekap'],'#FFF0C9')
lane(407,'Pesanan pembeli','Untuk bayar di lapak, mitra mengonfirmasi pembayaran sesuai alur pesanan yang berlaku.',
    ['Pesanan masuk','Periksa metode dan status bayar','Siapkan atau kirim','Selesaikan pesanan'],blue)
c.showPage()

base(14,'User flow / Admin','Tindak lanjuti akun dan pembayaran','Admin memeriksa status sebelum mengubahnya, sehingga pembeli dan mitra mendapat informasi yang tepat.')
lane(175,'Verifikasi mitra','Jika data perlu diperbaiki, gunakan tindakan Minta perbaikan. Nomor tenant dapat ditetapkan di tab yang sama.',
    ['Verifikasi mitra','Cari lapak','Periksa status dan data','Verifikasi atau minta perbaikan'],blue)
lane(291,'Verifikasi QRIS','Jika dana dan bukti sesuai, konfirmasi lunas. Jika tidak sesuai, admin dapat menolak pembayaran.',
    ['Verifikasi QRIS','Lihat bukti dan hasil OCR','Cocokkan dana masuk','Konfirmasi lunas atau tolak'],'#FFF0C9')
lane(407,'Pengawasan operasional','Pencairan, refund, dan laporan memiliki tempat tersendiri agar antrean tindakan dapat dipantau.',
    ['Pilih tab pengawasan','Periksa riwayat dan status','Catat tindakan bila perlu','Pantau rekap penjualan'],blue)
c.showPage()

base(15,'Pedoman visual','Sistem visual dan tampilan ponsel','Pola warna, tipografi, dan kontrol yang sama membantu pengguna mengenali aksi di berbagai ukuran layar.')
box(M,173,471,350,paper,line)
for i,(name,hx) in enumerate([('Latar',cream),('Aksi utama',gold),('Aksen',orange),('Informasi','#73A5CA'),('Teks',ink)]):
    x=M+16+i*90
    box(x,195,73,34,hx,line,r=8)
    text(x,235,name,10,'Bold')
    text(x,252,hx,9,'UI',muted)
rule(M+16,277,439)
for y,title,detail in [
    (290,'Tipografi','Bricolage Grotesque untuk judul. Plus Jakarta Sans untuk isi, label, dan instruksi.'),
    (351,'Komponen','Kartu untuk pengelompokan informasi, lencana berlabel teks, tombol membulat, dan dialog untuk tindakan terfokus.'),
    (415,'Responsif dan aksesibilitas','Pada ponsel, konten mengalir vertikal dan dialog add-on terpusat. Denah tetap kuning saat animasi dikurangi.')
]:
    text(M+16,y,title,14,'Bold')
    para(M+16,y+23,430,detail,11,muted,14)
panel(M+489,173,CONTENT-489,350,'Dialog di ponsel','Beranda  •  390 px','Checklist, catatan dan total terlihat dalam dialog yang sama.','mobile-addon')
c.showPage()

base(16,'Evaluasi rancangan','Keadaan antarmuka yang perlu terlihat','Matriks ini menjelaskan umpan balik pada skenario penting dan tindakan lanjutan yang tersedia.')
cols=[M,M+222,M+530]
widths=[222,308,CONTENT-530]
for i,h in enumerate(['Skenario','Umpan balik UI','Tindakan berikutnya']):
    box(cols[i],176,widths[i]-2,32,ink,r=7)
    text(cols[i]+9,182,h,11,'Bold',paper)
rows=[
    ('Jumlah melampaui stok','Kontrol jumlah dibatasi sesuai stok. Checkout memeriksa ulang stok terkini.','Kurangi jumlah atau pilih produk lain.'),
    ('Bukti QRIS tidak sesuai','Pesan menyebut merchant atau nominal yang perlu diperiksa.','Periksa bukti dan unggah ulang.'),
    ('Pembayaran menunggu','Riwayat pesanan membedakan status bayar dan proses pesanan.','Tunggu konfirmasi admin untuk QRIS.'),
    ('Denah tidak dapat menandai slot','Jika nomor tidak tercantum, dialog menampilkan keterangan. Nomor ganda menandai kedua lokasi.','Cocokkan nomor dan nama lapak.'),
    ('Penjualan offline salah dicatat','Tab Terjual offline menyediakan koreksi jumlah.','Simpan angka baru untuk menyesuaikan stok dan rekap.'),
]
for j,row in enumerate(rows):
    y=214+j*55
    box(M,y,CONTENT,51,paper,line,r=8)
    for i,value in enumerate(row):
        para(cols[i]+9,y+8,widths[i]-18,value,10.6,ink,13,'Semi' if i==0 else 'UI')
note(M,496,CONTENT,'Dasar rancangan','Halaman dan alur didokumentasikan dari aplikasi LapaKWU. Tangkapan layar memakai data demo lokal.',blue,44)
c.showPage()
c.save()
print(out)
