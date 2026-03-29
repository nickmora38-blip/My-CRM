/**
 * tasks.js — Automated call task scheduling (every 4h, 8am–7pm, Mon–Sat)
 * Uses setInterval for the task-checker loop
 */

const TASKS_KEY  = 'crm_tasks';
const CHECK_INTERVAL_MS = 60 * 1000; // check every 60 seconds

// ── Data helpers ─────────────────────────────────────────────────────────────

function getTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
  catch { return []; }
}

function saveAllTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function saveTask(task) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) tasks[idx] = task; else tasks.push(task);
  saveAllTasks(tasks);
  return task;
}

function getTaskById(id) {
  return getTasks().find(t => t.id === id) || null;
}

function getTasksForLead(leadId) {
  return getTasks().filter(t => t.leadId === leadId);
}

function removeTasksForLead(leadId) {
  const remaining = getTasks().filter(t => t.leadId !== leadId);
  saveAllTasks(remaining);
}

// ── Schedule helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the given Date falls in the call window:
 * Monday–Saturday, 8:00am–7:00pm (19:00)
 */
function isInCallWindow(date) {
  const d = date || new Date();
  const day = d.getDay(); // 0=Sun,1=Mon...6=Sat
  const hour = d.getHours();
  return day >= 1 && day <= 6 && hour >= 8 && hour < 19;
}

/**
 * Given a Date, compute the NEXT call slot (every `freqHours` hours, 8am–7pm, Mon–Sat)
 * Returns a Date object (future).
 */
function nextCallSlot(fromDate, freqHours) {
  freqHours = freqHours || 4;
  let d = new Date(fromDate.getTime());
  // Round up to the next hour boundary aligned to freqHours starting at 8am
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1); // at least 1 hour in the future

  let attempts = 0;
  while (attempts < 200) {
    const day  = d.getDay();
    const hour = d.getHours();

    // Skip Sunday (0)
    if (day === 0) { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); attempts++; continue; }

    // Before window — jump to 8am
    if (hour < 8)  { d.setHours(8, 0, 0, 0); }
    // After window (>= 19) — jump to next day 8am
    else if (hour >= 19) { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
    else {
      // Find next aligned slot: 8, 8+freq, 8+2*freq, ...
      const slotHour = 8 + Math.ceil((hour - 8) / freqHours) * freqHours;
      if (slotHour < 19) {
        d.setHours(slotHour, 0, 0, 0);
        return d;
      } else {
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
      }
    }
    attempts++;
  }
  return d;
}

// ── Create scheduled call tasks for a lead ───────────────────────────────────

/**
 * When a lead is saved with responseStatus "no_answer" or "text",
 * schedule the next call task.  Only one pending task per lead at a time.
 */
function scheduleCallTask(lead) {
  if (!['no_answer','text'].includes(lead.responseStatus)) return;
  // Stop scheduling if lead status makes it inactive
  if (['answered','active'].includes(lead.leadStatus) && lead.responseStatus === 'answered') return;

  // Remove any existing pending tasks for this lead
  const existing = getTasksForLead(lead.id).filter(t => t.status === 'pending');
  if (existing.length > 0) return; // already scheduled

  const freq = lead.callFrequencyHours || 4;
  const scheduledAt = nextCallSlot(new Date(), freq).toISOString();

  const task = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    leadId: lead.id,
    leadName: lead.name,
    type: 'call',
    status: 'pending',
    scheduledAt,
    assignedTo: lead.assignedTo || '',
    notes: `Auto-scheduled call — ${RESPONSE_STATUS[lead.responseStatus]?.label || lead.responseStatus}`,
    freqHours: freq,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  saveTask(task);
  logActivity(lead.id, 'task', `Call task scheduled for ${formatDatetime(scheduledAt)}`);
  return task;
}

/**
 * Cancel all pending call tasks for a lead (called when lead becomes Answered/Active)
 */
function cancelCallTasksForLead(leadId) {
  const tasks = getTasks().map(t => {
    if (t.leadId === leadId && t.status === 'pending') {
      return { ...t, status: 'cancelled', completedAt: new Date().toISOString() };
    }
    return t;
  });
  saveAllTasks(tasks);
}

/**
 * Complete a task and, if the lead still needs follow-up, schedule the next one.
 */
function completeTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  const updated = { ...task, status: 'completed', completedAt: new Date().toISOString() };
  saveTask(updated);
  logActivity(task.leadId, 'task', `Call task completed`);

  // Schedule next if lead still needs it
  const lead = getLeadById(task.leadId);
  if (lead && ['no_answer','text'].includes(lead.responseStatus)
      && !['answered'].includes(lead.responseStatus)) {
    scheduleNextAfterCompletion(lead, task.freqHours || 4);
  }
  updateTaskBadge();
}

function scheduleNextAfterCompletion(lead, freqHours) {
  const scheduledAt = nextCallSlot(new Date(), freqHours).toISOString();
  const task = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    leadId: lead.id,
    leadName: lead.name,
    type: 'call',
    status: 'pending',
    scheduledAt,
    assignedTo: lead.assignedTo || '',
    notes: `Auto-scheduled follow-up call`,
    freqHours,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  saveTask(task);
  logActivity(lead.id, 'task', `Next call task scheduled for ${formatDatetime(scheduledAt)}`);
}

