/**
 * Tests for CRM automation features:
 * 1. Task creation when Active Customer reaches "Completed" status
 * 2. Lender list restricted to 21ST Mortgage
 * 3. DocuSign document builder helper
 * 4. DocuSign endpoint (unconfigured → 503)
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-only-secret-change-in-production';

// ── Isolated data directory setup ────────────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-test-'));

// Set override BEFORE requiring server so DATA_DIR resolves to tmpDir
process.env.DATA_DIR_OVERRIDE = tmpDir;
// Unset DocuSign vars to ensure unconfigured state in tests
delete process.env.DOCUSIGN_INTEGRATION_KEY;
delete process.env.DOCUSIGN_SECRET_KEY;
delete process.env.DOCUSIGN_ACCOUNT_ID;

const { app, buildApplicationDocumentBase64 } = require('../server/server.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Data helpers ──────────────────────────────────────────────────────────────

const usersFile = path.join(tmpDir, 'users.json');
const tasksFile = path.join(tmpDir, 'tasks.json');
const activeCustomersFile = path.join(tmpDir, 'activeCustomers.json');
const dealerAppsFile = path.join(tmpDir, 'dealerApplications.json');

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}
function readJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}

function makeToken(userId, isAdmin = false) {
  return jwt.sign(
    { sub: userId, email: `${userId}@test.com`, name: 'Test User', isAdmin, role: isAdmin ? 'admin' : 'phc' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function seedAdmin(id = 'admin1') {
  const users = readJson(usersFile, {});
  users[`${id}@test.com`] = {
    id,
    email: `${id}@test.com`,
    name: `Admin ${id}`,
    isAdmin: true,
    role: 'admin',
    active: true,
    passwordHash: bcrypt.hashSync('password', 1)
  };
  writeJson(usersFile, users);
  return id;
}

function seedPHC(id = 'phc1') {
  const users = readJson(usersFile, {});
  users[`${id}@test.com`] = {
    id,
    email: `${id}@test.com`,
    name: `PHC ${id}`,
    isAdmin: false,
    role: 'phc',
    active: true,
    passwordHash: bcrypt.hashSync('password', 1)
  };
  writeJson(usersFile, users);
  return id;
}

function seedCustomer(overrides = {}) {
  const customers = readJson(activeCustomersFile, []);
  const customer = {
    id: `cust_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '555-0000',
    email: 'jane@example.com',
    status: 'App Submitted',
    owner: 'phc1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
  customers.push(customer);
  writeJson(activeCustomersFile, customers);
  return customer;
}

beforeEach(() => {
  writeJson(usersFile, {});
  writeJson(tasksFile, []);
  writeJson(activeCustomersFile, []);
  writeJson(dealerAppsFile, []);
  // Reset settings so default calcUrl is used
  const settingsFile = path.join(tmpDir, 'settings.json');
  if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildApplicationDocumentBase64', () => {
  test('encodes application data as a non-empty base64 string', () => {
    const doc = buildApplicationDocumentBase64({
      id: 'app_1',
      submittedAt: new Date().toISOString(),
      submittedByName: 'Agent Smith',
      borrower: { firstName: 'John', lastName: 'Doe', phone: '555-1234', email: 'john@example.com', address: '123 Main St', city: 'Anytown', state: 'TX', zip: '12345' },
      employment: { employer: 'ACME', position: 'Engineer', yearsEmployed: '5', monthlyIncome: '5000', employmentType: 'full' },
      incomeAssets: { otherIncome: '0', bankName: 'FirstBank', accountBalance: '10000', otherAssets: '' },
      property: { address: '456 Oak Ave', city: 'Anytown', state: 'TX', zip: '12345', landOwned: 'owned', propType: 'single' },
      homeSelection: { model: 'Model A', manufacturer: 'ACMEHomes', year: '2024', size: 'SW', condition: 'new' },
      notes: 'Test application'
    });
    expect(typeof doc).toBe('string');
    expect(doc.length).toBeGreaterThan(0);
    const decoded = Buffer.from(doc, 'base64').toString('utf8');
    expect(decoded).toContain('EXCLUSIVE MANUFACTURE HOMES');
    expect(decoded).toContain('John');
    expect(decoded).toContain('ACME');
    expect(decoded).toContain('Borrower Signature:');
  });

  test('includes co-borrower signature line when coBorrower is provided', () => {
    const doc = buildApplicationDocumentBase64({
      id: 'app_2',
      submittedAt: new Date().toISOString(),
      borrower: { firstName: 'Alice', lastName: 'Smith' },
      coBorrower: { firstName: 'Bob', lastName: 'Smith' }
    });
    const decoded = Buffer.from(doc, 'base64').toString('utf8');
    expect(decoded).toContain('CO-BORROWER');
    expect(decoded).toContain('Co-Borrower Signature:');
  });

  test('does not include co-borrower section when coBorrower is null', () => {
    const doc = buildApplicationDocumentBase64({
      id: 'app_3',
      borrower: { firstName: 'Solo', lastName: 'Applicant' },
      coBorrower: null
    });
    const decoded = Buffer.from(doc, 'base64').toString('utf8');
    expect(decoded).not.toContain('CO-BORROWER');
  });
});

describe('VALID_LENDERS — only 21ST Mortgage', () => {
  let adminId, adminToken;

  beforeEach(() => {
    adminId = seedAdmin('admin1');
    adminToken = makeToken(adminId, true);
    seedCustomer({ id: 'cust_lender', owner: adminId, status: 'App Submitted', lender: null });
  });

  test('accepts 21ST Mortgage as a valid lender', async () => {
    const res = await request(app)
      .put('/api/active-customers/cust_lender')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lender: '21ST Mortgage' });
    expect(res.status).toBe(200);
    expect(res.body.customer.lender).toBe('21ST Mortgage');
  });

  test('rejects old lender values — lender stays null', async () => {
    for (const oldLender of ['21ST', 'CPM', 'Triad', 'CUHU', 'Cash', 'Other', 'CSL', 'Calcon']) {
      const res = await request(app)
        .put('/api/active-customers/cust_lender')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lender: oldLender });
      expect(res.status).toBe(200);
      // Server keeps existing lender (null) when the value is invalid
      expect(res.body.customer.lender).toBeNull();
    }
  });
});

describe('Automation — review tasks on Completed status', () => {
  let adminId, adminToken;

  beforeEach(() => {
    adminId = seedAdmin('admin1');
    adminToken = makeToken(adminId, true);
  });

  test('creates one review task per admin when status changes to Completed', async () => {
    seedCustomer({ id: 'cust_comp', owner: adminId, status: 'Funded' });

    const res = await request(app)
      .put('/api/active-customers/cust_comp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    expect(res.status).toBe(200);
    expect(res.body.customer.status).toBe('Completed');

    const tasks = readJson(tasksFile, []);
    const reviewTasks = tasks.filter((t) => t.type === 'review_completed_app');
    expect(reviewTasks.length).toBe(1);
    expect(reviewTasks[0].leadOwner).toBe(adminId);
    expect(reviewTasks[0].customerId).toBe('cust_comp');
    expect(reviewTasks[0].title).toContain('Jane Doe');
    expect(reviewTasks[0].completed).toBe(false);
  });

  test('creates tasks for each admin when multiple admins exist', async () => {
    seedAdmin('admin2');
    seedCustomer({ id: 'cust_multi', owner: adminId, status: 'Funded' });

    await request(app)
      .put('/api/active-customers/cust_multi')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    const tasks = readJson(tasksFile, []);
    const reviewTasks = tasks.filter((t) => t.type === 'review_completed_app');
    expect(reviewTasks.length).toBe(2);
    const owners = reviewTasks.map((t) => t.leadOwner).sort();
    expect(owners).toEqual(['admin1', 'admin2'].sort());
  });

  test('idempotency — does not duplicate tasks on repeated Completed transitions', async () => {
    seedCustomer({ id: 'cust_idem', owner: adminId, status: 'Funded' });

    await request(app)
      .put('/api/active-customers/cust_idem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    // Second call (still Completed)
    await request(app)
      .put('/api/active-customers/cust_idem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    const tasks = readJson(tasksFile, []);
    const reviewTasks = tasks.filter(
      (t) => t.type === 'review_completed_app' && t.customerId === 'cust_idem'
    );
    expect(reviewTasks.length).toBe(1);
  });

  test('does NOT create review tasks when transitioning to a non-Completed status', async () => {
    seedCustomer({ id: 'cust_no_comp', owner: adminId, status: 'App Submitted' });

    await request(app)
      .put('/api/active-customers/cust_no_comp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Funded' });

    const tasks = readJson(tasksFile, []);
    const reviewTasks = tasks.filter((t) => t.type === 'review_completed_app');
    expect(reviewTasks.length).toBe(0);
  });

  test('review task title includes customer name', async () => {
    seedCustomer({ id: 'cust_name', owner: adminId, status: 'Funded', firstName: 'Alice', lastName: 'Wonder' });

    await request(app)
      .put('/api/active-customers/cust_name')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    const tasks = readJson(tasksFile, []);
    const reviewTasks = tasks.filter((t) => t.type === 'review_completed_app');
    expect(reviewTasks[0].title).toContain('Alice Wonder');
  });

  test('review task includes notes with application link metadata', async () => {
    seedCustomer({ id: 'cust_meta', owner: adminId, status: 'Funded', firstName: 'Bob', lastName: 'Builder' });

    await request(app)
      .put('/api/active-customers/cust_meta')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    const tasks = readJson(tasksFile, []);
    const task = tasks.find((t) => t.type === 'review_completed_app');
    expect(task.notes).toContain('Bob Builder');
    expect(task.notes).toContain('cust_meta');
  });

  test('non-owner non-admin gets 403 when trying to update customer', async () => {
    const phcId = seedPHC('phc1');
    const phcToken = makeToken(phcId, false);
    seedCustomer({ id: 'cust_403', owner: 'other_user', status: 'Funded' });

    const res = await request(app)
      .put('/api/active-customers/cust_403')
      .set('Authorization', `Bearer ${phcToken}`)
      .send({ status: 'Completed' });

    expect(res.status).toBe(403);
  });
});

describe('DocuSign endpoint', () => {
  let adminId, adminToken;

  beforeEach(() => {
    adminId = seedAdmin('admin1');
    adminToken = makeToken(adminId, true);
    writeJson(dealerAppsFile, [{
      id: 'app_ds1',
      submittedBy: adminId,
      submittedByName: 'Admin',
      submittedAt: new Date().toISOString(),
      borrower: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
    }]);
  });

  test('returns 503 when DocuSign env vars are not configured', async () => {
    const res = await request(app)
      .post('/api/dealer-applications/app_ds1/docusign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  test('returns 404 for non-existent application', async () => {
    const res = await request(app)
      .post('/api/dealer-applications/nonexistent/docusign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  test('returns 403 when non-owner PHC user tries to send', async () => {
    const phcId = seedPHC('phc1');
    const phcToken = makeToken(phcId, false);
    const res = await request(app)
      .post('/api/dealer-applications/app_ds1/docusign')
      .set('Authorization', `Bearer ${phcToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  test('GET docusign/status returns not_sent when no envelope exists', async () => {
    const res = await request(app)
      .get('/api/dealer-applications/app_ds1/docusign/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('not_sent');
    expect(res.body.envelopeId).toBeNull();
  });

  test('GET docusign/status returns cached status when envelope exists', async () => {
    writeJson(dealerAppsFile, [{
      id: 'app_ds2',
      submittedBy: adminId,
      submittedByName: 'Admin',
      submittedAt: new Date().toISOString(),
      borrower: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      docusignEnvelopeId: 'env_abc123',
      docusignStatus: 'sent'
    }]);

    const res = await request(app)
      .get('/api/dealer-applications/app_ds2/docusign/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // Without live DocuSign creds, it returns the cached status
    expect(['sent', 'unknown']).toContain(res.body.status);
    expect(res.body.envelopeId).toBe('env_abc123');
  });
});

describe('Settings default calcUrl', () => {
  let adminId, adminToken;

  beforeEach(() => {
    adminId = seedAdmin('admin1');
    adminToken = makeToken(adminId, true);
  });

  test('default calcUrl points to 21st Mortgage calculator', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.calcUrl).toContain('21stmortgage.com');
  });
});

// ─── Auth flow ────────────────────────────────────────────────────────────────

describe('Login flow — no DocuSign credentials required', () => {
  beforeEach(() => {
    // Ensure DocuSign env vars are unset so we confirm auth does not depend on them
    delete process.env.DOCUSIGN_INTEGRATION_KEY;
    delete process.env.DOCUSIGN_SECRET_KEY;
    delete process.env.DOCUSIGN_ACCOUNT_ID;
  });

  test('POST /api/auth/login succeeds with demo credentials', async () => {
    // The server seeds demo@crm.local on first readUsers() call when users.json is empty
    writeJson(usersFile, {});
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@crm.local', password: 'demo123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('demo@crm.local');
  });

  test('POST /api/auth/login returns 401 for wrong password', async () => {
    writeJson(usersFile, {});
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@crm.local', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/auth/login returns 400 when credentials are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/auth/me returns user info with valid token', async () => {
    writeJson(usersFile, {});
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@crm.local', password: 'demo123' });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('demo@crm.local');
  });

  test('GET /api/auth/me returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('token from login grants access to /api/leads', async () => {
    writeJson(usersFile, {});
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@crm.local', password: 'demo123' });
    const token = loginRes.body.token;

    const leadsRes = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${token}`);
    expect(leadsRes.status).toBe(200);
    expect(leadsRes.body).toHaveProperty('leads');
  });
});

