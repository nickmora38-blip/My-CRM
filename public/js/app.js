/**
 * app.js — Core CRM application logic:
 * routing, auth, modal management, lead/task/template forms.
 */

// ── Auth ─────────────────────────────────────────────────────────────────────

const AUTH_KEY = 'crm_user';

function login(name, email) {
  const user = { id: 'user_' + Date.now(), name: name.trim(), email: email.trim() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  location.reload();
}

// ── Navigation / routing ──────────────────────────────────────────────────────

let currentPage = 'dashboard';

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    leads: 'Leads',
    tasks: 'Call Tasks',
    email: 'Email Templates',
    settings: 'Settings',
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[page] || page;

  refreshCurrentPage();
}

function refreshCurrentPage() {
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'leads')    refreshLeads();
  if (currentPage === 'tasks')    refreshTasks();
  if (currentPage === 'email')    renderEmailTemplateCards('email-template-cards');
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function renderDashboard() {
  const stats = getLeadStats();
  const pendingTasks = getPendingTaskCount();

  // Stat cards
  const statData = [
    { icon:'📋', cls:'blue',   value: stats.total,       label:'Total Leads' },
    { icon:'🟢', cls:'green',  value: stats.active,      label:'Active Leads' },
    { icon:'📵', cls:'red',    value: stats.no_answer,   label:'No Answer' },
    { icon:'💬', cls:'yellow', value: stats.text,        label:'Text' },
    { icon:'📞', cls:'cyan',   value: pendingTasks,      label:'Pending Calls' },
    { icon:'✅', cls:'purple', value: stats.answered,    label:'Answered' },
  ];

  const statGrid = document.getElementById('dash-stats');
  if (statGrid) {
    statGrid.innerHTML = statData.map(s => `
      <div class="stat-card">
        <div class="stat-icon ${s.cls}">${s.icon}</div>
        <div>
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      </div>`).join('');
  }

  // Recent leads
  const leads = getLeads().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const recentEl = document.getElementById('dash-recent-leads');
  if (recentEl) {
    if (leads.length === 0) {
      recentEl.innerHTML = '<div class="empty-state" style="padding:24px"><p>No leads yet. Add your first lead!</p></div>';
    } else {
      recentEl.innerHTML = `<table>
        <thead><tr><th>Name</th><th>Response</th><th>Status</th><th>Created</th><th></th></tr></thead>
        <tbody>${leads.map(l => `<tr>
          <td><div class="font-semibold">${escHtml(l.name)}</div><div class="text-xs text-muted">${escHtml(l.email)}</div></td>
          <td>${responseStatusBadge(l.responseStatus)}</td>
          <td>${leadStatusBadge(l.leadStatus)}</td>
          <td class="text-xs text-muted">${formatDatetime(l.createdAt)}</td>
          <td><button class="btn btn-ghost btn-sm btn-icon" onclick="openLeadModal('${l.id}')">✏️</button></td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
  }

  // Upcoming tasks
  const tasks = getTasks().filter(t => t.status === 'pending').sort((a,b) => new Date(a.scheduledAt)-new Date(b.scheduledAt)).slice(0,5);
  const taskEl = document.getElementById('dash-upcoming-tasks');
  if (taskEl) {
    if (tasks.length === 0) {
      taskEl.innerHTML = '<div style="padding:12px;color:var(--gray-500);font-size:13px">No pending call tasks.</div>';
    } else {
      taskEl.innerHTML = tasks.map(task => {
        const overdue = new Date(task.scheduledAt) < new Date();
        return `<div class="task-card ${overdue ? 'overdue' : 'upcoming'}" style="margin-bottom:8px">
          <div class="task-info">
            <div class="task-name">📞 ${escHtml(task.leadName)}</div>
            <div class="task-meta">${escHtml(task.notes)}</div>
          </div>
          <div class="task-time">${overdue ? '<span class="text-danger">⚠️ Overdue</span><br>' : ''}${formatDatetime(task.scheduledAt)}</div>
          <button class="btn btn-success btn-sm" onclick="completeTask('${task.id}');renderDashboard()">Done</button>
        </div>`;
      }).join('');
    }
  }
}

// ── Leads page ────────────────────────────────────────────────────────────────

let leadFilter = { search: '', responseStatus: '', leadStatus: '' };

function refreshLeads() {
  renderLeadsTable(leadMatchesFilter, 'leads-table-body');
  updateLeadsCount();
}

function leadMatchesFilter(lead) {
  const s = leadFilter.search.toLowerCase();
  if (s && !lead.name.toLowerCase().includes(s) && !lead.email.toLowerCase().includes(s) && !lead.phone.includes(s)) return false;
  if (leadFilter.responseStatus && lead.responseStatus !== leadFilter.responseStatus) return false;
  if (leadFilter.leadStatus    && lead.leadStatus    !== leadFilter.leadStatus)    return false;
  return true;
}

function updateLeadsCount() {
  const total = getLeads().filter(leadMatchesFilter).length;
  const el = document.getElementById('leads-count');
  if (el) el.textContent = `${total} lead${total !== 1 ? 's' : ''}`;
}

// ── Tasks page ────────────────────────────────────────────────────────────────

let taskTab = 'pending';

function refreshTasks() {
  renderTasksView(taskTab, 'tasks-list');
  updateTaskBadge();
}

// ── Lead Modal ───────────────────────────────────────────────────────────────

let editingLeadId = null;

function openLeadModal(leadId) {
  editingLeadId = leadId || null;
  const lead = leadId ? getLeadById(leadId) : null;
  const modal = document.getElementById('lead-modal');
  const title = document.getElementById('lead-modal-title');
  if (!modal) return;

  title.textContent = lead ? 'Edit Lead' : 'Add New Lead';

  // Reset form
  const form = document.getElementById('lead-form');
  form.reset();

  // Populate if editing
  if (lead) {
    setFormValue('lead-name',    lead.name);
    setFormValue('lead-email',   lead.email);
    setFormValue('lead-phone',   lead.phone);
    setFormValue('lead-company', lead.company);
    setFormValue('lead-notes',   lead.notes);
    setFormValue('lead-freq',    lead.callFrequencyHours || 4);

    // Response status radio
    const rsRadio = form.querySelector(`input[name="responseStatus"][value="${lead.responseStatus}"]`);
    if (rsRadio) rsRadio.checked = true;

    // Lead status select
    setFormValue('lead-status-select', lead.leadStatus);

    // Lead source checkboxes
    LEAD_SOURCES.forEach(src => {
      const cb = form.querySelector(`input[name="leadSource"][value="${src}"]`);
      if (cb) cb.checked = lead.leadSource.includes(src);
    });

    // Email template
    setFormValue('lead-email-template', lead.emailTemplateId || '');

  } else {
    // Default response = no_answer for new leads
    const defaultRs = form.querySelector('input[name="responseStatus"][value="no_answer"]');
    if (defaultRs) defaultRs.checked = true;
    setFormValue('lead-status-select', 'active');
    setFormValue('lead-freq', 4);
  }

  refreshTemplateSelect();
  modal.classList.remove('hidden');
}

function closeLeadModal() {
  document.getElementById('lead-modal')?.classList.add('hidden');
  editingLeadId = null;
}

function refreshTemplateSelect() {
  const sel = document.getElementById('lead-email-template');
  if (!sel) return;
  const templates = getEmailTemplates();
  sel.innerHTML = '<option value="">— No template —</option>' +
    templates.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
}

function submitLeadForm() {
  const form = document.getElementById('lead-form');
  const name = form.querySelector('#lead-name').value.trim();
  if (!name) { showNotification('error','Validation','Name is required'); return; }

  const responseStatus = form.querySelector('input[name="responseStatus"]:checked')?.value || 'answered';
  const leadStatus     = form.querySelector('#lead-status-select').value;
  const leadSource     = Array.from(form.querySelectorAll('input[name="leadSource"]:checked')).map(cb => cb.value);
  const emailTemplateId = form.querySelector('#lead-email-template').value;
  const callFreqHours  = parseInt(form.querySelector('#lead-freq').value) || 4;

  const data = {
    name,
    email:    form.querySelector('#lead-email').value.trim(),
    phone:    form.querySelector('#lead-phone').value.trim(),
    company:  form.querySelector('#lead-company').value.trim(),
    notes:    form.querySelector('#lead-notes').value.trim(),
    responseStatus,
    leadStatus,
    leadSource,
    emailTemplateId,
    callFrequencyHours: callFreqHours,
  };

  let lead;
  if (editingLeadId) {
    lead = updateLead(editingLeadId, data);
    showNotification('success', 'Lead Updated', `${lead.name} has been updated.`);
  } else {
    lead = createLead(data);
    showNotification('success', 'Lead Added', `${lead.name} has been added.`);
  }

  // Handle task scheduling based on response status
  if (['no_answer','text'].includes(lead.responseStatus)) {
    scheduleCallTask(lead);
    showNotification('info', '📞 Call Task Scheduled', `A call reminder will appear every ${callFreqHours}h (8am–7pm, Mon–Sat)`);
  }

  // Cancel tasks if answered
  if (lead.responseStatus === 'answered' || lead.leadStatus === 'active') {
    cancelCallTasksForLead(lead.id);
  }

  // Auto-send email
  if (!editingLeadId && lead.responseStatus === 'no_answer' && lead.email) {
    autoSendEmail(lead, 'no_answer');
  }
  if (lead.leadStatus === 'active' && lead.email) {
    autoSendEmail(lead, 'active');
  }

  closeLeadModal();
  refreshCurrentPage();
  updateTaskBadge();
}

// ── Lead Detail Modal ─────────────────────────────────────────────────────────

function openLeadDetail(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  const modal = document.getElementById('detail-modal');
  if (!modal) return;

  document.getElementById('detail-modal-title').textContent = lead.name;

  const detailEl = document.getElementById('detail-content');
  const tasks    = getTasksForLead(leadId);
  const activity = getActivity(leadId);
  const emailLog = getEmailLogForLead(leadId);

  detailEl.innerHTML = `
    <!-- Lead Info -->
    <div class="section-divider">Contact Information</div>
    ${detailRow('Name', escHtml(lead.name))}
    ${detailRow('Email', lead.email ? `<a href="mailto:${escHtml(lead.email)}">${escHtml(lead.email)}</a>` : '—')}
    ${detailRow('Phone', lead.phone ? `<a href="tel:${escHtml(lead.phone)}">${escHtml(lead.phone)}</a>` : '—')}
    ${detailRow('Company', escHtml(lead.company) || '—')}

    <div class="section-divider mt-4">Lead Info</div>
    ${detailRow('Response Status', responseStatusBadge(lead.responseStatus))}
    ${detailRow('Lead Status', leadStatusBadge(lead.leadStatus))}
    ${detailRow('Lead Source', leadSourceTags(lead.leadSource))}
    ${detailRow('Assigned To', escHtml(lead.assignedTo) || '—')}
    ${detailRow('Created', formatDatetime(lead.createdAt))}
    ${detailRow('Updated', formatDatetime(lead.updatedAt))}
    ${lead.notes ? detailRow('Notes', `<span style="white-space:pre-line">${escHtml(lead.notes)}</span>`) : ''}

    <!-- Call Tasks -->
    <div class="section-divider mt-4">Call Tasks (${tasks.length})</div>
    ${tasks.length === 0
      ? '<p class="text-muted text-sm" style="padding:8px 0">No call tasks.</p>'
      : tasks.sort((a,b) => new Date(a.scheduledAt)-new Date(b.scheduledAt)).map(t => `
          <div class="email-log-item">
            <span>${t.status === 'completed' ? '✅' : t.status === 'cancelled' ? '🚫' : '📞'}</span>
            <div style="flex:1">
              <div class="font-medium">${escHtml(t.notes)}</div>
              <div class="text-xs text-muted">${formatDatetime(t.scheduledAt)}</div>
            </div>
            <span class="badge ${t.status==='completed'?'badge-green':t.status==='cancelled'?'badge-gray':'badge-yellow'}">${t.status}</span>
          </div>`).join('')}

    <!-- Email Log -->
    <div class="section-divider mt-4">Email History (${emailLog.length})</div>
    ${emailLog.length === 0
      ? '<p class="text-muted text-sm" style="padding:8px 0">No emails sent.</p>'
      : emailLog.sort((a,b) => new Date(b.sentAt)-new Date(a.sentAt)).map(e => `
          <div class="email-log-item">
            <span>📧</span>
            <div style="flex:1">
              <div class="font-medium">${escHtml(e.subject)}</div>
              <div class="text-xs text-muted">${escHtml(e.templateName)} · ${formatDatetime(e.sentAt)}</div>
            </div>
            <span class="badge badge-green">Sent</span>
          </div>`).join('')}

    <!-- Activity -->
    <div class="section-divider mt-4">Activity Log (${activity.length})</div>
    <ul class="activity-list">
      ${activity.slice().reverse().slice(0,20).map(a => `
        <li class="activity-item">
          <div class="activity-dot ${a.type==='email'?'success':a.type==='task'?'warning':''}"></div>
          <div>
            <div>${escHtml(a.message)}</div>
            <div class="text-xs text-muted">${formatDatetime(a.at)}</div>
          </div>
        </li>`).join('')}
    </ul>

    <!-- Quick actions -->
    <div class="divider"></div>
    <div class="flex gap-2 flex-wrap">
      <button class="btn btn-primary btn-sm" onclick="closeDetailModal();openLeadModal('${leadId}')">✏️ Edit Lead</button>
      <button class="btn btn-outline btn-sm" onclick="openSendEmailModal('${leadId}')">📧 Send Email</button>
      ${['no_answer','text'].includes(lead.responseStatus)
        ? `<button class="btn btn-warning btn-sm" onclick="scheduleCallTask(getLeadById('${leadId}'));showNotification('success','Task Scheduled','Call task added');closeDetailModal();refreshCurrentPage()">📞 Schedule Call</button>`
        : ''}
    </div>
  `;

  modal.classList.remove('hidden');
}

function detailRow(label, value) {
  return `<div class="detail-row"><div class="detail-label">${label}</div><div class="detail-value">${value}</div></div>`;
}

function closeDetailModal() {
  document.getElementById('detail-modal')?.classList.add('hidden');
}

// ── Delete Lead ───────────────────────────────────────────────────────────────

function confirmDeleteLead(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return;
  if (!confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return;
  deleteLead(leadId);
  showNotification('success', 'Lead Deleted', `${lead.name} has been removed.`);
  refreshCurrentPage();
}

// ── Send Email Modal ──────────────────────────────────────────────────────────

function openSendEmailModal(leadId) {
  const modal = document.getElementById('send-email-modal');
  if (!modal) return;
  const sel  = document.getElementById('send-email-template-sel');
  const lead = getLeadById(leadId);
  if (!lead || !sel) return;

  modal.dataset.leadId = leadId;
  sel.innerHTML = getEmailTemplates().map(t =>
    `<option value="${t.id}">${escHtml(t.name)}</option>`
  ).join('');

  updateEmailPreview(lead, sel.value);
  modal.classList.remove('hidden');
}

function updateEmailPreview(lead, templateId) {
  const tpl = getEmailTemplateById(templateId);
  const previewEl = document.getElementById('send-email-preview');
  if (!previewEl) return;
  if (!tpl) { previewEl.innerHTML = ''; return; }
  const subject = interpolate(tpl.subject, lead);
  const body    = interpolate(tpl.body, lead);
  previewEl.innerHTML = `
    <div style="font-size:12px;color:var(--gray-600);margin-bottom:6px"><strong>Subject:</strong> ${escHtml(subject)}</div>
    <div style="white-space:pre-line;font-size:12px;color:var(--gray-700);background:var(--gray-50);border-radius:6px;padding:10px">${escHtml(body)}</div>
  `;
}

function submitSendEmail() {
  const modal = document.getElementById('send-email-modal');
  const leadId = modal.dataset.leadId;
  const templateId = document.getElementById('send-email-template-sel').value;
  sendEmailToLead(leadId, templateId);
  modal.classList.add('hidden');
  refreshCurrentPage();
}

// ── Email Template Modal ──────────────────────────────────────────────────────

let editingTemplateId = null;

function openTemplateModal(templateId) {
  editingTemplateId = templateId || null;
  const tpl  = templateId ? getEmailTemplateById(templateId) : null;
  const modal = document.getElementById('template-modal');
  if (!modal) return;

  document.getElementById('template-modal-title').textContent = tpl ? 'Edit Template' : 'New Template';

  setFormValue('tpl-name',    tpl?.name    || '');
  setFormValue('tpl-subject', tpl?.subject || '');
  setFormValue('tpl-body',    tpl?.body    || '');
  setFormValue('tpl-trigger', tpl?.triggerOn || '');
  modal.classList.remove('hidden');
}

function closeTemplateModal() {
  document.getElementById('template-modal')?.classList.add('hidden');
  editingTemplateId = null;
}

function submitTemplateForm() {
  const name    = document.getElementById('tpl-name').value.trim();
  const subject = document.getElementById('tpl-subject').value.trim();
  const body    = document.getElementById('tpl-body').value.trim();
  const trigger = document.getElementById('tpl-trigger').value;

  if (!name || !subject || !body) { showNotification('error','Validation','Name, subject and body are required'); return; }

  if (editingTemplateId) {
    const existing = getEmailTemplateById(editingTemplateId);
    saveEmailTemplate({ ...existing, name, subject, body, triggerOn: trigger });
    showNotification('success','Template Updated', name);
  } else {
    createEmailTemplate({ name, subject, body, triggerOn: trigger });
    showNotification('success','Template Created', name);
  }

  closeTemplateModal();
  renderEmailTemplateCards('email-template-cards');
}

function previewTemplate(templateId) {
  const tpl = getEmailTemplateById(templateId);
  if (!tpl) return;
  const dummyLead = { name:'John Smith', company:'My Company', phone:'(555) 555-1234', email:'john@example.com' };
  alert(`SUBJECT:\n${interpolate(tpl.subject, dummyLead)}\n\nBODY:\n${interpolate(tpl.body, dummyLead)}`);
}

function confirmDeleteTemplate(id) {
  const tpl = getEmailTemplateById(id);
  if (!tpl) return;
  if (!confirm(`Delete template "${tpl.name}"?`)) return;
  deleteEmailTemplate(id);
  showNotification('success','Template Deleted', tpl.name);
  renderEmailTemplateCards('email-template-cards');
}

// ── Settings ─────────────────────────────────────────────────────────────────

function renderSettings() {
  const user = getCurrentUser();
  if (!user) return;
  setFormValue('settings-name',  user.name);
  setFormValue('settings-email', user.email);
}

function saveSettings() {
  const name  = document.getElementById('settings-name').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  if (!name) { showNotification('error','Validation','Name is required'); return; }
  const user = { ...getCurrentUser(), name, email };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  document.getElementById('user-display-name').textContent = name;
  showNotification('success','Settings Saved','Your profile has been updated.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setFormValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value != null ? value : '';
}

// ── Seed demo data ────────────────────────────────────────────────────────────

function seedDemoData() {
  if (getLeads().length > 0) return; // already has data
  const demoLeads = [
    { name:'Alice Johnson', email:'alice@example.com', phone:'(555) 123-4567', company:'Johnson Family', responseStatus:'no_answer', leadStatus:'active', leadSource:['facebook','referral'], notes:'Interested in 3BR model' },
    { name:'Bob Martinez',  email:'bob@example.com',   phone:'(555) 234-5678', company:'',               responseStatus:'answered',  leadStatus:'active', leadSource:['instagram'], notes:'' },
    { name:'Carol White',   email:'carol@example.com', phone:'(555) 345-6789', company:'White & Co.',    responseStatus:'text',      leadStatus:'not_active', leadSource:['craigslist'], notes:'Requested quote' },
    { name:'David Lee',     email:'david@example.com', phone:'(555) 456-7890', company:'',               responseStatus:'answered',  leadStatus:'long_term', leadSource:['signage'], notes:'' },
    { name:'Eve Brown',     email:'eve@example.com',   phone:'(555) 567-8901', company:'',               responseStatus:'no_answer', leadStatus:'lost', leadSource:['tiktok'], notes:'Called 3 times' },
  ];
  demoLeads.forEach(d => {
    const lead = createLead(d);
    if (['no_answer','text'].includes(lead.responseStatus)) {
      scheduleCallTask(lead);
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initApp() {
  const user = getCurrentUser();

  if (!user) {
    // Show login
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');

    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const name  = document.getElementById('login-name').value.trim();
      const email = document.getElementById('login-email').value.trim();
      if (!name) { showNotification('error','Error','Please enter your name'); return; }
      login(name, email);
      initApp();
    });
    return;
  }

  // Show app
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-display-name').textContent = user.name;

  // Nav click handlers
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // Search
  document.getElementById('leads-search')?.addEventListener('input', e => {
    leadFilter.search = e.target.value;
    refreshLeads();
  });

  // Response status filter
  document.getElementById('filter-response')?.addEventListener('change', e => {
    leadFilter.responseStatus = e.target.value;
    refreshLeads();
  });

  // Lead status filter
  document.getElementById('filter-status')?.addEventListener('change', e => {
    leadFilter.leadStatus = e.target.value;
    refreshLeads();
  });

  // Task tabs
  document.querySelectorAll('.task-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      taskTab = btn.dataset.filter;
      refreshTasks();
    });
  });

  // Email template select preview
  document.getElementById('send-email-template-sel')?.addEventListener('change', e => {
    const modal = document.getElementById('send-email-modal');
    const lead  = getLeadById(modal.dataset.leadId);
    if (lead) updateEmailPreview(lead, e.target.value);
  });

  // Settings page
  document.getElementById('settings-save-btn')?.addEventListener('click', saveSettings);

  // Seed demo data
  seedDemoData();

  // Render settings
  renderSettings();

  // Start task checker
  startTaskChecker();

  // Initial render
  navigateTo('dashboard');
  updateTaskBadge();
}

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);

// Expose globals needed by inline HTML onclick handlers
window.logout = logout;
window.navigateTo = navigateTo;
window.openLeadModal = openLeadModal;
window.closeLeadModal = closeLeadModal;
window.submitLeadForm = submitLeadForm;
window.openLeadDetail = openLeadDetail;
window.closeDetailModal = closeDetailModal;
window.confirmDeleteLead = confirmDeleteLead;
window.openSendEmailModal = openSendEmailModal;
window.submitSendEmail = submitSendEmail;
window.openTemplateModal = openTemplateModal;
window.closeTemplateModal = closeTemplateModal;
window.submitTemplateForm = submitTemplateForm;
window.previewTemplate = previewTemplate;
window.confirmDeleteTemplate = confirmDeleteTemplate;
window.saveSettings = saveSettings;
