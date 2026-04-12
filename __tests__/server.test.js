'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// ─── Temp data dir setup ──────────────────────────────────────────────────────
// Each test suite uses an isolated temp directory so tests don't pollute each other.
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-test-'));

beforeAll(() => {
  process.env.DATA_DIR_OVERRIDE = TEST_DATA_DIR;
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up temp dir
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

// We need to load server AFTER setting DATA_DIR_OVERRIDE.
// However, the current server.js uses __dirname-relative paths.
// We'll test the exported helpers and the HTTP API via supertest.

// ─── Helpers ─────────────────────────────────────────────────────────────────
const JWT_SECRET = 'dev-only-secret-change-in-production';

function makeToken(userId, role = 'phc', name = 'Test User') {
  return jwt.sign({ sub: userId, name, role }, JWT_SECRET, { expiresIn: '1h' });
}

function seedUsers(usersObj) {
  const usersFile = path.join(TEST_DATA_DIR, 'users.json');
  fs.writeFileSync(usersFile, JSON.stringify(usersObj, null, 2));
}

function readTasksFromDisk() {
  const file = path.join(TEST_DATA_DIR, 'tasks.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readAppsFromDisk() {
  const file = path.join(TEST_DATA_DIR, 'dealerApplications.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ─── hasManagementAccess ─────────────────────────────────────────────────────

describe('hasManagementAccess()', () => {
  // We test the standalone helper without starting the server.
  let hasManagementAccess;

  beforeAll(() => {
    // Isolate module so each test suite can require fresh
    jest.resetModules();
    // Provide a minimal stub so server.js can load without binding a port
    process.env.PORT = '0';
    const mod = require('../server/server.js');
    hasManagementAccess = mod.hasManagementAccess;
  });

  test('returns true for admin user', () => {
    expect(hasManagementAccess({ active: true, isAdmin: true, role: 'admin' })).toBe(true);
  });

  test('returns true for user with canReviewSubmittedApplications permission', () => {
    const user = {
      active: true,
      isAdmin: false,
      role: 'phc',
      pagePermissions: { canReviewSubmittedApplications: true }
    };
    expect(hasManagementAccess(user)).toBe(true);
  });

  test('returns false for regular user without permission', () => {
    const user = { active: true, isAdmin: false, role: 'phc', pagePermissions: {} };
    expect(hasManagementAccess(user)).toBe(false);
  });

  test('returns false for inactive admin', () => {
    expect(hasManagementAccess({ active: false, isAdmin: true, role: 'admin' })).toBe(false);
  });

  test('returns false for null', () => {
    expect(hasManagementAccess(null)).toBe(false);
  });
});

// ─── MORTGAGE_21ST_URL constant ──────────────────────────────────────────────

describe('MORTGAGE_21ST_URL', () => {
  test('points to 21st Mortgage calculator', () => {
    jest.resetModules();
    const { MORTGAGE_21ST_URL } = require('../server/server.js');
    expect(MORTGAGE_21ST_URL).toContain('21stmortgage.com');
    expect(MORTGAGE_21ST_URL).toContain('calculators');
  });
});

// ─── HTTP API tests ───────────────────────────────────────────────────────────

describe('POST /api/dealer-applications', () => {
  let app;

  beforeAll(() => {
    jest.resetModules();
    // Pre-create users file so the server doesn't seed the default demo users
    const adminHash = bcrypt.hashSync('admin123', 4);
    const phcHash = bcrypt.hashSync('phc123', 4);
    const mgmtHash = bcrypt.hashSync('mgmt123', 4);
    seedUsers({
      'admin@test.local': {
        id: 'user-admin',
        email: 'admin@test.local',
        name: 'Admin User',
        isAdmin: true,
        role: 'admin',
        active: true,
        passwordHash: adminHash
      },
      'phc@test.local': {
        id: 'user-phc',
        email: 'phc@test.local',
        name: 'PHC User',
        isAdmin: false,
        role: 'phc',
        active: true,
        passwordHash: phcHash
      },
      'manager@test.local': {
        id: 'user-mgmt',
        email: 'manager@test.local',
        name: 'Manager User',
        isAdmin: false,
        role: 'phc',
        active: true,
        pagePermissions: { canReviewSubmittedApplications: true },
        passwordHash: mgmtHash
      }
    });
    ({ app } = require('../server/server.js'));
  });

  afterEach(() => {
    // Clear tasks and apps between tests
    fs.writeFileSync(path.join(TEST_DATA_DIR, 'tasks.json'), '[]');
    fs.writeFileSync(path.join(TEST_DATA_DIR, 'dealerApplications.json'), '[]');
  });

  const sampleApp = {
    borrower: { firstName: 'John', lastName: 'Doe', phone: '555-1234', email: 'john@test.com' },
    homeSelection: { model: 'Model X', size: 'DW', year: 2024 }
  };

  test('returns 401 if no token', async () => {
    const res = await request(app).post('/api/dealer-applications').send(sampleApp);
    expect(res.status).toBe(401);
  });

  test('creates application and returns 201', async () => {
    const token = makeToken('user-phc', 'phc', 'PHC User');
    const res = await request(app)
      .post('/api/dealer-applications')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleApp);
    expect(res.status).toBe(201);
    expect(res.body.application).toBeDefined();
    expect(res.body.application.id).toMatch(/^app_/);
  });

  test('creates review tasks for admin and management users on submission', async () => {
    const token = makeToken('user-phc', 'phc', 'PHC User');
    await request(app)
      .post('/api/dealer-applications')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleApp);

    // Give the async notification a moment to complete
    await new Promise((r) => setTimeout(r, 100));

    const tasks = readTasksFromDisk();
    const reviewTasks = tasks.filter((t) => t.type === 'review_application');

    // Should have tasks for: user-admin (isAdmin) + user-mgmt (canReviewSubmittedApplications)
    expect(reviewTasks.length).toBeGreaterThanOrEqual(2);
    const ownerIds = reviewTasks.map((t) => t.leadOwner);
    expect(ownerIds).toContain('user-admin');
    expect(ownerIds).toContain('user-mgmt');
    // The submitter (phc) should NOT get a review task
    expect(ownerIds).not.toContain('user-phc');
  });

  test('notification is idempotent - does not create duplicate tasks for same submission', async () => {
    const token = makeToken('user-phc', 'phc', 'PHC User');
    const res = await request(app)
      .post('/api/dealer-applications')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleApp);
    await new Promise((r) => setTimeout(r, 100));

    const appId = res.body.application.id;
    const apps = readAppsFromDisk();
    const savedApp = apps.find((a) => a.id === appId);

    // Manually call notifyManagementOfSubmission again on the same (now stored) app
    const { notifyManagementOfSubmission } = require('../server/server.js');
    await notifyManagementOfSubmission(savedApp);
    await new Promise((r) => setTimeout(r, 50));

    const tasks = readTasksFromDisk();
    const reviewTasks = tasks.filter((t) => t.type === 'review_application');
    const adminTasks = reviewTasks.filter((t) => t.leadOwner === 'user-admin');
    // Admin should only have ONE review task (idempotent)
    expect(adminTasks.length).toBe(1);
  });

  test('tasks include borrower name and application metadata', async () => {
    const token = makeToken('user-phc', 'phc', 'PHC User');
    await request(app)
      .post('/api/dealer-applications')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleApp);
    await new Promise((r) => setTimeout(r, 100));

    const tasks = readTasksFromDisk();
    const reviewTask = tasks.find((t) => t.type === 'review_application' && t.leadOwner === 'user-admin');
    expect(reviewTask).toBeDefined();
    expect(reviewTask.title).toContain('John Doe');
    expect(reviewTask.metadata.borrowerName).toBe('John Doe');
  });
});

// ─── Admin: RBAC role creation / assignment ───────────────────────────────────

describe('Admin: role management', () => {
  let app;
  let adminToken;

  beforeAll(() => {
    jest.resetModules();
    const adminHash = bcrypt.hashSync('admin123', 4);
    seedUsers({
      'admin@test.local': {
        id: 'user-admin',
        email: 'admin@test.local',
        name: 'Admin User',
        isAdmin: true,
        role: 'admin',
        active: true,
        passwordHash: adminHash
      }
    });
    ({ app } = require('../server/server.js'));
    adminToken = makeToken('user-admin', 'admin', 'Admin User');
  });

  test('admin can create a new user', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newphc@test.local', password: 'pass123', name: 'New PHC', role: 'phc' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('newphc@test.local');
    expect(res.body.user.role).toBe('phc');
  });

  test('admin can assign canReviewSubmittedApplications permission', async () => {
    // First create a user
    const createRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'reviewer@test.local', password: 'pass123', name: 'Reviewer', role: 'phc' });
    const userId = createRes.body.user.id;

    // Grant management permission
    const permRes = await request(app)
      .put(`/api/admin/users/${userId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pagePermissions: { canReviewSubmittedApplications: true } });
    expect(permRes.status).toBe(200);
    expect(permRes.body.user.pagePermissions.canReviewSubmittedApplications).toBe(true);
  });

  test('non-admin cannot create users', async () => {
    const phcToken = makeToken('user-nobody', 'phc', 'Nobody');
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${phcToken}`)
      .send({ email: 'hack@test.local', password: 'pass123', name: 'Hacker', role: 'admin' });
    expect(res.status).toBe(403);
  });

  test('admin can update user role', async () => {
    const createRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'roletest@test.local', password: 'pass123', name: 'Role Test', role: 'phc' });
    const userId = createRes.body.user.id;

    const updateRes = await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.role).toBe('admin');
  });
});

