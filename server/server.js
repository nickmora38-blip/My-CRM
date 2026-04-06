const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'emailTemplates.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Warn if running in production with default secret
if (NODE_ENV === 'production' && process.env.JWT_SECRET === undefined) {
  console.warn('⚠️  WARNING: Running in production with default JWT_SECRET. Set JWT_SECRET env var.');
}

const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const VALID_RESPONSE_STATUSES = ['answered', 'not_answered', 'left_vm', 'text'];
const VALID_LEAD_STATUSES = ['pending_info', 'completing_application', 'appointment_set', 'answered'];
const VALID_FINANCING = ['cash', 'finance', 'credit_repair'];
const VALID_MOVE_TIMELINES = ['90_days_or_less', '3_6_months', 'not_ready'];

// Recall campaign schedule:
// Phase 1 (days 1-5): 4 calls/day at 7am, 11am, 3pm, 7pm
// Phase 2 (days 6-11): 2 calls on alternate days (6, 8, 10)
// Phase 3 (days 12-15): 1 call every 3rd day (12, 15)
// Day 16: mark dead
const PHASE1_HOURS = [7, 11, 15, 19]; // 7am, 11am, 3pm, 7pm

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Default email templates ─────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl_welcome',
    name: 'Welcome / Initial Follow-Up',
    subject: 'Thank you for your interest, {{firstName}}!',
    body: `Hi {{firstName}},\n\nThank you for reaching out! We're excited to help you find your perfect manufactured home.\n\nHere's a quick summary of what we discussed:\n- Home Type: {{homeType}}\n- Route: {{route}}\n\nWe'll be in touch shortly to discuss the next steps.\n\nBest regards,\n{{agentName}}`,
    type: 'welcome'
  },
  {
    id: 'tmpl_followup',
    name: 'Follow-Up / Check-In',
    subject: 'Following up on your home inquiry, {{firstName}}',
    body: `Hi {{firstName}},\n\nI wanted to follow up and see if you have any questions about your home transport inquiry.\n\nAs a reminder, we're here to help with:\n- {{homeType}} transport\n- Route: {{route}}\n- Estimated value: {{estimatedValue}}\n\nPlease don't hesitate to reach out. I'm available to answer any questions.\n\nBest regards,\n{{agentName}}`,
    type: 'followup'
  },
  {
    id: 'tmpl_appointment',
    name: 'Appointment Confirmation',
    subject: 'Your appointment is confirmed, {{firstName}}!',
    body: `Hi {{firstName}},\n\nYour appointment has been confirmed!\n\n📅 Date: {{appointmentDate}}\n🕐 Time: {{appointmentTime}}\n\nPlease let us know if you need to reschedule. We look forward to speaking with you!\n\nBest regards,\n{{agentName}}`,
    type: 'appointment'
  },
  {
    id: 'tmpl_drip1',
    name: 'Drip Campaign - Month 1',
    subject: 'Still thinking about your home move, {{firstName}}?',
    body: `Hi {{firstName}},\n\nWe wanted to check in and see if your home transport plans have progressed.\n\nWe're still here to help whenever you're ready! Our team specializes in {{homeType}} transport and would love to assist you.\n\nGive us a call or reply to this email to reconnect.\n\nBest regards,\n{{agentName}}`,
    type: 'drip'
  }
];

// ─── File read/write helpers ──────────────────────────────────────────────────

