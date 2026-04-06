const PIPELINE = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

const RESPONSE_LABELS = {
  answered: '✓ Answered',
  not_answered: '📵 Not Answered',
  left_vm: '📬 Left VM',
  text: '💬 Text'
};

const LEAD_STATUS_LABELS = {
  pending_info: 'Pending Info',
  completing_application: 'Completing App',
  appointment_set: '📅 Appt Set',
  answered: 'Answered'
};

const TIMELINE_LABELS = {
  '90_days_or_less': '≤ 90 Days',
  '3_6_months': '3–6 Months',
  not_ready: '🕐 Not Ready'
};

const state = {
  token: localStorage.getItem('crm_token') || '',
  user: null,
  leads: [],
  templates: [],
  tasks: [],
  users: [],
  view: 'list',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  filters: { search: '', status: '', source: '', response: '' },
  editingLeadId: null,
  openStatusDropdown: null,
  pendingLeadPayload: null,   // held during duplicate check
  pendingDuplicates: [],      // duplicates found during check
  emailTargetLeadId: null,
  emailTargetType: null,
  editingTemplateId: null,
  editingUserId: null,
  contacts: [],
  activeCustomers: [],
  contactsFilter: 'all',
  acFilter: 'all',
  editingContactId: null,
  editingCustomerId: null,
  docUploadTargetId: null,
  docUploadTargetType: null,
  pipelineActiveMonth: null
};

const els = {
  loginPanel: document.getElementById('login-panel'),
  appPanel: document.getElementById('app-panel'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginFormWrap: document.getElementById('login-form-wrap'),
  registerFormWrap: document.getElementById('register-form-wrap'),
  toggleRegisterBtn: document.getElementById('toggle-register'),
  toggleLoginBtn: document.getElementById('toggle-login'),
  userLine: document.getElementById('user-line'),
  tableWrap: document.getElementById('table-wrap'),
  boardWrap: document.getElementById('board-wrap'),
  detailView: document.getElementById('detail-view'),
  listView: document.getElementById('list-view'),
  listToggle: document.getElementById('list-toggle'),
  boardToggle: document.getElementById('board-toggle'),
  statusFilter: document.getElementById('status-filter'),
  sourceFilter: document.getElementById('source-filter'),
  responseFilter: document.getElementById('response-filter'),
  searchInput: document.getElementById('search-input'),
  exportBtn: document.getElementById('export-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  newLeadBtn: document.getElementById('new-lead-btn'),
  tasksBtn: document.getElementById('tasks-btn'),
  templatesBtn: document.getElementById('templates-btn'),
  tasksPanel: document.getElementById('tasks-panel'),
  tasksList: document.getElementById('tasks-list'),
  tasksCloseBtn: document.getElementById('tasks-close-btn'),
  templatesPanel: document.getElementById('templates-panel'),
  templatesList: document.getElementById('templates-list'),
  templatesCloseBtn: document.getElementById('templates-close-btn'),
  newTemplateBtn: document.getElementById('new-template-btn'),
  // Lead modal
  leadModal: document.getElementById('lead-modal'),
  leadForm: document.getElementById('lead-form'),
  leadModalTitle: document.getElementById('lead-modal-title'),
  leadCancelBtn: document.getElementById('lead-cancel-btn'),
  saveLeadBtn: document.getElementById('save-lead-btn'),
  responseBtns: document.getElementById('response-btns'),
  responseStatusInput: document.getElementById('responseStatus-input'),
  recallNotice: document.getElementById('recall-notice'),
  leadStatusSection: document.getElementById('lead-status-section'),
  leadStatusSelect: document.getElementById('leadStatus-select'),
  appointmentSection: document.getElementById('appointment-section'),
  longtermNotice: document.getElementById('longterm-notice'),
  emailTemplateFieldset: document.getElementById('email-template-fieldset'),
  templatePicker: document.getElementById('template-picker'),
  selectedTemplateIdInput: document.getElementById('selectedTemplateId-input'),
  // Duplicate modal
  dupModal: document.getElementById('dup-modal'),
  dupComparison: document.getElementById('dup-comparison'),
  dupPhcHint: document.getElementById('dup-phc-hint'),
  dupAdminSection: document.getElementById('dup-admin-section'),
  dupNote: document.getElementById('dup-note'),
  dupOwnerSelectWrap: document.getElementById('dup-owner-select-wrap'),
  dupOwnerDropdown: document.getElementById('dup-owner-dropdown'),
  dupRejectBtn: document.getElementById('dup-reject-btn'),
  dupAllowBtn: document.getElementById('dup-allow-btn'),
  dupMergeBtn: document.getElementById('dup-merge-btn'),
  dupOwnerBtn: document.getElementById('dup-owner-btn'),
  // Email modal
  emailModal: document.getElementById('email-modal'),
  emailModalTitle: document.getElementById('email-modal-title'),
  emailTemplateSelect: document.getElementById('email-template-select'),
  emailSubject: document.getElementById('email-subject'),
  emailBody: document.getElementById('email-body'),
  emailCancelBtn: document.getElementById('email-cancel-btn'),
  emailSendBtn: document.getElementById('email-send-btn'),
  // Template editor modal
  templateModal: document.getElementById('template-modal'),
  templateModalTitle: document.getElementById('template-modal-title'),
  tmplName: document.getElementById('tmpl-name'),
  tmplType: document.getElementById('tmpl-type'),
  tmplSubject: document.getElementById('tmpl-subject'),
  tmplBody: document.getElementById('tmpl-body'),
  tmplCancelBtn: document.getElementById('tmpl-cancel-btn'),
  tmplSaveBtn: document.getElementById('tmpl-save-btn'),
  // Users panel
  usersBtn: document.getElementById('users-btn'),
  usersPanel: document.getElementById('users-panel'),
  usersList: document.getElementById('users-list'),
  usersCloseBtn: document.getElementById('users-close-btn'),
  addUserBtn: document.getElementById('add-user-btn'),
  // User modal
  userModal: document.getElementById('user-modal'),
  userModalTitle: document.getElementById('user-modal-title'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userPassword: document.getElementById('user-password'),
  userPasswordWrap: document.getElementById('user-password-wrap'),
  userRole: document.getElementById('user-role'),
  userCancelBtn: document.getElementById('user-cancel-btn'),
  userSaveBtn: document.getElementById('user-save-btn'),
  // Contacts panel
  contactsBtn: document.getElementById('contacts-btn'),
  contactsPanel: document.getElementById('contacts-panel'),
  contactsList: document.getElementById('contacts-list'),
  contactsCloseBtn: document.getElementById('contacts-close-btn'),
  newContactBtn: document.getElementById('new-contact-btn'),
  contactsPipelineBar: document.getElementById('contacts-pipeline-bar'),
  // Active customers panel
  activeCustomersBtn: document.getElementById('active-customers-btn'),
  activeCustomersPanel: document.getElementById('active-customers-panel'),
  activeCustomersList: document.getElementById('active-customers-list'),
  activeCustomersCloseBtn: document.getElementById('active-customers-close-btn'),
  acStatusFilterBar: document.getElementById('ac-status-filter-bar'),
  // Pipeline panel
  pipelineBtn: document.getElementById('pipeline-btn'),
  pipelinePanel: document.getElementById('pipeline-panel'),
  pipelineCloseBtn: document.getElementById('pipeline-close-btn'),
  pipelineMonthTabs: document.getElementById('pipeline-month-tabs'),
  pipelineReportContent: document.getElementById('pipeline-report-content'),
  // Contact modal
  contactModal: document.getElementById('contact-modal'),
  contactModalTitle: document.getElementById('contact-modal-title'),
  contactFirstName: document.getElementById('contact-firstName'),
  contactLastName: document.getElementById('contact-lastName'),
  contactPhone: document.getElementById('contact-phone'),
  contactEmail: document.getElementById('contact-email'),
  contactHomeType: document.getElementById('contact-homeType'),
  contactRoute: document.getElementById('contact-route'),
  contactPipelineStatus: document.getElementById('contact-pipelineStatus'),
  contactSource: document.getElementById('contact-source'),
  contactNotes: document.getElementById('contact-notes'),
  contactCancelBtn: document.getElementById('contact-cancel-btn'),
  contactSaveBtn: document.getElementById('contact-save-btn'),
  // Contact detail modal
  contactDetailModal: document.getElementById('contact-detail-modal'),
  contactDetailContent: document.getElementById('contact-detail-content'),
  // Active customer detail modal
  acDetailModal: document.getElementById('ac-detail-modal'),
  acDetailContent: document.getElementById('ac-detail-content'),
  // Document upload modal
  docUploadModal: document.getElementById('doc-upload-modal'),
  docCategory: document.getElementById('doc-category'),
  docFileInput: document.getElementById('doc-file-input'),
  docUploadCancelBtn: document.getElementById('doc-upload-cancel-btn'),
  docUploadSaveBtn: document.getElementById('doc-upload-save-btn')
};

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: response.status, data });
  return data;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function currentUserIsAdmin() {
  return !!(state.user && (state.user.isAdmin || state.user.role === 'admin'));
}

function isDetailRoute() {
  return /^\/leads\/.+/.test(window.location.pathname);
}

function currentLeadIdFromRoute() {
  const match = window.location.pathname.match(/^\/leads\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function nav(path) {
  window.history.pushState({}, '', path);
  render();
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function interpolateTemplate(tmpl, lead) {
  return tmpl
    .replace(/\{\{firstName\}\}/g, lead.firstName || '')
    .replace(/\{\{lastName\}\}/g, lead.lastName || '')
    .replace(/\{\{homeType\}\}/g, lead.homeType || '')
    .replace(/\{\{route\}\}/g, lead.route || '')
    .replace(/\{\{estimatedValue\}\}/g, currency(lead.estimatedValue))
    .replace(/\{\{appointmentDate\}\}/g, lead.appointmentDate || '')
    .replace(/\{\{appointmentTime\}\}/g, lead.appointmentTime || '')
    .replace(/\{\{agentName\}\}/g, state.user ? state.user.name : 'Your Agent');
}

function responseStatusBadge(status) {
  if (!status) return '';
  const map = { answered: 'badge-green', not_answered: 'badge-red', left_vm: 'badge-orange', text: 'badge-blue' };
  return `<span class="badge ${map[status] || ''}">${escHtml(RESPONSE_LABELS[status] || status)}</span>`;
}

function leadStatusBadge(status) {
  if (!status) return '';
  const map = { pending_info: 'badge-yellow', completing_application: 'badge-blue', appointment_set: 'badge-green', answered: 'badge-green' };
  return `<span class="badge ${map[status] || ''}">${escHtml(LEAD_STATUS_LABELS[status] || status)}</span>`;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadLeads() {
  const data = await api('/api/leads');
  state.leads = data.leads || [];
}

async function loadTemplates() {
  const data = await api('/api/email-templates');
  state.templates = data.templates || [];
}

async function loadTasks() {
  const data = await api('/api/tasks');
  state.tasks = data.tasks || [];
}

async function loadUsers() {
  try {
    const data = await api('/api/admin/users');
    state.users = data.users || [];
  } catch {
    state.users = [];
  }
}

async function updateLead(id, patch) {
  const response = await api(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
  const idx = state.leads.findIndex((item) => item.id === id);
  if (idx > -1) state.leads[idx] = response.lead;
  return response.lead;
}

// ─── Filtering / sorting ──────────────────────────────────────────────────────

function filteredLeads() {
  const search = state.filters.search.toLowerCase();
  let rows = state.leads.filter((lead) => {
    const contact = `${lead.firstName} ${lead.lastName}`.toLowerCase();
    const route = String(lead.route || '').toLowerCase();
    const source = String(lead.source || '').toLowerCase();
    const statusOk = !state.filters.status || lead.status === state.filters.status;
    const sourceOk = !state.filters.source || lead.source === state.filters.source;
    const responseOk = !state.filters.response || lead.responseStatus === state.filters.response;
    const searchOk = !search || contact.includes(search) || route.includes(search) || source.includes(search);
    return statusOk && sourceOk && responseOk && searchOk;
  });

  const dir = state.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (state.sortBy === 'contact') {
      const aa = `${a.firstName} ${a.lastName}`.toLowerCase();
      const bb = `${b.firstName} ${b.lastName}`.toLowerCase();
      return aa.localeCompare(bb) * dir;
    }
    if (state.sortBy === 'status') return a.status.localeCompare(b.status) * dir;
    if (state.sortBy === 'value') return (Number(a.estimatedValue) - Number(b.estimatedValue)) * dir;
    if (state.sortBy === 'source') return String(a.source).localeCompare(String(b.source)) * dir;
    return String(a.updatedAt).localeCompare(String(b.updatedAt)) * dir;
  });
  return rows;
}

function sortIndicator(key) {
  if (state.sortBy !== key) return '';
  return state.sortDir === 'asc' ? ' ▲' : ' ▼';
}

// ─── Status picker ────────────────────────────────────────────────────────────

function createStatusPicker(leadId) {
  const picker = document.createElement('div');
  picker.className = 'status-picker';
  PIPELINE.forEach((status) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = status;
    option.addEventListener('click', async () => {
      await updateLead(leadId, { status });
      state.openStatusDropdown = null;
      render();
    });
    picker.appendChild(option);
  });
  return picker;
}

// ─── Table render ─────────────────────────────────────────────────────────────

function renderTable(rows) {
  const isAdmin = currentUserIsAdmin();
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th class="sortable" data-sort="contact">Contact${sortIndicator('contact')}</th>
        <th>Entry User</th>
        <th>Assigned To</th>
        <th>Home Type</th>
        <th>Route</th>
        <th class="sortable" data-sort="status">Stage${sortIndicator('status')}</th>
        <th>Response</th>
        <th>Lead Status</th>
        <th class="sortable" data-sort="value">Value${sortIndicator('value')}</th>
        <th class="sortable" data-sort="source">Source${sortIndicator('source')}</th>
        <th>Timeline</th>
        <th>Recall</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  rows.forEach((lead) => {
    const isOwner = state.user && lead.leadOwner === state.user.id;
    const isAdmin = currentUserIsAdmin();
    const canEdit = isOwner || isAdmin;

    const recallCell = lead.isDead
      ? '<span class="badge badge-red">💀 Dead</span>'
      : lead.isLongTerm
      ? '<span class="badge badge-yellow">📅 Long-Term</span>'
      : lead.recallCampaignActive
      ? '<span class="badge badge-orange">⏰ Recall</span>'
      : '';

    const entryUser = lead.createdByName || lead.leadOwnerName || 'Unknown';
    const assignedUser = lead.leadOwnerName || 'Unknown';
    const lockedNote = !isAdmin && isOwner ? ' <span class="lock-chip" title="Locked to you">🔒</span>' : '';

    const tr = document.createElement('tr');
    if (lead.isDead) tr.style.opacity = '0.6';
    tr.innerHTML = `
      <td><a href="#" data-open="${escHtml(lead.id)}">${escHtml(lead.firstName)} ${escHtml(lead.lastName)}</a>${lead.isLongTerm ? ' <span class="badge badge-yellow" title="Long-Term">LT</span>' : ''}</td>
      <td><span class="owner-chip">${escHtml(entryUser)}</span></td>
      <td><span class="owner-chip ${isOwner ? 'owner-me' : ''}">${escHtml(assignedUser)}${lockedNote}</span></td>
      <td>${escHtml(lead.homeType || '-')}</td>
      <td>${escHtml(lead.route || '-')}</td>
      <td class="status-cell"></td>
      <td>${responseStatusBadge(lead.responseStatus)}</td>
      <td>${leadStatusBadge(lead.leadStatus)}</td>
      <td>${currency(lead.estimatedValue)}</td>
      <td>${escHtml(lead.source || '-')}</td>
      <td>${lead.moveTimeline ? `<span class="badge badge-purple">${escHtml(TIMELINE_LABELS[lead.moveTimeline] || lead.moveTimeline)}</span>` : '-'}</td>
      <td>${recallCell}</td>
    `;

    const statusCell = tr.querySelector('.status-cell');
    const statusWrap = document.createElement('div');
    statusWrap.className = 'status-wrap';
    const chip = document.createElement('button');
    chip.className = 'status-chip';
    chip.type = 'button';
    chip.textContent = lead.status;
    chip.disabled = !canEdit;
    chip.title = canEdit ? 'Click to change stage' : 'Only owner can change stage';
    chip.addEventListener('click', (event) => {
      if (!canEdit) return;
      event.stopPropagation();
      state.openStatusDropdown = state.openStatusDropdown === lead.id ? null : lead.id;
      render();
    });
    statusWrap.appendChild(chip);
    if (state.openStatusDropdown === lead.id && canEdit) statusWrap.appendChild(createStatusPicker(lead.id));
    statusCell.appendChild(statusWrap);

    tbody.appendChild(tr);
  });

  table.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (state.sortBy === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = key;
        state.sortDir = key === 'contact' ? 'asc' : 'desc';
      }
      render();
    });
  });

  table.querySelectorAll('a[data-open]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      nav(`/leads/${link.getAttribute('data-open')}`);
    });
  });

  els.tableWrap.innerHTML = '';
  els.tableWrap.appendChild(table);
}

