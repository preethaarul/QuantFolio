import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Automatically attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const register = (data: { full_name: string; email: string; password: string }) =>
  API.post('/api/auth/register', data);

export const login = (data: { username: string; password: string }) => {
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);
  return API.post('/api/auth/login', formData);
};

// Portfolio
export const getPortfolios = () => API.get('/api/portfolio/');
export const createPortfolio = (name: string) => API.post('/api/portfolio/', { name });
export const getHoldings = (portfolioId: number) => API.get(`/api/portfolio/${portfolioId}/holdings`);
export const addHolding = (portfolioId: number, data: {
  ticker: string;
  company_name: string;
  quantity: number;
  buy_price: number;
}) => API.post(`/api/portfolio/${portfolioId}/holdings`, data);
export const deleteHolding = (portfolioId: number, holdingId: number) =>
  API.delete(`/api/portfolio/${portfolioId}/holdings/${holdingId}`);

// Stocks
export const getStockPrice = (ticker: string) => API.get(`/api/stocks/${ticker}`);
export const getRiskMetrics = (portfolioId: number) => API.get(`/api/stocks/risk/${portfolioId}`);

// AI
export const getAIAdvice = (portfolioId: number) => API.get(`/api/ai/advice/${portfolioId}`);

export const getMultiplePrices = (tickers: string[]) =>
  API.post('/api/stocks/prices', tickers);

export const getNewsSentiment = (ticker: string) =>
  API.get(`/api/stocks/news/${ticker}`);

export const whatIfSimulation = (portfolioId: number, adjustments: Record<string, number>) =>
  API.post(`/api/stocks/whatif/${portfolioId}`, adjustments);

export const searchStocks = (query: string) =>
  API.get(`/api/stocks/search/${query}`);

export const getPortfolioHistory = (portfolioId: number) =>
  API.get(`/api/stocks/history/${portfolioId}`);

export const getRiskScore = (portfolioId: number) =>
  API.get(`/api/stocks/riskscore/${portfolioId}`);

export const getBenchmarkComparison = (portfolioId: number) =>
  API.get(`/api/stocks/benchmark/${portfolioId}`);

export const getPortfolioHealth = (portfolioId: number) =>
  API.get(`/api/stocks/health/${portfolioId}`);