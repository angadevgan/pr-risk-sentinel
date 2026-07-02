import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import RiskBadge from './RiskBadge.jsx';

export default function PRTable({ prs, newPrId }) {
  if (prs.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 13, color: '#3F3F46' }}>$ awaiting pull requests...</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Pull Request</th>
            <th>Author</th>
            <th>Changes</th>
            <th>Opened</th>
            <th>Risk Score</th>
            <th style={{ width: 32 }} />
          </tr>
        </thead>
        <tbody>
          {prs.map(pr => (
            <tr key={pr.id} style={pr.id === newPrId ? { animation: 'slideIn .4s ease-out' } : {}}>
              <td>
                <Link to={`/prs/${pr.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ fontWeight: 500, color: '#FAFAFA', fontSize: 13, marginBottom: 2 }}>{pr.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: '#52525B' }}>#{pr.pr_number}</div>
                </Link>
              </td>
              <td><span className="mono" style={{ fontSize: 12, color: '#71717A' }}>{pr.author_login}</span></td>
              <td>
                <span className="mono" style={{ fontSize: 12 }}>
                  <span style={{ color: '#22C55E' }}>+{pr.additions}</span>
                  <span style={{ color: '#3F3F46', margin: '0 3px' }}>/</span>
                  <span style={{ color: '#EF4444' }}>-{pr.deletions}</span>
                  <span style={{ color: '#52525B', marginLeft: 6 }}>{pr.changed_files}f</span>
                </span>
              </td>
              <td><span style={{ fontSize: 12, color: '#52525B' }}>{pr.opened_at ? formatDistanceToNow(new Date(pr.opened_at), { addSuffix: true }) : '—'}</span></td>
              <td>{pr.risk_level ? <RiskBadge level={pr.risk_level} score={pr.score} /> : <span className="mono" style={{ fontSize: 11, color: '#3F3F46' }}>pending</span>}</td>
              <td>
                <Link to={`/prs/${pr.id}`} style={{ color: '#3F3F46', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 10L9 7L5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
