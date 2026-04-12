import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { setLeads, addLead, updateLead, deleteLead, Lead } from '../store/slices/leadsSlice';
import { leadsAPI } from '../services/api';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const STATUSES: Lead['status'][] = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];
const SOURCES = ['Website', 'Referral', 'Social Media', 'Google Ads', 'Cold Call', 'Other'];
const HOME_TYPES = ['Single Wide', 'Double Wide', 'Triple Wide', 'Park Model'];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  status: 'new' as Lead['status'],
  source: 'Website',
  notes: '',
  homeType: 'Single Wide',
  origin: '',
  destination: '',
  estimatedValue: '',
  moveDate: '',
};

const DEMO_LEADS: Lead[] = [
  { id: '1', name: 'James Williams', email: 'james@example.com', phone: '555-0101', status: 'new', source: 'Website', notes: 'Interested in 3BR transport', createdAt: new Date().toISOString(), homeType: 'Single Wide', origin: 'Phoenix, AZ', destination: 'Tucson, AZ', estimatedValue: 3200 },
  { id: '2', name: 'Maria Garcia', email: 'maria@example.com', phone: '555-0102', status: 'contacted', source: 'Referral', notes: 'Needs quote ASAP', createdAt: new Date(Date.now() - 86400000).toISOString(), homeType: 'Double Wide', origin: 'Dallas, TX', destination: 'Houston, TX', estimatedValue: 5800 },
  { id: '3', name: 'Robert Johnson', email: 'robert@example.com', phone: '555-0103', status: 'qualified', source: 'Social Media', notes: 'Budget confirmed', createdAt: new Date(Date.now() - 172800000).toISOString(), homeType: 'Triple Wide', origin: 'Miami, FL', destination: 'Orlando, FL', estimatedValue: 9500 },
  { id: '4', name: 'Linda Martinez', email: 'linda@example.com', phone: '555-0104', status: 'proposal', source: 'Google Ads', notes: 'Proposal sent 3/15', createdAt: new Date(Date.now() - 259200000).toISOString(), homeType: 'Single Wide', origin: 'Denver, CO', destination: 'Boulder, CO', estimatedValue: 2900 },
  { id: '5', name: 'Michael Brown', email: 'michael@example.com', phone: '555-0105', status: 'closed_won', source: 'Website', notes: 'Completed transport', createdAt: new Date(Date.now() - 345600000).toISOString(), homeType: 'Double Wide', origin: 'Seattle, WA', destination: 'Portland, OR', estimatedValue: 6400 },
];

type SortField = 'name' | 'status' | 'estimatedValue' | 'createdAt' | 'source';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'kanban';

const KANBAN_COLUMNS: { status: Lead['status']; label: string; borderColor: string }[] = [
  { status: 'new', label: 'New', borderColor: 'border-exclusive-red/40' },
  { status: 'contacted', label: 'Contacted', borderColor: 'border-blue-700/40' },
  { status: 'qualified', label: 'Qualified', borderColor: 'border-yellow-700/40' },
  { status: 'proposal', label: 'Proposal', borderColor: 'border-purple-700/40' },
  { status: 'closed_won', label: 'Won', borderColor: 'border-green-700/40' },
  { status: 'closed_lost', label: 'Lost', borderColor: 'border-gray-700/40' },
];

