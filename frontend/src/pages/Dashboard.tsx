import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getPortfolios, createPortfolio, getHoldings, addHolding,
  deleteHolding, getRiskMetrics, getAIAdvice, getMultiplePrices,
  getNewsSentiment, whatIfSimulation, searchStocks, getPortfolioHistory,
  getRiskScore, getBenchmarkComparison, getStockPrice, getPortfolioHealth
} from '../services/api';

interface Holding {
  id: number;
  ticker: string;
  company_name: string;
  quantity: number;
  buy_price: number;
  added_at: string;
}

interface Portfolio {
  id: number;
  name: string;
  created_at: string;
  holdings: Holding[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa', '#f87171', '#34d399'];
const POPULAR_STOCKS = [
  { ticker: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { ticker: 'TCS', name: 'Tata Consultancy Services Ltd' },
  { ticker: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { ticker: 'INFY', name: 'Infosys Ltd' },
  { ticker: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { ticker: 'ITC', name: 'ITC Ltd' }
];

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#1e293b] rounded-lg ${className}`} />;
}

function RiskTab({ portfolioId }: { portfolioId: number }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchRisk = async () => {
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading('Computing risk metrics from 1 year of data...');
    try {
      const res = await getRiskMetrics(portfolioId);
      setMetrics(res.data);
      toast.success('Risk metrics computed!', { id: toastId });
    } catch {
      toast.error('Could not compute risk metrics.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!metrics && !loading && !fetchingRef.current) {
      fetchingRef.current = true;
      fetchRisk();
    }
  }, [portfolioId]);

  if (!metrics) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-500">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900/50 backdrop-blur-md rounded-xl border border-slate-600/30 p-6">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-9 w-32 mb-2" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md rounded-xl border border-slate-600/30 p-5">
           <Skeleton className="h-4 w-32 mb-4" />
           <Skeleton className="h-10 w-24 mb-3" />
           <Skeleton className="h-3 w-full" />
        </div>
        <div className="bg-cyan-900/30 backdrop-blur-md border border-cyan-600/30 rounded-xl p-4 flex flex-col gap-2">
           <Skeleton className="h-3 w-24 bg-cyan-800/30" />
           <Skeleton className="h-4 w-full bg-cyan-800/30" />
        </div>
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-xs text-cyan-400 font-medium bg-cyan-900/30 px-3 py-1.5 rounded-full border border-cyan-600/30">
            <div className="animate-spin h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
            Analyzing 1 year of NSE historical data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Sharpe Ratio', value: metrics.sharpe_ratio, sub: metrics.interpretation.sharpe, color: metrics.sharpe_ratio > 1 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Annual Volatility', value: `${metrics.volatility_pct}%`, sub: metrics.interpretation.volatility, color: metrics.volatility_pct < 15 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Value at Risk (1 day, 95%)', value: `₹${Math.abs(metrics.var_95).toLocaleString('en-IN')}`, sub: 'Max expected daily loss', color: 'text-rose-400' },
              { label: 'Diversification Score', value: `${metrics.diversification_score}%`, sub: metrics.interpretation.diversification, color: metrics.diversification_score > 60 ? 'text-emerald-400' : 'text-amber-400' },
            ].map((m, i) => (
              <div key={i} className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-6 hover:bg-slate-900/60 transition">
                <div className="text-xs text-slate-400 mb-2">{m.label}</div>
                <div className={`text-3xl font-semibold mb-1 ${m.color}`}>{m.value}</div>
                <div className="text-xs text-slate-400">{m.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5 hover:bg-slate-900/60 transition">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-300">Beta vs NIFTY 50</div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                metrics.beta < 0.8 ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-600/30' :
                metrics.beta < 1.2 ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-600/30' :
                'bg-amber-900/40 text-amber-400 border border-amber-600/30'
              }`}>{metrics.interpretation.beta}</span>
            </div>
            <div className="text-3xl font-semibold text-slate-100 mb-1">{metrics.beta}</div>
            <div className="text-xs text-slate-400">
              {metrics.beta < 1
                ? `Your portfolio moves ${((1 - metrics.beta) * 100).toFixed(0)}% less than NIFTY 50 — lower risk, lower potential return.`
                : `Your portfolio moves ${((metrics.beta - 1) * 100).toFixed(0)}% more than NIFTY 50 — higher risk, higher potential return.`}
            </div>
          </div>

          {metrics.sector_allocation && Object.keys(metrics.sector_allocation).length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5 hover:bg-slate-900/60 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-300">Sector allocation</div>
                {metrics.sector_concentrated && (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-900/40 text-amber-400 border border-amber-600/30">⚠️ Concentrated</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(metrics.sector_allocation)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([sector, pct], i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{sector}</span>
                        <span className="font-medium text-slate-200">{pct as number}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="bg-cyan-900/30 backdrop-blur-md border border-cyan-600/30 rounded-2xl p-4">
            <div className="text-xs font-medium text-cyan-300 mb-1">ℹ️ What this means</div>
            <div className="text-sm text-cyan-100">
              Sharpe ratio of <strong>{metrics.sharpe_ratio}</strong> — portfolio earns{' '}
              {metrics.sharpe_ratio > 0 ? 'more' : 'less'} return per unit of risk.
              Beta of <strong>{metrics.beta}</strong> — portfolio is <strong>{metrics.interpretation.beta.toLowerCase()}</strong> vs NIFTY 50.
              Volatility <strong>{metrics.volatility_pct}%</strong> annually is {metrics.interpretation.volatility.toLowerCase()}.
              Max daily loss at 95% confidence: <strong>₹{Math.abs(metrics.var_95).toLocaleString('en-IN')}</strong>.
            </div>
          </div>

          <div className="text-center">
            <button onClick={fetchRisk} disabled={loading} className="text-xs text-slate-400 hover:text-slate-300 disabled:opacity-50 transition">
              {loading ? 'Computing...' : '↺ Recompute'}
            </button>
          </div>
        </div>
      );
}

function AITab({ portfolioId }: { portfolioId: number }) {
  const [advice, setAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchAdvice = async () => {
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading('Analysing your portfolio...');
    try {
      const res = await getAIAdvice(portfolioId);
      setAdvice(res.data);
      toast.success('AI advice ready!', { id: toastId });
    } catch {
      toast.error('Could not fetch AI advice.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const typeStyles: Record<string, string> = {
    warning: 'bg-amber-900/40 backdrop-blur-md border-amber-600/30 text-amber-200',
    info: 'bg-blue-900/40 backdrop-blur-md border-blue-600/30 text-blue-200',
    success: 'bg-green-900/40 backdrop-blur-md border-green-600/30 text-green-200',
  };

  const typeIcons: Record<string, string> = {
    warning: '⚠️', info: '💡', success: '✅',
  };

  return (
    <div>
      {!advice ? (
        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-8 text-center hover:bg-slate-900/60 transition">
          <div className="text-4xl mb-4">🤖</div>
          <div className="text-slate-200 font-medium mb-2">AI Portfolio Advisor</div>
          <div className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Get 3 personalised rebalancing recommendations based on your actual holdings.
          </div>
          <button onClick={fetchAdvice} disabled={loading}
            className="bg-[#185FA5] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#2579cc] disabled:opacity-50 transition shadow-lg shadow-blue-500/20">
            {loading ? 'Analysing...' : '✨ Get AI advice'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5 hover:bg-slate-900/60 transition">
            <div className="text-xs text-slate-400 mb-1">Overall assessment</div>
            <div className="text-sm font-medium text-slate-200">{advice.summary}</div>
          </div>
          {advice.recommendations?.map((r: any, i: number) => (
            <div key={i} className={`rounded-xl border p-5 ${typeStyles[r.type] || typeStyles.info}`}>
              <div className="flex items-center gap-2 font-medium text-sm mb-2">
                <span>{typeIcons[r.type] || '💡'}</span>{r.title}
              </div>
              <div className="text-sm opacity-80">{r.detail}</div>
            </div>
          ))}
          <button onClick={() => setAdvice(null)} className="text-xs text-gray-400 hover:text-gray-600 text-center">
            ↺ Get fresh advice
          </button>
        </div>
      )}
    </div>
  );
}

function NewsTab({ holdings }: { holdings: Holding[] }) {
  const [news, setNews] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const fetchingRef = useRef(false);

  const fetchAllNews = async () => {
    if (loading || !holdings.length) return;
    setLoading(true);
    const toastId = toast.loading('Fetching news sentiment...');
    try {
      const results: Record<string, any> = {};
      for (const h of holdings) {
        const res = await getNewsSentiment(h.ticker);
        results[h.ticker] = res.data;
      }
      setNews(results);
      setFetched(true);
      toast.success('News sentiment loaded!', { id: toastId });
    } catch {
      toast.error('Could not fetch news.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!fetched && !loading && holdings.length > 0 && !fetchingRef.current) {
      fetchingRef.current = true;
      fetchAllNews();
    }
  }, [holdings.length]);

  const sentimentColor: Record<string, string> = {
    positive: 'text-green-400 bg-green-900/40 border border-green-600/30',
    negative: 'text-red-400 bg-red-900/40 border border-red-600/30',
    neutral: 'text-slate-400 bg-slate-700/40 border border-slate-600/30',
  };

  const sentimentIcon: Record<string, string> = {
    positive: '📈', negative: '📉', neutral: '➡️',
  };

  if (!fetched) return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-8 text-center hover:bg-slate-900/60 transition">
      <div className="text-4xl mb-4">📰</div>
      <div className="text-slate-200 font-medium mb-2">News Sentiment Analysis</div>
      <div className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
        Fetch latest news for each holding and flag negative signals before they hit your returns.
      </div>
      <button onClick={fetchAllNews} disabled={loading || !holdings.length}
        className="bg-[#185FA5] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#2579cc] disabled:opacity-50 transition shadow-lg shadow-blue-500/20">
        {loading ? 'Fetching...' : '📰 Fetch news sentiment'}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(news).map(([ticker, data]) => (
        <div key={ticker} className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5 hover:bg-slate-900/60 transition">
          <div className="flex items-center justify-between mb-4">
            <div className="font-medium text-slate-200">{ticker}</div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${sentimentColor[data.sentiment]}`}>
              {sentimentIcon[data.sentiment]} {data.sentiment.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {data.articles?.map((a: any, i: number) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/40 transition">
                <span className={`text-xs mt-0.5 px-2 py-0.5 rounded-full flex-shrink-0 ${sentimentColor[a.sentiment]}`}>
                  {a.sentiment}
                </span>
                <div>
                  <div className="text-sm text-slate-200 leading-snug">{a.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{a.source} · {a.published}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setFetched(false)} className="text-xs text-gray-400 hover:text-gray-600 text-center">
        ↺ Refresh news
      </button>
    </div>
  );
}

function WhatIfTab({ portfolio }: { portfolio: Portfolio | null }) {
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const holdings = portfolio?.holdings || [];
  const total = holdings.reduce((sum, h) => sum + h.quantity * h.buy_price, 0);
  const currentAlloc = holdings.reduce((acc, h) => {
    acc[h.ticker] = total > 0 ? Math.round((h.quantity * h.buy_price) / total * 100) : 0;
    return acc;
  }, {} as Record<string, number>);

  const getNewAlloc = (ticker: string) =>
    Math.max(0, Math.min(100, (currentAlloc[ticker] || 0) + (adjustments[ticker] || 0)));

  const simulate = async () => {
    if (!portfolio) return;
    setLoading(true);
    const toastId = toast.loading('Running simulation...');
    try {
      const res = await whatIfSimulation(portfolio.id, adjustments);
      setResult(res.data);
      toast.success('Simulation complete!', { id: toastId });
    } catch {
      toast.error('Simulation failed.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!holdings.length) return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-8 text-center">
      <div className="text-slate-400 text-sm">Add holdings to use the simulator</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5 hover:bg-slate-900/60 transition">
        <div className="text-sm font-medium text-slate-300 mb-1">Adjust allocation</div>
        <div className="text-xs text-slate-400 mb-5">Drag sliders to simulate rebalancing</div>
        <div className="flex flex-col gap-5">
          {holdings.map(h => (
            <div key={h.ticker}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="text-sm font-medium text-slate-200">{h.ticker}</span>
                  <span className="text-xs text-slate-400 ml-2">{h.company_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 line-through">{currentAlloc[h.ticker]}%</span>
                  <span className={`text-sm font-medium ${getNewAlloc(h.ticker) !== currentAlloc[h.ticker] ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {getNewAlloc(h.ticker)}%
                  </span>
                </div>
              </div>
              <input type="range" min="0" max="100" value={getNewAlloc(h.ticker)}
                onChange={e => {
                  setAdjustments(prev => ({ ...prev, [h.ticker]: parseInt(e.target.value) - (currentAlloc[h.ticker] || 0) }));
                  setResult(null);
                }}
                className="w-full accent-blue-700" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={simulate} disabled={loading || Object.keys(adjustments).length === 0}
            className="flex-1 bg-[#185FA5] text-white py-2 rounded-xl text-sm font-medium hover:bg-[#2579cc] disabled:opacity-50 transition shadow-lg shadow-blue-500/20">
            {loading ? 'Computing...' : '🔄 Simulate'}
          </button>
          <button onClick={() => { setAdjustments({}); setResult(null); }}
            className="px-4 border border-slate-600/30 text-slate-400 py-2 rounded-xl text-sm hover:bg-slate-800/40 hover:text-slate-300 transition">
            Reset
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5 hover:bg-slate-900/60 transition">
        <div className="text-sm font-medium text-slate-300 mb-4">Impact analysis</div>
        {!result ? (
          <div className="text-sm text-slate-400 text-center py-12">
            Adjust sliders and click Simulate to see risk impact
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[
              { label: 'Sharpe Ratio', current: result.current_sharpe, next: result.new_sharpe, change: result.sharpe_change, good: result.sharpe_change > 0 },
              { label: 'Annual Volatility', current: `${result.current_volatility}%`, next: `${result.new_volatility}%`, change: result.volatility_change, good: result.volatility_change < 0 },
            ].map((m, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30 hover:bg-slate-800/70 transition">
                <div className="text-xs text-slate-400 mb-2">{m.label}</div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Current</div>
                    <div className="text-lg font-medium text-slate-200">{m.current}</div>
                  </div>
                  <div className="text-slate-600 text-xl">→</div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Simulated</div>
                    <div className={`text-lg font-medium ${m.good ? 'text-emerald-400' : 'text-rose-400'}`}>{m.next}</div>
                  </div>
                  <div className={`ml-auto text-sm font-medium px-2 py-1 rounded-lg ${m.good ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-600/30' : 'bg-rose-900/40 text-rose-400 border border-rose-600/30'}`}>
                    {m.change > 0 ? '+' : ''}{m.change}
                  </div>
                </div>
              </div>
            ))}
            <div className={`p-4 rounded-lg border text-sm ${result.sharpe_change > 0 ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              {result.sharpe_change > 0
                ? `✅ This rebalancing improves risk-adjusted return by ${result.sharpe_change} Sharpe points.`
                : `⚠️ This rebalancing reduces risk-adjusted return by ${Math.abs(result.sharpe_change)} Sharpe points.`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExportButton({ portfolio, livePrices, totalPnL, totalPnLPct }: {
  portfolio: Portfolio | null, livePrices: Record<string, number>,
  totalPnL: number, totalPnLPct: number
}) {
  const exportPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('en-IN');
    const totalInvested = portfolio?.holdings.reduce((s, h) => s + h.quantity * h.buy_price, 0) || 0;
    const totalCurrentValue = portfolio?.holdings.reduce((s, h) => s + h.quantity * (livePrices[h.ticker] || h.buy_price), 0) || 0;

    doc.setFontSize(20); doc.setTextColor(24, 95, 165);
    doc.text('Quantfolio', 14, 20);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`Portfolio Report — ${date}`, 14, 28);
    doc.text(`Portfolio: ${portfolio?.name || ''}`, 14, 35);
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text('Summary', 14, 48);

    autoTable(doc, {
      startY: 52,
      head: [['Metric', 'Value']],
      body: [
        ['Total Invested', `Rs ${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
        ['Current Value', `Rs ${totalCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
        ['Total P&L', `${totalPnL >= 0 ? '+' : ''}Rs ${Math.abs(totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
        ['Return', `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`],
        ['Holdings', `${portfolio?.holdings.length || 0}`],
      ],
      theme: 'grid', headStyles: { fillColor: [24, 95, 165] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Holdings', 14, finalY);
    autoTable(doc, {
      startY: finalY + 4,
      head: [['Ticker', 'Company', 'Qty', 'Buy Price', 'Current Price', 'P&L']],
      body: portfolio?.holdings.map(h => {
        const cp = livePrices[h.ticker] || h.buy_price;
        const pnl = (h.quantity * cp) - (h.quantity * h.buy_price);
        const pnlPct = (pnl / (h.quantity * h.buy_price)) * 100;
        return [h.ticker, h.company_name, h.quantity, `Rs ${h.buy_price}`, `Rs ${cp}`,
          `${pnl >= 0 ? '+' : ''}Rs ${Math.abs(pnl).toFixed(0)} (${pnlPct.toFixed(1)}%)`];
      }) || [],
      theme: 'striped', headStyles: { fillColor: [24, 95, 165] },
    });

    doc.setFontSize(9); doc.setTextColor(150);
    doc.text(`Generated by Quantfolio on ${date} | For informational purposes only`, 14, 285);
    doc.save(`quantfolio-report-${date}.pdf`);
    toast.success('PDF downloaded!');
  };

  const exportCSV = () => {
    const rows = [
      ['Quantfolio Portfolio Report'],
      [`Generated: ${new Date().toLocaleDateString('en-IN')}`],
      [''],
      ['Ticker', 'Company', 'Quantity', 'Buy Price', 'Current Price', 'Current Value', 'P&L', 'P&L %'],
      ...(portfolio?.holdings.map(h => {
        const cp = livePrices[h.ticker] || h.buy_price;
        const pnl = (h.quantity * cp) - (h.quantity * h.buy_price);
        const pnlPct = (pnl / (h.quantity * h.buy_price)) * 100;
        return [h.ticker, h.company_name, h.quantity, h.buy_price, cp,
          (h.quantity * cp).toFixed(2), pnl.toFixed(2), pnlPct.toFixed(2) + '%'];
      }) || [])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantfolio-${new Date().toLocaleDateString('en-IN')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded!');
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportPDF}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
        style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#243044';
          e.currentTarget.style.color = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#1e293b';
          e.currentTarget.style.color = '#94a3b8';
        }}
      >
        📄 Export PDF
      </button>
      <button
        onClick={exportCSV}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
        style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#243044';
          e.currentTarget.style.color = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#1e293b';
          e.currentTarget.style.color = '#94a3b8';
        }}
      >
        📊 Export CSV
      </button>
    </div>
  );
}

function RiskScoreGauge({ portfolioId }: { portfolioId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const fetchingRef = useRef(false);

  const fetch = async () => {
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading('Computing risk score...');
    try {
      const res = await getRiskScore(portfolioId);
      setData(res.data);
      setFetched(true);
      toast.success('Risk score ready!', { id: toastId });
    } catch {
      toast.error('Could not compute risk score.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!fetched && !loading && !fetchingRef.current) {
      fetchingRef.current = true;
      fetch();
    }
  }, [portfolioId]);

  const getColor = (score: number) => {
    if (score >= 70) return { stroke: '#16a34a', text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' };
    if (score >= 45) return { stroke: '#d97706', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
    return { stroke: '#dc2626', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
  };

  // SVG gauge parameters
  const buildGauge = (score: number) => {
    const radius = 80;
    const cx = 110;
    const cy = 100;
    const startAngle = -210;
    const endAngle = 30;
    const totalAngle = endAngle - startAngle;
    const scoreAngle = startAngle + (score / 100) * totalAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const arcPath = (start: number, end: number, r: number) => {
      const x1 = cx + r * Math.cos(toRad(start));
      const y1 = cy + r * Math.sin(toRad(start));
      const x2 = cx + r * Math.cos(toRad(end));
      const y2 = cy + r * Math.sin(toRad(end));
      const large = end - start > 180 ? 1 : 0;
      return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    };

    const needleX = cx + (radius - 15) * Math.cos(toRad(scoreAngle));
    const needleY = cy + (radius - 15) * Math.sin(toRad(scoreAngle));

    return { arcPath, needleX, needleY, scoreAngle, cx, cy };
  };

  if (!fetched) return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-6 text-center hover:bg-slate-900/60 transition">
      <div className="text-2xl mb-3">🎯</div>
      <div className="text-sm font-medium text-slate-200 mb-1">Portfolio Risk Score</div>
      <div className="text-xs text-slate-400 mb-4">A single 0-100 score summarising your portfolio's overall risk profile</div>
      <button onClick={fetch} disabled={loading}
        className="bg-[#185FA5] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#2579cc] disabled:opacity-50 transition shadow-lg shadow-blue-500/20">
        {loading ? 'Computing...' : 'Compute risk score'}
      </button>
    </div>
  );

  if (!data) return null;

  const colors = getColor(data.score);
  const { arcPath, needleX, needleY, cx, cy } = buildGauge(data.score);

  return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-600/30 p-6 hover:bg-slate-900/60 transition">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-slate-300">Portfolio Risk Score</div>
        <button onClick={fetch} disabled={loading} className="text-xs text-slate-400 hover:text-slate-300 disabled:opacity-50 transition">
          {loading ? 'Computing...' : '↺ Recompute'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          <svg width="220" height="160" viewBox="0 0 220 160">
            {/* Background arc */}
            <path d={arcPath(-210, 30, 80)} fill="none" stroke="#f1f5f9" strokeWidth="16" strokeLinecap="round" />
            {/* Colored arc */}
            <path d={arcPath(-210, -210 + (data.score / 100) * 240, 80)}
              fill="none" stroke={colors.stroke} strokeWidth="16" strokeLinecap="round" />
            {/* Zone markers */}
            <path d={arcPath(-210, -114, 80)} fill="none" stroke="#fca5a5" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d={arcPath(-114, -18, 80)} fill="none" stroke="#fcd34d" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d={arcPath(-18, 30, 80)} fill="none" stroke="#86efac" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            {/* Needle */}
            <line x1={cx} y1={cy} x2={needleX} y2={needleY}
              stroke={colors.stroke} strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="6" fill={colors.stroke} />
            {/* Score text */}
            <text x={cx} y={cy + 35} textAnchor="middle" fontSize="32" fontWeight="600" fill="#f1f5f9">{data.score}</text>
            <text x={cx} y={cy + 52} textAnchor="middle" fontSize="11" fill="#94a3b8">/100</text>
            {/* Labels */}
            <text x="28" y="125" textAnchor="middle" fontSize="9" fill="#94a3b8">High</text>
            <text x="110" y="22" textAnchor="middle" fontSize="9" fill="#94a3b8">Moderate</text>
            <text x="192" y="125" textAnchor="middle" fontSize="9" fill="#94a3b8">Low</text>
          </svg>
          <div className={`text-sm font-semibold px-4 py-1.5 rounded-full mt-2 ${colors.bg} ${colors.text} border ${colors.border}`}>
            {data.level}
          </div>
          <div className="text-xs text-gray-400 text-center mt-2 max-w-xs">{data.description}</div>
        </div>

        {/* Component breakdown */}
        <div className="flex flex-col gap-3 justify-center">
          <div className="text-xs font-medium text-gray-500 mb-1">Score breakdown</div>
          {Object.entries(data.components).map(([label, score], i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{label}</span>
                <span className={`font-medium ${(score as number) >= 70 ? 'text-emerald-400' : (score as number) >= 45 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {score as number}/100
                </span>
              </div>
              <div className="h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background: (score as number) >= 70 ? '#16a34a' : (score as number) >= 45 ? '#d97706' : '#dc2626'
                  }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BenchmarkTab({ portfolioId }: { portfolioId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const fetchingRef = useRef(false);

  const fetchBenchmark = async () => {
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading('Fetching NIFTY 50 comparison...');
    try {
      const res = await getBenchmarkComparison(portfolioId);
      setData(res.data);
      setFetched(true);
      toast.success('Benchmark comparison ready!', { id: toastId });
    } catch {
      toast.error('Could not fetch benchmark data.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!fetched && !loading && !fetchingRef.current) {
      fetchingRef.current = true;
      fetchBenchmark();
    }
  }, [portfolioId]);

  if (!fetched) return (
    <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
      <div className="text-4xl mb-4">📊</div>
      <div className="text-gray-700 font-medium mb-2">Portfolio vs NIFTY 50</div>
      <div className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
        Compare your portfolio performance against the NIFTY 50 benchmark over 6 months. See your alpha.
      </div>
      <button onClick={fetchBenchmark} disabled={loading}
        className="bg-[#185FA5] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#2579cc] disabled:opacity-50 shadow-lg shadow-blue-500/20 transition">
        {loading ? 'Fetching...' : '📊 Compare vs NIFTY 50'}
      </button>
    </div>
  );

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-xs text-gray-400 mb-1">Your portfolio return</div>
          <div className={`text-2xl font-semibold ${data.portfolio_return >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {data.portfolio_return >= 0 ? '+' : ''}{data.portfolio_return}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Last 6 months</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-xs text-gray-400 mb-1">NIFTY 50 return</div>
          <div className={`text-2xl font-semibold ${data.nifty_return >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {data.nifty_return >= 0 ? '+' : ''}{data.nifty_return}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Last 6 months</div>
        </div>
        <div className={`rounded-xl border p-5 ${data.outperformed ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <div className={`text-xs mb-1 ${data.outperformed ? 'text-green-600' : 'text-red-500'}`}>Alpha (vs NIFTY)</div>
          <div className={`text-2xl font-semibold ${data.outperformed ? 'text-green-600' : 'text-red-500'}`}>
            {data.alpha >= 0 ? '+' : ''}{data.alpha}%
          </div>
          <div className={`text-xs mt-1 ${data.outperformed ? 'text-green-600' : 'text-red-500'}`}>
            {data.outperformed ? '✅ Outperforming NIFTY' : '⚠️ Underperforming NIFTY'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm font-medium text-gray-700">Portfolio vs NIFTY 50 — indexed to 100</div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-0.5 bg-blue-700 rounded" />Your portfolio
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-0.5 bg-orange-400 rounded" />NIFTY 50
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              interval={Math.floor(data.data.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(v) => `${v}`}
              width={40}
              domain={['auto', 'auto']}
            />
            <Tooltip formatter={(v: any, name: any) => [
                `${Number(v).toFixed(1)}`,
                name === 'portfolio' ? 'Your portfolio' : 'NIFTY 50'
              ]}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
            />
            <Line type="monotone" dataKey="portfolio" stroke="#185FA5" strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} name="portfolio" />
            <Line type="monotone" dataKey="nifty" stroke="#f97316" strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} name="nifty" strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-xs text-gray-400 text-center mt-2">
          Both indexed to 100 at start of period. Values above 100 = positive return.
        </div>
      </div>

      <button onClick={() => setFetched(false)} className="text-xs text-gray-400 hover:text-gray-600 text-center">
        ↺ Refresh
      </button>
    </div>
  );
}
function HealthTab({ portfolioId }: { portfolioId: number }) {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    const toastId = toast.loading('Computing portfolio health...');
    try {
      const res = await getPortfolioHealth(portfolioId);
      setHealth(res.data);
      toast.success('Health report ready!', { id: toastId });
    } catch {
      toast.error('Could not compute health score.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const gradeColor: Record<string, string> = {
    A: 'text-green-400', B: 'text-blue-400',
    C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400',
  };

  if (!health) return (
    <div className="rounded-xl p-8 text-center"
      style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b' }}>
      <div className="text-white font-medium mb-2">Portfolio Health Engine</div>
      <div className="text-sm mb-6" style={{ color: '#64748b' }}>
        Get a comprehensive A-F grade across 5 dimensions — diversification,
        concentration, sector balance, beta, and volatility.
      </div>
      <button onClick={fetchHealth} disabled={loading}
        className="text-white px-6 py-2 rounded-lg text-sm font-medium"
        style={{ background: '#185FA5' }}>
        {loading ? 'Computing...' : ' Compute health score'}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Grade card */}
      <div className="rounded-xl p-6 flex items-center gap-6"
        style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b' }}>
        <div className={`text-7xl font-black ${gradeColor[health.grade] || 'text-white'}`}>
          {health.grade}
        </div>
        <div>
          <div className="text-white text-2xl font-bold mb-1">
            {health.health_score}/100
          </div>
          <div style={{ color: '#64748b' }} className="text-sm">
            Portfolio health score across {health.holdings_count} holdings
          </div>
          <div style={{ color: '#64748b' }} className="text-xs mt-1">
            Total invested: ₹{health.total_invested.toLocaleString('en-IN')}
          </div>
        </div>
        <button onClick={() => setHealth(null)} className="ml-auto text-xs"
          style={{ color: '#64748b' }}>
          ↺ Recompute
        </button>
      </div>

      {/* Component scores */}
      <div className="rounded-xl p-5"
        style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b' }}>
        <div className="text-sm font-medium text-white mb-4">Component scores</div>
        <div className="flex flex-col gap-3">
          {Object.entries(health.component_scores).map(([key, val]: any) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#94a3b8' }}>
                  {key.replace(/_/g, ' ').replace('score', '').trim()
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
                <span className={`font-medium ${val >= 70 ? 'text-green-400' : val >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                  {val}/100
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: '#1e293b' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${val}%`,
                    background: val >= 70 ? '#16a34a' : val >= 45 ? '#d97706' : '#dc2626'
                  }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths */}
      {health.strengths.length > 0 && (
        <div className="rounded-xl p-5"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b' }}>
          <div className="text-sm font-medium text-white mb-3">✅ Strengths</div>
          <div className="flex flex-col gap-2">
            {health.strengths.map((s: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm" style={{ color: '#94a3b8' }}>
                <span style={{ color: '#16a34a' }}>✓</span>{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {health.weaknesses.length > 0 && (
        <div className="rounded-xl p-5"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b' }}>
          <div className="text-sm font-medium text-white mb-3">⚠️ Weaknesses</div>
          <div className="flex flex-col gap-2">
            {health.weaknesses.map((w: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm" style={{ color: '#94a3b8' }}>
                <span style={{ color: '#dc2626' }}>✗</span>{w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium text-white">💡 Recommendations</div>
          {health.recommendations.map((r: any, i: number) => (
            <div key={i} className="rounded-xl p-4"
              style={{
                background: 'rgba(15,23,42,0.6)',
                border: `1px solid ${r.priority === 'high' ? '#7f1d1d' : r.priority === 'medium' ? '#78350f' : '#1e293b'}`
              }}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  r.priority === 'high' ? 'bg-red-900 text-red-300' :
                  r.priority === 'medium' ? 'bg-amber-900 text-amber-300' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {r.priority.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-white">{r.title}</span>
              </div>
              <div className="text-xs mb-2" style={{ color: '#64748b' }}>{r.detail}</div>
              <div className="text-sm" style={{ color: '#94a3b8' }}>{r.action}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { logoutUser } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [form, setForm] = useState({ ticker: '', company_name: '', quantity: '', buy_price: '' });
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const isSelectingRef = useRef(false);

  useEffect(() => { loadPortfolio(); }, []);

  useEffect(() => {
    if (searchQuery.length === 0) { setSearchResults([]); return; }
    if (isSelectingRef.current) { isSelectingRef.current = false; return; }
    
    // 1. Immediate local matching from popular list for instant feedback
    const localMatches = POPULAR_STOCKS.filter(s => 
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(s => ({ ...s, exchange: 'NSE', type: 'stock' }));

    if (localMatches.length > 0) {
      setSearchResults(localMatches);
    }

    // 2. Faster 300ms debounce for API search
    if (searchQuery.length < 2) return;
    
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchStocks(searchQuery);
        // Merge with local matches, avoiding duplicates
        const apiResults = res.data.filter((r: any) => !localMatches.some(lm => lm.ticker === r.ticker));
        setSearchResults([...localMatches, ...apiResults]);
      } catch {
        // Fallback to local if API fails
        setSearchResults(localMatches);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchHistory = async (portfolioId: number) => {
    try {
      const res = await getPortfolioHistory(portfolioId);
      setPortfolioHistory(res.data.history || []);
    } catch {
      console.error('Could not fetch history');
    }
  };

  const fetchLivePrices = async (holdings: Holding[]) => {
    if (!holdings.length) return;
    setPricesLoading(true);
    try {
      const res = await getMultiplePrices(holdings.map(h => h.ticker));
      setLivePrices(res.data);
    } catch {
      console.error('Could not fetch live prices');
    } finally {
      setPricesLoading(false);
    }
  };

  const loadPortfolio = async () => {
    try {
      const res = await getPortfolios();
      if (res.data.length === 0) {
        const created = await createPortfolio('My Portfolio');
        setPortfolio({ ...created.data, holdings: [] });
      } else {
        const p = res.data[0];
        const holdingsRes = await getHoldings(p.id);
        setPortfolio({ ...p, holdings: holdingsRes.data });
        fetchLivePrices(holdingsRes.data);
        fetchHistory(p.id);
      }
    } catch {
      logoutUser();
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const selectStock = async (ticker: string, name: string) => {
    isSelectingRef.current = true;
    setForm(prev => ({ ...prev, ticker, company_name: name }));
    setSearchQuery(name);
    setSearchResults([]);
    const loadingToast = toast.loading(`Fetching price for ${ticker}...`);
    try {
      const priceRes = await getStockPrice(ticker);
      setForm(prev => ({ ...prev, buy_price: priceRes.data.current_price.toString() }));
      toast.success('Price auto-filled', { id: loadingToast });
    } catch {
      toast.dismiss(loadingToast);
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolio) return;
    const toastId = toast.loading('Adding holding...');
    try {
      await addHolding(portfolio.id, {
        ticker: form.ticker.toUpperCase().trim(),
        company_name: form.company_name.trim(),
        quantity: parseFloat(form.quantity),
        buy_price: parseFloat(form.buy_price),
      });
      setForm({ ticker: '', company_name: '', quantity: '', buy_price: '' });
      setSearchQuery('');
      setSearchResults([]);
      setShowAddHolding(false);
      await loadPortfolio();
      setLastUpdate(Date.now());
      toast.success('Holding added!', { id: toastId });
    } catch {
      toast.error('Failed to add holding.', { id: toastId });
    }
  };

  const handleDelete = async (holdingId: number) => {
    if (!portfolio) return;
    if (!confirm('Remove this holding?')) return;
    const toastId = toast.loading('Removing...');
    try {
      await deleteHolding(portfolio.id, holdingId);
      await loadPortfolio();
      setLastUpdate(Date.now());
      toast.success('Holding removed.', { id: toastId });
    } catch {
      toast.error('Failed to remove holding.', { id: toastId });
    }
  };

  const totalInvested = portfolio?.holdings.reduce((s, h) => s + h.quantity * h.buy_price, 0) || 0;
  const totalCurrentValue = portfolio?.holdings.reduce((s, h) => s + h.quantity * (livePrices[h.ticker] || h.buy_price), 0) || 0;
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const allocationData = portfolio?.holdings.map(h => ({
    name: h.ticker,
    value: totalInvested > 0 ? Math.round((h.quantity * h.buy_price / totalInvested) * 100) : 0
  })) || [];

  if (loading) return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>
      <div className="w-56 p-6" style={{ background: '#0d1117' }}>
        <Skeleton className="h-6 w-28 mb-8" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 mb-2" />)}
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#0f172a' }}>
      {/* Sidebar */}
      <div
        className="w-56 fixed h-full z-10 flex flex-col py-6 px-4"
        style={{ background: '#0d1117', borderRight: '1px solid #1e293b' }}
      >
        <div className="text-xl font-bold text-white mb-8 px-2 tracking-tight">Quantfolio</div>
        {[
          { id: 'overview', label: 'Dashboard' },
          { id: 'holdings', label: 'Portfolio' },
          { id: 'risk', label: 'Risk Analysis' },
          { id: 'ai', label: 'AI Advisor' },
          { id: 'news', label: 'News Sentiment' },
          { id: 'whatif', label: 'What-if' },
          { id: 'benchmark', label: 'vs NIFTY 50' },
          { id: 'health', label: 'Portfolio Health' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 text-left font-medium w-full transition-all ${
              activeTab === tab.id
                ? 'bg-[#185FA5] text-white'
                : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b]'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="mt-auto">
          <button
            onClick={() => {
              logoutUser();
              navigate('/');
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-left transition-all text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b]"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-56 flex-1 p-8 min-h-screen" style={{ background: '#0f172a' }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xl font-semibold text-white">
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'holdings' && 'Portfolio Holdings'}
              {activeTab === 'risk' && 'Risk Analysis'}
              {activeTab === 'ai' && 'AI Advisor'}
              {activeTab === 'news' && 'News Sentiment'}
              {activeTab === 'whatif' && 'What-if Simulator'}
              {activeTab === 'benchmark' && 'Portfolio vs NIFTY 50'}
              {activeTab === 'health' && 'Portfolio Health'}
              
            </div>
            <div className="text-sm text-[#64748b]">{portfolio?.name}</div>
          </div>
          <div className="flex gap-2">
            <ExportButton portfolio={portfolio} livePrices={livePrices} totalPnL={totalPnL} totalPnLPct={totalPnLPct} />
            <button onClick={() => setShowAddHolding(true)}
              className="bg-[#185FA5] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2563eb] transition-all">
              + Add holding
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-4">
            {/* Metric cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total invested', value: `₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '' },
                { label: 'Current value', value: `₹${totalCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '' },
                { label: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}₹${Math.abs(totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: totalPnL >= 0 ? 'text-green-600' : 'text-red-500' },
                { label: 'Return', value: `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`, color: totalPnLPct >= 0 ? 'text-green-600' : 'text-red-500' },
              ].map((m, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="text-xs text-gray-400 mb-1">{m.label}</div>
                  {pricesLoading && i > 0
                    ? <Skeleton className="h-7 w-24 mt-1" />
                    : <div className={`text-xl font-semibold ${m.color || 'text-gray-900'}`}>{m.value}</div>}
                </div>
              ))}
            </div>

            {/* Allocation + Holdings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-sm font-medium text-gray-700 mb-4">Allocation</div>
                {allocationData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={allocationData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                          {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2">
                      {allocationData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          {d.name} — {d.value}%
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-8">Add holdings to see allocation</div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-sm font-medium text-gray-700 mb-4">Holdings snapshot</div>
                {portfolio?.holdings.length ? (
                  <div className="flex flex-col gap-1">
                    {portfolio.holdings.slice(0, 5).map((h, i) => {
                      const cp = livePrices[h.ticker] || h.buy_price;
                      const pnl = ((cp - h.buy_price) / h.buy_price) * 100;
                      return (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{h.ticker}</div>
                            <div className="text-xs text-gray-400">{h.company_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              ₹{(h.quantity * cp).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            {pricesLoading
                              ? <Skeleton className="h-3 w-12 mt-1" />
                              : <div className={`text-xs font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
                                </div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-8">No holdings yet</div>
                )}
              </div>
            </div>

            {/* Portfolio History Chart — full width */}
            {portfolioHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-sm font-medium text-gray-700 mb-4">Portfolio value — last 6 months</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={portfolioHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      interval={Math.floor(portfolioHistory.length / 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      width={50}
                    />
                    <Tooltip
                      formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Portfolio value']}
                      labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    />
                    <Line type="monotone" dataKey="value" stroke="#185FA5" strokeWidth={2}
                      dot={false} activeDot={{ r: 4, fill: '#185FA5' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Ticker', 'Company', 'Qty', 'Buy Price', 'Current Price', 'Current Value', 'P&L', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings.length ? portfolio.holdings.map((h) => {
                  const cp = livePrices[h.ticker] || h.buy_price;
                  const cv = h.quantity * cp;
                  const pnl = cv - (h.quantity * h.buy_price);
                  const pnlPct = (pnl / (h.quantity * h.buy_price)) * 100;
                  return (
                    <tr key={h.id} className="border-b border-gray-50 hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm font-medium text-blue-700">{h.ticker}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{h.company_name}</td>
                      <td className="px-5 py-3 text-sm text-gray-900">{h.quantity}</td>
                      <td className="px-5 py-3 text-sm text-gray-900">₹{h.buy_price.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-sm text-gray-900">
                        {pricesLoading ? <Skeleton className="h-4 w-16" /> : `₹${cp.toLocaleString('en-IN')}`}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">
                        ₹{cv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-5 py-3">
                        {pricesLoading ? <Skeleton className="h-4 w-20" /> :
                          <span className={`text-sm font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pnlPct.toFixed(1)}%)
                          </span>}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDelete(h.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 text-sm py-12">
                      No holdings yet — click "+ Add holding" to get started
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'risk' && (
          <div className="flex flex-col gap-4">
            <RiskScoreGauge key={`score-${lastUpdate}`} portfolioId={portfolio?.id || 0} />
            <RiskTab key={`metrics-${lastUpdate}`} portfolioId={portfolio?.id || 0} />
          </div>
        )}
        {activeTab === 'ai' && <AITab key={`ai-${lastUpdate}`} portfolioId={portfolio?.id || 0} />}
        {activeTab === 'news' && <NewsTab key={`news-${lastUpdate}`} holdings={portfolio?.holdings || []} />}
        {activeTab === 'whatif' && <WhatIfTab portfolio={portfolio} />}
        {activeTab === 'benchmark' && <BenchmarkTab key={`bench-${lastUpdate}`} portfolioId={portfolio?.id || 0} />}
        {activeTab === 'health' && <HealthTab portfolioId={portfolio?.id || 0} />}
      </div>

      {/* Add Holding Modal */}
      {showAddHolding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Add new holding</h3>
              <button 
                onClick={() => { setShowAddHolding(false); setSearchQuery(''); setSearchResults([]); }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="relative mb-6">
                <label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-2 block">Search NSE Stocks</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                    placeholder="Type ticker (e.g. RELIANCE) or company..." 
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-3.5">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>

                {(searchQuery.length > 0 || searchResults.length > 0) ? (
                  searchResults.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border border-gray-100 rounded-xl mt-2 shadow-xl overflow-hidden py-1 border-t-0 ring-1 ring-black/5">
                      {searchResults.map((r, i) => (
                        <button key={i} type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectStock(r.ticker, r.name); }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors flex items-center justify-between group">
                          <div>
                            <div className="font-bold text-gray-900 group-hover:text-blue-700">{r.ticker}</div>
                            <div className="text-xs text-gray-500">{r.name}</div>
                          </div>
                          <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium uppercase">{r.exchange}</div>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2 px-1">Popular Suggestions</div>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_STOCKS.map(s => (
                        <button
                          key={s.ticker} type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectStock(s.ticker, s.name); }}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-700 transition-all"
                        >
                          {s.ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleAddHolding} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 block">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="0.00"
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 block">Buy Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.buy_price}
                      onChange={e => setForm({ ...form, buy_price: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-blue-700"
                      placeholder="0.00"
                      required 
                    />
                  </div>
                </div>


                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={!form.ticker || !form.quantity || !form.buy_price}
                    className="w-full bg-[#185FA5] text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-[#2579cc] hover:shadow-blue-700/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
                  >
                    Add to Portfolio
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}