// ─── Board render ─────────────────────────────────────────────────────────────

function renderBoard(rows) {
  els.boardWrap.innerHTML = '';
  PIPELINE.forEach((stage) => {
    const col = document.createElement('section');
    col.className = 'board-column';
    const leads = rows.filter((lead) => lead.status === stage);
    col.innerHTML = `<h4>${escHtml(stage)} (${leads.length})</h4>`;
    leads.forEach((lead) => {
      const card = document.createElement('article');
      card.className = 'lead-card';
      const isAdmin = currentUserIsAdmin();
      card.innerHTML = `
        <strong>${escHtml(lead.firstName)} ${escHtml(lead.lastName)}</strong>
        ${lead.isDead ? '<span class="badge badge-red">Dead</span>' : ''}
        ${lead.isLongTerm ? '<span class="badge badge-yellow">Long-Term</span>' : ''}
        ${lead.recallCampaignActive ? '<span class="badge badge-orange">Recall Active</span>' : ''}
        <p>${escHtml(lead.homeType || 'Home type not set')}</p>
        <p>${escHtml(lead.route || 'No route yet')}</p>
        <p>${currency(lead.estimatedValue)}</p>
        <p class="muted" style="font-size:0.8rem">Entry: ${escHtml(lead.createdByName || lead.leadOwnerName || '-')}</p>
        <p class="muted" style="font-size:0.8rem">Assigned: ${escHtml(lead.leadOwnerName || '-')}${state.user && lead.leadOwner === state.user.id ? ' 🔒' : ''}</p>
      `;
      card.addEventListener('click', () => nav(`/leads/${lead.id}`));
      col.appendChild(card);
    });
    els.boardWrap.appendChild(col);
  });
}

// ─── Lead Detail ──────────────────────────────────────────────────────────────

function detailCard(title, body) {
  return `<article class="card"><h4>${escHtml(title)}</h4><div>${body}</div></article>`;
}

