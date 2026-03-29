/**
 * leads.js — Lead data model, CRUD operations, response/lead status, lead source
 */

const LEADS_KEY = 'crm_leads';
const ACTIVITY_KEY = 'crm_activity';

const RESPONSE_STATUS = {
  answered: { label: 'Answered', badge: 'badge-green',  icon: '✅' },
  no_answer: { label: 'No Answer', badge: 'badge-red',   icon: '📵' },
  text:      { label: 'Text',      badge: 'badge-yellow', icon: '💬' },
};

const LEAD_STATUS = {
  active:    { label: 'Active',    badge: 'badge-green',  icon: '🟢' },
  not_active:{ label: 'Not Active',badge: 'badge-gray',   icon: '⚫' },
  dead:      { label: 'Dead',      badge: 'badge-red',    icon: '💀' },
  lost:      { label: 'Lost',      badge: 'badge-orange', icon: '🔴' },
  long_term: { label: 'Long Term', badge: 'badge-purple', icon: '⏳' },
};

const LEAD_SOURCES = ['facebook','instagram','tiktok','craigslist','referral','signage'];

const SOURCE_ICONS = {
  facebook:  '📘',
  instagram: '📷',
  tiktok:    '🎵',
  craigslist:'🔎',
  referral:  '🤝',
  signage:   '🪧',
};

// ── CRUD ────────────────────────────────────────────────────────────────────

function getLeads() {
  try { return JSON.parse(localStorage.getItem(LEADS_KEY)) || []; }
  catch { return []; }
}

function saveLead(lead) {
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === lead.id);
  if (idx >= 0) {
    leads[idx] = lead;
  } else {
    leads.push(lead);
  }
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  return lead;
}

function deleteLead(id) {
  const leads = getLeads().filter(l => l.id !== id);
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  // Also remove related tasks
  removeTasksForLead(id);
}

function getLeadById(id) {
  return getLeads().find(l => l.id === id) || null;
}

function createLead(data) {
  const lead = {
    id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    company: data.company || '',
    notes: data.notes || '',
    responseStatus: data.responseStatus || 'answered',
    leadStatus: data.leadStatus || 'active',
    leadSource: Array.isArray(data.leadSource) ? data.leadSource : [],
    assignedTo: data.assignedTo || getCurrentUser()?.name || '',
    emailTemplateId: data.emailTemplateId || '',
    callFrequencyHours: data.callFrequencyHours || 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLead(lead);
  logActivity(lead.id, 'created', `Lead created — response: ${RESPONSE_STATUS[lead.responseStatus]?.label}, status: ${LEAD_STATUS[lead.leadStatus]?.label}`);
  return lead;
}

function updateLead(id, updates) {
  const lead = getLeadById(id);
  if (!lead) return null;
  const prev = { ...lead };
  const updated = { ...lead, ...updates, updatedAt: new Date().toISOString() };
  saveLead(updated);

  // Log status changes
  if (prev.responseStatus !== updated.responseStatus)
    logActivity(id, 'status', `Response status: ${RESPONSE_STATUS[prev.responseStatus]?.label} → ${RESPONSE_STATUS[updated.responseStatus]?.label}`);
  if (prev.leadStatus !== updated.leadStatus)
    logActivity(id, 'status', `Lead status: ${LEAD_STATUS[prev.leadStatus]?.label} → ${LEAD_STATUS[updated.leadStatus]?.label}`);

  return updated;
}

// ── Activity Log ────────────────────────────────────────────────────────────

function getActivity(leadId) {
  try {
    const all = JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || [];
    return leadId ? all.filter(a => a.leadId === leadId) : all;
  } catch { return []; }
}

function logActivity(leadId, type, message) {
  try {
    const all = JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || [];
    all.push({ id: 'act_' + Date.now(), leadId, type, message, at: new Date().toISOString() });
    // Keep last 500 entries
    if (all.length > 500) all.splice(0, all.length - 500);
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(all));
  } catch {}
}

// ── Badge / pill helpers ─────────────────────────────────────────────────────

function responseStatusBadge(status) {
  const s = RESPONSE_STATUS[status];
  if (!s) return '';
  return `<span class="badge ${s.badge}">${s.icon} ${s.label}</span>`;
}

function leadStatusBadge(status) {
  const s = LEAD_STATUS[status];
  if (!s) return '';
  return `<span class="badge ${s.badge}">${s.icon} ${s.label}</span>`;
}

function leadSourceTags(sources) {
  if (!sources || sources.length === 0) return '<span class="text-muted text-xs">—</span>';
  return `<div class="source-tags">${sources.map(s =>
    `<span class="source-tag ${s}">${SOURCE_ICONS[s] || ''} ${s.charAt(0).toUpperCase()+s.slice(1)}</span>`
  ).join('')}</div>`;
}

// ── Render Leads Table ───────────────────────────────────────────────────────

function renderLeadsTable(filterFn, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let leads = getLeads();
  if (typeof filterFn === 'function') leads = leads.filter(filterFn);

  if (leads.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No leads found</h3><p>Add your first lead to get started.</p></div>`;
    return;
  }

  const rows = leads.map(lead => {
    const nextCall = getNextCallTime(lead.id);
    const nextCallBadge = nextCall
      ? `<span class="next-call-badge">📞 ${formatTime(nextCall)}</span>`
      : '';
    return `<tr>
      <td>
        <div class="font-semibold">${escHtml(lead.name)}</div>
        <div class="text-xs text-muted">${escHtml(lead.email)}</div>
      </td>
      <td>${escHtml(lead.phone || '—')}</td>
      <td>${responseStatusBadge(lead.responseStatus)}</td>
      <td>${leadStatusBadge(lead.leadStatus)}</td>
      <td>${leadSourceTags(lead.leadSource)}</td>
      <td>${nextCallBadge}</td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openLeadModal('${lead.id}')" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openLeadDetail('${lead.id}')" title="Details">👁️</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="confirmDeleteLead('${lead.id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `<table>
    <thead>
      <tr>
        <th>Name / Email</th>
        <th>Phone</th>
        <th>Response</th>
        <th>Status</th>
        <th>Source</th>
        <th>Next Call</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Statistics ───────────────────────────────────────────────────────────────

function getLeadStats() {
  const leads = getLeads();
  const stats = {
    total: leads.length,
    active: 0, not_active: 0, dead: 0, lost: 0, long_term: 0,
    answered: 0, no_answer: 0, text: 0,
  };
  leads.forEach(l => {
    if (stats[l.leadStatus] !== undefined) stats[l.leadStatus]++;
    if (stats[l.responseStatus] !== undefined) stats[l.responseStatus]++;
  });
  return stats;
}

// Expose to global
window.getLeads = getLeads;
window.saveLead = saveLead;
window.deleteLead = deleteLead;
window.getLeadById = getLeadById;
window.createLead = createLead;
window.updateLead = updateLead;
window.getActivity = getActivity;
window.logActivity = logActivity;
window.responseStatusBadge = responseStatusBadge;
window.leadStatusBadge = leadStatusBadge;
window.leadSourceTags = leadSourceTags;
window.renderLeadsTable = renderLeadsTable;
window.getLeadStats = getLeadStats;
window.RESPONSE_STATUS = RESPONSE_STATUS;
window.LEAD_STATUS = LEAD_STATUS;
window.LEAD_SOURCES = LEAD_SOURCES;
window.SOURCE_ICONS = SOURCE_ICONS;
