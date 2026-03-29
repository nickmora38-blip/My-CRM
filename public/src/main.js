// main.js — CRM application entry point
import UIRenderer from './UIRenderer.js';

// ── State ──────────────────────────────────────────────────────────────────

const STATE_KEY = 'crm_state';

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : { leads: [], conditions: [], logistics: [] };
  } catch {
    return { leads: [], conditions: [], logistics: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

let state = loadState();

// ── Navigation ─────────────────────────────────────────────────────────────

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      switchView(link.dataset.view);
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${viewName}-view`)?.classList.add('active');

  const renderers = {
    dashboard:  renderDashboard,
    leads:      renderLeads,
    conditions: renderConditions,
    pipeline:   renderPipeline,
    logistics:  renderLogistics,
  };
  renderers[viewName]?.();
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function renderDashboard() {
  document.getElementById('total-leads').textContent        = state.leads.length;
  document.getElementById('in-progress-count').textContent  = state.leads.filter(l => l.stage !== 'dead').length;
  document.getElementById('completed-count').textContent    = state.leads.filter(l => l.stage === 'dead').length;
  document.getElementById('site-jobs-count').textContent    = state.logistics.length;

  const recentList = document.getElementById('recent-leads-list');
  const recent = [...state.leads].reverse().slice(0, 5);
  recentList.innerHTML = recent.length
    ? recent.map(l => UIRenderer.renderRecentLead(l)).join('')
    : '<p style="color:#555;font-size:0.9rem">No leads yet.</p>';
}

// ── Leads ──────────────────────────────────────────────────────────────────

function renderLeads() {
  const container = document.getElementById('leads-container');
  container.innerHTML = state.leads.length
    ? state.leads.map(l => UIRenderer.renderLeadCard(l)).join('')
    : '<p style="color:#555;padding:1rem">No leads found. Click "+ Add Lead" to get started.</p>';
}

function setupLeadModal() {
  const modal   = document.getElementById('lead-modal');
  const form    = document.getElementById('lead-form');
  const openBtn = document.getElementById('add-lead-btn');
  const closeEl = modal.querySelector('.close');

  const closeModal = () => { modal.classList.remove('active'); form.reset(); };

  openBtn.addEventListener('click', () => modal.classList.add('active'));
  closeEl.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const lead = {
      id:        Date.now().toString(),
      name:      document.getElementById('lead-name').value.trim(),
      email:     document.getElementById('lead-email').value.trim(),
      phone:     document.getElementById('lead-phone').value.trim(),
      company:   document.getElementById('lead-company').value.trim(),
      stage:     document.getElementById('lead-stage').value,
      notes:     document.getElementById('lead-notes').value.trim(),
      createdAt: new Date().toISOString(),
    };
    state.leads.push(lead);
    saveState(state);
    closeModal();
    renderLeads();
    renderDashboard();
  });
}

// ── Conditions ─────────────────────────────────────────────────────────────

function renderConditions() {
  const container = document.getElementById('conditions-list');
  container.innerHTML = state.conditions.length
    ? state.conditions.map(c => UIRenderer.renderConditionCard(c)).join('')
    : '<p style="color:#555;padding:1rem">No conditions recorded. Click "+ Add Conditions" to get started.</p>';
}

function setupConditionModal() {
  const modal   = document.getElementById('condition-modal');
  const form    = document.getElementById('condition-form');
  const openBtn = document.getElementById('add-condition-btn');
  const closeEl = modal.querySelector('.close');

  const closeModal = () => { modal.classList.remove('active'); form.reset(); };

  openBtn.addEventListener('click', () => modal.classList.add('active'));
  closeEl.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', e => {
    e.preventDefault();

    // Helper: read a radio group by name; defaults to 'na' if nothing checked
    const radio = name => {
      const el = form.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : 'na';
    };

    const condition = {
      id:              Date.now().toString(),
      leadName:        document.getElementById('condition-lead').value.trim(),
      // 9 Yes/No/N/A radio fields
      deposit:         radio('deposit'),
      cv:              radio('cv'),
      paystub:         radio('paystub'),
      w2:              radio('w2'),
      taxes:           radio('taxes'),
      landDeed:        radio('land-deed'),
      landLocation:    radio('land-location'),
      siteInspection:  radio('site-inspection'),
      deliveryRequest: radio('delivery-request'),
      // 3 text/date fields (converted from radio buttons)
      estimatedGross:  document.getElementById('estimated-gross').value.trim(),
      offlineDate:     document.getElementById('offline-date').value,
      cocs:            document.getElementById('cocs').value.trim(),
      // extra
      notes:           document.getElementById('condition-notes').value.trim(),
      createdAt:       new Date().toISOString(),
    };

    state.conditions.push(condition);
    saveState(state);
    closeModal();
    renderConditions();
  });
}

// ── Pipeline ───────────────────────────────────────────────────────────────

function renderPipeline() {
  const container = document.getElementById('pipeline-container');
  const stages = [
    { id: 'lead',      label: 'Lead'      },
    { id: 'contact',   label: 'Contact'   },
    { id: 'submitted', label: 'Submitted' },
    { id: 'long-term', label: 'Long Term' },
    { id: 'dead',      label: 'Dead'      },
  ];
  container.innerHTML = stages
    .map(s => UIRenderer.renderPipelineColumn(s.id, s.label, state.leads.filter(l => l.stage === s.id)))
    .join('');
}

// ── Logistics ──────────────────────────────────────────────────────────────

function renderLogistics() {
  const container = document.getElementById('logistics-list');
  container.innerHTML = state.logistics.length
    ? state.logistics.map(j => UIRenderer.renderLogisticsCard(j)).join('')
    : '<p style="color:#555;padding:1rem">No jobs recorded. Click "+ Add Job" to get started.</p>';
}

function setupLogisticsModal() {
  const modal   = document.getElementById('logistics-modal');
  const form    = document.getElementById('logistics-form');
  const openBtn = document.getElementById('add-logistics-btn');
  const closeEl = modal.querySelector('.close');

  const closeModal = () => { modal.classList.remove('active'); form.reset(); };

  openBtn.addEventListener('click', () => modal.classList.add('active'));
  closeEl.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const job = {
      id:           Date.now().toString(),
      jobId:        document.getElementById('logistics-job-id').value.trim(),
      siteLocation: document.getElementById('logistics-site-location').value.trim(),
      workType:     document.getElementById('logistics-work-type').value.trim(),
      status:       document.getElementById('logistics-status').value,
      startDate:    document.getElementById('logistics-start-date').value,
      endDate:      document.getElementById('logistics-end-date').value,
      notes:        document.getElementById('logistics-notes').value.trim(),
      createdAt:    new Date().toISOString(),
    };
    state.logistics.push(job);
    saveState(state);
    closeModal();
    renderLogistics();
    renderDashboard();
  });
}

// ── Global delete handlers (called from rendered onclick attributes) ────────

window.deleteLead = id => {
  if (!confirm('Delete this lead?')) return;
  state.leads = state.leads.filter(l => l.id !== id);
  saveState(state);
  renderLeads();
  renderDashboard();
};

window.deleteCondition = id => {
  if (!confirm('Delete this condition entry?')) return;
  state.conditions = state.conditions.filter(c => c.id !== id);
  saveState(state);
  renderConditions();
};

window.deleteLogisticsJob = id => {
  if (!confirm('Delete this job?')) return;
  state.logistics = state.logistics.filter(j => j.id !== id);
  saveState(state);
  renderLogistics();
  renderDashboard();
};

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupLeadModal();
  setupConditionModal();
  setupLogisticsModal();
  renderDashboard();
});