function renderLeadDetail(lead) {
  const isOwner = state.user && lead.leadOwner === state.user.id;
  const isAdmin = currentUserIsAdmin();
  const canEdit = isOwner || isAdmin;

  const pipelineButtons = PIPELINE.filter((s) => s !== 'Lost')
    .map((stage) => `<button type="button" data-stage="${escHtml(stage)}" class="${lead.status === stage ? 'active' : ''}" ${!canEdit ? 'disabled title="Only owner can change stage"' : ''}>${escHtml(stage)}</button>`)
    .join('');

  const financingStr = Array.isArray(lead.financing) && lead.financing.length > 0
    ? lead.financing.map((f) => f.replace('_', ' ')).join(', ')
    : 'Not specified';

  const emailHistory = Array.isArray(lead.emailsSent) && lead.emailsSent.length > 0
    ? lead.emailsSent.map((e) => `<div class="email-record"><strong>${escHtml(e.subject)}</strong> <span class="muted">${new Date(e.sentAt).toLocaleString()}</span></div>`).join('')
    : '<p class="muted">No emails recorded.</p>';

  const recallStatus = lead.isDead
    ? '<span class="badge badge-red">💀 Dead — Enrolled in drip campaign</span>'
    : lead.recallCampaignActive
    ? `<span class="badge badge-orange">⏰ Active — Started ${lead.recallCampaignStarted ? new Date(lead.recallCampaignStarted).toLocaleDateString() : 'N/A'}</span>`
    : lead.recallCampaignStarted
    ? '<span class="badge badge-green">Completed</span>'
    : '<span class="muted">No campaign</span>';

  const contactHistory = lead.contactAttempts > 0
    ? `<p><strong>Attempts:</strong> ${lead.contactAttempts}</p><p><strong>Last Contact:</strong> ${lead.lastContactAttempt ? new Date(lead.lastContactAttempt).toLocaleString() : 'N/A'}</p>`
    : '<p class="muted">No contact attempts recorded.</p>';

  els.detailView.innerHTML = `
    <div class="toolbar">
      <div>
        <h2>${escHtml(lead.firstName)} ${escHtml(lead.lastName)}</h2>
        <p class="muted">${escHtml(lead.homeType || 'Lead profile')} &nbsp;|&nbsp; Assigned: <strong>${escHtml(lead.leadOwnerName || 'Unknown')}</strong> ${isOwner ? '(You 🔒)' : ''}</p>
      </div>
      <div class="toolbar-actions">
        <button id="back-btn">← Back</button>
        ${canEdit ? '<button id="edit-btn">✏️ Edit</button>' : ''}
        <button id="send-email-btn" class="primary">✉️ Send Email</button>
        ${canEdit ? '<button id="record-contact-btn">📞 Record Contact</button>' : ''}
        ${canEdit ? '<button id="move-to-contacts-btn">👥 Move to Contacts</button>' : ''}
        ${isAdmin ? '<button id="delete-btn" class="danger-btn">🗑️ Delete</button>' : ''}
        ${isAdmin ? `<button id="admin-transfer-btn">🔁 Reassign</button>` : ''}
      </div>
    </div>

    <div class="pipeline">
      ${pipelineButtons}
      <button type="button" data-stage="Lost" ${!canEdit ? 'disabled' : ''}>Mark Lost</button>
    </div>

    <div class="detail-grid">
      ${detailCard('Contact Info', `
        <p><strong>Phone:</strong> ${escHtml(lead.phone || '-')}</p>
        <p><strong>Email:</strong> ${escHtml(lead.email || '-')}</p>
        <p><strong>Source:</strong> ${escHtml(lead.source || '-')}</p>
        <p><strong>Entry User:</strong> ${escHtml(lead.createdByName || lead.leadOwnerName || '-')} <span class="muted" style="font-size:0.8rem">(original submitter)</span></p>
        <p><strong>Assigned To:</strong> ${escHtml(lead.leadOwnerName || '-')} ${isOwner ? '<span class="badge badge-green">🔒 You</span>' : ''}</p>
      `)}
      ${detailCard('Response & Lead Status', `
        <p><strong>Response:</strong> ${responseStatusBadge(lead.responseStatus) || '<span class="muted">Not set</span>'}</p>
        <p><strong>Lead Status:</strong> ${leadStatusBadge(lead.leadStatus) || '<span class="muted">Not set</span>'}</p>
        ${lead.appointmentDate ? `<p><strong>Appointment:</strong> ${escHtml(lead.appointmentDate)} at ${escHtml(lead.appointmentTime || 'TBD')}</p>` : ''}
      `)}
      ${detailCard('Qualification', `
        <p><strong>Financing:</strong> ${escHtml(financingStr)}</p>
        <p><strong>Has Land:</strong> ${lead.hasLand ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Has Downpayment (5%):</strong> ${lead.hasDownpayment ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Move Timeline:</strong> ${lead.moveTimeline ? escHtml(TIMELINE_LABELS[lead.moveTimeline] || lead.moveTimeline) : 'Not set'}</p>
        ${lead.isLongTerm ? '<p><span class="badge badge-yellow">📅 Long-Term Bucket</span></p>' : ''}
        ${lead.isDead ? '<p><span class="badge badge-red">💀 Dead Lead</span></p>' : ''}
      `)}
      ${detailCard('Transport Details', `
        <p><strong>Route:</strong> ${escHtml(lead.route || '-')}</p>
        <p><strong>Move Date:</strong> ${escHtml(lead.moveDate || '-')}</p>
        <p><strong>Home Type:</strong> ${escHtml(lead.homeType || '-')}</p>
        <p>${escHtml(lead.transportDetails || 'No transport details.')}</p>
        <p><strong>Est. Value:</strong> ${currency(lead.estimatedValue)}</p>
      `)}
      ${detailCard('Recall Campaign', `
        <p><strong>Status:</strong> ${recallStatus}</p>
        ${contactHistory}
      `)}
      ${detailCard('Email History', emailHistory)}
      ${lead.notes ? detailCard('Notes', `<p>${escHtml(lead.notes).replace(/\n/g, '<br>')}</p>`) : ''}
      ${Array.isArray(lead.duplicateMergeHistory) && lead.duplicateMergeHistory.length > 0
        ? detailCard('Duplicate Merge History', lead.duplicateMergeHistory.map((h) => `<p class="muted" style="font-size:0.85rem">${new Date(h.mergedAt).toLocaleString()} — ${escHtml(h.note || '')}</p>`).join(''))
        : ''}
    </div>
  `;

  els.detailView.querySelector('#back-btn').addEventListener('click', () => nav('/'));
  if (canEdit) {
    els.detailView.querySelector('#edit-btn').addEventListener('click', () => openLeadModal(lead));
    els.detailView.querySelector('#record-contact-btn').addEventListener('click', async () => {
      await api(`/api/leads/${lead.id}`, { method: 'PUT', body: JSON.stringify({ recordContactAttempt: true, firstName: lead.firstName, lastName: lead.lastName }) });
      await loadLeads();
      const updated = state.leads.find((l) => l.id === lead.id);
      if (updated) renderLeadDetail(updated);
    });
  }

  if (isAdmin) {
    els.detailView.querySelector('#delete-btn').addEventListener('click', async () => {
      if (!window.confirm('Delete this lead? This cannot be undone.')) return;
      await api(`/api/leads/${lead.id}`, { method: 'DELETE' });
      await loadLeads();
      nav('/');
    });
  }

  els.detailView.querySelector('#send-email-btn').addEventListener('click', () => openEmailModal(lead));

  if (canEdit) {
    const moveToContactsBtn = els.detailView.querySelector('#move-to-contacts-btn');
    if (moveToContactsBtn) {
      moveToContactsBtn.addEventListener('click', () => {
        nav('/');
        openContactModal(null, lead);
      });
    }
  }

  if (isAdmin) {
    els.detailView.querySelector('#admin-transfer-btn').addEventListener('click', async () => {
      try {
        const usersData = await api('/api/admin/users');
        const opts = usersData.users.map((u) => `${u.id}: ${u.name} (${u.email})`).join('\n');
        const choice = window.prompt(`Enter user ID to reassign lead to:\n${opts}`);
        if (!choice) return;
        const newOwnerId = choice.trim();
        await api(`/api/admin/leads/${lead.id}/transfer`, { method: 'PUT', body: JSON.stringify({ newOwnerId }) });
        await loadLeads();
        const updated = state.leads.find((l) => l.id === lead.id);
        if (updated) renderLeadDetail(updated);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  els.detailView.querySelectorAll('button[data-stage]').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', async () => {
      const stage = btn.getAttribute('data-stage');
      await updateLead(lead.id, { status: stage, firstName: lead.firstName, lastName: lead.lastName });
      const updated = state.leads.find((item) => item.id === lead.id);
      if (updated) renderLeadDetail(updated);
    });
  });
}

// ─── List / board pages ───────────────────────────────────────────────────────

function renderListPage() {
  const rows = filteredLeads();
  els.listView.classList.remove('hidden');
  els.detailView.classList.add('hidden');
  els.listToggle.classList.toggle('active', state.view === 'list');
  els.boardToggle.classList.toggle('active', state.view === 'board');

  if (state.view === 'list') {
    els.tableWrap.classList.remove('hidden');
    els.boardWrap.classList.add('hidden');
    renderTable(rows);
  } else {
    els.tableWrap.classList.add('hidden');
    els.boardWrap.classList.remove('hidden');
    renderBoard(rows);
  }
}

function renderDetailPage() {
  const leadId = currentLeadIdFromRoute();
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) { nav('/'); return; }
  els.listView.classList.add('hidden');
  els.detailView.classList.remove('hidden');
  renderLeadDetail(lead);
}

function render() {
  if (!state.token) {
    els.loginPanel.classList.remove('hidden');
    els.appPanel.classList.add('hidden');
    return;
  }
  els.loginPanel.classList.add('hidden');
  els.appPanel.classList.remove('hidden');
  const isAdmin = currentUserIsAdmin();
  const roleLabel = isAdmin ? '🔑 Admin' : '👤 PHC';
  els.userLine.textContent = state.user
    ? `${state.user.name} (${state.user.email}) — ${roleLabel}`
    : '';
  // Show admin-only buttons
  if (els.usersBtn) els.usersBtn.classList.toggle('hidden', !isAdmin);
  if (isDetailRoute()) renderDetailPage();
  else renderListPage();
}

// ─── Tasks panel ──────────────────────────────────────────────────────────────

function renderTasksPanel() {
  const pending = state.tasks.filter((t) => !t.completed);
  if (pending.length === 0) {
    els.tasksList.innerHTML = '<p class="muted" style="padding:12px">No pending tasks.</p>';
    return;
  }

  const typeLabels = {
    recall_call: '📞 Recall Call',
    mark_dead: '💀 Mark Dead',
    drip_email: '📧 Drip Email',
    monthly_call: '📅 Monthly Call',
    admin_review: '🔑 Admin Review'
  };

  els.tasksList.innerHTML = '';
  pending.slice(0, 30).forEach((task) => {
    const lead = state.leads.find((l) => l.id === task.leadId);
    const row = document.createElement('div');
    row.className = 'task-row';
    const isPast = new Date(task.scheduledAt) < new Date();
    row.innerHTML = `
      <div class="task-info">
        <strong>${escHtml(typeLabels[task.type] || task.type)}</strong>
        <span class="muted"> — ${lead ? `${escHtml(lead.firstName)} ${escHtml(lead.lastName)}` : 'Unknown lead'}</span>
        <br><span class="${isPast ? 'badge badge-red' : 'muted'}" style="font-size:0.8rem">${new Date(task.scheduledAt).toLocaleString()}</span>
        ${task.phase ? `<span class="muted" style="font-size:0.8rem"> Phase ${task.phase}</span>` : ''}
      </div>
      <button type="button" data-task="${escHtml(task.id)}" class="primary" style="font-size:0.8rem;padding:5px 10px">✓ Done</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      await api(`/api/tasks/${task.id}/complete`, { method: 'PUT' });
      await loadTasks();
      renderTasksPanel();
    });
    els.tasksList.appendChild(row);
  });

  if (pending.length > 30) {
    const more = document.createElement('p');
    more.className = 'muted';
    more.style.padding = '8px 12px';
    more.textContent = `… and ${pending.length - 30} more tasks`;
    els.tasksList.appendChild(more);
  }
}

// ─── Templates panel ──────────────────────────────────────────────────────────

function renderTemplatesPanel() {
  els.templatesList.innerHTML = '';
  if (state.templates.length === 0) {
    els.templatesList.innerHTML = '<p class="muted" style="padding:12px">No templates yet.</p>';
    return;
  }
  state.templates.forEach((tmpl) => {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
      <div class="task-info" style="flex:1">
        <strong>${escHtml(tmpl.name)}</strong> <span class="badge badge-blue">${escHtml(tmpl.type)}</span>
        <p class="muted" style="font-size:0.85rem;margin:4px 0 0">${escHtml(tmpl.subject)}</p>
      </div>
      <div class="toolbar-actions" style="gap:6px">
        <button type="button" data-edit="${escHtml(tmpl.id)}" style="font-size:0.8rem">✏️ Edit</button>
        <button type="button" data-del="${escHtml(tmpl.id)}" class="danger-btn" style="font-size:0.8rem">🗑️</button>
      </div>
    `;
    row.querySelector('[data-edit]').addEventListener('click', () => openTemplateModal(tmpl));
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!window.confirm('Delete this template?')) return;
      await api(`/api/email-templates/${tmpl.id}`, { method: 'DELETE' });
      await loadTemplates();
      renderTemplatesPanel();
    });
    els.templatesList.appendChild(row);
  });
}

// ─── Users panel ──────────────────────────────────────────────────────────────

function renderUsersPanel() {
  els.usersList.innerHTML = '';
  if (state.users.length === 0) {
    els.usersList.innerHTML = '<p class="muted" style="padding:12px">No users found.</p>';
    return;
  }
  state.users.forEach((user) => {
    const isSelf = state.user && user.id === state.user.id;
    const row = document.createElement('div');
    row.className = 'task-row';
    const roleLabel = user.role === 'admin' ? '🔑 Admin' : '👤 PHC';
    const statusLabel = user.active !== false ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>';
    row.innerHTML = `
      <div class="task-info" style="flex:1">
        <strong>${escHtml(user.name)}</strong> ${statusLabel} <span class="badge badge-blue">${roleLabel}</span>
        <p class="muted" style="font-size:0.85rem;margin:4px 0 0">${escHtml(user.email)}${isSelf ? ' <em>(You)</em>' : ''}</p>
      </div>
      <div class="toolbar-actions" style="gap:6px">
        <button type="button" data-edit-user="${escHtml(user.id)}" style="font-size:0.8rem">✏️ Edit</button>
        ${!isSelf ? `<button type="button" data-del-user="${escHtml(user.id)}" class="danger-btn" style="font-size:0.8rem">🗑️ Delete</button>` : ''}
      </div>
    `;
    row.querySelector('[data-edit-user]').addEventListener('click', () => openUserModal(user));
    const delBtn = row.querySelector('[data-del-user]');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!window.confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
        try {
          await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
          await loadUsers();
          renderUsersPanel();
        } catch (err) {
          alert(err.message);
        }
      });
    }
    els.usersList.appendChild(row);
  });
}

