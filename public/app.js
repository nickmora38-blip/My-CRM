const PIPELINE = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

const state = {
  token: localStorage.getItem('crm_token') || '',
  user: null,
  leads: [],
  view: 'list',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  filters: { search: '', status: '', source: '' },
  editingLeadId: null,
  openStatusDropdown: null
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
  searchInput: document.getElementById('search-input'),
  exportBtn: document.getElementById('export-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  newLeadBtn: document.getElementById('new-lead-btn'),
  leadModal: document.getElementById('lead-modal'),
  leadForm: document.getElementById('lead-form'),
  leadModalTitle: document.getElementById('lead-modal-title')
};

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(value || 0)
  );
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
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

function filteredLeads() {
  const search = state.filters.search.toLowerCase();
  let rows = state.leads.filter((lead) => {
    const contact = `${lead.firstName} ${lead.lastName}`.toLowerCase();
    const route = String(lead.route || '').toLowerCase();
    const source = String(lead.source || '').toLowerCase();
    const statusOk = !state.filters.status || lead.status === state.filters.status;
    const sourceOk = !state.filters.source || lead.source === state.filters.source;
    const searchOk = !search || contact.includes(search) || route.includes(search) || source.includes(search);
    return statusOk && sourceOk && searchOk;
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

function renderTable(rows) {
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th class="sortable" data-sort="contact">Contact${sortIndicator('contact')}</th>
        <th>Home Type</th>
        <th>Route</th>
        <th class="sortable" data-sort="status">Status${sortIndicator('status')}</th>
        <th class="sortable" data-sort="value">Value${sortIndicator('value')}</th>
        <th class="sortable" data-sort="source">Source${sortIndicator('source')}</th>
        <th>Move Date</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  rows.forEach((lead) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" data-open="${lead.id}">${lead.firstName} ${lead.lastName}</a></td>
      <td>${lead.homeType || '-'}</td>
      <td>${lead.route || '-'}</td>
      <td class="status-cell"></td>
      <td>${currency(lead.estimatedValue)}</td>
      <td>${lead.source || '-'}</td>
      <td>${lead.moveDate || '-'}</td>
    `;

    const statusCell = tr.querySelector('.status-cell');
    const statusWrap = document.createElement('div');
    statusWrap.className = 'status-wrap';
    const chip = document.createElement('button');
    chip.className = 'status-chip';
    chip.type = 'button';
    chip.textContent = lead.status;
    chip.addEventListener('click', (event) => {
      event.stopPropagation();
      state.openStatusDropdown = state.openStatusDropdown === lead.id ? null : lead.id;
      render();
    });
    statusWrap.appendChild(chip);

    if (state.openStatusDropdown === lead.id) {
      statusWrap.appendChild(createStatusPicker(lead.id));
    }

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

function renderBoard(rows) {
  els.boardWrap.innerHTML = '';
  PIPELINE.forEach((stage) => {
    const col = document.createElement('section');
    col.className = 'board-column';
    const leads = rows.filter((lead) => lead.status === stage);

    col.innerHTML = `<h4>${stage} (${leads.length})</h4>`;

    leads.forEach((lead) => {
      const card = document.createElement('article');
      card.className = 'lead-card';
      card.innerHTML = `
        <strong>${lead.firstName} ${lead.lastName}</strong>
        <p>${lead.homeType || 'Home type not set'}</p>
        <p>${lead.route || 'No route yet'}</p>
        <p>${currency(lead.estimatedValue)}</p>
        <p>Source: ${lead.source || '-'}</p>
      `;
      card.addEventListener('click', () => nav(`/leads/${lead.id}`));
      col.appendChild(card);
    });

    els.boardWrap.appendChild(col);
  });
}

function detailCard(title, body) {
  return `<article class="card"><h4>${title}</h4><div>${body}</div></article>`;
}

function renderLeadDetail(lead) {
  const pipelineButtons = PIPELINE.filter((s) => s !== 'Lost')
    .map((stage) => `<button type="button" data-stage="${stage}" class="${lead.status === stage ? 'active' : ''}">${stage}</button>`)
    .join('');

  els.detailView.innerHTML = `
    <div class="toolbar">
      <div>
        <h2>${lead.firstName} ${lead.lastName}</h2>
        <p class="muted">${lead.homeType || 'Lead profile'}</p>
      </div>
      <div class="toolbar-actions">
        <button id="back-btn">Back</button>
        <button id="edit-btn">Edit</button>
        <button id="delete-btn" style="border-color: #e8b9b2; color: #a63427;">Delete</button>
      </div>
    </div>

    <div class="pipeline">
      ${pipelineButtons}
      <button type="button" data-stage="Lost">Mark Lost</button>
    </div>

    <div class="detail-grid">
      ${detailCard(
        'Pipeline Stage',
        `<p><strong>${lead.status}</strong></p><p class="muted">Updated: ${new Date(lead.updatedAt).toLocaleString()}</p>`
      )}
      ${detailCard(
        'Transport Details',
        `<p><strong>Route:</strong> ${lead.route || '-'}</p><p><strong>Move Date:</strong> ${lead.moveDate || '-'}</p><p>${lead.transportDetails || 'No transport details provided.'}</p>`
      )}
      ${detailCard(
        'Contact Info',
        `<p><strong>Phone:</strong> ${lead.phone || '-'}</p><p><strong>Email:</strong> ${lead.email || '-'}</p><p><strong>Source:</strong> ${lead.source || '-'}</p>`
      )}
      ${detailCard(
        'Notes',
        `<p>${(lead.notes || 'No notes yet.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><p><strong>Value:</strong> ${currency(
          lead.estimatedValue
        )}</p>`
      )}
    </div>
  `;

  els.detailView.querySelector('#back-btn').addEventListener('click', () => nav('/'));
  els.detailView.querySelector('#edit-btn').addEventListener('click', () => openLeadModal(lead));
  els.detailView.querySelector('#delete-btn').addEventListener('click', async () => {
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    await api(`/api/leads/${lead.id}`, { method: 'DELETE' });
    await loadLeads();
    nav('/');
  });

  els.detailView.querySelectorAll('button[data-stage]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const stage = btn.getAttribute('data-stage');
      await updateLead(lead.id, { status: stage });
      const updated = state.leads.find((item) => item.id === lead.id);
      if (updated) {
        renderLeadDetail(updated);
      }
    });
  });
}

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

  if (!lead) {
    nav('/');
    return;
  }

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
  els.userLine.textContent = state.user ? `${state.user.name} (${state.user.email})` : '';

  if (isDetailRoute()) {
    renderDetailPage();
  } else {
    renderListPage();
  }
}

async function loadLeads() {
  const data = await api('/api/leads');
  state.leads = data.leads || [];
}

async function updateLead(id, patch) {
  const response = await api(`/api/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  });

  const idx = state.leads.findIndex((item) => item.id === id);
  if (idx > -1) {
    state.leads[idx] = response.lead;
  }
}

function toCsv(rows) {
  const headers = [
    'First Name',
    'Last Name',
    'Status',
    'Home Type',
    'Route',
    'Estimated Value',
    'Source',
    'Move Date',
    'Phone',
    'Email',
    'Transport Details',
    'Notes'
  ];

  const esc = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    [
      row.firstName,
      row.lastName,
      row.status,
      row.homeType,
      row.route,
      row.estimatedValue,
      row.source,
      row.moveDate,
      row.phone,
      row.email,
      row.transportDetails,
      row.notes
    ]
      .map(esc)
      .join(',')
  );

  return `${headers.join(',')}\n${lines.join('\n')}`;
}

function downloadCsv() {
  const rows = filteredLeads();
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formDataToLead(form) {
  const fd = new FormData(form);
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
    notes: String(fd.get('notes') || '')
  };
}

function openLeadModal(lead = null) {
  state.editingLeadId = lead ? lead.id : null;
  els.leadModalTitle.textContent = lead ? 'Edit Lead' : 'New Lead';

  els.leadForm.reset();

  if (lead) {
    const fields = [
      'firstName',
      'lastName',
      'phone',
      'email',
      'homeType',
      'route',
      'estimatedValue',
      'source',
      'status',
      'moveDate',
      'transportDetails',
      'notes'
    ];

    fields.forEach((field) => {
      const input = els.leadForm.elements[field];
      if (input) {
        input.value = lead[field] || '';
      }
    });
  }

  els.leadModal.showModal();
}

async function submitLeadForm(event) {
  event.preventDefault();
  const payload = formDataToLead(els.leadForm);

  if (state.editingLeadId) {
    await updateLead(state.editingLeadId, payload);
  } else {
    const response = await api('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
    state.leads.unshift(response.lead);
  }

  els.leadModal.close();
  render();
}

async function initializeAuthedState() {
  try {
    const me = await api('/api/auth/me');
    state.user = me.user;
    await loadLeads();
    render();
  } catch (error) {
    state.token = '';
    state.user = null;
    localStorage.removeItem('crm_token');
    render();
  }
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(els.loginForm);
  const email = String(fd.get('email') || '');
  const password = String(fd.get('password') || '');

  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('crm_token', state.token);
    await loadLeads();
    nav('/');
  } catch (error) {
    alert(error.message);
  }
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(els.registerForm);
  const email = String(fd.get('email') || '');
  const password = String(fd.get('password') || '');
  const name = String(fd.get('name') || '');

  try {
    const result = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('crm_token', state.token);
    await loadLeads();
    nav('/');
  } catch (error) {
    alert(error.message);
  }
});

