'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { list, ubah, Query } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import Pesanan from '@/components/Pesanan';

export default function PesananSaya() {
  const { akun, peran, memuat } = useSaya();
  const [n, setN] = useState([]);
  useEffect(() => { if (akun) list('notifikasi', [Query.equal('id_pengguna', akun.$id), Query.orderDesc('$createdAt'), Query.limit(10)]).then(setN).catch(() => {}); }, [akun]);
  const baca = async (x) => { await ubah('notifikasi', x.$id, { sudah_dibaca: true }); setN(n.map((y) => (y.$id === x.$id ? { ...y, sudah_dibaca: true } : y))); };

  if (memuat) return <main className="wrap" />;
  if (!akun) return <main className="wrap"><p className="kosong"><Link className="link" href="/masuk">Masuk</Link> untuk melihat pesananmu.</p></main>;
  return (
    <main className="wrap split s2">
      <section><h2>Riwayat pesanan</h2><Pesanan uid={akun.$id} sebagai="pembeli" /></section>
      <aside><h3>Pemberitahuan</h3>
        {!n.length && <p className="muted">Belum ada pemberitahuan.</p>}
        <div className="stack">{n.map((x) => (
          <div key={x.$id} className="card pad" style={{ opacity: x.sudah_dibaca ? .6 : 1 }}>
            <b>{x.judul}</b><p style={{ margin: '4px 0' }}><small>{x.pesan}</small></p>
            {!x.sudah_dibaca && <button className="link" onClick={() => baca(x)}>Tandai dibaca</button>}
          </div>))}
        </div>
      </aside>
    </main>
  );
}
