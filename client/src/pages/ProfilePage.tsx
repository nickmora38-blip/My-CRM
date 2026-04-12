import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { usersAPI } from '../services/api';
import { usePushNotifications } from '../hooks/usePushNotifications';

const inputClass =
  'w-full px-3 py-2 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red text-sm placeholder-gray-600';
const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  smsOptIn?: boolean;
  role: string;
}

export default function ProfilePage() {
  const authUser = useSelector((state: RootState) => state.auth.user);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ name: '', phoneNumber: '', smsOptIn: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { supported, subscribed, loading: pushLoading, error: pushError, subscribe, unsubscribe } =
    usePushNotifications();

  useEffect(() => {
    usersAPI.getMe()
      .then((res) => {
        const u = (res.data as { user: UserProfile }).user;
        setProfile(u);
        setForm({
          name: u.name || '',
          phoneNumber: u.phoneNumber || '',
          smsOptIn: !!u.smsOptIn,
        });
      })
      .catch(() => {
        if (authUser) {
          setProfile({ ...authUser, role: authUser.role });
        }
      });
  }, [authUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await usersAPI.updateMe({
        name: form.name,
        phoneNumber: form.phoneNumber,
        smsOptIn: form.smsOptIn,
      });
      const updated = (res.data as { user: UserProfile }).user;
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 sm:pb-0">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Profile & Notifications</h1>

        {/* Profile form */}
        <form onSubmit={handleSave} className="space-y-4 mb-6">
          <div className="p-4 bg-exclusive-black-card border border-exclusive-black-border rounded-xl space-y-4">
            <h2 className="text-sm font-semibold text-white">Account Info</h2>
            <div>
              <label className={labelClass}>Display Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={profile.email} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <input value={profile.role} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
            </div>
          </div>

          <div className="p-4 bg-exclusive-black-card border border-exclusive-black-border rounded-xl space-y-4">
            <h2 className="text-sm font-semibold text-white">📱 SMS Notifications</h2>
            <p className="text-gray-500 text-xs">Receive task reminders via SMS when a task is due soon or assigned to you.</p>
            <div>
              <label className={labelClass}>Phone Number (for SMS)</label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="+15551234567"
                className={inputClass}
              />
              <p className="text-gray-600 text-xs mt-1">Include country code, e.g. +1 for US</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, smsOptIn: !f.smsOptIn }))}
                className={`w-10 h-6 rounded-full transition-colors relative ${form.smsOptIn ? 'bg-exclusive-red' : 'bg-gray-700'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.smsOptIn ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </div>
              <span className="text-sm text-gray-300">Receive SMS notifications</span>
            </label>
          </div>

          {error && <p className="text-exclusive-red text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-exclusive-red hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </form>

        {/* Push notifications */}
        {supported && (
          <div className="p-4 bg-exclusive-black-card border border-exclusive-black-border rounded-xl">
            <h2 className="text-sm font-semibold text-white mb-2">🔔 Push Notifications</h2>
            <p className="text-gray-500 text-xs mb-3">
              {subscribed
                ? 'Push notifications are enabled on this device.'
                : 'Enable push notifications to receive task reminders even when the app is in the background.'}
            </p>
            {pushError && <p className="text-red-400 text-xs mb-2">{pushError}</p>}
            <button
              onClick={subscribed ? unsubscribe : subscribe}
              disabled={pushLoading}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                subscribed
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  : 'bg-exclusive-red text-white hover:bg-red-700'
              }`}
            >
              {pushLoading ? '...' : subscribed ? '🔕 Disable Push' : '🔔 Enable Push Notifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
