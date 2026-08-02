import { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { getBenchmarkComparison } from '../services/api';

interface BenchmarkProps {
  portfolioId: number;
}

export function BenchmarkTab({ portfolioId }: BenchmarkProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmark = async () => {
    setLoading(true);
    setError(null);
    const toastId = toast.loading('Fetching NIFTY 50 comparison...');

    try {
      const res = await getBenchmarkComparison(portfolioId);
      const responseData = res.data;
      if (!responseData?.data || responseData.data.length === 0) {
        throw new Error('No benchmark data returned');
      }
      console.log('Benchmark sample:', responseData.data[0]);
      setData(responseData);
      setFetched(true);
      toast.success('Benchmark comparison ready!', { id: toastId });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Could not fetch benchmark data';
      setError(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (portfolioId) {
      fetchBenchmark();
    }
  }, [portfolioId]);

  const chartData = useMemo(() => {
    return data?.data?.filter((d: any) => d.portfolio != null && d.nifty != null && d.nifty > 0) ?? [];
  }, [data]);

  if (!fetched) {
    return (
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Portfolio vs NIFTY 50</h2>
            <p className="text-sm text-slate-400 mt-1">Compare your portfolio performance against India's benchmark index over 6 months. See your alpha.</p>
          </div>
          <button
            onClick={fetchBenchmark}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#185FA5', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Loading…' : 'Compare vs NIFTY 50'}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '12px', padding: '20px' }}>
        <div className="text-sm text-rose-200 font-semibold mb-3">Benchmark data error</div>
        <div className="text-sm text-slate-300 mb-4">{error}</div>
        <button
          onClick={() => { setFetched(false); setData(null); setError(null); }}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: '#185FA5', color: 'white' }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <div className="text-sm text-slate-300">No valid benchmark chart data is available.</div>
      </div>
    );
  }

  if (fetched && data) {
    console.log('First data point:', data.data[0]);
    console.log('Nifty sample values:', data.data.slice(0, 5).map((d: any) => d.nifty));
  }

  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid #1e293b' }}>
          <div className="text-xs text-slate-400 uppercase tracking-widest">Your portfolio return</div>
          <div className={`text-2xl font-semibold ${data.portfolio_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.portfolio_return >= 0 ? `+${data.portfolio_return}%` : `${data.portfolio_return}%`}
          </div>
          <div className="text-xs text-slate-500">Last 6 months</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid #1e293b' }}>
          <div className="text-xs text-slate-400 uppercase tracking-widest">NIFTY 50 return</div>
          <div className={`text-2xl font-semibold ${data.nifty_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.nifty_return >= 0 ? `+${data.nifty_return}%` : `${data.nifty_return}%`}
          </div>
          <div className="text-xs text-slate-500">Last 6 months</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: data.outperformed ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', border: data.outperformed ? '1px solid rgba(22,163,74,0.2)' : '1px solid rgba(220,38,38,0.2)' }}>
          <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: data.outperformed ? '#22c55e' : '#f43f5e' }}>
            {data.outperformed ? '✅ Outperforming NIFTY' : '⚠️ Underperforming NIFTY'}
          </div>
          <div className={`text-2xl font-semibold ${data.outperformed ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.alpha >= 0 ? `+${data.alpha}%` : `${data.alpha}%`}
          </div>
          <div className="text-xs" style={{ color: data.outperformed ? '#22c55e' : '#f43f5e' }}>Alpha</div>
        </div>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <div className="flex items-center gap-4 mb-4 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span style={{ width: 20, height: 3, background: '#3b82f6', display: 'inline-block' }} />
            Your Portfolio
          </div>
          <div className="flex items-center gap-2">
            <span style={{ width: 20, height: 3, background: '#f97316', display: 'inline-block', borderRadius: 999, border: '1px dashed #f97316' }} />
            NIFTY 50
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(d) => {
                const date = new Date(d);
                return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
              }}
              interval={Math.floor(chartData.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v}`}
              width={35}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: any, name?: string | number) => [
                `${Number(value).toFixed(2)} pts`,
                name === 'portfolio' ? 'Your Portfolio' : 'NIFTY 50'
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            />
            <Legend formatter={(value) => value === 'portfolio' ? 'Your Portfolio' : 'NIFTY 50'} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            <ReferenceLine y={100} stroke="#334155" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="nifty"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#f97316' }}
              strokeDasharray="5 3"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button
        onClick={() => { setFetched(false); setData(null); }}
        className="text-xs text-center w-full mt-2"
        style={{ color: '#64748b' }}
      >
        ↺ Refresh
      </button>
    </div>
  );
}