// ─── nmora_exclusive@outlook.com is always admin ─────────────────────────────

describe('nmora_exclusive@outlook.com admin seeding', () => {
  test('nmora_exclusive is present and admin in a fresh user store', () => {
    jest.resetModules();

    // Reset to empty state
    const usersFile = path.join(TEST_DATA_DIR, 'users.json');
    if (fs.existsSync(usersFile)) fs.unlinkSync(usersFile);

    const { readUsers, isAdminUser } = require('../server/server.js');
    const users = readUsers();

    const nmora = users['nmora_exclusive@outlook.com'];
    expect(nmora).toBeDefined();
    expect(isAdminUser(nmora)).toBe(true);
  });
});

// ─── Settings: default mortgage calc URL ─────────────────────────────────────

describe('Settings: default mortgage calculator URL', () => {
  test('default settings point to 21st Mortgage', async () => {
    jest.resetModules();
    const adminHash = bcrypt.hashSync('admin123', 4);
    seedUsers({
      'admin@test.local': {
        id: 'user-admin2',
        email: 'admin@test.local',
        name: 'Admin',
        isAdmin: true,
        role: 'admin',
        active: true,
        passwordHash: adminHash
      }
    });
    // Remove settings file to get defaults
    const settingsFile = path.join(TEST_DATA_DIR, 'settings.json');
    if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);

    const { app: freshApp } = require('../server/server.js');
    const token = makeToken('user-admin2', 'admin', 'Admin');
    const res = await request(freshApp)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.calcUrl).toContain('21stmortgage.com');
  });
});

// ─── Email sending (mocked) ──────────────────────────────────────────────────

describe('Email notifications (mocked)', () => {
  test('sendEmail logs when SMTP is not configured', async () => {
    jest.resetModules();
    // Clear SMTP env vars to ensure we get the console.log path
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { notifyManagementOfSubmission, readUsers } = require('../server/server.js');
      const users = readUsers();
      const adminEmail = Object.keys(users).find((k) => users[k].isAdmin);

      if (adminEmail) {
        const fakeApp = {
          id: 'app_test_email',
          borrower: { firstName: 'Email', lastName: 'Test' },
          submittedByName: 'Tester',
          submittedAt: new Date().toISOString(),
          notificationTaskIds: {}
        };
        await notifyManagementOfSubmission(fakeApp);
        // At least one log line mentioning EMAIL
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[EMAIL'));
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