export default function LeadsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const leads = useSelector((state: RootState) => state.leads.leads);

  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [quickStatusId, setQuickStatusId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCard = (id: string) => setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await leadsAPI.getAll();
        dispatch(setLeads(res.data));
      } catch {
        if (leads.length === 0) dispatch(setLeads(DEMO_LEADS));
      }
    };
    fetchLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditLead(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      notes: lead.notes,
      homeType: lead.homeType || 'Single Wide',
      origin: lead.origin || '',
      destination: lead.destination || '',
      estimatedValue: lead.estimatedValue?.toString() || '',
      moveDate: lead.moveDate || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
    };
    try {
      if (editLead) {
        const res = await leadsAPI.update(editLead.id, payload);
        dispatch(updateLead(res.data));
      } else {
        const res = await leadsAPI.create(payload);
        dispatch(addLead(res.data));
      }
    } catch {
      if (editLead) {
        dispatch(updateLead({ ...editLead, ...payload, estimatedValue: payload.estimatedValue }));
      } else {
        dispatch(addLead({
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          ...payload,
          estimatedValue: payload.estimatedValue,
        }));
      }
    }
    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    try {
      await leadsAPI.delete(id);
    } catch {
      // demo mode
    }
    dispatch(deleteLead(id));
  };

  const handleQuickStatus = async (lead: Lead, newStatus: Lead['status']) => {
    setQuickStatusId(null);
    try {
      const res = await leadsAPI.update(lead.id, { status: newStatus });
      dispatch(updateLead(res.data));
    } catch {
      dispatch(updateLead({ ...lead, status: newStatus }));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Source', 'Home Type', 'Origin', 'Destination', 'Estimated Value', 'Notes', 'Created'];
    const rows = filtered.map((l) => [
      l.name,
      l.email,
      l.phone,
      l.status,
      l.source,
      l.homeType || '',
      l.origin || '',
      l.destination || '',
      l.estimatedValue ?? '',
      (l.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
      new Date(l.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = leads
    .filter((l) => {
      const matchSearch =
        !search ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search);
      const matchStatus = filterStatus === 'all' || l.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      if (sortField === 'estimatedValue') {
        valA = a.estimatedValue ?? -1;
        valB = b.estimatedValue ?? -1;
      } else if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else {
        valA = ((a[sortField] as string) || '').toLowerCase();
        valB = ((b[sortField] as string) || '').toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const inputClass =
    'w-full px-3 py-2 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red text-sm placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <span className="ml-1 text-exclusive-red">{sortDir === 'asc' ? '↑' : '↓'}</span>
    ) : (
      <span className="ml-1 text-gray-700">↕</span>
    );

  // Normalize phone for tel: links (strip formatting, keep +)
  const normPhone = (p: string) => p.replace(/[^\d+]/g, '');

  return (
    <div className="min-h-screen bg-black pb-20 sm:pb-0" onClick={() => quickStatusId && setQuickStatusId(null)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Leads</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">{leads.length} total leads</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-400 border border-exclusive-black-border rounded-lg hover:text-white hover:border-gray-500 transition-colors"
              title="Export leads to CSV"
            >
              ↓ Export
            </button>
            <Button onClick={openCreate} className="shrink-0">+ Add Lead</Button>
          </div>
        </div>

        {/* Filters + View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-exclusive-black-card border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red text-sm placeholder-gray-600"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-exclusive-black-card border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red text-sm"
          >
            <option value="all">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          {/* View Toggle */}
          <div className="flex rounded-lg border border-exclusive-black-border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-exclusive-red text-white' : 'text-gray-400 hover:text-white bg-exclusive-black-card'}`}
              title="Table view"
            >
              ≡ List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'kanban' ? 'bg-exclusive-red text-white' : 'text-gray-400 hover:text-white bg-exclusive-black-card'}`}
              title="Kanban view"
            >
              ⊞ Board
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          /* ── TABLE / CARD VIEW ── */
          <>
            {/* Mobile cards (shown on xs/sm, hidden md+) */}
            <div className="md:hidden space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-sm">
                  {search || filterStatus !== 'all' ? 'No leads match your filters.' : 'No leads yet. Click "+ Add Lead" to get started.'}
                </div>
              ) : (
                filtered.map((lead) => {
                  const expanded = !!expandedCards[lead.id];
                  return (
                    <div
                      key={lead.id}
                      className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-4"
                    >
                      {/* Top: name + status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="text-left flex-1 min-w-0"
                        >
                          <p className="text-white font-semibold text-sm leading-tight hover:text-exclusive-red transition-colors truncate">{lead.name}</p>
                        </button>
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setQuickStatusId(quickStatusId === lead.id ? null : lead.id)}
                            className="focus:outline-none"
                            title="Tap to change status"
                          >
                            <StatusBadge status={lead.status} />
                          </button>
                          {quickStatusId === lead.id && (
                            <div className="absolute right-0 top-8 z-20 bg-exclusive-black-card border border-exclusive-black-border rounded-lg shadow-xl py-1 min-w-[140px]">
                              {STATUSES.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handleQuickStatus(lead, s)}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-black/40 transition-colors ${s === lead.status ? 'text-exclusive-red' : 'text-gray-300'}`}
                                >
                                  {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contact action links */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {lead.phone && (
                          <a
                            href={`tel:${normPhone(lead.phone)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-900/30 border border-green-800/40 rounded-lg text-green-400 text-xs font-medium hover:bg-green-900/50 transition-colors"
                          >
                            📞 {lead.phone}
                          </a>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-900/30 border border-blue-800/40 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-900/50 transition-colors truncate max-w-full"
                          >
                            ✉ {lead.email}
                          </a>
                        )}
                      </div>

                      {/* Always-visible summary fields */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                        {lead.estimatedValue != null && (
                          <>
                            <span className="text-gray-500">Value</span>
                            <span className="text-white font-medium">${lead.estimatedValue.toLocaleString()}</span>
                          </>
                        )}
                        {lead.source && (
                          <>
                            <span className="text-gray-500">Source</span>
                            <span className="text-gray-300">{lead.source}</span>
                          </>
                        )}
                        {lead.homeType && (
                          <>
                            <span className="text-gray-500">Home Type</span>
                            <span className="text-gray-300">{lead.homeType}</span>
                          </>
                        )}
                      </div>

                      {/* Expandable details */}
                      <button
                        onClick={() => toggleCard(lead.id)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {expanded ? '▲ Less' : '▼ More details'}
                      </button>
                      {expanded && (
                        <div className="mt-2 pt-2 border-t border-exclusive-black-border grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {lead.origin && (
                            <>
                              <span className="text-gray-500">From</span>
                              <span className="text-gray-300">{lead.origin}</span>
                            </>
                          )}
                          {lead.destination && (
                            <>
                              <span className="text-gray-500">To</span>
                              <span className="text-gray-300">{lead.destination}</span>
                            </>
                          )}
                          {lead.moveDate && (
                            <>
                              <span className="text-gray-500">Move Date</span>
                              <span className="text-gray-300">{lead.moveDate}</span>
                            </>
                          )}
                          {lead.notes && (
                            <div className="col-span-2 mt-1">
                              <span className="text-gray-500 block mb-0.5">Notes</span>
                              <span className="text-gray-300">{lead.notes}</span>
                            </div>
                          )}
                          <div className="col-span-2 mt-1">
                            <span className="text-gray-500 block mb-0.5">Created</span>
                            <span className="text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}

                      {/* Card actions */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-exclusive-black-border">
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="flex-1 py-1.5 text-xs font-medium text-gray-300 bg-black border border-exclusive-black-border rounded-lg hover:border-exclusive-red/50 hover:text-white transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEdit(lead)}
                          className="flex-1 py-1.5 text-xs font-medium text-gray-300 bg-black border border-exclusive-black-border rounded-lg hover:border-exclusive-red/50 hover:text-white transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="flex-1 py-1.5 text-xs font-medium text-gray-500 bg-black border border-exclusive-black-border rounded-lg hover:border-exclusive-red/50 hover:text-exclusive-red transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop table (hidden on mobile) */}
            <div className="hidden md:block bg-exclusive-black-card border border-exclusive-black-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-exclusive-black-border">
                      <th
                        className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                        onClick={() => handleSort('name')}
                      >
                        Contact <SortIcon field="name" />
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Route</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Home Type</th>
                      <th
                        className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th
                        className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                        onClick={() => handleSort('estimatedValue')}
                      >
                        Value <SortIcon field="estimatedValue" />
                      </th>
                      <th
                        className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                        onClick={() => handleSort('source')}
                      >
                        Source <SortIcon field="source" />
                      </th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        className={`${idx < filtered.length - 1 ? 'border-b border-exclusive-black-border' : ''} hover:bg-black/40 transition-colors`}
                      >
                        <td className="px-6 py-4">
                          <button
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            className="text-left"
                          >
                            <p className="text-white font-medium text-sm hover:text-exclusive-red transition-colors">{lead.name}</p>
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-500 hover:text-blue-400 text-xs mt-0.5 block transition-colors"
                            >
                              {lead.email}
                            </a>
                            <a
                              href={`tel:${normPhone(lead.phone)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-600 hover:text-green-400 text-xs block transition-colors"
                            >
                              {lead.phone}
                            </a>
                          </button>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <p className="text-gray-300 text-sm">{lead.origin || '—'}</p>
                          <p className="text-gray-500 text-xs mt-0.5">→ {lead.destination || '—'}</p>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="text-gray-300 text-sm">{lead.homeType || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setQuickStatusId(quickStatusId === lead.id ? null : lead.id)}
                              className="focus:outline-none"
                              title="Click to change status"
                            >
                              <StatusBadge status={lead.status} />
                            </button>
                            {quickStatusId === lead.id && (
                              <div className="absolute left-0 top-8 z-20 bg-exclusive-black-card border border-exclusive-black-border rounded-lg shadow-xl py-1 min-w-[140px]">
                                {STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => handleQuickStatus(lead, s)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-black/40 transition-colors ${s === lead.status ? 'text-exclusive-red' : 'text-gray-300'}`}
                                  >
                                    {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white text-sm font-medium">
                            {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-400 text-xs">{lead.source}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className="text-gray-400 hover:text-white text-xs transition-colors px-2 py-1 rounded hover:bg-exclusive-black-border"
                            >
                              View
                            </button>
                            <button
                              onClick={() => openEdit(lead)}
                              className="text-gray-400 hover:text-white text-xs transition-colors px-2 py-1 rounded hover:bg-exclusive-black-border"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(lead.id)}
                              className="text-gray-500 hover:text-exclusive-red text-xs transition-colors px-2 py-1 rounded hover:bg-exclusive-red/10"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-16 text-gray-500">
                    {search || filterStatus !== 'all' ? 'No leads match your filters.' : 'No leads yet. Click "+ Add Lead" to get started.'}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ── KANBAN VIEW ── */
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {KANBAN_COLUMNS.map((col) => {
                const colLeads = filtered.filter((l) => l.status === col.status);
                return (
                  <div key={col.status} className={`w-64 bg-exclusive-black-card border ${col.borderColor} rounded-xl flex flex-col`}>
                    <div className="px-4 py-3 border-b border-exclusive-black-border flex items-center justify-between">
                      <span className="text-white text-sm font-semibold">{col.label}</span>
                      <span className="text-gray-500 text-xs bg-exclusive-black-border px-2 py-0.5 rounded-full">{colLeads.length}</span>
                    </div>
                    <div className="p-3 space-y-3 flex-1 min-h-[200px]">
                      {colLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-black border border-exclusive-black-border rounded-lg p-3 cursor-pointer hover:border-exclusive-red/40 transition-colors"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <p className="text-white text-sm font-medium mb-1 leading-tight">{lead.name}</p>
                          {lead.homeType && (
                            <p className="text-gray-500 text-xs mb-1">{lead.homeType}</p>
                          )}
                          {(lead.origin || lead.destination) && (
                            <p className="text-gray-500 text-xs mb-1 truncate">
                              {lead.origin} → {lead.destination}
                            </p>
                          )}
                          {lead.estimatedValue != null && (
                            <p className="text-exclusive-red text-xs font-semibold mt-2">
                              ${lead.estimatedValue.toLocaleString()}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-gray-600 text-xs">{lead.source}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                              className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                      {colLeads.length === 0 && (
                        <p className="text-gray-700 text-xs text-center pt-4">No leads</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editLead ? 'Edit Lead' : 'Add New Lead'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Full Name *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="555-0100" />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Lead['status'] })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select className={inputClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Home Type</label>
              <select className={inputClass} value={form.homeType} onChange={(e) => setForm({ ...form, homeType: e.target.value })}>
                {HOME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estimated Value ($)</label>
              <input type="number" className={inputClass} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0" min="0" />
            </div>
            <div>
              <label className={labelClass}>Origin</label>
              <input className={inputClass} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="City, State" />
            </div>
            <div>
              <label className={labelClass}>Destination</label>
              <input className={inputClass} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="City, State" />
            </div>
            <div>
              <label className={labelClass}>Move Date</label>
              <input type="date" className={inputClass} value={form.moveDate} onChange={(e) => setForm({ ...form, moveDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea className={`${inputClass} resize-none`} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : editLead ? 'Save Changes' : 'Add Lead'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
