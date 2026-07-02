import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRepoPRs, getRepoAnalytics, getRepos } from '../lib/api.js';
import { useRepoSocket } from '../hooks/useRepoSocket.js';
import PRTable from '../components/PRTable.jsx';
import { RiskTrendChart, RiskDistributionChart, HotspotFilesChart } from '../components/AnalyticsCharts.jsx';

const FILTERS = ['all', 'low', 'medium', 'high', 'critical'];

export default function RepoDashboardPage() {
  const { repoId } = useParams();
  const [prs, setPrs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [newPrId, setNewPrId] = useState(null);
  const [repoName, setRepoName] = useState('');

  const loadData = useCallback(() => {
    const params = filter !== 'all' ? { riskLevel: filter } : {};
    Promise.all([getRepoPRs(repoId, params), getRepoAnalytics(repoId), getRepos()])
      .then(([prsData, analyticsData, reposData]) => {
        setPrs(prsData);
        setAnalytics(analyticsData);
        const repo = reposData.find(r => String(r.id) === String(repoId));
        if (repo) setRepoName(repo.full_name);
        setLoading(false);
      });
  }, [repoId, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const { connected } = useRepoSocket(repoId, (newPR) => {
    setPrs(prev => {
      const exists = prev.find(p => p.pr_number === newPR.pr_number);
      if (exists) return prev.map(p => p.pr_number === newPR.pr_number ? { ...p, ...newPR } : p);
      setNewPrId(newPR.id);
      setTimeout(() => setNewPrId(null), 2000);
      return [newPR, ...prev];
    });
    getRepoAnalytics(repoId).then(setAnalytics);
  });

  const highRisk = prs.filter(p => ['high', 'critical'].includes(p.risk_level)).length;
  const avgScore = prs.length > 0 ? (prs.reduce((a, p) => a + (p.score || 0), 0) / prs.length).toFixed(1) : '—';

  if (loading) return (
    <div className="mono" style={{ fontSize: 13, color: '#3F3F46', padding: '80px 0', textAlign: 'center' }}>Loading...</div>
  );

  return (
    <div className="slide-in">
      {/* Back */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52525B', textDecoration: 'none', marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 10L5 7L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        All repositories
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Repository Analysis</div>
          <h1 className="mono" style={{ fontSize: 22, fontWeight: 600, color: '#FAFAFA' }}>{repoName || `repo/${repoId}`}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${connected ? '#22C55E30' : '#222228'}`, background: connected ? '#22C55E08' : 'transparent' }}>
            <span className="dot dot-pulse" style={{ background: connected ? '#22C55E' : '#3F3F46' }} />
            <span className="mono" style={{ fontSize: 11, color: connected ? '#22C55E' : '#3F3F46' }}>{connected ? 'LIVE' : 'offline'}</span>
          </div>
          <button onClick={loadData} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #222228', background: 'transparent', color: '#52525B', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 2L9 4L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total PRs', value: prs.length, color: '#7C3AED' },
          { label: 'High / Critical', value: highRisk, color: highRisk > 0 ? '#F97316' : '#52525B' },
          { label: 'Avg Score', value: avgScore, color: '#06B6D4' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#52525B', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          <RiskTrendChart trend={analytics.trend} />
          <RiskDistributionChart distribution={analytics.distribution} />
          <HotspotFilesChart files={analytics.hotspotFiles} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 12px', borderRadius: 6, border: `1px solid ${filter === f ? '#7C3AED60' : '#222228'}`,
            background: filter === f ? '#7C3AED15' : 'transparent',
            color: filter === f ? '#8B5CF6' : '#52525B',
            fontSize: 12, fontFamily: '"JetBrains Mono",monospace', cursor: 'pointer',
          }}>{f}</button>
        ))}
        <span className="mono" style={{ fontSize: 11, color: '#3F3F46', marginLeft: 'auto' }}>{prs.length} results</span>
      </div>

      <PRTable prs={prs} newPrId={newPrId} />
    </div>
  );
}
