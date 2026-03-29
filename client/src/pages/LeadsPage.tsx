import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
};

const DEMO_LEADS: Lead[] = [
  { id: '1', name: 'James Williams', email: 'james@example.com', phone: '555-0101', status: 'new', source: 'Website', notes: 'Interested in 3BR transport', createdAt: new Date().toISOString(), homeType: 'Single Wide', origin: 'Phoenix, AZ', destination: 'Tucson, AZ', estimatedValue: 3200 },
  { id: '2', name: 'Maria Garcia', email: 'maria@example.com', phone: '555-0102', status: 'contacted', source: 'Referral', notes: 'Needs quote ASAP', createdAt: new Date(Date.now() - 86400000).toISOString(), homeType: 'Double Wide', origin: 'Dallas, TX', destination: 'Houston, TX', estimatedValue: 5800 },
  { id: '3', name: 'Robert Johnson', email: 'robert@example.com', phone: '555-0103', status: 'qualified', source: 'Social Media', notes: 'Budget confirmed', createdAt: new Date(Date.now() - 172800000).toISOString(), homeType: 'Triple Wide', origin: 'Miami, FL', destination: 'Orlando, FL', estimatedValue: 9500 },
  { id: '4', name: 'Linda Martinez', email: 'linda@example.com', phone: '555-0104', status: 'proposal', source: 'Google Ads', notes: 'Proposal sent 3/15', createdAt: new Date(Date.now() - 259200000).toISOString(), homeType: 'Single Wide', origin: 'Denver, CO', destination: 'Boulder, CO', estimatedValue: 2900 },
  { id: '5', name: 'Michael Brown', email: 'michael@example.com', phone: '555-0105', status: 'closed_won', source: 'Website', notes: 'Completed transport', createdAt: new Date(Date.now() - 345600000).toISOString(), homeType: 'Double Wide', origin: 'Seattle, WA', destination: 'Portland, OR', estimatedValue: 6400 },
];

export default function LeadsPage() {
  const dispatch = useDispatch();
  const leads = useSelector((state: RootState) => state.leads.leads);

  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [saving, setSaving] = useState(false);

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
      // Demo mode: update local state
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

  const filtered = leads.filter((l) => {
    const matchSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const inputClass =
    'w-full px-3 py-2 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red text-sm placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Leads</h1>
            <p className="text-gray-400 text-sm mt-1">{leads.length} total leads</p>
          </div>
          <Button onClick={openCreate}>+ Add Lead</Button>
        </div>

        {/* Filters */}
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
        </div>

        {/* Leads Table */}
        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-exclusive-black-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Route</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Home Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Value</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Source</th>
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
                      <p className="text-white font-medium text-sm">{lead.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{lead.email}</p>
                      <p className="text-gray-600 text-xs">{lead.phone}</p>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <p className="text-gray-300 text-sm">{lead.origin || '—'}</p>
                      <p className="text-gray-500 text-xs mt-0.5">→ {lead.destination || '—'}</p>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-gray-300 text-sm">{lead.homeType || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-white text-sm font-medium">
                        {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-gray-400 text-xs">{lead.source}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
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