function openUserModal(user = null) {
  state.editingUserId = user ? user.id : null;
  els.userModalTitle.textContent = user ? 'Edit User' : 'Add User';
  els.userName.value = user ? user.name : '';
  els.userEmail.value = user ? user.email : '';
  els.userPassword.value = '';
  els.userRole.value = user ? (user.role || 'phc') : 'phc';
  // Hide password field when editing (optional password change)
  if (user) {
    els.userPasswordWrap.querySelector('input').placeholder = 'Leave blank to keep current password';
    els.userPasswordWrap.firstChild.textContent = 'New Password (optional) ';
  } else {
    els.userPasswordWrap.querySelector('input').placeholder = 'At least 6 characters';
    els.userPasswordWrap.firstChild.textContent = 'Password * ';
  }
  els.userModal.showModal();
}

els.userCancelBtn.addEventListener('click', () => els.userModal.close());

els.userSaveBtn.addEventListener('click', async () => {
  const name = els.userName.value.trim();
  const email = els.userEmail.value.trim();
  const password = els.userPassword.value;
  const role = els.userRole.value;

  if (state.editingUserId) {
    // Edit existing user
    const patch = { role };
    if (name) patch.name = name;
    if (password && password.length >= 6) patch.password = password;
    else if (password && password.length > 0 && password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    try {
      await api(`/api/admin/users/${state.editingUserId}`, { method: 'PUT', body: JSON.stringify(patch) });
      await loadUsers();
      els.userModal.close();
      renderUsersPanel();
    } catch (err) {
      alert(err.message);
    }
  } else {
    // Create new user
    if (!name || !email || !password) { alert('Name, email, and password are required.'); return; }
    if (password.length < 6) { alert('Password must be at least 6 characters.'); return; }
    try {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ name, email, password, role }) });
      await loadUsers();
      els.userModal.close();
      renderUsersPanel();
    } catch (err) {
      alert(err.message);
    }
  }
});

function populateTemplatePicker() {
  els.templatePicker.innerHTML = '';
  state.templates.forEach((tmpl) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'template-pick-btn';
    btn.dataset.id = tmpl.id;
    btn.innerHTML = `<strong>${escHtml(tmpl.name)}</strong><br><span class="muted" style="font-size:0.8rem">${escHtml(tmpl.subject)}</span>`;
    btn.addEventListener('click', () => {
      els.templatePicker.querySelectorAll('.template-pick-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      els.selectedTemplateIdInput.value = tmpl.id;
    });
    els.templatePicker.appendChild(btn);
  });
}

function setupResponseButtons() {
  els.responseBtns.querySelectorAll('.response-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.responseBtns.querySelectorAll('.response-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.response;
      els.responseStatusInput.value = val;

      const isNonAnswer = ['not_answered', 'left_vm', 'text'].includes(val);
      els.recallNotice.classList.toggle('hidden', !isNonAnswer);
      els.leadStatusSection.classList.toggle('hidden', val !== 'answered');
      if (val !== 'answered') {
        els.appointmentSection.classList.add('hidden');
        els.leadStatusSelect.value = '';
      }
    });
  });

  els.leadStatusSelect.addEventListener('change', () => {
    els.appointmentSection.classList.toggle('hidden', els.leadStatusSelect.value !== 'appointment_set');
  });

  // Move timeline radio → long-term notice
  els.leadForm.querySelectorAll('input[name="moveTimeline"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      els.longtermNotice.classList.toggle('hidden', radio.value !== 'not_ready' || !radio.checked);
    });
  });
}

function openLeadModal(lead = null) {
  state.editingLeadId = lead ? lead.id : null;
  els.leadModalTitle.textContent = lead ? 'Edit Lead' : 'New Lead';
  els.leadForm.reset();

  // Reset custom controls
  els.responseStatusInput.value = '';
  els.responseBtns.querySelectorAll('.response-btn').forEach((b) => b.classList.remove('active'));
  els.recallNotice.classList.add('hidden');
  els.leadStatusSection.classList.add('hidden');
  els.appointmentSection.classList.add('hidden');
  els.longtermNotice.classList.add('hidden');
  els.selectedTemplateIdInput.value = '';
  els.templatePicker.querySelectorAll('.template-pick-btn').forEach((b) => b.classList.remove('selected'));

  // Show/hide email template picker only for new leads
  els.emailTemplateFieldset.classList.toggle('hidden', !!lead);

  if (lead) {
    const fields = ['firstName', 'lastName', 'phone', 'email', 'homeType', 'route', 'estimatedValue', 'source', 'status', 'moveDate', 'transportDetails', 'notes'];
    fields.forEach((field) => {
      const input = els.leadForm.elements[field];
      if (input) input.value = lead[field] || '';
    });

    // Response status
    if (lead.responseStatus) {
      els.responseStatusInput.value = lead.responseStatus;
      const btn = els.responseBtns.querySelector(`[data-response="${lead.responseStatus}"]`);
      if (btn) {
        btn.classList.add('active');
        els.recallNotice.classList.toggle('hidden', !['not_answered', 'left_vm', 'text'].includes(lead.responseStatus));
        els.leadStatusSection.classList.toggle('hidden', lead.responseStatus !== 'answered');
      }
    }

    // Lead status
    if (lead.leadStatus) {
      els.leadStatusSelect.value = lead.leadStatus;
      els.appointmentSection.classList.toggle('hidden', lead.leadStatus !== 'appointment_set');
    }

    // Appointment
    if (lead.appointmentDate) els.leadForm.elements['appointmentDate'].value = lead.appointmentDate;
    if (lead.appointmentTime) els.leadForm.elements['appointmentTime'].value = lead.appointmentTime;

    // Financing checkboxes
    if (Array.isArray(lead.financing)) {
      lead.financing.forEach((f) => {
        const cb = els.leadForm.querySelector(`input[name="financing"][value="${f}"]`);
        if (cb) cb.checked = true;
      });
    }

    // Other checkboxes
    if (lead.hasLand) {
      const cb = els.leadForm.querySelector('input[name="hasLand"]');
      if (cb) cb.checked = true;
    }
    if (lead.hasDownpayment) {
      const cb = els.leadForm.querySelector('input[name="hasDownpayment"]');
      if (cb) cb.checked = true;
    }

    // Move timeline
    if (lead.moveTimeline) {
      const radio = els.leadForm.querySelector(`input[name="moveTimeline"][value="${lead.moveTimeline}"]`);
      if (radio) {
        radio.checked = true;
        els.longtermNotice.classList.toggle('hidden', lead.moveTimeline !== 'not_ready');
      }
    }
  }

  populateTemplatePicker();
  els.leadModal.showModal();
}

function collectLeadFormData() {
  const fd = new FormData(els.leadForm);
  const financing = fd.getAll('financing').filter(Boolean);
  const moveTimeline = fd.get('moveTimeline') || null;
  return {
    firstName: String(fd.get('firstName') || ''),
    lastName: String(fd.get('lastName') || ''),
    phone: String(fd.get('phone') || ''),
    email: String(fd.get('email') || ''),
    homeType: String(fd.get('homeType') || ''),
    route: String(fd.get('route') || ''),
    estimatedValue: Number(fd.get('estimatedValue') || 0),
    source: String(fd.get('source') || ''),
    status: String(fd.get('status') || 'New'),
    moveDate: String(fd.get('moveDate') || ''),
    transportDetails: String(fd.get('transportDetails') || ''),
    notes: String(fd.get('notes') || ''),
    responseStatus: els.responseStatusInput.value || null,
    leadStatus: els.leadStatusSelect.value || null,
    appointmentDate: String(fd.get('appointmentDate') || '') || null,
    appointmentTime: String(fd.get('appointmentTime') || '') || null,
    financing,
    hasLand: !!els.leadForm.querySelector('input[name="hasLand"]')?.checked,
    hasDownpayment: !!els.leadForm.querySelector('input[name="hasDownpayment"]')?.checked,
    moveTimeline,
    isLongTerm: moveTimeline === 'not_ready'
  };
}

