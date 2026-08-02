import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Activity, TrendingUp, AlertTriangle, RefreshCcw, FileText, FileDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { getRiskMetrics, getRiskScore, getPortfolioHealth } from '../services/api';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#1e293b] rounded-lg ${className}`} />;
}

export default function RiskHealthDiagnosticsPage({ portfolioId }: { portfolioId: number }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [riskScore, setRiskScore] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchAll = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [r, s, h] = await Promise.all([
        getRiskMetrics(portfolioId).then(res => res.data).catch(() => null),
        getRiskScore(portfolioId).then(res => res.data).catch(() => null),
        getPortfolioHealth(portfolioId).then(res => res.data).catch(() => null),
      ]);
      setMetrics(r);
      setRiskScore(s);
      setHealth(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!fetchingRef.current) {
      fetchingRef.current = true;
      fetchAll();
    }
  }, [portfolioId]);

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(['Metric', 'Value']);
    if (metrics) {
      rows.push(['Sharpe Ratio', String(metrics.sharpe_ratio)]);
      rows.push(['Volatility %', String(metrics.volatility_pct)]);
      rows.push(['Beta', String(metrics.beta)]);
      rows.push(['VaR 95%', String(metrics.var_95)]);
      rows.push(['Diversification', String(metrics.diversification_score)]);
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-health-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // fallback: print view
    window.print();
  };

  const recommendations = () => {
    const recs: { badge: string; icon?: React.ReactNode; text: string; tone?: 'warn'|'info'|'good' }[] = [];
    if (metrics) {
      if (metrics.diversification_score < 40 || metrics.sector_concentrated) {
        recs.push({ badge: 'Concentration Risk', icon: <AlertTriangle className="h-4 w-4" />, text: `Rebalance ${Object.entries(metrics.sector_allocation || {}).sort((a,b)=> (b[1] as number)-(a[1] as number))[0][0]} from ${(Object.entries(metrics.sector_allocation || {}).sort((a,b)=> (b[1] as number)-(a[1] as number))[0][1] as number).toFixed(1)}% to under 40% to lower portfolio volatility and improve health.`, tone: 'warn' });
      }
      if (metrics.sharpe_ratio < 0) {
        recs.push({ badge: 'Return Optimization', icon: <TrendingUp className="h-4 w-4" />, text: 'Consider trimming underperforming positions and reallocating to higher risk-adjusted return assets to improve Sharpe.', tone: 'info' });
      }
      if (riskScore && riskScore.score >= 70) {
        recs.push({ badge: 'High Risk', icon: <ShieldAlert className="h-4 w-4" />, text: 'Portfolio risk score is high; consider reducing leverage or concentration.', tone: 'warn' });
      }
    }
    if (recs.length === 0) recs.push({ badge: 'No issues detected', icon: <Activity className="h-4 w-4" />, text: 'Diagnostics are within expected ranges.', tone: 'good' });
    return recs;
  };

  if (loading || (!metrics && !health && !riskScore)) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-14 w-full mb-3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sectorEntries = (metrics?.sector_allocation ? Object.entries(metrics.sector_allocation).map(([s, v]) => [s, Number(v)]) : []) as [string, number][];
  sectorEntries.sort(([,a],[,b]) => a < b ? 1 : a > b ? -1 : 0);

  return (
    <div className="space-y-6">
      {/* Executive header banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-sm text-slate-400">Portfolio Health</div>
            <div className="text-2xl font-bold text-white">{health?.grade ?? '-'} — {health?.health_score ?? '-'} / 100</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Composite Risk</div>
            <div className="text-2xl font-bold text-white">{riskScore?.score ?? '-'} / 100</div>
            <div className="text-xs text-slate-400">{riskScore?.level ?? ''}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="flex items-center gap-2 bg-[#185FA5] px-4 py-2 rounded-xl text-white hover:bg-[#2579cc]">
            <RefreshCcw className="h-4 w-4" /> Recompute Diagnostics
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-100 border border-slate-700">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-100 border border-slate-700">
            <FileDown className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Diagnostic matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-sm text-slate-400">Risk-Adjusted Return</div>
          <div className="text-3xl font-semibold text-white">{metrics?.sharpe_ratio ?? '-'}</div>
          <div className="text-xs text-slate-400 mt-2">Sharpe Quality: {(metrics?.sharpe_quality ?? Math.max(0, Math.round((metrics?.sharpe_ratio ?? 0) * 10))).toFixed(1)}/100 — {metrics?.sharpe_ratio < 0 ? 'Poor / Suboptimal' : 'Acceptable'}</div>
          <div className="text-xs text-slate-400 mt-3">Returns are underperforming the risk-free rate for the given volatility.</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-sm text-slate-400">Market Correlation & Volatility</div>
          <div className="flex items-baseline gap-4">
            <div className="text-2xl font-semibold text-white">{metrics?.volatility_pct ?? '-'}%</div>
            <div className="text-xl font-semibold text-white">Beta: {metrics?.beta ?? '-'}</div>
          </div>
          <div className="text-xs text-slate-400 mt-2">Beta {metrics?.beta} — Market Correlated</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-sm text-slate-400">Downside Risk & Value at Risk</div>
          <div className="text-3xl font-semibold text-white">₹{Math.abs(metrics?.var_95 ?? 0).toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-400 mt-2">Maximum expected 1-day loss with 95% statistical confidence.</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-sm text-slate-400">Diversification & Concentration</div>
          <div className="text-2xl font-semibold text-white">{metrics?.diversification_score ?? '-'}%</div>
          <div className="text-xs text-slate-400 mt-2">Primary Concentration: {sectorEntries[0] ? `${sectorEntries[0][0]} — ${sectorEntries[0][1]}%` : '—'}</div>
        </div>
      </div>

      {/* Sector exposure */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex gap-6">
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="text-sm text-slate-400 mb-3">Sector Distribution</div>
          <div style={{ height: 220 }}>
            {/* Simple donut-like representation using a small chart if available */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220} aspect={undefined}>
              <LineChart data={sectorEntries.map(([s, v]) => ({ name: s, value: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                <XAxis dataKey="name" />
                <YAxis />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-sm text-slate-400 mb-3">Sectors</div>
          <div className="space-y-3">
            {sectorEntries.map(([sector, pct], i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{sector}</span>
                  <span className="font-medium text-slate-200">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 40 ? '#f59e0b' : '#34d399' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI remediation */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="text-sm text-slate-400 mb-3">Actionable Risk Recommendations</div>
        <div className="space-y-3">
          {recommendations().map((r, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${r.tone === 'warn' ? 'bg-amber-900/30' : r.tone === 'good' ? 'bg-emerald-900/20' : 'bg-slate-800/30'}`}>
              <div className="text-slate-100 font-semibold">{r.badge}</div>
              <div className="text-slate-300 text-sm">{r.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
