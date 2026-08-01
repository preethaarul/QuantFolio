import axios from 'axios';

// 1. Sanitize baseURL to prevent double slashes (e.g. domain.com//api/...)
const rawBaseURL = import.meta.env.VITE_API_URL || '';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL.slice(0, -1) : rawBaseURL;

const API = axios.create({
  baseURL,
});

// 2. Automatically attach JWT token to every outgoing request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Handle 401 Unauthorized responses globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear invalid/expired token and redirect to login if not already there
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const register = (data: { full_name: string; email: string; password: string }) =>
  API.post('/api/auth/register', data);

export const login = (data: { username: string; password: string }) => {
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);
  return API.post('/api/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
};

// --- Portfolio (No trailing slashes) ---
export const getPortfolios = () => API.get('/api/portfolio');
export const createPortfolio = (name: string) => API.post('/api/portfolio', { name });
export const getHoldings = (portfolioId: number) => API.get(`/api/portfolio/${portfolioId}/holdings`);
export const addHolding = (
  portfolioId: number,
  data: {
    ticker: string;
    company_name: string;
    quantity: number;
    buy_price: number;
  }
) => API.post(`/api/portfolio/${portfolioId}/holdings`, data);
export const deleteHolding = (portfolioId: number, holdingId: number) =>
  API.delete(`/api/portfolio/${portfolioId}/holdings/${holdingId}`);

// --- Stocks ---
export const getStockPrice = (ticker: string) => API.get(`/api/stocks/${ticker}`);
export const getMultiplePrices = (tickers: string[]) => API.post('/api/stocks/prices', tickers);
export const searchStocks = (query: string) => API.get(`/api/stocks/search/${query}`);
export const getNewsSentiment = (ticker: string) => API.get(`/api/stocks/news/${ticker}`);

// --- Analytics & Risk ---
export const getRiskMetrics = (portfolioId: number) => API.get(`/api/stocks/risk/${portfolioId}`);
export const getRiskScore = (portfolioId: number) => API.get(`/api/stocks/riskscore/${portfolioId}`);
export const getPortfolioHistory = (portfolioId: number) => API.get(`/api/stocks/history/${portfolioId}`);
export const getBenchmarkComparison = (portfolioId: number) => API.get(`/api/stocks/benchmark/${portfolioId}`);
export const getPortfolioHealth = (portfolioId: number) => API.get(`/api/stocks/health/${portfolioId}`);
export const whatIfSimulation = (portfolioId: number, adjustments: Record<string, number>) =>
  API.post(`/api/stocks/whatif/${portfolioId}`, adjustments);

// --- AI Advisor ---
export const getAIAdvice = (portfolioId: number) => API.get(`/api/ai/advice/${portfolioId}`);

export default API;