els.toggleRegisterBtn.addEventListener('click', (event) => {
  event.preventDefault();
  els.loginFormWrap.classList.add('hidden');
  els.registerFormWrap.classList.remove('hidden');
  els.registerForm.reset();
});

els.toggleLoginBtn.addEventListener('click', (event) => {
  event.preventDefault();
  els.registerFormWrap.classList.add('hidden');
  els.loginFormWrap.classList.remove('hidden');
  els.loginForm.reset();
});

els.logoutBtn.addEventListener('click', () => {
  state.token = '';
  state.user = null;
  state.leads = [];
  localStorage.removeItem('crm_token');
  nav('/');
});

els.newLeadBtn.addEventListener('click', () => openLeadModal());
els.exportBtn.addEventListener('click', downloadCsv);
els.leadForm.addEventListener('submit', submitLeadForm);

els.listToggle.addEventListener('click', () => {
  state.view = 'list';
  render();
});

els.boardToggle.addEventListener('click', () => {
  state.view = 'board';
  render();
});

els.searchInput.addEventListener('input', (event) => {
  state.filters.search = event.target.value;
  render();
});

els.statusFilter.addEventListener('change', (event) => {
  state.filters.status = event.target.value;
  render();
});

els.sourceFilter.addEventListener('change', (event) => {
  state.filters.source = event.target.value;
  render();
});

window.addEventListener('popstate', render);
window.addEventListener('click', () => {
  if (state.openStatusDropdown) {
    state.openStatusDropdown = null;
    render();
  }
});

(async function start() {
  if (state.token) {
    await initializeAuthedState();
    return;
  }
  render();
})();
