'use client';
import { useState, useEffect } from 'react';

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
  inputPlaceholder = '',
  tombolOk = 'Ya, lanjutkan',
  tombolBatal = 'Batal',
  warnaOk = 'sun',
  onOk,
  onBatal,
  busy = false,
}) {
  const [val, setVal] = useState(inputDefault !== undefined ? inputDefault : '');

  useEffect(() => {
    setVal(inputDefault !== undefined ? inputDefault : '');
  }, [inputDefault]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (tipe === 'input' && (val === '' || val === null)) return;
    onOk(val);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onBatal}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <b style={{ fontSize: '1.1rem', color: '#0f172a', lineHeight: 1.3 }}>{judul}</b>
          <button
            type="button"
            onClick={onBatal}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0 4px',
              marginTop: -4,
            }}
          >
            ✕
          </button>
        </div>

        {pesan && (
          <p style={{ margin: '0 0 16px', color: '#475569', fontSize: '0.95rem', lineHeight: 1.55 }}>
            {pesan}
          </p>
        )}

        {tipe === 'input' && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
            <div className="field">
              {inputLabel && <label style={{ fontWeight: 600, color: '#334155' }}>{inputLabel}</label>}
              {inputType === 'textarea' ? (
                <textarea
                  rows={3}
                  required
                  placeholder={inputPlaceholder}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                  autoFocus
                />
              ) : (
                <input
                  type={inputType}
                  required
                  placeholder={inputPlaceholder}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  style={{ width: '100%' }}
                  autoFocus
                />
              )}
            </div>
          </form>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          {tipe !== 'pesan' && (
            <button
              type="button"
              className="btn sm out"
              onClick={onBatal}
              disabled={busy}
              style={{ minWidth: 70 }}
            >
              {tombolBatal}
            </button>
          )}
          <button
            type="button"
            className={`btn sm ${warnaOk}`}
            onClick={handleSubmit}
            disabled={busy || (tipe === 'input' && String(val).trim() === '')}
            style={{ minWidth: 80 }}
          >
            {busy ? 'Memproses…' : tombolOk}
          </button>
        </div>
      </div>
    </div>
  );
}
