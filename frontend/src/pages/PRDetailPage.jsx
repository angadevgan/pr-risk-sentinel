import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPRDetail } from '../lib/api.js';
import RiskBadge from '../components/RiskBadge.jsx';

const RISK_COLOR = { low: '#22C55E', medium: '#EAB308', high: '#F97316', critical: '#EF4444' };
const FEAT = {
  diffSize:        { label: 'Diff Size',        desc: 'Large diffs are harder to review — more surface area for bugs' },
  sensitivePaths:  { label: 'Sensitive Paths',  desc: 'Touches auth, payments, config, migrations, or infra code' },
  testRatio:       { label: 'Test Coverage',    desc: 'Tests added proportional to the change size' },
  complexityDelta: { label: 'Complexity',       desc: 'Change in cyclomatic complexity across modified files' },
  authorHistory:   { label: 'Author History',   desc: "Author's historical revert rate on this repo" },
  timing:          { label: 'Timing Risk',      desc: 'Late-night and Friday deploys get less careful review' },
};

function ScoreRing({ score, level }) {
  const r = 44, circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 150); }, []);
  const color = RISK_COLOR[level] || '#22C55E';
  const offset = circ - (score / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1C1C21" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={animated ? offset : circ}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 26, fontWeight: 600, color: '#FAFAFA', lineHeight: 1 }}>{Number(score).toFixed(0)}</span>
        <span className="mono" style={{ fontSize: 11, color: '#52525B', marginTop: 3 }}>/ 100</span>
      </div>
    </div>
  );
}

function FeatureRow({ featureKey, data }) {
  const meta = FEAT[featureKey] || { label: featureKey, desc: '' };
  const pct = Math.round((data.rawScore || 0) * 100);
  const [w, setW] = useState(0);
  useEffect(() => { setTimeout(() => setW(pct), 300); }, [pct]);
  const color = pct >= 70 ? '#EF4444' : pct >= 45 ? '#F97316' : pct >= 20 ? '#EAB308' : '#22C55E';

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid #1C1C21' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#FAFAFA', marginBottom: 2 }}>{meta.label}</div>
          <div style={{ fontSize: 12, color: '#52525B' }}>{meta.desc}</div>
        </div>
        <div className="mono" style={{ fontSize: 12, textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <span style={{ color, fontWeight: 600 }}>+{data.contributionPoints?.toFixed(1)}</span>
          <span style={{ color: '#3F3F46' }}>pts</span>
        </div>
      </div>
      <div style={{ height: 4, background: '#1C1C21', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 2, transition: 'width .7s cubic-bezier(.4,0,.2,1)', boxShadow: `0 0 8px ${color}50` }} />
      </div>
    </div>
  );
}

export default function PRDetailPage() {
  const { prId } = useParams();
  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getPRDetail(prId).then(setPr).finally(() => setLoading(false)); }, [prId]);

  if (loading) return <div className="mono" style={{ fontSize: 13, color: '#3F3F46', padding: '80px 0', textAlign: 'center' }}>Loading analysis...</div>;
  if (!pr) return <div className="mono" style={{ fontSize: 13, color: '#3F3F46', padding: '80px 0', textAlign: 'center' }}>PR not found.</div>;

  const breakdown = pr.breakdown || {};
  const sensitiveHits = pr.sensitive_paths_hit || [];
  const touchedFiles = pr.touched_files || [];
  const sorted = Object.entries(breakdown).sort((a, b) => b[1].contributionPoints - a[1].contributionPoints);

  return (
    <div style={{ maxWidth: 720 }} className="slide-in">
      {/* Back */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52525B', textDecoration: 'none', marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 10L5 7L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        All repositories
      </Link>

      {/* Score card */}
      <div className="card" style={{ padding: 28, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {pr.risk_level && <ScoreRing score={pr.score} level={pr.risk_level} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, color: '#52525B', marginBottom: 8 }}>
              #{pr.pr_number} · {pr.author_login}
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#FAFAFA', marginBottom: 12, lineHeight: 1.3 }}>{pr.title}</h1>
            {pr.risk_level && <RiskBadge level={pr.risk_level} score={pr.score} />}
          </div>
        </div>

        {/* Meta pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20, paddingTop: 20, borderTop: '1px solid #1C1C21' }}>
          {[
            { label: 'additions', value: `+${pr.additions}`, color: '#22C55E' },
            { label: 'deletions', value: `-${pr.deletions}`, color: '#EF4444' },
            { label: 'files', value: pr.changed_files, color: '#06B6D4' },
            { label: 'tests modified', value: pr.has_test_changes ? 'yes ✓' : 'no ✗', color: pr.has_test_changes ? '#22C55E' : '#F97316' },
            { label: 'model', value: pr.model_version, color: '#7C3AED' },
          ].map(s => (
            <div key={s.label} className="mono" style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #222228', background: '#111114' }}>
              <span style={{ color: s.color, fontWeight: 600 }}>{s.value}</span>
              <span style={{ color: '#3F3F46', marginLeft: 5 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitive paths alert */}
      {sensitiveHits.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid #F9731630', background: '#F973160A', marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 2L14 13H2L8 2Z" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 7V9M8 11V11.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F97316', marginBottom: 3 }}>Sensitive paths detected</div>
            <div style={{ fontSize: 12, color: '#A1A1AA' }}>{[...new Set(sensitiveHits.map(h => h.label))].join(', ')}</div>
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="card" style={{ padding: '4px 24px 4px', marginBottom: 12 }}>
        <div style={{ padding: '16px 0 12px', borderBottom: '1px solid #1C1C21' }}>
          <div className="mono" style={{ fontSize: 11, color: '#52525B', textTransform: 'uppercase', letterSpacing: '.08em' }}>Risk Breakdown</div>
          <div style={{ fontSize: 12, color: '#52525B', marginTop: 4 }}>Weighted sum of 6 signals · sorted by contribution</div>
        </div>
        {sorted.map(([key, data]) => <FeatureRow key={key} featureKey={key} data={data} />)}
      </div>

      {/* Files */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="mono" style={{ fontSize: 11, color: '#52525B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
          Files Changed ({touchedFiles.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {touchedFiles.map(f => {
            const sensitive = sensitiveHits.some(h => h.filePath === f);
            return (
              <div key={f} className="mono" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: sensitive ? '#F97316' : '#71717A' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="1" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 4H8M4 6H8M4 8H6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                {f}
                {sensitive && <span style={{ fontSize: 10, color: '#F97316', padding: '1px 6px', borderRadius: 4, border: '1px solid #F9731630', background: '#F973160A' }}>sensitive</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