function readJson(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readUsers() {
  const users = readJson(USERS_FILE, {});
  if (Object.keys(users).length === 0) {
    // Seed demo users
    const seeded = {
      'demo@crm.local': {
        id: 'user-1',
        email: 'demo@crm.local',
        name: 'Demo User',
        isAdmin: true,
        passwordHash: bcrypt.hashSync('demo123', 10)
      },
      'alex@crm.local': {
        id: 'user-2',
        email: 'alex@crm.local',
        name: 'Alex Morgan',
        isAdmin: false,
        passwordHash: bcrypt.hashSync('alex123', 10)
      }
    };
    writeJson(USERS_FILE, seeded);
    return seeded;
  }
  // Ensure legacy users get isAdmin flag
  let changed = false;
  Object.values(users).forEach((u) => {
    if (u.isAdmin === undefined) {
      u.isAdmin = u.id === 'user-1';
      changed = true;
    }
  });
  if (changed) writeJson(USERS_FILE, users);
  return users;
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function readLeads() {
  const raw = readJson(LEADS_FILE, null);
  // Migrate old {users:{}} format to flat leads array
  if (raw && raw.users && typeof raw.users === 'object' && !Array.isArray(raw)) {
    const leads = [];
    Object.entries(raw.users).forEach(([userId, userLeads]) => {
      if (Array.isArray(userLeads)) {
        userLeads.forEach((lead) => {
          leads.push({ ...lead, leadOwner: lead.leadOwner || userId });
        });
      }
    });
    writeJson(LEADS_FILE, leads);
    return leads;
  }
  return Array.isArray(raw) ? raw : [];
}

function writeLeads(leads) {
  writeJson(LEADS_FILE, leads);
}

function readTemplates() {
  const stored = readJson(TEMPLATES_FILE, null);
  if (!stored) {
    writeJson(TEMPLATES_FILE, DEFAULT_TEMPLATES);
    return DEFAULT_TEMPLATES;
  }
  return stored;
}

function writeTemplates(templates) {
  writeJson(TEMPLATES_FILE, templates);
}

function readTasks() {
  return readJson(TASKS_FILE, []);
}

function writeTasks(tasks) {
  writeJson(TASKS_FILE, tasks);
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  if (!userRecord || !userRecord.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.isAdmin = true;
  next();
}

// ─── Lead helpers ─────────────────────────────────────────────────────────────

function sanitizeLeadInput(input) {
  const value = Number(input.estimatedValue || 0);
  const normalizedStatus = PIPELINE_STAGES.includes(input.status) ? input.status : 'New';

  const financing = Array.isArray(input.financing)
    ? input.financing.filter((f) => VALID_FINANCING.includes(f))
    : [];

  return {
    firstName: (input.firstName || '').trim(),
    lastName: (input.lastName || '').trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim().toLowerCase(),
    homeType: (input.homeType || '').trim(),
    route: (input.route || '').trim(),
    transportDetails: (input.transportDetails || '').trim(),
    source: (input.source || '').trim() || 'Other',
    status: normalizedStatus,
    estimatedValue: Number.isFinite(value) ? value : 0,
    notes: (input.notes || '').trim(),
    moveDate: input.moveDate || '',
    // Advanced fields
    responseStatus: VALID_RESPONSE_STATUSES.includes(input.responseStatus) ? input.responseStatus : null,
    leadStatus: VALID_LEAD_STATUSES.includes(input.leadStatus) ? input.leadStatus : null,
    appointmentDate: input.appointmentDate || null,
    appointmentTime: input.appointmentTime || null,
    financing,
    hasLand: input.hasLand === true || input.hasLand === 'true',
    hasDownpayment: input.hasDownpayment === true || input.hasDownpayment === 'true',
    moveTimeline: VALID_MOVE_TIMELINES.includes(input.moveTimeline) ? input.moveTimeline : null,
    isLongTerm: input.isLongTerm === true || input.isLongTerm === 'true'
  };
}

function ensureLeadRequired(lead) {
  return Boolean(lead.firstName && lead.lastName);
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function findDuplicates(firstName, lastName, email, phone, excludeId) {
  const leads = readLeads();
  const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
  const normalizedPhone = (phone || '').replace(/\D/g, '');
  const normalizedEmail = (email || '').trim().toLowerCase();

  return leads.filter((lead) => {
    if (lead.id === excludeId) return false;
    const leadName = `${lead.firstName} ${lead.lastName}`.trim().toLowerCase();
    const leadPhone = (lead.phone || '').replace(/\D/g, '');
    const leadEmail = (lead.email || '').trim().toLowerCase();

    if (normalizedEmail && leadEmail && normalizedEmail === leadEmail) return true;
    if (normalizedPhone.length >= 7 && leadPhone.length >= 7 && normalizedPhone === leadPhone) return true;
    if (fullName && leadName && fullName === leadName) return true;
    return false;
  });
}

// ─── Recall campaign ─────────────────────────────────────────────────────────

function generateRecallTasks(leadId, leadOwner, startTime) {
  const tasks = [];
  const start = new Date(startTime);

  function nextWorkingHour(date, hour) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    if (d <= date) d.setDate(d.getDate() + 1);
    return d;
  }

  // Phase 1: Days 1-5, calls at 7am, 11am, 3pm, 7pm
  for (let day = 1; day <= 5; day++) {
    for (const hour of PHASE1_HOURS) {
      const d = new Date(start);
      d.setDate(d.getDate() + day);
      d.setHours(hour, 0, 0, 0);
      tasks.push({
        id: `task_${crypto.randomUUID()}`,
        leadId,
        leadOwner,
        type: 'recall_call',
        phase: 1,
        title: `Recall call (Phase 1, Day ${day})`,
        scheduledAt: d.toISOString(),
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString()
      });
    }
  }

  // Phase 2: Days 6, 8, 10 — 2 calls per day (9am, 2pm)
  for (const day of [6, 8, 10]) {
    for (const hour of [9, 14]) {
      const d = new Date(start);
      d.setDate(d.getDate() + day);
      d.setHours(hour, 0, 0, 0);
      tasks.push({
        id: `task_${crypto.randomUUID()}`,
        leadId,
        leadOwner,
        type: 'recall_call',
        phase: 2,
        title: `Recall call (Phase 2, Day ${day})`,
        scheduledAt: d.toISOString(),
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString()
      });
    }
  }

  // Phase 3: Days 12, 15 — 1 call per day
  for (const day of [12, 15]) {
    const d = new Date(start);
    d.setDate(d.getDate() + day);
    d.setHours(10, 0, 0, 0);
    tasks.push({
      id: `task_${crypto.randomUUID()}`,
      leadId,
      leadOwner,
      type: 'recall_call',
      phase: 3,
      title: `Recall call (Phase 3, Day ${day})`,
      scheduledAt: d.toISOString(),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    });
  }

  // Day 16: auto-mark dead task
  const deadDate = new Date(start);
  deadDate.setDate(deadDate.getDate() + 16);
  deadDate.setHours(8, 0, 0, 0);
  tasks.push({
    id: `task_${crypto.randomUUID()}`,
    leadId,
    leadOwner,
    type: 'mark_dead',
    phase: 4,
    title: 'Auto-mark lead as Dead + enroll in drip campaign',
    scheduledAt: deadDate.toISOString(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  });

  return tasks;
}

function generateMonthlyCallTask(leadId, leadOwner) {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setHours(10, 0, 0, 0);
  return {
    id: `task_${crypto.randomUUID()}`,
    leadId,
    leadOwner,
    type: 'monthly_call',
    phase: null,
    title: 'Monthly check-in call (Long-Term Lead)',
    scheduledAt: d.toISOString(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  };
}

// ─── Background scheduler ─────────────────────────────────────────────────────

function runScheduler() {
  const now = new Date();
  const tasks = readTasks();
  const leads = readLeads();
  let tasksChanged = false;
  let leadsChanged = false;

  tasks.forEach((task) => {
    if (task.completed) return;
    const scheduledAt = new Date(task.scheduledAt);
    if (scheduledAt > now) return;

    if (task.type === 'mark_dead') {
      const leadIdx = leads.findIndex((l) => l.id === task.leadId);
      if (leadIdx !== -1 && !leads[leadIdx].isDead) {
        leads[leadIdx].isDead = true;
        leads[leadIdx].recallCampaignActive = false;
        leads[leadIdx].updatedAt = now.toISOString();
        leadsChanged = true;
        // Enroll in drip — create a drip task for tomorrow
        const dripDate = new Date(now);
        dripDate.setDate(dripDate.getDate() + 1);
        dripDate.setHours(9, 0, 0, 0);
        tasks.push({
          id: `task_${crypto.randomUUID()}`,
          leadId: task.leadId,
          leadOwner: task.leadOwner,
          type: 'drip_email',
          phase: null,
          title: 'Drip email campaign — dead lead enrollment',
          scheduledAt: dripDate.toISOString(),
          completed: false,
          completedAt: null,
          createdAt: now.toISOString()
        });
        tasksChanged = true;
      }
      task.completed = true;
      task.completedAt = now.toISOString();
      tasksChanged = true;
    }
  });

  if (tasksChanged) writeTasks(tasks);
  if (leadsChanged) writeLeads(leads);
}

// Run scheduler every 60 seconds
setInterval(runScheduler, 60_000);

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const users = readUsers();
  const user = users[email];
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }, JWT_SECRET, {
    expiresIn: '12h'
  });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  const users = readUsers();
  if (users[email]) return res.status(409).json({ error: 'Email already registered' });

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  // First registered user beyond demo becomes admin if no other admin exists
  const hasAdmin = Object.values(users).some((u) => u.isAdmin);
  users[email] = {
    id: userId,
    email,
    name: (name || email.split('@')[0]).trim(),
    isAdmin: !hasAdmin,
    passwordHash
  };
  writeUsers(users);

  const token = jwt.sign({ sub: userId, email, name: users[email].name, isAdmin: users[email].isAdmin }, JWT_SECRET, {
    expiresIn: '12h'
  });
  return res.status(201).json({ token, user: { id: userId, email, name: users[email].name, isAdmin: users[email].isAdmin } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  res.json({ user: { ...req.user, isAdmin: userRecord ? userRecord.isAdmin : false } });
});

// ─── Leads routes ─────────────────────────────────────────────────────────────

app.use('/api/leads', authMiddleware);

// GET /api/leads — all users can see all leads
app.get('/api/leads', (req, res) => {
  const leads = readLeads();
  const { status, source, search, owner } = req.query;

  let filtered = leads;
  if (status) filtered = filtered.filter((l) => l.status === status);
  if (source) filtered = filtered.filter((l) => l.source === source);
  if (owner) filtered = filtered.filter((l) => l.leadOwner === owner);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((l) =>
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
      String(l.route || '').toLowerCase().includes(q) ||
      String(l.source || '').toLowerCase().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  res.json({ leads: filtered });
});

// GET /api/leads/:id — all authenticated users can view
app.get('/api/leads/:id', (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json({ lead });
});

// POST /api/leads/check-duplicate — check before creating
app.post('/api/leads/check-duplicate', (req, res) => {
  const { firstName, lastName, email, phone, excludeId } = req.body;
  const dups = findDuplicates(firstName || '', lastName || '', email || '', phone || '', excludeId || null);

  if (dups.length === 0) return res.json({ duplicates: [] });

  const users = readUsers();
  const enriched = dups.map((lead) => {
    const owner = Object.values(users).find((u) => u.id === lead.leadOwner);
    return {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      leadOwner: lead.leadOwner,
      leadOwnerName: owner ? owner.name : 'Unknown',
      createdAt: lead.createdAt
    };
  });

  return res.json({ duplicates: enriched });
});

// POST /api/leads — create lead (only owner can be creator)
app.post('/api/leads', (req, res) => {
  const leadInput = sanitizeLeadInput(req.body);
  if (!ensureLeadRequired(leadInput)) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  // Duplicate check (unless admin override was explicitly passed)
  if (!req.body.adminApproved) {
    const dups = findDuplicates(leadInput.firstName, leadInput.lastName, leadInput.email, leadInput.phone, null);
    if (dups.length > 0) {
      return res.status(409).json({
        error: 'Duplicate lead detected',
        duplicates: dups.map((d) => ({ id: d.id, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, leadOwner: d.leadOwner }))
      });
    }
  }

  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const now = new Date().toISOString();

  const lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...leadInput,
    leadOwner: req.user.sub,
    leadOwnerName: userRecord ? userRecord.name : req.user.name,
    recallCampaignActive: false,
    recallCampaignStarted: null,
    lastContactAttempt: null,
    contactAttempts: 0,
    emailsSent: [],
    isDead: false,
    duplicateMergeHistory: req.body.adminApproved
      ? [{ mergedAt: now, approvedBy: req.user.sub, note: 'Admin approved duplicate entry' }]
      : [],
    createdAt: now,
    updatedAt: now
  };

  const leads = readLeads();
  leads.unshift(lead);
  writeLeads(leads);

  // Auto-trigger recall campaign for non-answered response
  if (['not_answered', 'left_vm', 'text'].includes(lead.responseStatus)) {
    const campaignTasks = generateRecallTasks(lead.id, lead.leadOwner, now);
    const existingTasks = readTasks();
    writeTasks([...existingTasks, ...campaignTasks]);

    leads[0].recallCampaignActive = true;
    leads[0].recallCampaignStarted = now;
    writeLeads(leads);
  }

  // Trigger long-term automation if moveTimeline is 'not_ready'
  if (lead.moveTimeline === 'not_ready') {
    const callTask = generateMonthlyCallTask(lead.id, lead.leadOwner);
    const existingTasks = readTasks();
    writeTasks([...existingTasks, callTask]);

    leads[0].isLongTerm = true;
    writeLeads(leads);
  }

  res.status(201).json({ lead: leads[0] });
});

// PUT /api/leads/:id — only lead owner (or admin) can modify
app.put('/api/leads/:id', (req, res) => {
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

  const lead = leads[idx];
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = userRecord && userRecord.isAdmin;

  if (lead.leadOwner !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the lead owner can modify this lead' });
  }

  const patch = sanitizeLeadInput({ ...lead, ...req.body });
  if (!ensureLeadRequired(patch)) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  const now = new Date().toISOString();
  const previousResponseStatus = lead.responseStatus;
  const previousMoveTimeline = lead.moveTimeline;

  leads[idx] = {
    ...lead,
    ...patch,
    // immutable fields
    leadOwner: lead.leadOwner,
    leadOwnerName: lead.leadOwnerName,
    createdAt: lead.createdAt,
    duplicateMergeHistory: lead.duplicateMergeHistory || [],
    emailsSent: lead.emailsSent || [],
    updatedAt: now
  };

  // If responseStatus changed to a non-answered type, start recall campaign
  if (
    ['not_answered', 'left_vm', 'text'].includes(patch.responseStatus) &&
    patch.responseStatus !== previousResponseStatus &&
    !leads[idx].recallCampaignActive
  ) {
    const campaignTasks = generateRecallTasks(leads[idx].id, leads[idx].leadOwner, now);
    const existingTasks = readTasks();
    writeTasks([...existingTasks, ...campaignTasks]);
    leads[idx].recallCampaignActive = true;
    leads[idx].recallCampaignStarted = now;
  }

  // If responseStatus changed to 'answered', cancel recall campaign
  if (patch.responseStatus === 'answered' && previousResponseStatus !== 'answered') {
    leads[idx].recallCampaignActive = false;
    const tasks = readTasks();
    const updated = tasks.map((t) =>
      t.leadId === leads[idx].id && !t.completed && t.type === 'recall_call'
        ? { ...t, completed: true, completedAt: now, cancelledReason: 'Lead answered' }
        : t
    );
    writeTasks(updated);
  }

  // Long-term automation
  if (patch.moveTimeline === 'not_ready' && previousMoveTimeline !== 'not_ready') {
    const callTask = generateMonthlyCallTask(leads[idx].id, leads[idx].leadOwner);
    const existingTasks = readTasks();
    writeTasks([...existingTasks, callTask]);
    leads[idx].isLongTerm = true;
  }

  // Track contact attempt
  if (req.body.recordContactAttempt) {
    leads[idx].contactAttempts = (leads[idx].contactAttempts || 0) + 1;
    leads[idx].lastContactAttempt = now;
  }

  writeLeads(leads);
  res.json({ lead: leads[idx] });
});

// DELETE /api/leads/:id — only lead owner (or admin) can delete
app.delete('/api/leads/:id', (req, res) => {
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

  const lead = leads[idx];
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = userRecord && userRecord.isAdmin;

  if (lead.leadOwner !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the lead owner can delete this lead' });
  }

  leads.splice(idx, 1);
  writeLeads(leads);

  // Cancel pending tasks
  const tasks = readTasks();
  const updated = tasks.map((t) =>
    t.leadId === req.params.id && !t.completed
      ? { ...t, completed: true, completedAt: new Date().toISOString(), cancelledReason: 'Lead deleted' }
      : t
  );
  writeTasks(updated);

  res.json({ success: true });
});

// POST /api/leads/:id/send-email — record an email as sent (backend-ready)
app.post('/api/leads/:id/send-email', authMiddleware, (req, res) => {
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

  const { templateId, subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'subject and body are required' });

  const emailRecord = {
    id: `email_${crypto.randomUUID()}`,
    templateId: templateId || null,
    subject,
    body,
    sentAt: new Date().toISOString(),
    sentBy: req.user.sub
  };

  if (!Array.isArray(leads[idx].emailsSent)) leads[idx].emailsSent = [];
  leads[idx].emailsSent.push(emailRecord);
  leads[idx].updatedAt = new Date().toISOString();
  writeLeads(leads);

  res.json({ email: emailRecord, message: 'Email recorded (backend-ready; no external service integrated)' });
});

// ─── Email templates routes ───────────────────────────────────────────────────

app.use('/api/email-templates', authMiddleware);

app.get('/api/email-templates', (req, res) => {
  res.json({ templates: readTemplates() });
});

app.post('/api/email-templates', (req, res) => {
  const { name, subject, body, type } = req.body;
  if (!name || !subject || !body) return res.status(400).json({ error: 'name, subject, and body are required' });

  const templates = readTemplates();
  const tmpl = {
    id: `tmpl_${crypto.randomUUID()}`,
    name: name.trim(),
    subject: subject.trim(),
    body: body.trim(),
    type: type || 'custom',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  templates.push(tmpl);
  writeTemplates(templates);
  res.status(201).json({ template: tmpl });
});

app.put('/api/email-templates/:id', (req, res) => {
  const templates = readTemplates();
  const idx = templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });

  const { name, subject, body, type } = req.body;
  templates[idx] = {
    ...templates[idx],
    name: name !== undefined ? name.trim() : templates[idx].name,
    subject: subject !== undefined ? subject.trim() : templates[idx].subject,
    body: body !== undefined ? body.trim() : templates[idx].body,
    type: type !== undefined ? type : templates[idx].type,
    updatedAt: new Date().toISOString()
  };
  writeTemplates(templates);
  res.json({ template: templates[idx] });
});

app.delete('/api/email-templates/:id', (req, res) => {
  const templates = readTemplates();
  const idx = templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });
  templates.splice(idx, 1);
  writeTemplates(templates);
  res.json({ success: true });
});

