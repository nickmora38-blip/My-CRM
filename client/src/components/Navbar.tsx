import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import {
  setNotifications,
  dismissNotification,
} from '../store/slices/notificationsSlice';
import { notificationsAPI } from '../services/api';
import { RootState } from '../store';
import ExclusiveLogo from './ExclusiveLogo';

const navLinks = [
  { path: '/', label: 'Dashboard' },
  { path: '/leads', label: 'Leads' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/profile', label: 'Profile' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const user = useSelector((state: RootState) => state.auth.user);
  const { items: notifications, dismissed } = useSelector(
    (state: RootState) => state.notifications
  );

  const visible = notifications.filter((n) => !dismissed.includes(n.id));
  const unreadCount = visible.length;

  // Fetch notifications on mount and every 5 minutes
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await notificationsAPI.getAll();
        dispatch(setNotifications(res.data));
      } catch {
        // Silently fail in demo mode — no notifications available
      }
    };
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="bg-black border-b border-exclusive-black-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3">
            <ExclusiveLogo className="h-10 w-auto" />
            <div className="hidden sm:block">
              <span className="text-white text-xs font-medium opacity-60 leading-tight block">
                Mobile Home Transport
              </span>
              <span className="text-exclusive-red text-xs font-semibold tracking-widest uppercase">
                CRM
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  location.pathname === link.path
                    ? 'bg-exclusive-red text-white'
                    : 'text-gray-300 hover:text-white hover:bg-exclusive-black-card'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Role badge (desktop) */}
            {user?.role === 'admin' && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-exclusive-red/20 text-exclusive-red border border-exclusive-red/30">
                Admin
              </span>
            )}

            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-exclusive-black-card transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <svg
                  className="w-5 h-5 text-gray-400 hover:text-white transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-exclusive-red rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-exclusive-black-card border border-exclusive-black-border rounded-xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-exclusive-black-border">
                    <h3 className="text-white text-sm font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs text-gray-400">{unreadCount} alert{unreadCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {visible.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-gray-500 text-sm">🎉 All clear — no stale leads</p>
                      </div>
                    ) : (
                      visible.map((notif) => (
                        <div
                          key={notif.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b border-exclusive-black-border/50 last:border-0 hover:bg-black/30 transition-colors ${
                            notif.severity === 'high' ? 'border-l-2 border-l-exclusive-red' : 'border-l-2 border-l-yellow-600'
                          }`}
                        >
                          <span className="mt-0.5 shrink-0 text-base">
                            {notif.severity === 'high' ? '🔴' : '🟡'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-200 text-xs leading-relaxed">{notif.message}</p>
                            <Link
                              to={`/leads/${notif.leadId}`}
                              onClick={() => setNotifOpen(false)}
                              className="text-exclusive-red text-xs hover:underline mt-0.5 inline-block"
                            >
                              View lead →
                            </Link>
                          </div>
                          <button
                            onClick={() => dispatch(dismissNotification(notif.id))}
                            className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors text-sm leading-none"
                            aria-label="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Logout */}
            <button
              onClick={handleLogout}
              className="hidden sm:block text-gray-400 hover:text-exclusive-red text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-exclusive-black-card"
            >
              Sign Out
            </button>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="sm:hidden flex flex-col justify-center items-center w-11 h-11 rounded-lg hover:bg-exclusive-black-card transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${mobileOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white mt-1 transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white mt-1 transition-transform duration-200 ${mobileOpen ? '-translate-y-3 -rotate-45' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-exclusive-black-border bg-black">
          <div className="px-4 py-3 space-y-1">
            {user?.role === 'admin' && (
              <div className="px-4 py-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-exclusive-red/20 text-exclusive-red border border-exclusive-red/30">
                  Admin
                </span>
              </div>
            )}
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={closeMobile}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  location.pathname === link.path
                    ? 'bg-exclusive-red text-white'
                    : 'text-gray-300 hover:text-white hover:bg-exclusive-black-card'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => { closeMobile(); handleLogout(); }}
              className="w-full text-left flex items-center px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-exclusive-red hover:bg-exclusive-black-card transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
