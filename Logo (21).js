export default function Logo({ size = 30 }) {
  return (
    <div className="mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 18 18">
        <path d="M2 13 L6 8 L9.5 11 L16 4" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="4" r="1.8" fill="var(--accent)" />
      </svg>
    </div>
  );
}