// ── Get next call time for a lead (for table display) ────────────────────────

function getNextCallTime(leadId) {
  const pending = getTasks().filter(t => t.leadId === leadId && t.status === 'pending');
  if (pending.length === 0) return null;
  pending.sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return pending[0].scheduledAt;
}

// ── Task checker loop ────────────────────────────────────────────────────────

let _taskCheckerInterval = null;

function startTaskChecker() {
  if (_taskCheckerInterval) return;
  _taskCheckerInterval = setInterval(runTaskChecker, CHECK_INTERVAL_MS);
  // Run immediately on start
  runTaskChecker();
}

function runTaskChecker() {
  const now = new Date();
  const tasks = getTasks();
  let changed = false;

  tasks.forEach(task => {
    if (task.status !== 'pending') return;
    const due = new Date(task.scheduledAt);
    if (due <= now) {
      // Task is due — fire notification
      showNotification(
        'warning',
        '📞 Call Reminder',
        `Time to call ${escHtml(task.leadName || 'lead')}${task.assignedTo ? ' — assigned to ' + task.assignedTo : ''}`,
        6000
      );
      logActivity(task.leadId, 'task', `Call reminder triggered for ${task.leadName}`);

      // Mark as notified (convert to a "notified" sub-state so we don't re-notify)
      task.notified = true;
      changed = true;
    }
  });

  if (changed) {
    saveAllTasks(tasks);
    updateTaskBadge();
  }
}

// ── Pending task count / badge ───────────────────────────────────────────────

function getPendingTaskCount() {
  return getTasks().filter(t => t.status === 'pending').length;
}

function updateTaskBadge() {
  const count = getPendingTaskCount();
  document.querySelectorAll('.tasks-badge').forEach(el => {
    if (count > 0) {
      el.textContent = count;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// ── Render Tasks ─────────────────────────────────────────────────────────────

function renderTasksView(filter, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let tasks = getTasks();
  if (filter === 'pending')   tasks = tasks.filter(t => t.status === 'pending');
  if (filter === 'completed') tasks = tasks.filter(t => t.status === 'completed');
  if (filter === 'overdue')   tasks = tasks.filter(t => t.status === 'pending' && new Date(t.scheduledAt) < new Date());

  tasks.sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>No tasks</h3><p>No call tasks in this view.</p></div>`;
    return;
  }

  const now = new Date();
  container.innerHTML = tasks.map(task => {
    const due = new Date(task.scheduledAt);
    const isOverdue = task.status === 'pending' && due < now;
    const isCompleted = task.status === 'completed';
    const cls = isCompleted ? 'completed' : isOverdue ? 'overdue' : 'upcoming';
    const lead = getLeadById(task.leadId);

    return `<div class="task-card ${cls}" id="task-card-${task.id}">
      <div class="task-checkbox ${isCompleted ? 'checked' : ''}" onclick="${isCompleted ? '' : `completeTask('${task.id}')`}" title="${isCompleted ? 'Completed' : 'Mark complete'}">
        ${isCompleted ? '✓' : ''}
      </div>
      <div class="task-info">
        <div class="task-name">📞 Call ${escHtml(task.leadName || 'Lead')}</div>
        <div class="task-meta">
          ${escHtml(task.notes || '')}
          ${lead ? ` · ${responseStatusBadge(lead.responseStatus)}` : ''}
          ${task.assignedTo ? ` · <span class="text-muted">👤 ${escHtml(task.assignedTo)}</span>` : ''}
        </div>
      </div>
      <div class="task-time">
        ${isOverdue ? '<span class="text-danger">⚠️ Overdue</span><br>' : ''}
        ${formatDatetime(task.scheduledAt)}
        ${task.status === 'cancelled' ? '<br><span class="text-muted text-xs">Cancelled</span>' : ''}
      </div>
      ${!isCompleted && task.status !== 'cancelled' ? `
        <div class="flex gap-1">
          <button class="btn btn-success btn-sm" onclick="completeTask('${task.id}')">Done</button>
          <button class="btn btn-outline btn-sm" onclick="openLeadModal('${task.leadId}')">Lead</button>
        </div>` : ''}
    </div>`;
  }).join('');
}

// Expose to global
window.getTasks = getTasks;
window.saveTask = saveTask;
window.getTaskById = getTaskById;
window.getTasksForLead = getTasksForLead;
window.removeTasksForLead = removeTasksForLead;
window.scheduleCallTask = scheduleCallTask;
window.cancelCallTasksForLead = cancelCallTasksForLead;
window.completeTask = completeTask;
window.getNextCallTime = getNextCallTime;
window.startTaskChecker = startTaskChecker;
window.runTaskChecker = runTaskChecker;
window.getPendingTaskCount = getPendingTaskCount;
window.updateTaskBadge = updateTaskBadge;
window.renderTasksView = renderTasksView;
window.isInCallWindow = isInCallWindow;
window.nextCallSlot = nextCallSlot;
