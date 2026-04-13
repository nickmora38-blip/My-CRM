import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import Button from '../components/Button';
import ExclusiveLogo from '../components/ExclusiveLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
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
            <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
            <p className="text-gray-400 text-sm mt-1">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="text-gray-300 text-sm">
                If an account with that email exists, a reset link has been sent. Check your inbox.
              </p>
              <Link
                to="/login"
                className="inline-block text-exclusive-red hover:text-red-400 text-sm font-medium transition-colors"
              >
                ← Back to Sign In
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

                <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              <div className="mt-5 text-center text-sm text-gray-500">
                <Link to="/login" className="text-exclusive-red hover:text-red-400 font-medium transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
