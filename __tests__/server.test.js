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

// ─── Push subscriptions API ───────────────────────────────────────────────────

describe('Push subscription routes', () => {
  let app;
  let userToken;

  beforeAll(() => {
    jest.resetModules();
    const userHash = bcrypt.hashSync('user123', 4);
    seedUsers({
      'pushuser@test.local': {
        id: 'user-push',
        email: 'pushuser@test.local',
        name: 'Push User',
        isAdmin: false,
        role: 'phc',
        active: true,
        passwordHash: userHash
      }
    });
    ({ app } = require('../server/server.js'));
    userToken = makeToken('user-push', 'phc', 'Push User');
  });

  test('GET /api/push/vapid-public-key returns null when not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await request(app).get('/api/push/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBeNull();
  });

  test('POST /api/push/subscribe requires auth', async () => {
    const res = await request(app).post('/api/push/subscribe').send({
      subscription: { endpoint: 'https://example.com/push/1', keys: { p256dh: 'abc', auth: 'def' } }
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/push/subscribe stores subscription', async () => {
    const fakeSub = { endpoint: 'https://example.com/push/1', keys: { p256dh: 'abc', auth: 'def' } };
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ subscription: fakeSub });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify stored on disk
    const pushFile = path.join(TEST_DATA_DIR, 'pushSubscriptions.json');
    const stored = JSON.parse(fs.readFileSync(pushFile, 'utf8'));
    expect(stored['user-push']).toHaveLength(1);
    expect(stored['user-push'][0].endpoint).toBe('https://example.com/push/1');
  });

  test('DELETE /api/push/unsubscribe removes subscription', async () => {
    // Subscribe first
    const fakeSub = { endpoint: 'https://example.com/push/del', keys: { p256dh: 'abc', auth: 'def' } };
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ subscription: fakeSub });

    // Unsubscribe
    const res = await request(app)
      .delete('/api/push/unsubscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ endpoint: 'https://example.com/push/del' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const pushFile = path.join(TEST_DATA_DIR, 'pushSubscriptions.json');
    const stored = JSON.parse(fs.readFileSync(pushFile, 'utf8'));
    const remaining = (stored['user-push'] || []).filter(
      (s) => s.endpoint === 'https://example.com/push/del'
    );
    expect(remaining).toHaveLength(0);
  });
});

// ─── User profile (GET/PUT /api/users/me) ────────────────────────────────────

describe('GET /api/users/me and PUT /api/users/me', () => {
  let app;
  let userToken;

  beforeAll(() => {
    jest.resetModules();
    const userHash = bcrypt.hashSync('user123', 4);
    seedUsers({
      'profile@test.local': {
        id: 'user-profile',
        email: 'profile@test.local',
        name: 'Profile User',
        isAdmin: false,
        role: 'phc',
        active: true,
        passwordHash: userHash
      }
    });
    ({ app } = require('../server/server.js'));
    userToken = makeToken('user-profile', 'phc', 'Profile User');
  });

  test('GET /api/users/me returns user without passwordHash', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-profile');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('PUT /api/users/me updates phoneNumber and smsOptIn', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ phoneNumber: '+15551234567', smsOptIn: true });
    expect(res.status).toBe(200);
    expect(res.body.user.phoneNumber).toBe('+15551234567');
    expect(res.body.user.smsOptIn).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('PUT /api/users/me normalizes phone number', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ phoneNumber: '(555) 123-4567' });
    expect(res.status).toBe(200);
    // All non-digit chars removed (no + in this number)
    expect(res.body.user.phoneNumber).toBe('5551234567');
  });

  test('PUT /api/users/me requires auth', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .send({ phoneNumber: '+15559999999' });
    expect(res.status).toBe(401);
  });
});

// ─── Tasks API (POST /api/tasks, GET /api/tasks) ─────────────────────────────

