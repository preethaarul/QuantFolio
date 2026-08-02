import { useEffect, useRef, useMemo, useState } from 'react';
import { RotateCcw, BarChart3, Newspaper, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import { getNewsSentiment, getStockForecast } from '../services/api';

interface Holding {
  id: number;
  ticker: string;
  company_name: string;
  quantity: number;
  buy_price: number;
  added_at?: string;
}

interface AIInsightsPageProps {
  holdings: Holding[];
  lastUpdate?: number;
}

function ForecastTab({ holdings }: { holdings: Holding[] }) {
  const [selectedTicker, setSelectedTicker] = useState<string>(holdings[0]?.ticker || '');
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');

  const chartData = useMemo(() => {
    if (!forecastData?.forecast?.length || forecastData?.current_price == null) return [];

    return forecastData.forecast.map((item: any) => ({
      date: item.date,
      price: Number(item.predicted_price),
      upper: Number(item.upper_bound),
      lower: Number(item.lower_bound),
    }));
  }, [forecastData]);

  const fetchForecast = async (ticker: string, background = false) => {
    if (!ticker) return;
    if (!background) setLoading(true);
    try {
      const res = await getStockForecast(ticker);
      setForecastData(res.data);
      setLastSync(res.data.last_updated || new Date().toLocaleTimeString());
    } catch {
      if (!background) toast.error(`Failed to fetch real-time forecast for ${ticker}`);
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTicker) {
      fetchForecast(selectedTicker);
      
      const interval = setInterval(() => {
        fetchForecast(selectedTicker, true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [selectedTicker]);

  if (!holdings.length) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8 text-center text-slate-400">
        Add holdings to track Real-Time ML Price Forecasts.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-200">Live Real-Time Asset Stream</span>
          </div>
          <div className="text-xs text-slate-400">Active Monte Carlo simulation synced with live market ticks {lastSync && `(Last Sync: ${lastSync})`}</div>
        </div>
        <select
          value={selectedTicker}
          onChange={(e) => setSelectedTicker(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 focus:outline-none"
        >
          {holdings.map((h) => (
            <option key={h.id} value={h.ticker}>
              {h.ticker} ({h.company_name})
            </option>
          ))}
        </select>
      </div>

      {loading && !forecastData ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-12 text-center text-slate-400">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Connecting to Real-Time Feed for {selectedTicker}...
        </div>
      ) : forecastData ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-white">{forecastData.ticker} Real-Time 30-Day Outlook</div>
              <div className="mt-1 text-xs text-slate-400">Live Market Price: <span className="text-cyan-400 font-semibold">₹{forecastData.current_price}</span></div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Expected 30D Return</div>
              <div className={`text-lg font-bold ${forecastData.expected_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {forecastData.expected_return_pct >= 0 ? '+' : ''}{forecastData.expected_return_pct}%
              </div>
            </div>
          </div>

        <ResponsiveContainer width="100%" height={280} minWidth={100} minHeight={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
          <Tooltip 
            formatter={(v: any, name: any) => [
              `₹${v}`, 
              name === 'upper' ? 'Upper Bound' : name === 'lower' ? 'Lower Bound' : 'Mean Path'
            ]} 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }}
            labelStyle={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}
            itemSorter={(item: any) => {
              if (item.dataKey === 'upper') return -1;
              if (item.dataKey === 'price') return 0;
              return 1;
            }}
          />
          <Line type="monotone" dataKey="upper" stroke="#4ade80" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="upper" />
          <Line type="monotone" dataKey="lower" stroke="#f87171" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="lower" />
          <Line type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} dot={false} name="price" />
        </LineChart>
      </ResponsiveContainer>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" />Upper Confidence Bound</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-400" />Lower Confidence Bound</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400" />Live Mean Forecast Path</div>
          </div>
          <div className="text-[11px] text-slate-400 bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-700/30 leading-relaxed">
                <span className="text-cyan-400 font-semibold">Note:</span> Forecasts reflect statistical confidence paths based on recent market behavior and do not guarantee future returns.
              </div>
        </div>
      ) : null}
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
    try {
      const results: Record<string, any> = {};
      for (const h of holdings) {
        const res = await getNewsSentiment(h.ticker);
        results[h.ticker] = res.data;
      }
      setNews(results);
      setFetched(true);
      // inline loading indicator used; suppress global toasts for background fetch
    } catch {
      toast.error('Could not fetch news.');
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
    positive: 'border border-green-600/30 bg-green-900/40 text-green-400',
    negative: 'border border-red-600/30 bg-red-900/40 text-red-400',
    neutral: 'border border-slate-600/30 bg-slate-700/40 text-slate-400',
  };

  const sentimentIcon: Record<string, React.ReactNode> = {
    positive: <TrendingUp className="h-3.5 w-3.5" />,
    negative: <TrendingUp className="h-3.5 w-3.5 rotate-180" />,
    neutral: <BarChart3 className="h-3.5 w-3.5" />,
  };

  if (!fetched) {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-12 text-center text-slate-400">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Fetching latest news sentiment for your holdings...
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8 text-center transition hover:bg-slate-900/60">
        <div className="mb-4 flex justify-center"><Newspaper className="h-10 w-10 text-slate-400" /></div>
        <div className="mb-2 font-medium text-slate-200">News Sentiment Analysis</div>
        <div className="mx-auto mb-6 max-w-sm text-sm text-slate-400">
          Fetch latest news for each holding and flag negative signals before they hit your returns.
        </div>
        <button
          onClick={fetchAllNews}
          disabled={loading || !holdings.length}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#185FA5] px-6 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2579cc] disabled:opacity-50"
        >
          {loading ? 'Fetching...' : <><Newspaper className="h-4 w-4" /> Fetch news sentiment</>}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(news).map(([ticker, data]) => (
        <div key={ticker} className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5 transition hover:bg-slate-900/60">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-medium text-slate-200">{ticker}</div>
            <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${sentimentColor[data.sentiment]}`}>
              {sentimentIcon[data.sentiment]} {data.sentiment.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {data.articles?.map((a: any, i: number) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-lg p-3 transition hover:bg-slate-800/40"
              >
                <span className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${sentimentColor[a.sentiment]}`}>
                  {a.sentiment}
                </span>
                <div>
                  <div className="text-sm leading-snug text-slate-200">{a.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{a.source} · {a.published}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setFetched(false)} className="flex items-center justify-center gap-2 text-center text-xs text-slate-400 transition hover:text-slate-300">
        <RotateCcw className="h-3.5 w-3.5" /> Refresh news
      </button>
    </div>
  );
}

export default function AIInsightsPage({ holdings, lastUpdate }: AIInsightsPageProps) {
  const [activeTab, setActiveTab] = useState<'forecast' | 'sentiment'>('forecast');

  const tabs = [
    { id: 'forecast' as const, label: 'ML Price Forecast', icon: TrendingUp },
    { id: 'sentiment' as const, label: 'News & Market Sentiment', icon: Newspaper },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-2 shadow-lg shadow-slate-950/20 backdrop-blur-md">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'border-blue-500/30 bg-blue-600/20 shadow-sm shadow-blue-500/10'
                      : 'border-transparent bg-transparent hover:border-slate-700/60 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <tab.icon className={`h-4 w-4 text-current ${isActive ? 'text-blue-400' : 'text-slate-300'}`} />
                  <span className={isActive ? 'text-white' : 'text-slate-200'}>{tab.label}</span>
                </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'forecast' ? <ForecastTab holdings={holdings} /> : <NewsTab key={`news-${lastUpdate ?? 0}`} holdings={holdings} />}
    </div>
  );
}