async function submitLeadForm() {
  const payload = collectLeadFormData();

  if (!payload.firstName || !payload.lastName) {
    alert('First name and last name are required.');
    return;
  }

  try {
    if (state.editingLeadId) {
      await updateLead(state.editingLeadId, payload);
    } else {
      // Check for duplicates first
      const dupCheck = await api('/api/leads/check-duplicate', { method: 'POST', body: JSON.stringify({ firstName: payload.firstName, lastName: payload.lastName, email: payload.email, phone: payload.phone }) });
      if (dupCheck.duplicates && dupCheck.duplicates.length > 0) {
        els.leadModal.close();
        state.pendingLeadPayload = payload;
        // Load users if not loaded yet (for the owner dropdown in dup modal)
        if (state.users.length === 0) await loadUsers();
        openDuplicateModal(dupCheck.duplicates, payload);
        return;
      }
      const result = await api('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
      state.leads.unshift(result.lead);

      // Send initial email if template selected
      const tmplId = els.selectedTemplateIdInput.value;
      if (tmplId) {
        await sendEmailFromTemplate(result.lead, tmplId);
      }
    }
    els.leadModal.close();
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function sendEmailFromTemplate(lead, templateId) {
  const tmpl = state.templates.find((t) => t.id === templateId);
  if (!tmpl) return;
  const subject = interpolateTemplate(tmpl.subject, lead);
  const body = interpolateTemplate(tmpl.body, lead);
  try {
    await api(`/api/leads/${lead.id}/send-email`, { method: 'POST', body: JSON.stringify({ templateId, subject, body }) });
    // Reload to pick up emailsSent update
    await loadLeads();
  } catch (err) {
    console.warn('Email record failed:', err.message);
  }
}

// ─── Duplicate modal ──────────────────────────────────────────────────────────

function openDuplicateModal(duplicates, newLeadData) {
  state.pendingDuplicates = duplicates;
  const isAdmin = currentUserIsAdmin();

  // Build side-by-side comparison for the first duplicate
  const existing = duplicates[0];
  const newLead = newLeadData || state.pendingLeadPayload || {};

  const fields = [
    ['First Name', existing.firstName, newLead.firstName],
    ['Last Name', existing.lastName, newLead.lastName],
    ['Phone', existing.phone, newLead.phone],
    ['Email', existing.email, newLead.email],
    ['Home Type', existing.homeType, newLead.homeType],
    ['Route', existing.route, newLead.route],
    ['Source', existing.source, newLead.source],
    ['Entry User', existing.leadOwnerName, state.user ? state.user.name : 'You'],
  ];

  const tableRows = fields.map(([label, existVal, newVal]) => {
    const diff = String(existVal || '').trim().toLowerCase() !== String(newVal || '').trim().toLowerCase();
    return `<tr ${diff ? 'class="dup-diff"' : ''}>
      <td class="dup-label">${escHtml(label)}</td>
      <td>${escHtml(existVal || '-')}</td>
      <td>${escHtml(newVal || '-')}</td>
    </tr>`;
  }).join('');

  const moreCount = duplicates.length > 1 ? `<p class="muted" style="font-size:0.85rem;margin-top:8px">+${duplicates.length - 1} more duplicate(s) found.</p>` : '';

  els.dupComparison.innerHTML = `
    <table class="dup-table">
      <thead><tr><th>Field</th><th>Existing Lead</th><th>New Entry</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    ${moreCount}
  `;

  // Show/hide admin section
  els.dupPhcHint.classList.toggle('hidden', isAdmin);
  els.dupAdminSection.classList.toggle('hidden', !isAdmin);
  els.dupAllowBtn.classList.toggle('hidden', !isAdmin);
  els.dupMergeBtn.classList.toggle('hidden', !isAdmin);
  els.dupOwnerBtn.classList.toggle('hidden', !isAdmin);
  els.dupOwnerSelectWrap.classList.add('hidden');

  // Populate owner dropdown
  if (isAdmin) {
    els.dupOwnerDropdown.innerHTML = '';
    (state.users.length ? state.users : []).forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.email})`;
      els.dupOwnerDropdown.appendChild(opt);
    });
  }

  els.dupNote.value = '';
  els.dupModal.showModal();
}

els.dupRejectBtn.addEventListener('click', () => {
  state.pendingLeadPayload = null;
  state.pendingDuplicates = [];
  els.dupModal.close();
});

els.dupAllowBtn.addEventListener('click', async () => {
  if (!state.pendingLeadPayload) return;
  const note = els.dupNote.value.trim();
  try {
    const result = await api('/api/admin/approve-duplicate', {
      method: 'POST',
      body: JSON.stringify({ action: 'allow', pendingLeadData: state.pendingLeadPayload, note: note || 'Admin approved duplicate entry' })
    });
    state.leads.unshift(result.lead);

    const tmplId = els.selectedTemplateIdInput.value;
    if (tmplId) await sendEmailFromTemplate(result.lead, tmplId);

    state.pendingLeadPayload = null;
    state.pendingDuplicates = [];
    els.dupModal.close();
    render();
  } catch (err) {
    alert(err.message);
  }
});

els.dupMergeBtn.addEventListener('click', async () => {
  const existing = state.pendingDuplicates[0];
  if (!existing) return;
  const note = els.dupNote.value.trim();
  try {
    await api('/api/admin/approve-duplicate', {
      method: 'POST',
      body: JSON.stringify({ action: 'merge', existingLeadId: existing.id, pendingLeadData: state.pendingLeadPayload, note: note || 'Admin merged duplicate entry' })
    });
    await loadLeads();
    state.pendingLeadPayload = null;
    state.pendingDuplicates = [];
    els.dupModal.close();
    render();
  } catch (err) {
    alert(err.message);
  }
});

els.dupOwnerBtn.addEventListener('click', async () => {
  const existing = state.pendingDuplicates[0];
  if (!existing) return;

  // Toggle owner select visibility
  const isVisible = !els.dupOwnerSelectWrap.classList.contains('hidden');
  if (isVisible) {
    // Confirm the action
    const targetUserId = els.dupOwnerDropdown.value;
    if (!targetUserId) { alert('Please select a user.'); return; }
    const note = els.dupNote.value.trim();
    try {
      await api('/api/admin/approve-duplicate', {
        method: 'POST',
        body: JSON.stringify({ action: 'change_owner', existingLeadId: existing.id, targetUserId, note: note || 'Admin changed lead owner' })
      });
      await loadLeads();
      state.pendingLeadPayload = null;
      state.pendingDuplicates = [];
      els.dupModal.close();
      render();
    } catch (err) {
      alert(err.message);
    }
  } else {
    els.dupOwnerSelectWrap.classList.remove('hidden');
    els.dupOwnerBtn.textContent = '✓ Confirm Owner Change';
  }
});

// ─── Email modal ──────────────────────────────────────────────────────────────

function openEmailModal(lead) {
  state.emailTargetLeadId = lead.id;
  state.emailTargetType = 'lead';
  els.emailModalTitle.textContent = `Email — ${lead.firstName} ${lead.lastName}`;
  els.emailSubject.value = '';
  els.emailBody.value = '';

  // Populate template select
  els.emailTemplateSelect.innerHTML = '<option value="">— Custom / No Template —</option>';
  state.templates.forEach((tmpl) => {
    const opt = document.createElement('option');
    opt.value = tmpl.id;
    opt.textContent = tmpl.name;
    els.emailTemplateSelect.appendChild(opt);
  });

  // Auto-fill for appointment confirmation if applicable
  if (lead.leadStatus === 'appointment_set') {
    const apptTmpl = state.templates.find((t) => t.type === 'appointment');
    if (apptTmpl) {
      els.emailTemplateSelect.value = apptTmpl.id;
      els.emailSubject.value = interpolateTemplate(apptTmpl.subject, lead);
      els.emailBody.value = interpolateTemplate(apptTmpl.body, lead);
    }
  }

  els.emailModal.showModal();
}

els.emailTemplateSelect.addEventListener('change', () => {
  const tmplId = els.emailTemplateSelect.value;
  if (!tmplId) return;
  const lead = state.leads.find((l) => l.id === state.emailTargetLeadId);
  if (!lead) return;
  const tmpl = state.templates.find((t) => t.id === tmplId);
  if (!tmpl) return;
  els.emailSubject.value = interpolateTemplate(tmpl.subject, lead);
  els.emailBody.value = interpolateTemplate(tmpl.body, lead);
});

els.emailCancelBtn.addEventListener('click', () => els.emailModal.close());

els.emailSendBtn.addEventListener('click', async () => {
  const subject = els.emailSubject.value.trim();
  const body = els.emailBody.value.trim();
  if (!subject || !body) { alert('Subject and body are required'); return; }
  try {
    const targetType = state.emailTargetType || 'lead';
    let endpoint;
    if (targetType === 'contact') {
      endpoint = `/api/contacts/${state.emailTargetLeadId}/send-email`;
    } else if (targetType === 'customer') {
      endpoint = `/api/active-customers/${state.emailTargetLeadId}/send-email`;
    } else {
      endpoint = `/api/leads/${state.emailTargetLeadId}/send-email`;
    }
    await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({ templateId: els.emailTemplateSelect.value || null, subject, body })
    });
    if (targetType === 'lead') {
      await loadLeads();
      // Re-render detail if we're on detail page
      if (isDetailRoute()) {
        const lead = state.leads.find((l) => l.id === state.emailTargetLeadId);
        if (lead) renderLeadDetail(lead);
      }
    } else if (targetType === 'contact') {
      await loadContacts();
    } else {
      await loadActiveCustomers();
    }
    els.emailModal.close();
    alert('Email recorded successfully!');
  } catch (err) {
    alert(err.message);
  }
});

// ─── Template modal ───────────────────────────────────────────────────────────

function openTemplateModal(tmpl = null) {
  state.editingTemplateId = tmpl ? tmpl.id : null;
  els.templateModalTitle.textContent = tmpl ? 'Edit Template' : 'New Email Template';
  els.tmplName.value = tmpl ? tmpl.name : '';
  els.tmplType.value = tmpl ? tmpl.type : 'welcome';
  els.tmplSubject.value = tmpl ? tmpl.subject : '';
  els.tmplBody.value = tmpl ? tmpl.body : '';
  els.templateModal.showModal();
}

els.tmplCancelBtn.addEventListener('click', () => els.templateModal.close());

els.tmplSaveBtn.addEventListener('click', async () => {
  const name = els.tmplName.value.trim();
  const subject = els.tmplSubject.value.trim();
  const body = els.tmplBody.value.trim();
  const type = els.tmplType.value;
  if (!name || !subject || !body) { alert('Name, subject, and body are required'); return; }
  try {
    if (state.editingTemplateId) {
      await api(`/api/email-templates/${state.editingTemplateId}`, { method: 'PUT', body: JSON.stringify({ name, subject, body, type }) });
    } else {
      await api('/api/email-templates', { method: 'POST', body: JSON.stringify({ name, subject, body, type }) });
    }
    await loadTemplates();
    els.templateModal.close();
    renderTemplatesPanel();
  } catch (err) {
    alert(err.message);
  }
});

// ─── CSV export ───────────────────────────────────────────────────────────────

function toCsv(rows) {
  const headers = ['First Name', 'Last Name', 'Owner', 'Status', 'Response', 'Lead Status', 'Home Type', 'Route', 'Value', 'Source', 'Financing', 'Has Land', 'Has Downpayment', 'Timeline', 'Long-Term', 'Dead', 'Recall Active', 'Move Date', 'Phone', 'Email', 'Notes'];
  const esc = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [
    r.firstName, r.lastName, r.leadOwnerName, r.status, r.responseStatus || '', r.leadStatus || '',
    r.homeType, r.route, r.estimatedValue, r.source,
    Array.isArray(r.financing) ? r.financing.join(';') : '',
    r.hasLand ? 'Yes' : 'No', r.hasDownpayment ? 'Yes' : 'No',
    r.moveTimeline || '', r.isLongTerm ? 'Yes' : 'No', r.isDead ? 'Yes' : 'No',
    r.recallCampaignActive ? 'Yes' : 'No', r.moveDate, r.phone, r.email, r.notes
  ].map(esc).join(','));
  return `${headers.join(',')}\n${lines.join('\n')}`;
}

function downloadCsv() {
  const blob = new Blob([toCsv(filteredLeads())], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initializeAuthedState() {
  try {
    const me = await api('/api/auth/me');
    state.user = me.user;
    const loaders = [loadLeads(), loadTemplates(), loadTasks()];
    if (currentUserIsAdmin()) loaders.push(loadUsers());
    await Promise.all(loaders);
    render();
  } catch (error) {
    state.token = '';
    state.user = null;
    localStorage.removeItem('crm_token');
    render();
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// ─── Contacts data ────────────────────────────────────────────────────────────

async function loadContacts() {
  const data = await api('/api/contacts');
  state.contacts = data.contacts || [];
}

async function loadActiveCustomers() {
  const data = await api('/api/active-customers');
  state.activeCustomers = data.customers || [];
}

// ─── Contacts panel ───────────────────────────────────────────────────────────

const CONTACT_PIPELINE = ['Call Back Scheduled', 'Appointment Set', 'Application Sent'];

const ACTIVE_CUSTOMER_STATUSES_LIST = [
  'Contact Status', 'App Submitted', 'Approved', 'Pending Conditions', 'Ready to Close',
  'Appraisal', 'Docs Ordered', 'Closed Pending Delivery', 'Delivered Pending Funding',
  'Funded', 'Trimout Pending', 'Trimmed Out Pending Addl Work', 'Completed', 'Closed'
];

const LENDERS = ['21ST', 'CPM', 'Triad', 'CUHU', 'Cash', 'Other', 'CSL', 'Calcon'];

function renderContactsPanel() {
  const filter = state.contactsFilter;
  const contacts = filter === 'all'
    ? state.contacts
    : state.contacts.filter((c) => c.pipelineStatus === filter);

  els.contactsPipelineBar.querySelectorAll('.pipe-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.stage === filter);
  });

  els.contactsList.innerHTML = '';

  if (contacts.length === 0) {
    els.contactsList.innerHTML = '<p class="muted" style="padding:12px">No contacts found. Move a lead to contacts or create a new contact.</p>';
    return;
  }

  const boardWrap = document.createElement('div');
  boardWrap.className = 'contacts-board';

  const stages = filter === 'all' ? CONTACT_PIPELINE : [filter];
  stages.forEach((stage) => {
    const col = document.createElement('div');
    col.className = 'contact-col';
    const stageContacts = contacts.filter((c) => c.pipelineStatus === stage);
    col.innerHTML = `<h4 class="contact-col-header">${escHtml(stage)} <span class="count-badge">${stageContacts.length}</span></h4>`;

    stageContacts.forEach((contact) => {
      const card = document.createElement('article');
      card.className = 'contact-card';
      card.innerHTML = `
        <div class="contact-card-header">
          <strong>${escHtml(contact.firstName)} ${escHtml(contact.lastName)}</strong>
          ${contact.promotedToCustomer ? '<span class="badge badge-green" title="Promoted to Active Customer">⭐ Customer</span>' : ''}
        </div>
        <p class="muted" style="font-size:0.85rem">${escHtml(contact.phone || '-')} &nbsp;|&nbsp; ${escHtml(contact.source || '-')}</p>
        ${contact.homeType ? `<p style="font-size:0.85rem">${escHtml(contact.homeType)}</p>` : ''}
        ${contact.route ? `<p style="font-size:0.85rem">📍 ${escHtml(contact.route)}</p>` : ''}
        <p class="muted" style="font-size:0.75rem">Owner: ${escHtml(contact.ownerName || '-')}</p>
        <div class="card-actions" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" data-view-contact="${escHtml(contact.id)}" style="font-size:0.75rem;padding:3px 8px">View</button>
          ${!contact.promotedToCustomer ? `<button type="button" data-promote-contact="${escHtml(contact.id)}" class="primary" style="font-size:0.75rem;padding:3px 8px">⭐ Promote</button>` : ''}
        </div>
      `;
      col.appendChild(card);
    });

    boardWrap.appendChild(col);
  });

  els.contactsList.appendChild(boardWrap);

  els.contactsList.querySelectorAll('[data-view-contact]').forEach((btn) => {
    btn.addEventListener('click', () => openContactDetail(btn.dataset.viewContact));
  });
  els.contactsList.querySelectorAll('[data-promote-contact]').forEach((btn) => {
    btn.addEventListener('click', () => promoteContactToCustomer(btn.dataset.promoteContact));
  });
}

async function promoteContactToCustomer(contactId) {
  if (!window.confirm('Promote this contact to an Active Customer?')) return;
  try {
    const result = await api(`/api/contacts/${contactId}/promote`, { method: 'POST' });
    await Promise.all([loadContacts(), loadActiveCustomers()]);
    renderContactsPanel();
    alert(`${result.customer.firstName} ${result.customer.lastName} has been promoted to Active Customer!`);
  } catch (err) {
    alert(err.message);
  }
}

function openContactDetail(contactId) {
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return;
  renderContactDetailModal(contact);
  els.contactDetailModal.showModal();
}

function renderContactDetailModal(contact) {
  const isOwner = state.user && contact.owner === state.user.id;
  const isAdmin = currentUserIsAdmin();
  const canEdit = isOwner || isAdmin;

  els.contactDetailContent.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px">
      <div>
        <h3 style="margin:0">${escHtml(contact.firstName)} ${escHtml(contact.lastName)}</h3>
        <p class="muted" style="margin:0">${escHtml(contact.pipelineStatus)} &nbsp;|&nbsp; Owner: ${escHtml(contact.ownerName || '-')}</p>
      </div>
      <div class="toolbar-actions">
        ${canEdit ? `<button type="button" id="contact-detail-edit-btn" data-id="${escHtml(contact.id)}">✏️ Edit</button>` : ''}
        <button type="button" id="contact-detail-email-btn" class="primary">✉️ Email</button>
        <button type="button" id="contact-detail-docs-btn">📎 Documents</button>
        ${isAdmin ? `<button type="button" id="contact-detail-delete-btn" class="danger-btn">🗑️ Delete</button>` : ''}
        <button type="button" id="contact-detail-close-btn">✕ Close</button>
      </div>
    </div>

    <div class="pipeline" style="margin-bottom:16px">
      ${CONTACT_PIPELINE.map((s) => `<button type="button" data-contact-stage="${escHtml(s)}" class="${contact.pipelineStatus === s ? 'active' : ''}" ${!canEdit ? 'disabled' : ''}>${escHtml(s)}</button>`).join('')}
    </div>

    <div class="detail-grid">
      <article class="card">
        <h4>Contact Info</h4>
        <p><strong>Phone:</strong> ${escHtml(contact.phone || '-')}</p>
        <p><strong>Email:</strong> ${escHtml(contact.email || '-')}</p>
        <p><strong>Source:</strong> ${escHtml(contact.source || '-')}</p>
        <p><strong>Home Type:</strong> ${escHtml(contact.homeType || '-')}</p>
        <p><strong>Route:</strong> ${escHtml(contact.route || '-')}</p>
      </article>
      <article class="card">
        <h4>Status</h4>
        <p><strong>Pipeline:</strong> <span class="badge badge-blue">${escHtml(contact.pipelineStatus)}</span></p>
        <p><strong>Created:</strong> ${new Date(contact.createdAt).toLocaleDateString()}</p>
        ${contact.fromLeadId ? `<p><strong>From Lead:</strong> <a href="#" data-lead-link="${escHtml(contact.fromLeadId)}">View original lead</a></p>` : ''}
        ${contact.promotedToCustomer ? '<p><span class="badge badge-green">⭐ Promoted to Active Customer</span></p>' : ''}
      </article>
      ${contact.notes ? `<article class="card" style="grid-column:1/-1"><h4>Notes</h4><p>${escHtml(contact.notes).replace(/\n/g, '<br>')}</p></article>` : ''}
      ${Array.isArray(contact.emailsSent) && contact.emailsSent.length > 0 ? `
        <article class="card" style="grid-column:1/-1">
          <h4>Email History</h4>
          ${contact.emailsSent.map((e) => `<div class="email-record"><strong>${escHtml(e.subject)}</strong> <span class="muted">${new Date(e.sentAt).toLocaleString()}</span></div>`).join('')}
        </article>` : ''}
    </div>

    <div id="contact-docs-section" class="hidden" style="margin-top:16px">
      <div class="toolbar" style="margin-bottom:8px">
        <h4 style="margin:0">Documents</h4>
        <button type="button" id="contact-upload-doc-btn" class="primary" style="font-size:0.85rem">+ Upload Document</button>
      </div>
      <div id="contact-docs-list"></div>
    </div>
  `;

  els.contactDetailContent.querySelector('#contact-detail-close-btn').addEventListener('click', () => els.contactDetailModal.close());

  if (canEdit) {
    els.contactDetailContent.querySelector('#contact-detail-edit-btn').addEventListener('click', () => {
      els.contactDetailModal.close();
      openContactModal(contact);
    });
  }

  els.contactDetailContent.querySelectorAll('[data-contact-stage]').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', async () => {
      const stage = btn.dataset.contactStage;
      await api(`/api/contacts/${contact.id}`, { method: 'PUT', body: JSON.stringify({ pipelineStatus: stage }) });
      await loadContacts();
      const updated = state.contacts.find((c) => c.id === contact.id);
      if (updated) renderContactDetailModal(updated);
      renderContactsPanel();
    });
  });

  els.contactDetailContent.querySelector('#contact-detail-email-btn').addEventListener('click', () => {
    openContactEmailModal(contact);
  });

  const deleteBtn = els.contactDetailContent.querySelector('#contact-detail-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('Delete this contact? This cannot be undone.')) return;
      await api(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      await loadContacts();
      els.contactDetailModal.close();
      renderContactsPanel();
    });
  }

  els.contactDetailContent.querySelector('#contact-detail-docs-btn').addEventListener('click', async () => {
    const section = els.contactDetailContent.querySelector('#contact-docs-section');
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
      await renderDocumentsList(contact.id, els.contactDetailContent.querySelector('#contact-docs-list'));
    }
  });

  const uploadDocBtn = els.contactDetailContent.querySelector('#contact-upload-doc-btn');
  if (uploadDocBtn) {
    uploadDocBtn.addEventListener('click', () => openDocUploadModal(contact.id, 'contact'));
  }

  const leadLink = els.contactDetailContent.querySelector('[data-lead-link]');
  if (leadLink) {
    leadLink.addEventListener('click', (e) => {
      e.preventDefault();
      els.contactDetailModal.close();
      nav(`/leads/${leadLink.dataset.leadLink}`);
    });
  }
}