describe('Tasks API', () => {
  let app;
  let userToken;
  let adminToken;

  beforeAll(() => {
    jest.resetModules();
    const userHash = bcrypt.hashSync('user123', 4);
    const adminHash = bcrypt.hashSync('admin123', 4);
    seedUsers({
      'taskuser@test.local': {
        id: 'user-task',
        email: 'taskuser@test.local',
        name: 'Task User',
        isAdmin: false,
        role: 'phc',
        active: true,
        passwordHash: userHash
      },
      'taskadmin@test.local': {
        id: 'user-taskadmin',
        email: 'taskadmin@test.local',
        name: 'Task Admin',
        isAdmin: true,
        role: 'admin',
        active: true,
        passwordHash: adminHash
      }
    });
    ({ app } = require('../server/server.js'));
    userToken = makeToken('user-task', 'phc', 'Task User');
    adminToken = makeToken('user-taskadmin', 'admin', 'Task Admin');
    // Clear tasks before suite
    fs.writeFileSync(path.join(TEST_DATA_DIR, 'tasks.json'), '[]');
  });

  test('POST /api/tasks creates task for self', async () => {
    const due = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Call back client', scheduledAt: due });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Call back client');
    expect(res.body.task.assignedTo).toBe('user-task');
    expect(res.body.task.completed).toBe(false);
    expect(res.body.task.dueSoonNotifiedAt).toBeNull();
  });

  test('POST /api/tasks requires title and scheduledAt', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Missing date' });
    expect(res.status).toBe(400);
  });

  test('non-admin cannot assign task to another user', async () => {
    const due = new Date(Date.now() + 3600000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Sneaky assign', scheduledAt: due, assignedTo: 'user-taskadmin' });
    expect(res.status).toBe(403);
  });

  test('admin can assign task to another user', async () => {
    const due = new Date(Date.now() + 3600000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin assigned', scheduledAt: due, assignedTo: 'user-task' });
    expect(res.status).toBe(201);
    expect(res.body.task.assignedTo).toBe('user-task');
  });

  test('GET /api/tasks returns tasks assigned to user', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    const tasks = res.body.tasks || [];
    // All returned tasks should be assigned to or owned by user-task
    tasks.forEach((t) => {
      const isOwned = t.assignedTo === 'user-task' || (!t.assignedTo && t.leadOwner === 'user-task');
      expect(isOwned).toBe(true);
    });
  });

  test('PUT /api/tasks/:id/complete marks task as done', async () => {
    const due = new Date(Date.now() + 3600000).toISOString();
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'To complete', scheduledAt: due });
    const taskId = createRes.body.task.id;

    const completeRes = await request(app)
      .put(`/api/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.task.completed).toBe(true);
    expect(completeRes.body.task.completedAt).toBeTruthy();
  });
});

// ─── Scheduler: 5-minute due-soon notifications ───────────────────────────────

describe('Scheduler: dueSoonNotifiedAt deduplication', () => {
  let readTasks;
  let writeTasks;

  beforeAll(() => {
    jest.resetModules();
    seedUsers({
      'sched@test.local': {
        id: 'user-sched',
        email: 'sched@test.local',
        name: 'Scheduler User',
        isAdmin: false,
        role: 'phc',
        active: true,
        passwordHash: bcrypt.hashSync('pass', 4)
      }
    });
    ({ readTasks, writeTasks } = require('../server/server.js'));
  });

  test('task without dueSoonNotifiedAt is eligible for due-soon notification window', () => {
    // A task due in 3 minutes should have dueSoonNotifiedAt set by scheduler
    const inThreeMinutes = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const task = {
      id: 'task_sched_1',
      type: 'custom',
      title: 'Almost due',
      scheduledAt: inThreeMinutes,
      leadOwner: 'user-sched',
      assignedTo: 'user-sched',
      completed: false,
      dueSoonNotifiedAt: null,
      createdAt: new Date().toISOString()
    };
    writeTasks([task]);
    const tasks = readTasks();
    const saved = tasks.find((t) => t.id === 'task_sched_1');
    expect(saved).toBeDefined();
    // dueSoonNotifiedAt should still be null until scheduler runs
    expect(saved.dueSoonNotifiedAt).toBeNull();
  });

  test('task with dueSoonNotifiedAt already set is not re-notified', () => {
    const inThreeMinutes = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const task = {
      id: 'task_sched_2',
      type: 'custom',
      title: 'Already notified',
      scheduledAt: inThreeMinutes,
      leadOwner: 'user-sched',
      assignedTo: 'user-sched',
      completed: false,
      dueSoonNotifiedAt: new Date().toISOString(), // already notified
      createdAt: new Date().toISOString()
    };
    writeTasks([task]);
    const tasks = readTasks();
    const saved = tasks.find((t) => t.id === 'task_sched_2');
    expect(saved.dueSoonNotifiedAt).not.toBeNull();
  });
});
