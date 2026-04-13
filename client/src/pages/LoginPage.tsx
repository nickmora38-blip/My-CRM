import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setAuth, setError } from '../store/slices/authSlice';
import { RootState } from '../store';
import { authAPI } from '../services/api';
import Button from '../components/Button';
import ExclusiveLogo from '../components/ExclusiveLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const error = useSelector((state: RootState) => state.auth.error);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login({ email, password });
      dispatch(setAuth(response.data));
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      dispatch(setError(axiosErr.response?.data?.error || 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-exclusive-red/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-exclusive-red/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <ExclusiveLogo className="h-14 w-auto" />
        </div>

        {/* Card */}
        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to your CRM account</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-exclusive-red/10 border border-exclusive-red/30 rounded-lg text-exclusive-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red placeholder-gray-600"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                <a href="/forgot-password" className="text-xs text-gray-500 hover:text-exclusive-red transition-colors">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red placeholder-gray-600"
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <a href="/register" className="text-exclusive-red hover:text-exclusive-red-light font-medium transition-colors">
              Register here
            </a>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © 2026 Exclusive Mobile Home Transport. All rights reserved.
        </p>
      </div>
    </div>
  );
}