// ─── Tasks routes ─────────────────────────────────────────────────────────────

app.use('/api/tasks', authMiddleware);

app.get('/api/tasks', (req, res) => {
  const tasks = readTasks();
  const leads = readLeads();
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = userRecord && userRecord.isAdmin;

  // Admins see all tasks; regular users see tasks for leads they own
  const ownedLeadIds = new Set(leads.filter((l) => l.leadOwner === req.user.sub).map((l) => l.id));
  const filtered = isAdmin ? tasks : tasks.filter((t) => ownedLeadIds.has(t.leadId));

  const { completed, leadId } = req.query;
  let result = filtered;
  if (completed !== undefined) result = result.filter((t) => t.completed === (completed === 'true'));
  if (leadId) result = result.filter((t) => t.leadId === leadId);

  res.json({ tasks: result.sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt))) });
});

app.put('/api/tasks/:id/complete', (req, res) => {
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  tasks[idx].completed = true;
  tasks[idx].completedAt = new Date().toISOString();
  writeTasks(tasks);
  res.json({ task: tasks[idx] });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

app.use('/api/admin', authMiddleware, adminMiddleware);

// GET /api/admin/users — list all users (for ownership transfer)
app.get('/api/admin/users', (req, res) => {
  const users = readUsers();
  const list = Object.values(users).map((u) => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin }));
  res.json({ users: list });
});

