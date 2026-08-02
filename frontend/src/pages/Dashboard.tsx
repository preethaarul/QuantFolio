import { useState, useEffect, useRef, useMemo } from 'react';
import { FileDown, FileText, TrendingUp, TrendingDown, Minus, X, ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AIChatDrawer } from '../components/AI_ChatDrawer';
import { PortfolioChart } from '../components/PortfolioChart';
import AIInsightsPage from './AIInsightsPage';
import RiskHealthDiagnosticsPage from './RiskHealthDiagnosticsPage';
import {
  getPortfolios, createPortfolio, getHoldings, addHolding,
  deleteHolding, getMultiplePrices,
  whatIfSimulation, searchStocks, getPortfolioHistory, getBenchmarkComparison,
  getStockPrice,
  getStockForecast
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
function ForecastModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const chartData = useMemo(() => {
    if (!data?.forecast?.length || data?.current_price == null) return [];

    const normalized = data.forecast.map((item: any) => ({
      date: item.date,
      price: Number(item.predicted_price),
      upper: Number(item.upper_bound ?? item.predicted_price),
      lower: Number(item.lower_bound ?? item.predicted_price),
    }));

    const currentPrice = Number(data.current_price);
    const firstForecastPrice = normalized[0]?.price ?? currentPrice;

    if (Math.abs(currentPrice - firstForecastPrice) > 0.01) {
      return [{ date: 'Today', price: currentPrice, upper: currentPrice, lower: currentPrice }, ...normalized];
    }
    return normalized;
  }, [data]);

  const currentPrice = Number(data?.current_price ?? 0);
  const computedChangePct = data?.expected_return_pct ?? '0.00';

  useEffect(() => {
    let isMounted = true;
    const fetchForecast = async () => {
      try {
        const res = await getStockForecast(ticker);
        if (isMounted) setData(res.data);
      } catch {
        toast.error(`Could not load forecast for ${ticker}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchForecast();
    return () => { isMounted = false; };
  }, [ticker]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg transition">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white mt-1">{ticker} — 30-Day Forecast Path</h3>
        </div>
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="animate-spin h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-3" />
            Running Amazon Chronos time-series forecasting model...
          </div>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/40">
              <div>
                <div className="text-xs text-slate-400">Current Price</div>
                <div className="text-lg font-bold text-slate-100">₹{data.current_price?.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Expected 30D Return</div>
                <div className={`text-lg font-bold ${Number(computedChangePct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {Number(computedChangePct) >= 0 ? '+' : ''}{computedChangePct}%
                </div>
              </div>
            </div>
            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} aspect={undefined}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    domain={[(dataMin: number) => dataMin * 0.98, (dataMax: number) => dataMax * 1.02]}
                  />
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `₹${value}`, 
                      name === 'upper' ? 'Upside Potential' : name === 'lower' ? 'Downside Risk' : 'Most Likely Price'
                    ]} 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} 
                    itemSorter={(item: any) => {
              if (item.dataKey === 'upper') return -1;
              if (item.dataKey === 'price') return 0;
              return 1;
            }}
                  />
                  <Line type="monotone" dataKey="upper" stroke="#4ade80" strokeDasharray="3 3" strokeWidth={1} dot={false} name="upper" />
                  <Line type="monotone" dataKey="lower" stroke="#f87171" strokeDasharray="3 3" strokeWidth={1} dot={false} name="lower" />
                  <Line type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2.5} dot={false} name="price" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between items-center bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400" />Most Likely
              </div>
                <div className="w-4 h-0.5 border-t border-dashed border-emerald-400"/>Upside Potential  
                <div className="w-4 h-0.5 border-t border-dashed border-rose-400"/>Downside Risk </div>
                
            </div>
            <div className="text-[11px] text-slate-400 bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-700/30 leading-relaxed">
                <span className="text-cyan-400 font-semibold">Note:</span> Forecasts reflect statistical confidence paths based on recent market behavior and do not guarantee future returns.
              </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">Failed to load Chronos forecast graph.</div>
        )}
      </div>
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
    try {
      const res = await whatIfSimulation(portfolio.id, adjustments);
      setResult(res.data);
      toast.success('Simulation complete!');
    } catch {
      toast.error('Simulation failed.');
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#185FA5] py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2579cc] disabled:opacity-50">
            {loading ? 'Computing...' : <><ArrowLeftRight className="h-4 w-4" /> Simulate</>}
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
              <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
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
            <div className={`p-4 rounded-lg border text-sm ${result.sharpe_change > 0 ? 'bg-emerald-900/20 border-emerald-600/30 text-emerald-300' : 'bg-amber-900/20 border-amber-600/30 text-amber-300'}`}>
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
      <button onClick={exportPDF}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
        style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
        <FileText className="h-4 w-4" /> Export PDF
      </button>
      <button onClick={exportCSV}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
        style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
        <FileDown className="h-4 w-4" /> Export CSV
      </button>
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
  const [niftyHistory, setNiftyHistory] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [form, setForm] = useState({ ticker: '', company_name: '', quantity: '', buy_price: '' });
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [selectedForecastTicker, setSelectedForecastTicker] = useState<string | null>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => { loadPortfolio(); }, []);

  useEffect(() => {
    if (searchQuery.length === 0) { setSearchResults([]); return; }
    if (isSelectingRef.current) { isSelectingRef.current = false; return; }

    const localMatches = POPULAR_STOCKS.filter(s =>
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(s => ({ ...s, exchange: 'NSE', type: 'stock' }));

    if (localMatches.length > 0) setSearchResults(localMatches);
    if (searchQuery.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const res = await searchStocks(searchQuery);
        const apiResults = res.data.filter((r: any) => !localMatches.some(lm => lm.ticker === r.ticker));
        setSearchResults([...localMatches, ...apiResults]);
      } catch {
        setSearchResults(localMatches);
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

  // ── FIX 1: use res.data.data not res.data.history ─────────────────────────
  useEffect(() => {
    let mounted = true;
    const fetchBenchmark = async () => {
      if (!portfolio?.id) return;
      try {
        const res = await getBenchmarkComparison(portfolio.id);
        // Backend returns { data: [...], portfolio_return, nifty_return, alpha }
        // Each item in data has shape: { date, portfolio, nifty }
        if (mounted) setNiftyHistory(res.data.data || []);
      } catch (e) {
        console.error('Could not fetch benchmark', e);
      }
    };
    if (portfolio?.id && portfolioHistory.length > 0 && niftyHistory.length === 0) {
      fetchBenchmark();
    }
    return () => { mounted = false; };
  }, [portfolio?.id, portfolioHistory.length, niftyHistory.length]);

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
    try {
      const priceRes = await getStockPrice(ticker);
      setForm(prev => ({ ...prev, buy_price: priceRes.data.current_price.toString() }));
      toast.success('Price auto-filled');
    } catch {
      toast.error('Could not fetch price.');
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolio) return;
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
      toast.success('Holding added!');
    } catch {
      toast.error('Failed to add holding.');
    }
  };

  const handleDelete = async (holdingId: number) => {
    if (!portfolio) return;
    if (!confirm('Remove this holding?')) return;
    try {
      await deleteHolding(portfolio.id, holdingId);
      await loadPortfolio();
      setLastUpdate(Date.now());
      toast.success('Holding removed.');
    } catch {
      toast.error('Failed to remove holding.');
    }
  };

  const totalInvested = portfolio?.holdings.reduce((s, h) => s + h.quantity * h.buy_price, 0) || 0;
  const totalCurrentValue = portfolio?.holdings.reduce((s, h) => s + h.quantity * (livePrices[h.ticker] || h.buy_price), 0) || 0;
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const aggregatedMap: Record<string, { ticker: string; name: string; value: number }> = {};
  (portfolio?.holdings || []).forEach(h => {
    const cp = livePrices[h.ticker] || h.buy_price;
    const val = h.quantity * cp;
    if (!aggregatedMap[h.ticker]) aggregatedMap[h.ticker] = { ticker: h.ticker, name: h.company_name, value: 0 };
    aggregatedMap[h.ticker].value += val;
  });
  const aggregatedHoldings = Object.values(aggregatedMap);
  const aggregatedTotal = aggregatedHoldings.reduce((s, a) => s + a.value, 0) || 0;
  const aggregatedAllocation = aggregatedHoldings.map(a => ({
    ticker: a.ticker,
    name: a.name,
    value: a.value,
    percent: aggregatedTotal > 0 ? (a.value / aggregatedTotal) * 100 : 0
  })).sort((a, b) => b.percent - a.percent);

  // ── FIX 2: niftyMap reads item.nifty — matches backend shape { date, portfolio, nifty }
  const rawHistoryData = useMemo(() => {
    if (!portfolioHistory || portfolioHistory.length === 0) return [];

    const niftyMap = new Map(
      niftyHistory.map((item: any) => [item.date, item.nifty ?? null])
    );

    return portfolioHistory.map(item => ({
      date: item.date,
      portfolioValue: item.value,
      niftyValue: niftyMap.get(item.date) ?? null,
    }));
  }, [portfolioHistory, niftyHistory]);

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
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#0f172a' }}>
      {/* Sidebar */}
      <div className="w-56 fixed h-full z-10 flex flex-col py-6 px-4" style={{ background: '#0d1117', borderRight: '1px solid #1e293b' }}>
        <div className="text-xl font-bold text-white mb-8 px-2 tracking-tight">Quantfolio</div>
        {[
          { id: 'overview', label: 'Dashboard' },
          { id: 'holdings', label: 'Portfolio' },
          { id: 'risk-health', label: 'Risk & Health' },
          { id: 'ai-insights', label: 'AI Insights' },
          { id: 'whatif', label: 'What-if' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 text-left font-medium w-full transition-all ${
              activeTab === tab.id ? 'bg-[#185FA5] text-white' : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b]'
            }`}>
            <span className="ml-2">{tab.label}</span>
          </button>
        ))}
        <div className="mt-auto">
          <button onClick={() => { logoutUser(); navigate('/'); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-left transition-all text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b]">
            Log out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8 min-h-screen" style={{ background: '#0f172a' }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xl font-semibold text-white">
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'holdings' && 'Portfolio Holdings'}
              {activeTab === 'risk-health' && 'Risk & Health'}
              {activeTab === 'ai-insights' && 'AI Insights'}
              {activeTab === 'whatif' && 'What-if Simulator'}
            </div>
            <div className="text-sm text-[#94a3b8]">{portfolio?.name}</div>
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
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm text-slate-100">
                <div className="text-xs text-slate-400 mb-2">Total Invested</div>
                <div className="text-2xl font-semibold">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm text-slate-100">
                <div className="text-xs text-slate-400 mb-2">Current Value</div>
                <div className="text-2xl font-semibold">₹{totalCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <div className="text-xs text-slate-200/80 mb-2">Total P&L</div>
                <div className="text-2xl font-semibold">{totalPnL >= 0 ? '+' : '-'}₹{Math.abs(totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm text-slate-100">
                <div className="text-xs text-slate-400 mb-2">Total Return</div>
                <div className={`text-2xl font-semibold ${totalPnLPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PortfolioChart rawHistoryData={rawHistoryData} />

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm text-slate-100">
                <div className="text-sm font-medium text-slate-200 mb-3">Allocation</div>
                {aggregatedAllocation.length > 0 ? (
                  <div className="space-y-4">
                    <div className="w-full h-6 bg-slate-800 rounded-full overflow-hidden flex">
                      {aggregatedAllocation.map((a, i) => (
                        <div key={a.ticker} title={`${a.ticker} ${a.percent.toFixed(1)}%`}
                          style={{ width: `${Math.max(1, Math.round(a.percent))}%`, background: COLORS[i % COLORS.length] }} />
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {aggregatedAllocation.map((a, i) => (
                        <div key={a.ticker} className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <div className="font-medium">{a.ticker}</div>
                          <div className="text-slate-400">{a.percent.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 text-center py-8">Add holdings to see allocation</div>
                )}

                <div className="mt-6">
                  <div className="text-sm font-medium text-slate-200 mb-3">Holdings snapshot</div>
                  {portfolio?.holdings.length ? (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-400">
                            <th className="pb-2">Asset</th>
                            <th className="pb-2">Current Value</th>
                            <th className="pb-2">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregatedAllocation.map((a) => {
                            const holding = portfolio.holdings.find(h => h.ticker === a.ticker);
                            const invested = holding ? holding.quantity * holding.buy_price : 0;
                            const pnlPct = invested > 0 ? ((a.value - invested) / invested) * 100 : 0;
                            return (
                              <tr key={a.ticker} className="border-t border-slate-800">
                                <td className="py-3">
                                  <div className="font-medium text-slate-100">{a.ticker}</div>
                                  <div className="text-xs text-slate-400">{a.name}</div>
                                </td>
                                <td className="py-3 font-semibold text-slate-100">₹{Math.round(a.value).toLocaleString('en-IN')}</td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    {pnlPct > 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : pnlPct < 0 ? <TrendingDown className="w-4 h-4 text-rose-400" /> : <Minus className="w-4 h-4 text-slate-400" />}
                                    <span className={`text-sm ${pnlPct > 0 ? 'text-emerald-400' : pnlPct < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                      {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 text-center py-8">No holdings yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <div className="rounded-xl overflow-x-auto" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  {['Ticker', 'Company', 'Qty', 'Buy Price', 'Current Price', '30D Forecast', 'Current Value', 'P&L', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold px-5 py-3.5 uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
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
                    <tr key={h.id} className="transition-colors hover:bg-slate-800/30" style={{ borderBottom: '1px solid #1e293b' }}>
                      <td className="px-5 py-3.5 text-sm font-bold text-blue-400">{h.ticker}</td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: '#94a3b8' }}>{h.company_name}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-white">{h.quantity}</td>
                      <td className="px-5 py-3.5 text-sm text-white">₹{h.buy_price.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5 text-sm text-white">
                        {pricesLoading ? <Skeleton className="h-4 w-16" /> : `₹${cp.toLocaleString('en-IN')}`}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => setSelectedForecastTicker(h.ticker)}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all hover:bg-slate-700/50"
                          style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
                          <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                          <span>View 30D Path</span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-white">
                        ₹{cv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pnlPct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => handleDelete(h.id)} className="text-xs text-rose-400 hover:text-rose-300 font-medium transition">Remove</button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={9} className="text-center text-sm py-12" style={{ color: '#64748b' }}>
                      No holdings yet — click "+ Add holding" to get started
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'risk-health' && <RiskHealthDiagnosticsPage portfolioId={portfolio?.id || 0} />}
        {activeTab === 'ai-insights' && <AIInsightsPage holdings={portfolio?.holdings || []} lastUpdate={lastUpdate} />}
        {activeTab === 'whatif' && <WhatIfTab portfolio={portfolio} />}
      </div>

      {selectedForecastTicker && (
        <ForecastModal ticker={selectedForecastTicker} onClose={() => setSelectedForecastTicker(null)} />
      )}

      <AIChatDrawer portfolioId={portfolio?.id || 0} />

      {showAddHolding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Add new holding</h3>
              <button onClick={() => { setShowAddHolding(false); setSearchQuery(''); setSearchResults([]); }}
                className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative mb-6">
                <label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-2 block">Search NSE Stocks</label>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                  placeholder="Type ticker (e.g. RELIANCE) or company..." />
                {searchResults.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-100 rounded-xl mt-2 shadow-xl overflow-hidden py-1">
                    {searchResults.map((r, i) => (
                      <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); selectStock(r.ticker, r.name); }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{r.ticker}</div>
                          <div className="text-xs text-gray-500">{r.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <form onSubmit={handleAddHolding} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 block">Quantity</label>
                    <input type="number" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="0.00" required />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 block">Buy Price (₹)</label>
                    <input type="number" step="any" value={form.buy_price} onChange={e => setForm({ ...form, buy_price: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-700" placeholder="0.00" required />
                  </div>
                </div>
                <button type="submit" disabled={!form.ticker || !form.quantity || !form.buy_price}
                  className="w-full bg-[#185FA5] text-white py-3 rounded-xl text-sm font-bold shadow-lg hover:bg-[#2579cc] transition-all disabled:opacity-50">
                  Add to Portfolio
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}