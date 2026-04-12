import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/leads', label: 'Leads', icon: '🎯' },
  { path: '/tasks', label: 'Tasks', icon: '📋' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export default function BottomTabBar() {
  const location = useLocation();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-exclusive-black-border safe-area-inset-bottom">
      <div className="flex">
        {tabs.map((tab) => {
          const active =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center py-2 pt-3 text-xs font-medium transition-colors ${
                active ? 'text-exclusive-red' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-xl leading-none mb-1">{tab.icon}</span>
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