function openContactEmailModal(contact) {
  state.emailTargetLeadId = contact.id;
  state.emailTargetType = 'contact';
  els.emailModalTitle.textContent = `Email — ${contact.firstName} ${contact.lastName}`;
  els.emailSubject.value = '';
  els.emailBody.value = '';

  els.emailTemplateSelect.innerHTML = '<option value="">— Custom / No Template —</option>';
  state.templates.forEach((tmpl) => {
    const opt = document.createElement('option');
    opt.value = tmpl.id;
    opt.textContent = tmpl.name;
    els.emailTemplateSelect.appendChild(opt);
  });

  els.emailModal.showModal();
}

// ─── Contact modal ────────────────────────────────────────────────────────────

function openContactModal(contact = null, fromLead = null) {
  state.editingContactId = contact ? contact.id : null;
  els.contactModalTitle.textContent = contact ? 'Edit Contact' : 'New Contact';
  els.contactFirstName.value = contact ? contact.firstName : (fromLead ? fromLead.firstName : '');
  els.contactLastName.value = contact ? contact.lastName : (fromLead ? fromLead.lastName : '');
  els.contactPhone.value = contact ? contact.phone : (fromLead ? fromLead.phone || '' : '');
  els.contactEmail.value = contact ? contact.email : (fromLead ? fromLead.email || '' : '');
  els.contactHomeType.value = contact ? contact.homeType : (fromLead ? fromLead.homeType || '' : '');
  els.contactRoute.value = contact ? contact.route : (fromLead ? fromLead.route || '' : '');
  els.contactPipelineStatus.value = contact ? contact.pipelineStatus : 'Call Back Scheduled';
  els.contactSource.value = contact ? (contact.source || 'Other') : (fromLead ? (fromLead.source || 'Other') : 'Other');
  els.contactNotes.value = contact ? contact.notes : (fromLead ? fromLead.notes || '' : '');
  els.contactModal._fromLeadId = fromLead ? fromLead.id : null;
  els.contactModal.showModal();
}

els.contactCancelBtn.addEventListener('click', () => els.contactModal.close());

