// Ilustrasi lapak untuk hero beranda (SVG murni, tanpa gambar eksternal)
export default function Lapak() {
  const warna = (i) => (i % 2 ? '#FFF8E6' : '#FF933E');
  return (
    <svg className="art" viewBox="0 0 440 400" role="img" aria-label="Ilustrasi lapak bertenda oranye krem berisi jeruk, toples, dan tas belanja">
      <ellipse cx="220" cy="382" rx="195" ry="12" fill="#22313F" opacity=".16" />
      <rect x="66" y="60" width="12" height="322" fill="#22313F" />
      <rect x="362" y="60" width="12" height="322" fill="#22313F" />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} fill={warna(i)} stroke="#22313F" strokeWidth="3">
          <rect x={60 + 32 * i} y="36" width="32" height="68" stroke="none" />
          <circle cx={76 + 32 * i} cy="104" r="16" />
        </g>
      ))}
      <rect x="60" y="33" width="320" height="6" fill="#22313F" />
      <g stroke="#22313F" strokeWidth="3"><line x1="188" y1="120" x2="188" y2="140" /><line x1="252" y1="120" x2="252" y2="140" /></g>
      <rect x="160" y="140" width="120" height="40" rx="8" fill="#FFF8E6" stroke="#22313F" strokeWidth="3" />
      <text x="220" y="168" textAnchor="middle" fontFamily="Bricolage Grotesque,sans-serif" fontWeight="800" fontSize="24" fill="#B8500A">KWU</text>
      {[[98, '5rb'], [318, '12rb']].map(([x, t]) => (
        <g key={t} className="tagswing">
          <line x1={x + 6} y1="120" x2={x + 6} y2="150" stroke="#22313F" strokeWidth="2" />
          <path d={`M${x - 12} 150h50l10 15-10 15h-50z`} fill="#73A5CA" stroke="#22313F" strokeWidth="2.5" />
          <text x={x + 14} y="171" textAnchor="middle" fontFamily="Bricolage Grotesque,sans-serif" fontWeight="800" fontSize="14" fill="#22313F">{t}</text>
        </g>
      ))}
      <rect x="62" y="274" width="316" height="106" fill="#22313F" />
      <rect x="50" y="260" width="340" height="18" rx="5" fill="#73A5CA" stroke="#22313F" strokeWidth="3" />
      <text x="220" y="338" textAnchor="middle" fontFamily="Bricolage Grotesque,sans-serif" fontWeight="800" fontSize="30" fill="#FFCB56">LapaKWU</text>
      <rect x="78" y="212" width="104" height="48" rx="4" fill="#FFCB56" stroke="#22313F" strokeWidth="3" />
      {[100, 130, 160].map((cx, i) => <circle key={cx} cx={cx} cy={i % 2 ? 204 : 208} r="16" fill="#FF933E" stroke="#22313F" strokeWidth="2.5" />)}
      {[[206, '#FF933E'], [248, '#73A5CA'], [290, '#FFCB56']].map(([x, c]) => (
        <g key={x}><rect x={x} y="218" width="34" height="42" rx="7" fill="#FFF8E6" stroke="#22313F" strokeWidth="3" /><rect x={x - 2} y="208" width="38" height="12" rx="4" fill={c} stroke="#22313F" strokeWidth="2.5" /></g>
      ))}
      <rect x="334" y="214" width="40" height="46" rx="6" fill="#FFE9A9" stroke="#22313F" strokeWidth="3" />
      <path d="M343 214c0-16 22-16 22 0" fill="none" stroke="#22313F" strokeWidth="3" />
    </svg>
  );
}
