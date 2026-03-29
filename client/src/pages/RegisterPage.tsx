import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setAuth, setError } from '../store/slices/authSlice';
import { RootState } from '../store';
import { authAPI } from '../services/api';
import Button from '../components/Button';
import ExclusiveLogo from '../components/ExclusiveLogo';

export default function RegisterPage() {
  const [name, setName] = useState('');
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
      const response = await authAPI.register({ name, email, password });
      dispatch(setAuth(response.data));
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      dispatch(setError(axiosErr.response?.data?.error || 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-exclusive-red/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-exclusive-red/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ExclusiveLogo className="h-14 w-auto" />
        </div>

        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-gray-400 text-sm mt-1">Join the Exclusive CRM platform</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-exclusive-red/10 border border-exclusive-red/30 rounded-lg text-exclusive-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red placeholder-gray-600"
                placeholder="John Doe"
                required
              />
            </div>

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
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red placeholder-gray-600"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-exclusive-red hover:text-exclusive-red-light font-medium transition-colors">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
