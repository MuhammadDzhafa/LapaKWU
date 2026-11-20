'use client';

import Link from 'next/link';
import { useSaya } from '@/components/Shell';
import Pesanan from '@/components/Pesanan';

export default function PesananSaya() {
  const { akun, memuat } = useSaya();

  if (memuat) return <main className="wrap" />;
  if (!akun) return <main className="wrap"><p className="kosong"><Link className="link" href="/masuk">Masuk</Link> untuk melihat pesananmu.</p></main>;

  return <main className="wrap">
    <h2>Riwayat pesanan</h2>
    <Pesanan uid={akun.$id} sebagai="pembeli" />
  </main>;
}
