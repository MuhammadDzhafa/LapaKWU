'use client';
import { useState, useEffect, useId } from 'react';
import PilihKategoriProduk from '@/components/PilihKategoriProduk';
import InputVarian from '@/components/InputVarian';

/**
 * Modal serbaguna pengganti alert(), confirm(), prompt() bawaan browser ("localhost says...").
 * 
 * Props:
 * - judul: string
 * - pesan: string (opsional)
 * - tipe: 'konfirmasi' | 'input' | 'pesan'
 * - inputType: 'text' | 'number' | 'textarea'
 * - inputLabel: string
 * - inputDefault: string | number
 * - inputMin, inputMax: batas untuk input angka
 * - inputPlaceholder: string
 * - tombolOk: string (default: 'Lanjutkan')
 * - tombolBatal: string (default: 'Batal')
 * - warnaOk: string (mis. 'sun', 'red', '')
 * - onOk: (nilaiInput) => void
 * - onBatal: () => void
 * - busy: boolean
 */
export default function Modal({
  judul,
  pesan,
  tipe = 'konfirmasi',
  inputType = 'text',
  inputLabel = 'Keterangan',
  inputDefault = '',
  inputMin,
  inputMax,
  inputPlaceholder = '',
  inputOpsional = false,
  kategori,
  tombolOk = 'Ya, lanjutkan',
  tombolBatal = 'Batal',
  warnaOk = 'sun',
  onOk,
  onBatal,
  busy = false,
}) {
  const [val, setVal] = useState(inputDefault !== undefined ? inputDefault : '');
  const formId = useId();
  const inputId = useId();

  useEffect(() => {
    setVal(inputDefault !== undefined ? inputDefault : '');
  }, [inputDefault]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (busy) return;
    if (tipe === 'input' && !inputOpsional && (val === '' || val === null)) return;
    onOk(val);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={judul} className="modal-back" onClick={onBatal}>
      <div className={['varian', 'kategori'].includes(inputType) ? 'modal-box modal-varian' : 'modal-box'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{judul}</b>
          <button type="button" className="modal-x" aria-label="Tutup" onClick={onBatal}>✕</button>
        </div>

        {pesan && <p className="modal-pesan">{pesan}</p>}

        {tipe === 'input' && (
          <form id={formId} onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
            <div className="field">
              {inputLabel && !['varian', 'kategori'].includes(inputType) && <label htmlFor={inputId}>{inputLabel}</label>}
              {inputType === 'kategori' ? (
                <PilihKategoriProduk nilai={val} onUbah={setVal} nonaktif={busy} kategori={kategori} />
              ) : inputType === 'varian' ? (
                <InputVarian judul={inputLabel} nilai={val} onUbah={setVal} nonaktif={busy} />
              ) : inputType === 'textarea' ? (
                <textarea id={inputId} rows={3} required={!inputOpsional} placeholder={inputPlaceholder} value={val} onChange={(e) => setVal(e.target.value)} style={{ width: '100%', resize: 'vertical' }} autoFocus />
              ) : (
                <input id={inputId} type={inputType} min={inputMin} max={inputMax} required={!inputOpsional} placeholder={inputPlaceholder} value={val} onChange={(e) => setVal(e.target.value)} style={{ width: '100%' }} autoFocus />
              )}
            </div>
          </form>
        )}

        <div className="modal-aksi">
          {tipe !== 'pesan' && (
            <button type="button" className="btn sm out" onClick={onBatal} disabled={busy} style={{ minWidth: 70 }}>{tombolBatal}</button>
          )}
          <button type={tipe === 'input' ? 'submit' : 'button'} form={tipe === 'input' ? formId : undefined}
            className={`btn sm ${warnaOk}`} onClick={tipe === 'input' ? undefined : handleSubmit}
            disabled={busy || (tipe === 'input' && !inputOpsional && String(val).trim() === '')} style={{ minWidth: 80 }}>
            {busy ? 'Memproses…' : tombolOk}
          </button>
        </div>
      </div>
    </div>
  );
}
