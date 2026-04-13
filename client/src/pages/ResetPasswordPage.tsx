import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import Button from '../components/Button';
import ExclusiveLogo from '../components/ExclusiveLogo';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authAPI.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Something went wrong. Please try again.');
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
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-gray-400 text-sm mt-1">Enter your new password below.</p>
          </div>

          {!token ? (
            <div className="text-center space-y-4">
              <p className="text-exclusive-red text-sm">Invalid or missing reset link.</p>
              <Link to="/forgot-password" className="text-exclusive-red hover:text-red-400 text-sm font-medium transition-colors">
                Request a new link →
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <p className="text-gray-300 text-sm">
                Password updated! Redirecting you to sign in…
              </p>
              <Link to="/login" className="inline-block text-exclusive-red hover:text-red-400 text-sm font-medium transition-colors">
                Sign In →
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 bg-exclusive-red/10 border border-exclusive-red/30 rounded-lg text-exclusive-red text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red placeholder-gray-600"
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red placeholder-gray-600"
                    placeholder="Re-enter your password"
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
