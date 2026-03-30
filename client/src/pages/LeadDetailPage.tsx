import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { updateLead, deleteLead, Lead } from '../store/slices/leadsSlice';
import { leadsAPI } from '../services/api';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const STATUSES: Lead['status'][] = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];
const SOURCES = ['Website', 'Referral', 'Social Media', 'Google Ads', 'Cold Call', 'Other'];
const HOME_TYPES = ['Single Wide', 'Double Wide', 'Triple Wide', 'Park Model'];

const STATUS_STEPS: { status: Lead['status']; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'qualified', label: 'Qualified' },
  { status: 'proposal', label: 'Proposal' },
  { status: 'closed_won', label: 'Won' },
];

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const lead = useSelector((state: RootState) => state.leads.leads.find((l) => l.id === id));

  type FormState = {
    name: string;
    email: string;
    phone: string;
    status: Lead['status'];
    source: string;
    notes: string;
    homeType: string;
    origin: string;
    destination: string;
    estimatedValue: string;
    moveDate: string;
  };

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  if (!lead) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Lead not found.</p>
          <Button onClick={() => navigate('/leads')}>← Back to Leads</Button>
        </div>
      </div>
    );
  }

  const openEdit = () => {
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
    setEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const payload = {
      ...form,
      estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
    };
    try {
      const res = await leadsAPI.update(lead.id, payload);
      dispatch(updateLead(res.data));
    } catch {
      dispatch(updateLead({ ...lead, ...payload }));
    }
    setSaving(false);
    setEditOpen(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await leadsAPI.delete(lead.id);
    } catch {
      // demo mode
    }
    dispatch(deleteLead(lead.id));
    navigate('/leads');
  };

  const handleStatusChange = async (newStatus: Lead['status']) => {
    try {
      const res = await leadsAPI.update(lead.id, { status: newStatus });
      dispatch(updateLead(res.data));
    } catch {
      dispatch(updateLead({ ...lead, status: newStatus }));
    }
  };

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.status === lead.status);
  const isClosedLost = lead.status === 'closed_lost';

  const inputClass =
    'w-full px-3 py-2 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red text-sm placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back + Actions */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <button
            onClick={() => navigate('/leads')}
            className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          >
            ← Back to Leads
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openEdit}>Edit</Button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-exclusive-red border border-exclusive-red/30 rounded-lg hover:bg-exclusive-red/10 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{lead.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                {lead.email && <span>✉ {lead.email}</span>}
                {lead.phone && <span>📞 {lead.phone}</span>}
              </div>
              <div className="mt-3">
                <StatusBadge status={lead.status} />
              </div>
            </div>
            <div className="text-right shrink-0">
              {lead.estimatedValue != null && (
                <p className="text-2xl font-bold text-white">${lead.estimatedValue.toLocaleString()}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                Added {new Date(lead.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline Progress */}
        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Pipeline Stage</h2>
          {isClosedLost ? (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-600" />
              <span className="text-sm">This lead was marked as Lost</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {STATUS_STEPS.map((step, idx) => (
                <div key={step.status} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStatusChange(step.status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      idx <= currentStepIdx
                        ? 'bg-exclusive-red text-white'
                        : 'bg-exclusive-black-border text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {step.label}
                  </button>
                  {idx < STATUS_STEPS.length - 1 && (
                    <span className={`text-xs ${idx < currentStepIdx ? 'text-exclusive-red' : 'text-gray-700'}`}>→</span>
                  )}
                </div>
              ))}
              <button
                onClick={() => handleStatusChange('closed_lost')}
                className={`ml-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-exclusive-black-border text-gray-500 hover:text-exclusive-red`}
              >
                Mark Lost
              </button>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Transport Info */}
          <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Transport Details</h2>
            <div className="space-y-3">
              <DetailRow label="Home Type" value={lead.homeType} />
              <DetailRow label="Origin" value={lead.origin} />
              <DetailRow label="Destination" value={lead.destination} />
              {lead.moveDate && <DetailRow label="Move Date" value={lead.moveDate} />}
              <DetailRow label="Estimated Value" value={lead.estimatedValue != null ? `$${lead.estimatedValue.toLocaleString()}` : undefined} />
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Contact Info</h2>
            <div className="space-y-3">
              <DetailRow label="Name" value={lead.name} />
              <DetailRow label="Email" value={lead.email} />
              <DetailRow label="Phone" value={lead.phone} />
              <DetailRow label="Source" value={lead.source} />
              <DetailRow label="Status" value={lead.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
            </div>
          </div>
        </div>

        {/* Notes */}
        {lead.notes && (
          <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-6">
            <h2 className="text-white font-semibold mb-3">Notes</h2>
            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Lead">
        {form && (
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
                <input type="date" className={inputClass} value={form.moveDate || ''} onChange={(e) => setForm({ ...form, moveDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-exclusive-black-border last:border-0">
      <span className="text-gray-500 text-sm shrink-0 mr-3">{label}</span>
      <span className="text-gray-200 text-sm text-right">{value || '—'}</span>
    </div>
  );
}
