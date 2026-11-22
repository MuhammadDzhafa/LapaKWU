export default function StatusMuat({ teks = 'Memuat halaman…' }) {
  return (
    <div className="status-muat" role="status">
      <span className="muted">{teks}</span>
      <div className="skel-box" aria-hidden="true" />
    </div>
  );
}
