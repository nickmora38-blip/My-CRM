import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import ExclusiveLogo from './ExclusiveLogo';

const navLinks = [
  { path: '/', label: 'Dashboard' },
  { path: '/leads', label: 'Leads' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);

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
