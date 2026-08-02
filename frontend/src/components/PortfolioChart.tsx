import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  portfolioValue?: number;
  niftyValue?: number;
}

interface PortfolioChartProps {
  rawHistoryData: ChartDataPoint[];
}

export const PortfolioChart: React.FC<PortfolioChartProps> = ({ rawHistoryData }) => {
  const [compareNifty, setCompareNifty] = useState<boolean>(false);

  const chartData = useMemo(() => {
    if (!rawHistoryData || rawHistoryData.length === 0) return [];

    // Find first valid portfolio value for normalization
    const firstValidPortfolio = rawHistoryData.find(d => (d.portfolioValue || 0) > 0);
    const initialPortfolio = firstValidPortfolio?.portfolioValue ?? 1;

    return rawHistoryData.map((item) => {
      const rawPortfolio = item.portfolioValue ?? 0;
      // niftyValue from benchmark is already indexed to 100 by backend — use directly
      const rawNifty = item.niftyValue ?? null;

      if (compareNifty) {
        return {
          date: item.date,
          // Normalize portfolio to 100 base
          portfolio: initialPortfolio > 0
            ? Number(((rawPortfolio / initialPortfolio) * 100).toFixed(2))
            : 0,
          // Nifty is already normalized to 100 by backend — use as-is
          nifty: rawNifty != null && rawNifty > 0 ? rawNifty : null,
          rawPortfolio,
          rawNifty,
        };
      }

      return {
        date: item.date,
        portfolio: rawPortfolio,
        rawPortfolio,
        nifty: null,
        rawNifty,
      };
    });
  }, [rawHistoryData, compareNifty]);

  const hasNiftyData = chartData.some(d => d.nifty != null && d.nifty > 0);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {compareNifty ? 'Portfolio vs NIFTY 50 — indexed to 100' : 'Portfolio value — last 6 months'}
          </h2>
          <p className="text-xs text-slate-400">Performance chart</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50 w-fit">
          <input
            type="checkbox"
            checked={compareNifty}
            onChange={(e) => setCompareNifty(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
          />
          <span className="text-xs font-medium text-slate-300">Compare vs NIFTY 50</span>
        </label>
      </div>

      {compareNifty && (
  <div className="flex items-center gap-6 mb-4">
  <div className="flex items-center gap-2 text-xs text-slate-400">
    <div className="w-6 border-t-[2.5px] border-solid border-blue-500 my-auto shrink-0" />
    Your Portfolio
  </div>
  <div className="flex items-center gap-2 text-xs text-slate-400">
    <div className="w-6 border-t-2 border-dashed border-orange-400 shrink-0" />
    NIFTY 50
  </div>
  {!hasNiftyData && (
    <div className="text-xs text-amber-400">
      ⚠️ NIFTY data loading...
    </div>
  )}
</div>
)}


      <div className="w-full h-[320px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(d) => {
                const date = new Date(d);
                return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
              }}
              interval={Math.floor(chartData.length / 6)}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              domain={compareNifty ? ['auto', 'auto'] : [0, 'auto']}
              tickFormatter={(val) =>
                compareNifty ? `${val}` : `₹${(val / 1000).toFixed(0)}k`
              }
              width={45}
            />
            <Tooltip content={<CustomChartTooltip compareNifty={compareNifty} />} />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#3b82f6' }}
              name="Your Portfolio"
              connectNulls={true}
            />
            {compareNifty && (
              <Line
                type="monotone"
                dataKey="nifty"
                stroke="#fb923c"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 5, fill: '#fb923c' }}
                name="NIFTY 50"
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const CustomChartTooltip = ({ active, payload, label, compareNifty }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
      <p className="text-slate-400 mb-2 font-medium">
        {new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      {payload.map((entry: any, index: number) => {
        if (entry.value == null) return null;
        const isPortfolio = entry.dataKey === 'portfolio';
        const color = isPortfolio ? 'text-blue-400' : 'text-orange-400';
        const rawVal = isPortfolio ? entry.payload.rawPortfolio : entry.payload.rawNifty;

        return (
          <div key={index} className="flex items-center justify-between gap-6 my-1">
            <span className={`font-semibold ${color}`}>{entry.name}:</span>
            <span className="font-mono text-slate-100 font-medium">
              {compareNifty
                ? `${Number(entry.value).toFixed(2)} pts`
                : `₹${rawVal?.toLocaleString('en-IN')}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};