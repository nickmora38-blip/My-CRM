import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../store';
import { setLeads, Lead } from '../store/slices/leadsSlice';
import { leadsAPI } from '../services/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

const DEMO_LEADS: Lead[] = [
  { id: '1', name: 'James Williams', email: 'james@example.com', phone: '555-0101', status: 'new', source: 'Website', notes: 'Interested in 3BR transport', createdAt: new Date().toISOString(), homeType: 'Single Wide', origin: 'Phoenix, AZ', destination: 'Tucson, AZ', estimatedValue: 3200 },
  { id: '2', name: 'Maria Garcia', email: 'maria@example.com', phone: '555-0102', status: 'contacted', source: 'Referral', notes: 'Needs quote ASAP', createdAt: new Date(Date.now() - 86400000).toISOString(), homeType: 'Double Wide', origin: 'Dallas, TX', destination: 'Houston, TX', estimatedValue: 5800 },
  { id: '3', name: 'Robert Johnson', email: 'robert@example.com', phone: '555-0103', status: 'qualified', source: 'Social Media', notes: 'Budget confirmed', createdAt: new Date(Date.now() - 172800000).toISOString(), homeType: 'Triple Wide', origin: 'Miami, FL', destination: 'Orlando, FL', estimatedValue: 9500 },
  { id: '4', name: 'Linda Martinez', email: 'linda@example.com', phone: '555-0104', status: 'proposal', source: 'Google Ads', notes: 'Proposal sent 3/15', createdAt: new Date(Date.now() - 259200000).toISOString(), homeType: 'Single Wide', origin: 'Denver, CO', destination: 'Boulder, CO', estimatedValue: 2900 },
  { id: '5', name: 'Michael Brown', email: 'michael@example.com', phone: '555-0105', status: 'closed_won', source: 'Website', notes: 'Completed transport', createdAt: new Date(Date.now() - 345600000).toISOString(), homeType: 'Double Wide', origin: 'Seattle, WA', destination: 'Portland, OR', estimatedValue: 6400 },
  { id: '6', name: 'Patricia Davis', email: 'patricia@example.com', phone: '555-0106', status: 'closed_lost', source: 'Referral', notes: 'Went with competitor', createdAt: new Date(Date.now() - 432000000).toISOString(), homeType: 'Single Wide', origin: 'Chicago, IL', destination: 'Milwaukee, WI', estimatedValue: 3100 },
];

const STATUS_COLORS: Record<string, string> = {
  new: '#DC143C',
  contacted: '#3B82F6',
  qualified: '#EAB308',
  proposal: '#8B5CF6',
  closed_won: '#22C55E',
  closed_lost: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  closed_won: 'Won',
  closed_lost: 'Lost',
};

export default function DashboardPage() {
  const dispatch = useDispatch();
  const leads = useSelector((state: RootState) => state.leads.leads);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await leadsAPI.getAll();
        dispatch(setLeads(res.data.leads));
      } catch {
        if (leads.length === 0) {
          dispatch(setLeads(DEMO_LEADS));
        }
        setError('Could not reach the server — showing demo data.');
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-exclusive-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === 'new').length;
  const wonLeads = leads.filter((l) => l.status === 'closed_won').length;
  const totalValue = leads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  const statusCounts = Object.entries(STATUS_LABELS).map(([status, label]) => ({
    status,
    label,
    count: leads.filter((l) => l.status === status).length,
    color: STATUS_COLORS[status],
  }));

  const maxCount = Math.max(...statusCounts.map((s) => s.count), 1);

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-black pb-20 sm:pb-0">
      {error && (
        <div className="bg-yellow-900/40 border-b border-yellow-700/60 text-yellow-300 text-sm px-4 py-2 text-center">
          {error}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Welcome to Exclusive Mobile Home Transport CRM</p>
          </div>
          <Link
            to="/leads"
            className="bg-exclusive-red hover:bg-exclusive-red-dark text-white font-semibold px-3 sm:px-4 py-2.5 rounded-lg transition-colors text-sm shrink-0 min-h-[44px] flex items-center"
          >
            + New Lead
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard title="Total Leads" value={totalLeads} icon="👥" trend="12%" trendUp={true} />
          <StatCard title="New Leads" value={newLeads} icon="🆕" trend="8%" trendUp={true} />
          <StatCard title="Deals Won" value={wonLeads} icon="✅" trend="5%" trendUp={true} />
          <StatCard title="Pipeline Value" value={`$${totalValue.toLocaleString()}`} icon="💰" trend="15%" trendUp={true} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Bar Chart (CSS-based) */}
          <div className="lg:col-span-2 bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6">
            <h2 className="text-white font-semibold mb-5">Leads by Status</h2>
            <div className="space-y-3">
              {statusCounts.map(({ status, label, count, color }) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs w-20 shrink-0">{label}</span>
                  <div className="flex-1 bg-exclusive-black-border rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-2 transition-all duration-500"
                      style={{
                        width: `${Math.max((count / maxCount) * 100, count > 0 ? 5 : 0)}%`,
                        backgroundColor: color,
                      }}
                    >
                      {count > 0 && (
                        <span className="text-white text-xs font-bold">{count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-white text-sm font-medium w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Panel */}
          <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Overview</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-exclusive-black-border">
                <span className="text-gray-400 text-sm">Conversion Rate</span>
                <span className="text-exclusive-red font-bold text-lg">{conversionRate}%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-exclusive-black-border">
                <span className="text-gray-400 text-sm">Pipeline Value</span>
                <span className="text-white font-semibold">${totalValue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-exclusive-black-border">
                <span className="text-gray-400 text-sm">Total Leads</span>
                <span className="text-white font-semibold">{totalLeads}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-400 text-sm">Won Deals</span>
                <span className="text-green-400 font-semibold">{wonLeads}</span>
              </div>
            </div>

            {totalLeads > 0 && (
              <div className="mt-4 pt-4 border-t border-exclusive-black-border">
                <p className="text-gray-400 text-xs mb-3">Status Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {statusCounts.filter((s) => s.count > 0).map(({ status, label, count, color }) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-gray-400 text-xs">{label}: {count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Leads Table */}
        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl">
          <div className="px-6 py-4 border-b border-exclusive-black-border flex items-center justify-between">
            <h2 className="text-white font-semibold">Recent Leads</h2>
            <Link to="/leads" className="text-exclusive-red hover:text-exclusive-red-light text-sm font-medium transition-colors">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-exclusive-black-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Route</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Value</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    className={`${idx < recentLeads.length - 1 ? 'border-b border-exclusive-black-border' : ''} hover:bg-black/40 transition-colors`}
                  >
                    <td className="px-6 py-4">
                      <p className="text-white font-medium text-sm">{lead.name}</p>
                      <p className="text-gray-500 text-xs">{lead.phone}</p>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-gray-300 text-sm">{lead.origin || '—'}</p>
                      <p className="text-gray-500 text-xs">→ {lead.destination || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-white text-sm font-medium">
                        {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentLeads.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No leads yet.{' '}
                <Link to="/leads" className="text-exclusive-red">
                  Add your first lead
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
