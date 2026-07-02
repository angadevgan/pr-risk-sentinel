export default function RiskBadge({ level, score, showScore = true }) {
  return (
    <span className={`risk-pill risk-${level}`}>
      <span className={`dot dot-pulse`} style={{ background: level === 'low' ? '#22C55E' : level === 'medium' ? '#EAB308' : level === 'high' ? '#F97316' : '#EF4444' }} />
      {level?.toUpperCase()}
      {showScore && score != null && <span style={{ opacity: .6 }}>· {Number(score).toFixed(1)}</span>}
    </span>
  );
}
