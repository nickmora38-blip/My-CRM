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

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

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

          {/* Nav Links */}
          <div className="flex items-center gap-1">
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

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-exclusive-red text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-exclusive-black-card"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