els.contactSaveBtn.addEventListener('click', async () => {
  const firstName = els.contactFirstName.value.trim();
  const lastName = els.contactLastName.value.trim();
  if (!firstName || !lastName) { alert('First name and last name are required.'); return; }

  const payload = {
    firstName,
    lastName,
    phone: els.contactPhone.value.trim(),
    email: els.contactEmail.value.trim(),
    homeType: els.contactHomeType.value.trim(),
    route: els.contactRoute.value.trim(),
    pipelineStatus: els.contactPipelineStatus.value,
    source: els.contactSource.value,
    notes: els.contactNotes.value.trim()
  };

  try {
    if (state.editingContactId) {
      await api(`/api/contacts/${state.editingContactId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      if (els.contactModal._fromLeadId) payload.fromLeadId = els.contactModal._fromLeadId;
      await api('/api/contacts', { method: 'POST', body: JSON.stringify(payload) });
    }
    await loadContacts();
    els.contactModal.close();
    renderContactsPanel();
  } catch (err) {
    alert(err.message);
  }
});

// ─── Active Customers panel ───────────────────────────────────────────────────

function renderActiveCustomersPanel() {
  const filter = state.acFilter;
  const customers = filter === 'all'
    ? state.activeCustomers
    : state.activeCustomers.filter((c) => c.status === filter);

  els.acStatusFilterBar.querySelectorAll('[data-ac-stage]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.acStage === filter);
  });

  els.activeCustomersList.innerHTML = '';

  if (customers.length === 0) {
    els.activeCustomersList.innerHTML = '<p class="muted" style="padding:12px">No active customers. Promote a contact to create an active customer.</p>';
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Customer</th>
        <th>Status</th>
        <th>Lender</th>
        <th>Home Type</th>
        <th>Route</th>
        <th>Month</th>
        <th>Owner</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  customers.forEach((customer) => {
    const tr = document.createElement('tr');
    const checklistCount = customer.checklist ? Object.values(customer.checklist).filter((v) => v === true).length : 0;
    const checklistTotal = 15;
    tr.innerHTML = `
      <td><strong>${escHtml(customer.firstName)} ${escHtml(customer.lastName)}</strong><br><span class="muted" style="font-size:0.8rem">${escHtml(customer.phone || '-')}</span></td>
      <td><span class="badge badge-blue" style="font-size:0.75rem">${escHtml(customer.status || '-')}</span></td>
      <td>${customer.lender ? `<span class="badge badge-green">${escHtml(customer.lender)}</span>` : '<span class="muted">-</span>'}</td>
      <td>${escHtml(customer.homeType || '-')}</td>
      <td>${escHtml(customer.route || '-')}</td>
      <td>${escHtml(customer.monthYear || '-')}</td>
      <td>${escHtml(customer.ownerName || '-')}</td>
      <td>
        <button type="button" data-view-ac="${escHtml(customer.id)}" style="font-size:0.75rem;padding:3px 8px">View</button>
        <span class="muted" style="font-size:0.75rem;margin-left:6px">${checklistCount}/${checklistTotal} ✓</span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  els.activeCustomersList.appendChild(table);

  els.activeCustomersList.querySelectorAll('[data-view-ac]').forEach((btn) => {
    btn.addEventListener('click', () => openActiveCustomerDetail(btn.dataset.viewAc));
  });
}

function openActiveCustomerDetail(customerId) {
  const customer = state.activeCustomers.find((c) => c.id === customerId);
  if (!customer) return;
  renderActiveCustomerDetailModal(customer);
  els.acDetailModal.showModal();
}

function renderActiveCustomerDetailModal(customer) {
  const isOwner = state.user && customer.owner === state.user.id;
  const isAdmin = currentUserIsAdmin();
  const canEdit = isOwner || isAdmin;
  const cl = customer.checklist || {};

  const checkboxItem = (key, label, isSelect = false, options = []) => {
    if (isSelect) {
      const opts = options.map((o) => `<option value="${escHtml(o)}" ${cl[key] === o ? 'selected' : ''}>${escHtml(o)}</option>`).join('');
      return `
        <div class="checklist-item">
          <label>${escHtml(label)}:
            <select data-cl-key="${escHtml(key)}" ${!canEdit ? 'disabled' : ''}>
              <option value="">— Select —</option>
              ${opts}
            </select>
          </label>
        </div>`;
    }
    return `
      <div class="checklist-item">
        <label class="check-label">
          <input type="checkbox" data-cl-key="${escHtml(key)}" ${cl[key] ? 'checked' : ''} ${!canEdit ? 'disabled' : ''} />
          ${escHtml(label)}
        </label>
      </div>`;
  };

  els.acDetailContent.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px">
      <div>
        <h3 style="margin:0">${escHtml(customer.firstName)} ${escHtml(customer.lastName)}</h3>
        <p class="muted" style="margin:0">Active Customer &nbsp;|&nbsp; Owner: ${escHtml(customer.ownerName || '-')}</p>
      </div>
      <div class="toolbar-actions">
        <button type="button" id="ac-email-btn" class="primary">✉️ Email</button>
        <button type="button" id="ac-docs-btn">📎 Documents</button>
        ${isAdmin ? `<button type="button" id="ac-delete-btn" class="danger-btn">🗑️ Delete</button>` : ''}
        <button type="button" id="ac-close-btn">✕ Close</button>
      </div>
    </div>

    <div class="detail-grid" style="margin-bottom:16px">
      <article class="card">
        <h4>Contact Info</h4>
        <p><strong>Phone:</strong> ${escHtml(customer.phone || '-')}</p>
        <p><strong>Email:</strong> ${escHtml(customer.email || '-')}</p>
        <p><strong>Home Type:</strong> ${escHtml(customer.homeType || '-')}</p>
        <p><strong>Route:</strong> ${escHtml(customer.route || '-')}</p>
        <p><strong>Month:</strong> ${escHtml(customer.monthYear || '-')}</p>
      </article>

      <article class="card">
        <h4>Status &amp; Financing</h4>
        <div style="margin-bottom:10px">
          <label><strong>Customer Status</strong>
            <select id="ac-status-select" ${!canEdit ? 'disabled' : ''} style="display:block;margin-top:4px;width:100%">
              ${ACTIVE_CUSTOMER_STATUSES_LIST.map((s) => `<option value="${escHtml(s)}" ${customer.status === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div>
          <label><strong>Approved for Financing — Lender</strong>
            <select id="ac-lender-select" ${!canEdit ? 'disabled' : ''} style="display:block;margin-top:4px;width:100%">
              <option value="">— No Lender Selected —</option>
              ${LENDERS.map((l) => `<option value="${escHtml(l)}" ${customer.lender === l ? 'selected' : ''}>${escHtml(l)}</option>`).join('')}
            </select>
          </label>
        </div>
        ${canEdit ? `<button type="button" id="ac-save-status-btn" class="primary" style="margin-top:10px;width:100%">Save Status &amp; Lender</button>` : ''}
      </article>
    </div>

    <article class="card" style="margin-bottom:16px">
      <h4>Detailed Items Checklist</h4>
      <div class="checklist-grid">
        <div class="checklist-section">
          <p class="qual-label">Type</p>
          ${checkboxItem('type', 'Type', true, ['New', 'Used', 'Repo'])}
          ${checkboxItem('orderStock', 'Order/Stock', true, ['Order', 'Stock'])}
          ${checkboxItem('factory', 'Factory', true, ['BU', 'RM', 'AT'])}
          ${checkboxItem('modular', 'Modular', true, ['Y', 'N'])}
          ${checkboxItem('swDwTw', 'SW/DW/TW', true, ['SW', 'DW', 'TW'])}
        </div>
        <div class="checklist-section">
          <p class="qual-label">Financial Documents</p>
          ${checkboxItem('payStubs', 'Pay Stubs')}
          ${checkboxItem('w2s', "W2's")}
          ${checkboxItem('vod', 'VOD')}
          ${checkboxItem('voeVor', 'VOE / VOR')}
          ${checkboxItem('bids', 'Bids')}
          ${checkboxItem('lenderDoc', 'Lender')}
        </div>
        <div class="checklist-section">
          <p class="qual-label">Property Documents</p>
          ${checkboxItem('deedLandContract', 'Deed / Land Contract')}
          ${checkboxItem('siteInspection', 'Site Inspection')}
          ${checkboxItem('survey', 'Survey')}
          ${checkboxItem('appraisal', 'Appraisal')}
          ${checkboxItem('title', 'Title')}
          ${checkboxItem('address911', '911 Address')}
          ${checkboxItem('specSheet', 'Spec Sheet')}
          ${checkboxItem('cocs', 'C.O.C.S.')}
          ${checkboxItem('conditionsMet', 'Conditions Met')}
        </div>
      </div>
      ${canEdit ? `<button type="button" id="ac-save-checklist-btn" class="primary" style="margin-top:12px">Save Checklist</button>` : ''}
    </article>

    ${customer.notes ? `<article class="card" style="margin-bottom:16px"><h4>Notes</h4><p>${escHtml(customer.notes).replace(/\n/g, '<br>')}</p></article>` : ''}

    <div id="ac-docs-section" class="hidden" style="margin-top:16px">
      <div class="toolbar" style="margin-bottom:8px">
        <h4 style="margin:0">Documents</h4>
        <button type="button" id="ac-upload-doc-btn" class="primary" style="font-size:0.85rem">+ Upload Document</button>
      </div>
      <div id="ac-docs-list"></div>
    </div>
  `;

  els.acDetailContent.querySelector('#ac-close-btn').addEventListener('click', () => els.acDetailModal.close());

  const saveStatusBtn = els.acDetailContent.querySelector('#ac-save-status-btn');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', async () => {
      const status = els.acDetailContent.querySelector('#ac-status-select').value;
      const lender = els.acDetailContent.querySelector('#ac-lender-select').value;
      try {
        await api(`/api/active-customers/${customer.id}`, { method: 'PUT', body: JSON.stringify({ status, lender }) });
        await loadActiveCustomers();
        const updated = state.activeCustomers.find((c) => c.id === customer.id);
        if (updated) renderActiveCustomerDetailModal(updated);
        renderActiveCustomersPanel();
        alert('Status and lender saved!');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const saveChecklistBtn = els.acDetailContent.querySelector('#ac-save-checklist-btn');
  if (saveChecklistBtn) {
    saveChecklistBtn.addEventListener('click', async () => {
      const checklist = {};
      els.acDetailContent.querySelectorAll('input[data-cl-key]').forEach((cb) => {
        checklist[cb.dataset.clKey] = cb.checked;
      });
      els.acDetailContent.querySelectorAll('select[data-cl-key]').forEach((sel) => {
        checklist[sel.dataset.clKey] = sel.value || null;
      });
      try {
        await api(`/api/active-customers/${customer.id}`, { method: 'PUT', body: JSON.stringify({ checklist }) });
        await loadActiveCustomers();
        const updated = state.activeCustomers.find((c) => c.id === customer.id);
        if (updated) renderActiveCustomerDetailModal(updated);
        renderActiveCustomersPanel();
        alert('Checklist saved!');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  els.acDetailContent.querySelector('#ac-email-btn').addEventListener('click', () => {
    state.emailTargetLeadId = customer.id;
    state.emailTargetType = 'customer';
    els.emailModalTitle.textContent = `Email — ${customer.firstName} ${customer.lastName}`;
    els.emailSubject.value = '';
    els.emailBody.value = '';
    els.emailTemplateSelect.innerHTML = '<option value="">— Custom / No Template —</option>';
    state.templates.forEach((tmpl) => {
      const opt = document.createElement('option');
      opt.value = tmpl.id;
      opt.textContent = tmpl.name;
      els.emailTemplateSelect.appendChild(opt);
    });
    els.emailModal.showModal();
  });

  const deleteBtn = els.acDetailContent.querySelector('#ac-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('Delete this active customer? This cannot be undone.')) return;
      await api(`/api/active-customers/${customer.id}`, { method: 'DELETE' });
      await loadActiveCustomers();
      els.acDetailModal.close();
      renderActiveCustomersPanel();
    });
  }

  els.acDetailContent.querySelector('#ac-docs-btn').addEventListener('click', async () => {
    const section = els.acDetailContent.querySelector('#ac-docs-section');
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
      await renderDocumentsList(customer.id, els.acDetailContent.querySelector('#ac-docs-list'));
    }
  });

  const uploadDocBtn = els.acDetailContent.querySelector('#ac-upload-doc-btn');
  if (uploadDocBtn) {
    uploadDocBtn.addEventListener('click', () => openDocUploadModal(customer.id, 'customer'));
  }
}

// ─── Document management ──────────────────────────────────────────────────────

async function renderDocumentsList(customerId, container) {
  try {
    const data = await api(`/api/documents/${customerId}`);
    const docs = data.documents || [];
    container.innerHTML = '';
    if (docs.length === 0) {
      container.innerHTML = '<p class="muted">No documents uploaded yet.</p>';
      return;
    }
    docs.forEach((doc) => {
      const row = document.createElement('div');
      row.className = 'task-row';
      row.innerHTML = `
        <div class="task-info" style="flex:1">
          <strong>${escHtml(doc.fileName)}</strong>
          <span class="badge badge-blue" style="font-size:0.75rem">${escHtml(doc.docCategory)}</span>
          <p class="muted" style="font-size:0.8rem">${new Date(doc.uploadedAt).toLocaleDateString()} — ${escHtml(doc.uploadedByName || '-')}</p>
        </div>
        <div class="toolbar-actions" style="gap:6px">
          <a href="/api/documents/${escHtml(customerId)}/${escHtml(doc.id)}/download" target="_blank" style="font-size:0.8rem;padding:4px 10px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);text-decoration:none">⬇️ Download</a>
          <button type="button" data-del-doc="${escHtml(doc.id)}" class="danger-btn" style="font-size:0.8rem;padding:4px 8px">🗑️</button>
        </div>
      `;
      row.querySelector('[data-del-doc]').addEventListener('click', async () => {
        if (!window.confirm('Delete this document?')) return;
        await api(`/api/documents/${customerId}/${doc.id}`, { method: 'DELETE' });
        await renderDocumentsList(customerId, container);
      });
      container.appendChild(row);
    });
  } catch (err) {
    container.innerHTML = `<p class="muted">Failed to load documents: ${escHtml(err.message)}</p>`;
  }
}

function openDocUploadModal(customerId, targetType) {
  state.docUploadTargetId = customerId;
  state.docUploadTargetType = targetType;
  els.docCategory.value = 'Pay Stubs';
  els.docFileInput.value = '';
  els.docUploadModal.showModal();
}

els.docUploadCancelBtn.addEventListener('click', () => els.docUploadModal.close());

els.docUploadSaveBtn.addEventListener('click', async () => {
  const file = els.docFileInput.files[0];
  if (!file) { alert('Please select a file to upload.'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('File must be smaller than 10MB.'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result.split(',')[1];
    try {
      await api(`/api/documents/${state.docUploadTargetId}/upload`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          docCategory: els.docCategory.value,
          data: base64Data
        })
      });
      els.docUploadModal.close();

      let container = null;
      if (state.docUploadTargetType === 'contact') {
        container = els.contactDetailContent ? els.contactDetailContent.querySelector('#contact-docs-list') : null;
      } else {
        container = els.acDetailContent ? els.acDetailContent.querySelector('#ac-docs-list') : null;
      }
      if (container) {
        await renderDocumentsList(state.docUploadTargetId, container);
      }
      alert('Document uploaded successfully!');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
});

// ─── Pipeline Report ──────────────────────────────────────────────────────────

async function renderPipelineReport() {
  try {
    const data = await api('/api/pipeline/monthly');
    const months = data.months || [];

    els.pipelineMonthTabs.innerHTML = '';
    els.pipelineReportContent.innerHTML = '';

    if (months.length === 0) {
      els.pipelineReportContent.innerHTML = '<p class="muted" style="padding:12px">No active customer data yet. Promote contacts to active customers to see pipeline data here.</p>';
      return;
    }

    if (!state.pipelineActiveMonth || !months.find((m) => m.month === state.pipelineActiveMonth)) {
      state.pipelineActiveMonth = months[0].month;
    }

    months.forEach((m) => {
      const tab = document.createElement('span');
      tab.className = `pipe-tab${m.month === state.pipelineActiveMonth ? ' active' : ''}`;
      tab.textContent = m.month;
      tab.addEventListener('click', () => {
        state.pipelineActiveMonth = m.month;
        renderPipelineMonthContent(months);
        els.pipelineMonthTabs.querySelectorAll('.pipe-tab').forEach((t) => t.classList.toggle('active', t.textContent === m.month));
      });
      els.pipelineMonthTabs.appendChild(tab);
    });

    renderPipelineMonthContent(months);
  } catch (err) {
    els.pipelineReportContent.innerHTML = `<p class="muted">Failed to load pipeline: ${escHtml(err.message)}</p>`;
  }
}

function renderPipelineMonthContent(months) {
  const monthData = months.find((m) => m.month === state.pipelineActiveMonth);
  if (!monthData) return;

  const ALL_STATUSES = [
    'Contact Status', 'App Submitted', 'Approved', 'Pending Conditions', 'Ready to Close',
    'Appraisal', 'Docs Ordered', 'Closed Pending Delivery', 'Delivered Pending Funding',
    'Funded', 'Trimout Pending', 'Trimmed Out Pending Addl Work', 'Completed', 'Closed'
  ];

  els.pipelineReportContent.innerHTML = '';

  const heading = document.createElement('h4');
  heading.style.margin = '16px 0 8px';
  heading.textContent = `${monthData.month} — ${monthData.total} Active Customer(s)`;
  els.pipelineReportContent.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'pipeline-report-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Status</th>
        <th>Count</th>
        <th>% of Total</th>
      </tr>
    </thead>
    <tbody>
      ${ALL_STATUSES.map((status) => {
        const count = monthData.statusCounts[status] || 0;
        const pct = monthData.total > 0 ? Math.round((count / monthData.total) * 100) : 0;
        return `<tr ${count > 0 ? 'class="pipeline-row-active"' : ''}>
          <td>${escHtml(status)}</td>
          <td><strong>${count}</strong></td>
          <td>
            <div class="pipeline-bar-wrap">
              <div class="pipeline-bar-fill" style="width:${pct}%"></div>
              <span>${pct}%</span>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  `;
  els.pipelineReportContent.appendChild(table);
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(els.loginForm);
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: String(fd.get('email') || ''), password: String(fd.get('password') || '') }) });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('crm_token', state.token);
    const loaders = [loadLeads(), loadTemplates(), loadTasks()];
    if (currentUserIsAdmin()) loaders.push(loadUsers());
    await Promise.all(loaders);
    nav('/');
  } catch (error) { alert(error.message); }
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(els.registerForm);
  try {
    const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: String(fd.get('email') || ''), password: String(fd.get('password') || ''), name: String(fd.get('name') || '') }) });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('crm_token', state.token);
    const loaders = [loadLeads(), loadTemplates(), loadTasks()];
    if (currentUserIsAdmin()) loaders.push(loadUsers());
    await Promise.all(loaders);
    nav('/');
  } catch (error) { alert(error.message); }
});

els.toggleRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); els.loginFormWrap.classList.add('hidden'); els.registerFormWrap.classList.remove('hidden'); els.registerForm.reset(); });
els.toggleLoginBtn.addEventListener('click', (e) => { e.preventDefault(); els.registerFormWrap.classList.add('hidden'); els.loginFormWrap.classList.remove('hidden'); els.loginForm.reset(); });