// POST /api/admin/approve-duplicate — admin approves/rejects duplicate lead entry
app.post('/api/admin/approve-duplicate', (req, res) => {
  const { approved, pendingLeadData, targetUserId, note } = req.body;
  if (approved === undefined) return res.status(400).json({ error: 'approved field is required' });

  if (!approved) return res.json({ success: true, message: 'Duplicate entry rejected by admin' });

  // Create the lead with admin approval marker
  const leadInput = sanitizeLeadInput(pendingLeadData || {});
  if (!ensureLeadRequired(leadInput)) {
    return res.status(400).json({ error: 'firstName and lastName are required in pendingLeadData' });
  }

  const users = readUsers();
  const ownerRecord = targetUserId
    ? Object.values(users).find((u) => u.id === targetUserId)
    : Object.values(users).find((u) => u.id === req.user.sub);

  const now = new Date().toISOString();
  const lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...leadInput,
    leadOwner: ownerRecord ? ownerRecord.id : req.user.sub,
    leadOwnerName: ownerRecord ? ownerRecord.name : req.user.name,
    recallCampaignActive: false,
    recallCampaignStarted: null,
    lastContactAttempt: null,
    contactAttempts: 0,
    emailsSent: [],
    isDead: false,
    duplicateMergeHistory: [{ mergedAt: now, approvedBy: req.user.sub, note: note || 'Admin approved duplicate entry' }],
    createdAt: now,
    updatedAt: now
  };

  const leads = readLeads();
  leads.unshift(lead);
  writeLeads(leads);

  // Create admin review task
  const tasks = readTasks();
  tasks.push({
    id: `task_${crypto.randomUUID()}`,
    leadId: lead.id,
    leadOwner: lead.leadOwner,
    type: 'admin_review',
    phase: null,
    title: `Admin: Review/merge duplicate lead — ${lead.firstName} ${lead.lastName}`,
    scheduledAt: now,
    completed: false,
    completedAt: null,
    createdAt: now
  });
  writeTasks(tasks);

  res.status(201).json({ lead, message: 'Duplicate lead approved and created' });
});

