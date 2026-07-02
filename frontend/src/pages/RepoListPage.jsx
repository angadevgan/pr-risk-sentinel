import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRepos } from '../lib/api.js';

export default function RepoListPage() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getRepos().then(setRepos).finally(() => setLoading(false)); }, []);

  const totalPRs = repos.reduce((a, r) => a + parseInt(r.total_prs || 0), 0);

  return (
    <div className="slide-in">
      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div className="mono" style={{ fontSize: 11, color: '#7C3AED', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Risk Analysis Engine · rule-based-v1
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 600, color: '#FAFAFA', lineHeight: 1.2, letterSpacing: '-.02em', marginBottom: 12 }}>
          Catch risky PRs<br />
          <span style={{ color: '#7C3AED' }}>before they ship.</span>
        </h1>
        <p style={{ fontSize: 14, color: '#71717A', maxWidth: 480, lineHeight: 1.7 }}>
          Real-time scoring across 6 signals — diff size, sensitive paths, test coverage, complexity, author history, and timing. Every score is explainable.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40, maxWidth: 480 }}>
        {[
          { v: repos.length, l: 'Repositories' },
          { v: totalPRs, l: 'PRs analyzed' },
          { v: '6', l: 'Risk signals' },
        ].map(s => (
          <div key={s.l} className="card" style={{ padding: '14px 16px' }}>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: '#7C3AED' }}>{s.v}</div>
            <div style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Repos */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontSize: 11, color: '#52525B', textTransform: 'uppercase', letterSpacing: '.08em' }}>Repositories</span>
        <div style={{ flex: 1, height: 1, background: '#1C1C21' }} />
      </div>

      {loading ? (
        <div className="mono" style={{ fontSize: 13, color: '#3F3F46', padding: '24px 0' }}>Loading...</div>
      ) : repos.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#52525B' }}>No repositories yet. Install the GitHub App or run the backfill script.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {repos.map((repo, i) => (
            <Link key={repo.id} to={`/repos/${repo.id}`} style={{ textDecoration: 'none' }}>
              <div className="card card-interactive" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animationDelay: `${i*50}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#7C3AED15', border: '1px solid #7C3AED30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" stroke="#7C3AED" strokeWidth="1.4" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 13, color: '#FAFAFA', fontWeight: 500 }}>{repo.full_name}</div>
                    <div style={{ fontSize: 12, color: '#52525B', marginTop: 1 }}>{repo.total_prs} pull requests analyzed</div>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12L10 8L6 4" stroke="#3F3F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