els.logoutBtn.addEventListener('click', () => {
  state.token = ''; state.user = null; state.leads = []; state.tasks = []; state.templates = [];
  state.contacts = []; state.activeCustomers = [];
  localStorage.removeItem('crm_token');
  nav('/');
});

els.newLeadBtn.addEventListener('click', () => openLeadModal());
els.exportBtn.addEventListener('click', downloadCsv);
els.leadCancelBtn.addEventListener('click', () => els.leadModal.close());
els.saveLeadBtn.addEventListener('click', submitLeadForm);

// Wire up response buttons and dynamic form sections once DOM is ready
setupResponseButtons();

els.tasksBtn.addEventListener('click', async () => {
  await loadTasks();
  renderTasksPanel();
  els.tasksPanel.classList.toggle('hidden');
  els.templatesPanel.classList.add('hidden');
});
els.tasksCloseBtn.addEventListener('click', () => els.tasksPanel.classList.add('hidden'));

els.templatesBtn.addEventListener('click', async () => {
  await loadTemplates();
  renderTemplatesPanel();
  els.templatesPanel.classList.toggle('hidden');
  els.tasksPanel.classList.add('hidden');
});
els.templatesCloseBtn.addEventListener('click', () => els.templatesPanel.classList.add('hidden'));
els.newTemplateBtn.addEventListener('click', () => openTemplateModal());

els.usersBtn.addEventListener('click', async () => {
  await loadUsers();
  renderUsersPanel();
  els.usersPanel.classList.toggle('hidden');
  els.tasksPanel.classList.add('hidden');
  els.templatesPanel.classList.add('hidden');
});
els.usersCloseBtn.addEventListener('click', () => els.usersPanel.classList.add('hidden'));
els.addUserBtn.addEventListener('click', () => openUserModal());

els.contactsBtn.addEventListener('click', async () => {
  await loadContacts();
  renderContactsPanel();
  els.contactsPanel.classList.toggle('hidden');
  els.tasksPanel.classList.add('hidden');
  els.templatesPanel.classList.add('hidden');
  els.usersPanel.classList.add('hidden');
  els.activeCustomersPanel.classList.add('hidden');
  els.pipelinePanel.classList.add('hidden');
});
els.contactsCloseBtn.addEventListener('click', () => els.contactsPanel.classList.add('hidden'));
els.newContactBtn.addEventListener('click', () => openContactModal());

els.contactsPipelineBar.querySelectorAll('.pipe-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    state.contactsFilter = tab.dataset.stage;
    renderContactsPanel();
  });
});

els.activeCustomersBtn.addEventListener('click', async () => {
  await loadActiveCustomers();
  renderActiveCustomersPanel();
  els.activeCustomersPanel.classList.toggle('hidden');
  els.tasksPanel.classList.add('hidden');
  els.templatesPanel.classList.add('hidden');
  els.usersPanel.classList.add('hidden');
  els.contactsPanel.classList.add('hidden');
  els.pipelinePanel.classList.add('hidden');
});
els.activeCustomersCloseBtn.addEventListener('click', () => els.activeCustomersPanel.classList.add('hidden'));

els.acStatusFilterBar.querySelectorAll('[data-ac-stage]').forEach((tab) => {
  tab.addEventListener('click', () => {
    state.acFilter = tab.dataset.acStage;
    renderActiveCustomersPanel();
  });
});

els.pipelineBtn.addEventListener('click', async () => {
  els.pipelinePanel.classList.toggle('hidden');
  els.tasksPanel.classList.add('hidden');
  els.templatesPanel.classList.add('hidden');
  els.usersPanel.classList.add('hidden');
  els.contactsPanel.classList.add('hidden');
  els.activeCustomersPanel.classList.add('hidden');
  if (!els.pipelinePanel.classList.contains('hidden')) {
    await loadActiveCustomers();
    await renderPipelineReport();
  }
});
els.pipelineCloseBtn.addEventListener('click', () => els.pipelinePanel.classList.add('hidden'));

els.listToggle.addEventListener('click', () => { state.view = 'list'; render(); });
els.boardToggle.addEventListener('click', () => { state.view = 'board'; render(); });

els.searchInput.addEventListener('input', (e) => { state.filters.search = e.target.value; render(); });
els.statusFilter.addEventListener('change', (e) => { state.filters.status = e.target.value; render(); });
els.sourceFilter.addEventListener('change', (e) => { state.filters.source = e.target.value; render(); });
els.responseFilter.addEventListener('change', (e) => { state.filters.response = e.target.value; render(); });

window.addEventListener('popstate', render);
window.addEventListener('click', () => {
  if (state.openStatusDropdown) {
    state.openStatusDropdown = null;
    render();
  }
});

(async function start() {
  if (state.token) { await initializeAuthedState(); return; }
  render();
})();