// PUT /api/admin/leads/:id/transfer — transfer lead ownership
app.put('/api/admin/leads/:id/transfer', (req, res) => {
  const { newOwnerId } = req.body;
  if (!newOwnerId) return res.status(400).json({ error: 'newOwnerId is required' });

  const users = readUsers();
  const newOwner = Object.values(users).find((u) => u.id === newOwnerId);
  if (!newOwner) return res.status(404).json({ error: 'New owner user not found' });

  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

  leads[idx].leadOwner = newOwner.id;
  leads[idx].leadOwnerName = newOwner.name;
  leads[idx].duplicateMergeHistory = [
    ...(leads[idx].duplicateMergeHistory || []),
    { mergedAt: new Date().toISOString(), transferredBy: req.user.sub, newOwner: newOwner.id, note: 'Lead transferred by admin' }
  ];
  leads[idx].updatedAt = new Date().toISOString();
  writeLeads(leads);

  res.json({ lead: leads[idx] });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Static + SPA fallback ────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

app.listen(PORT, () => {
  console.log(`✅ CRM server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${NODE_ENV}`);
  console.log(`🔐 Auth: JWT (${JWT_SECRET === 'dev-only-secret-change-in-production' ? 'default secret' : 'custom secret'})`);
  console.log(`💾 Data: ${LEADS_FILE}`);
});
