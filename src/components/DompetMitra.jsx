'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, rp, tgl } from '@/lib/aw';
import { useSaya } from '@/components/Shell';

export default function DompetMitra({ punyaQris, bukaQris }) {
  const { toast } = useSaya();
  const [data, setData] = useState(null);
  const [nominal, setNominal] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const permintaan = useRef(null);
  const muat = useCallback(async () => {
    setData(await api('/api/dompet', { aksi: 'muat' }));
  }, []);

  useEffect(() => { muat().catch((error) => toast(error.message, true)); }, [muat, toast]);

  async function tarik(e) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true);
    if (permintaan.current?.nominal !== nominal) {
      permintaan.current = { nominal, id: crypto.randomUUID() };
    }
    try {
      await api('/api/dompet', { aksi: 'tarik', nominal: Number(nominal), permintaan: permintaan.current.id });
      permintaan.current = null;
      setNominal('');
      toast('Penarikan diajukan ke admin.');
      await muat();
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <section className="card pad stack">
      <h3>Dompet Mitra</h3>
      <p className="muted">Pembayaran QRIS masuk ke LapaKWU. Saldo bisa ditarik setelah pesanan selesai.</p>
      <div className="wallet-grid">
        <div className="stat"><small>Saldo tersedia</small><b>{data ? rp(data.tersedia) : '—'}</b></div>
        <div className="stat"><small>Saldo pesanan berjalan</small><b>{data ? rp(data.tertahan) : '—'}</b></div>
      </div>
      {punyaQris ? (
        <form onSubmit={tarik} className="stack wallet-form">
          <label htmlFor="nominal-penarikan">Nominal penarikan (minimal Rp10.000)</label>
          <input id="nominal-penarikan" type="number" inputMode="numeric" min={10000} max={Math.floor(data?.tersedia ?? 0)} step={1} value={nominal} onChange={(e) => setNominal(e.target.value)} required disabled={sibuk || (data?.tersedia ?? 0) < 10000} />
          <button className="btn sun" disabled={sibuk || (data?.tersedia ?? 0) < 10000}>{sibuk ? 'Mengajukan…' : 'Ajukan penarikan'}</button>
        </form>
      ) : (
        <div className="msg"><button className="btn sm out" type="button" onClick={bukaQris}>Unggah QRIS pencairan</button></div>
      )}
      <h4>Riwayat pencairan</h4>
      {data && !data.riwayat.length && <p className="kosong">Belum ada pengajuan.</p>}
      {data?.riwayat.map((item) => (
        <div className="row wallet-heading" key={item.id}>
          <span><b>{rp(item.nominal)}</b> · {tgl(item.created_at)}</span>
          <span className="badge" data-s={item.status}>{item.status === 'DICAIRKAN' ? 'Dicairkan' : 'Menunggu admin'}</span>
        </div>
      ))}
    </section>
  );
}
