import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login({ username: email, password });
      loginUser(res.data.access_token);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center px-4 py-10 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-600/20 to-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-gradient-to-tl from-purple-600/15 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
      </div>
      <div className="bg-slate-950/70 backdrop-blur-xl rounded-3xl shadow-[0_30px_90px_-40px_rgba(15,23,42,0.8)] border border-slate-600/30 w-full max-w-md p-8 relative z-10">
        <div className="text-2xl font-semibold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">Quantfolio</div>
        <div className="text-slate-400 text-sm mb-8">Sign in to your account</div>

        {error && (
          <div className="bg-red-900/40 backdrop-blur-md text-red-200 text-sm px-4 py-3 rounded-2xl mb-4 border border-red-600/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-600/40 rounded-2xl px-3 py-2.5 text-sm text-slate-100 bg-slate-900/40 backdrop-blur-md placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/60 transition-all hover:bg-slate-900/60"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-600/40 rounded-2xl px-3 py-2.5 text-sm text-slate-100 bg-slate-900/40 backdrop-blur-md placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/60 transition-all hover:bg-slate-900/60"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2.5 rounded-2xl text-sm font-semibold hover:from-blue-500 hover:to-cyan-400 transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400 font-semibold hover:text-cyan-400 transition">Sign up</Link>
        </div>
      </div>
    </div>
  );
}