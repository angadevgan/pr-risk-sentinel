import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { format } from 'date-fns';

const RISK_COLORS = { low: '#22C55E', medium: '#EAB308', high: '#F97316', critical: '#EF4444' };

const TT = {
  contentStyle: {
    background: '#18181B',
    border: '1px solid #27272A',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: '"JetBrains Mono", monospace',
    color: '#A1A1AA',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  cursor: { stroke: '#7C3AED', strokeWidth: 1, strokeDasharray: '4 2' },
};

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="mono" style={{ fontSize: 11, color: '#52525B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

export function RiskTrendChart({ trend }) {
  const data = trend.map(t => ({
    week: format(new Date(t.week), 'MMM d'),
    score: Math.round(parseFloat(t.avg_score)),
  }));

  return (
    <Section title="Avg score / week">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#222228" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="week" stroke="#3F3F46" fontSize={11} tickLine={false} axisLine={false}
            fontFamily='"JetBrains Mono", monospace' tick={{ fill: '#52525B' }} />
          <YAxis stroke="#3F3F46" fontSize={11} tickLine={false} axisLine={false}
            domain={[0, 100]} fontFamily='"JetBrains Mono", monospace' tick={{ fill: '#52525B' }} />
          <Tooltip {...TT} />
          <Line type="monotone" dataKey="score" stroke="#7C3AED" strokeWidth={2.5}
            dot={{ r: 4, fill: '#7C3AED', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#7C3AED40' }} />
        </LineChart>
      </ResponsiveContainer>
    </Section>
  );
}

export function RiskDistributionChart({ distribution }) {
  const data = distribution.map(d => ({ name: d.risk_level, value: parseInt(d.count) }));
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <Section title="Distribution">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} startAngle={90} endAngle={450}>
              {data.map(e => <Cell key={e.name} fill={RISK_COLORS[e.name] || '#333'} />)}
            </Pie>
            <Tooltip {...TT} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="dot" style={{ background: RISK_COLORS[d.name] }} />
                <span className="mono" style={{ fontSize: 11, color: '#A1A1AA', textTransform: 'capitalize' }}>{d.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 48, height: 3, background: '#222228', borderRadius: 2, overflow: 'hidden' }}>
                  <div className="bar-grow" style={{ height: '100%', width: `${(d.value / total) * 100}%`, background: RISK_COLORS[d.name], borderRadius: 2 }} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: '#52525B', width: 16, textAlign: 'right' }}>{d.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function HotspotFilesChart({ files }) {
  const data = files.slice(0, 6).map(f => ({
    file: f.file_path.length > 22 ? '…' + f.file_path.slice(-20) : f.file_path,
    full: f.file_path,
    score: Math.round(parseFloat(f.avg_risk_score)),
  }));

  return (
    <Section title="Riskiest files">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#222228" strokeDasharray="0" horizontal={false} />
          <XAxis type="number" stroke="#3F3F46" fontSize={11} tickLine={false} axisLine={false}
            domain={[0, 100]} fontFamily='"JetBrains Mono", monospace' tick={{ fill: '#52525B' }} />
          <YAxis type="category" dataKey="file" stroke="#3F3F46" fontSize={10} width={110}
            tickLine={false} axisLine={false} fontFamily='"JetBrains Mono", monospace' tick={{ fill: '#71717A' }} />
          <Tooltip {...TT} formatter={(v, _, p) => [`${v} risk`, p.payload.full]} />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((e, i) => (
              <Cell key={i} fill={e.score >= 50 ? '#F97316' : e.score >= 25 ? '#EAB308' : '#22C55E'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}
