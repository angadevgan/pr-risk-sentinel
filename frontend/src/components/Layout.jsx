import { Outlet, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Layout() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0B' }}>
      <nav style={{
        borderBottom: '1px solid #1C1C21',
        background: '#0A0A0B',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="7" cy="7" r="2" fill="white"/>
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#FAFAFA', letterSpacing: '-.01em' }}>PR Risk Sentinel</span>
            <span className="mono" style={{ fontSize: 11, color: '#3F3F46', marginLeft: 2 }}>v1</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="mono" style={{ fontSize: 11, color: '#3F3F46' }}>
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111114', border: '1px solid #222228', borderRadius: 7, padding: '5px 10px' }}>
              <span className="dot dot-pulse" style={{ background: '#22C55E' }} />
              <span className="mono" style={{ fontSize: 11, color: '#22C55E' }}>live</span>
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <Outlet />
      </main>
    </div>
  );
}
