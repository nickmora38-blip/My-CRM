const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';
const DATA_FILE = path.join(__dirname, 'data', 'leads.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Warn if running in production with default secret
if (NODE_ENV === 'production' && process.env.JWT_SECRET === undefined) {
  console.warn('⚠️  WARNING: Running in production with default JWT_SECRET. Set JWT_SECRET env var.');
}

const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEMO_USERS = [
  { id: 'user-1', email: 'demo@crm.local', password: 'demo123', name: 'Demo User' },
  { id: 'user-2', email: 'alex@crm.local', password: 'alex123', name: 'Alex Morgan' }
];

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // Initialize with demo users (hashed)
    const users = {};
    DEMO_USERS.forEach((user) => {
      users[user.email] = {
        id: user.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        passwordHash: bcrypt.hashSync(user.password, 10)
      };
    });
    writeUsers(users);
    return users;
  }

  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw) || {};
  } catch (error) {
    return {};
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Failed to write users file:', error);
    throw error;
  }
}

function readStore() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: {} };
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users || typeof parsed.users !== 'object') {
      return { users: {} };
    }
    return parsed;
  } catch (error) {
    return { users: {} };
  }
}

function writeStore(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('Failed to write to data store:', error);
    throw error;
  }
}

function sanitizeLead(input) {
  const value = Number(input.estimatedValue || 0);
  const normalizedStatus = PIPELINE_STAGES.includes(input.status) ? input.status : 'New';

  return {
    firstName: (input.firstName || '').trim(),
    lastName: (input.lastName || '').trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim(),
    homeType: (input.homeType || '').trim(),
    route: (input.route || '').trim(),
    transportDetails: (input.transportDetails || '').trim(),
    source: (input.source || '').trim() || 'Other',
    status: normalizedStatus,
    estimatedValue: Number.isFinite(value) ? value : 0,
    notes: (input.notes || '').trim(),
    moveDate: input.moveDate || ''
  };
}

function ensureLeadRequired(lead) {
  return Boolean(lead.firstName && lead.lastName);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function getUserLeads(store, userId) {
  if (!Array.isArray(store.users[userId])) {
    store.users[userId] = [];
  }
  return store.users[userId];
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = readUsers();
  const user = users[email];

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: '12h'
  });

  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const users = readUsers();

  if (users[email]) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  users[email] = {
    id: userId,
    email,
    name: (name || email.split('@')[0]).trim(),
    passwordHash
  };

  writeUsers(users);

  // Auto-login after registration
  const token = jwt.sign({ sub: userId, email, name: users[email].name }, JWT_SECRET, {
    expiresIn: '12h'
  });

  return res.status(201).json({
    token,
    user: { id: userId, email, name: users[email].name }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api/leads', authMiddleware);

app.get('/api/leads', (req, res) => {
  const store = readStore();
  const userLeads = getUserLeads(store, req.user.sub);
  const { status, source, search } = req.query;

  let filtered = userLeads;

  if (status) {
    filtered = filtered.filter((lead) => lead.status === status);
  }

  if (source) {
    filtered = filtered.filter((lead) => lead.source === source);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((lead) => {
      return (
        `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(q) ||
        String(lead.route || '').toLowerCase().includes(q) ||
        String(lead.homeType || '').toLowerCase().includes(q) ||
        String(lead.source || '').toLowerCase().includes(q)
      );
    });
  }

  filtered = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json({ leads: filtered });
});

app.get('/api/leads/:id', (req, res) => {
  const store = readStore();
  const userLeads = getUserLeads(store, req.user.sub);
  const lead = userLeads.find((item) => item.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.json({ lead });
});

app.post('/api/leads', (req, res) => {
  const store = readStore();
  const userLeads = getUserLeads(store, req.user.sub);
  const leadInput = sanitizeLead(req.body);

  if (!ensureLeadRequired(leadInput)) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  const now = new Date().toISOString();
  const lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...leadInput,
    createdAt: now,
    updatedAt: now
  };

  userLeads.unshift(lead);
  writeStore(store);

  res.status(201).json({ lead });
});

app.put('/api/leads/:id', (req, res) => {
  const store = readStore();
  const userLeads = getUserLeads(store, req.user.sub);
  const index = userLeads.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const merged = sanitizeLead({ ...userLeads[index], ...req.body });
  if (!ensureLeadRequired(merged)) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  userLeads[index] = {
    ...userLeads[index],
    ...merged,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  res.json({ lead: userLeads[index] });
});

app.delete('/api/leads/:id', (req, res) => {
  const store = readStore();
  const userLeads = getUserLeads(store, req.user.sub);
  const index = userLeads.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  userLeads.splice(index, 1);
  writeStore(store);
  res.json({ success: true });
});

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
  console.log(`💾 Data: ${DATA_FILE}`);
});
