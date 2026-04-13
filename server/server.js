const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const twilio = require('twilio');

// ─── Email transport (optional – configure via env vars) ──────────────────────
// Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable real email delivery.
// If unconfigured the service will log notifications instead of sending.
const SMTP_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const emailTransport = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

async function sendEmail({ to, subject, text, html }) {
  if (!emailTransport) {
    console.log(`[EMAIL - not configured] To: ${to} | Subject: ${subject}`);
    return;
  }
  await emailTransport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
}

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';

// VAPID Web Push configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const PUSH_CONFIGURED = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (PUSH_CONFIGURED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Twilio SMS configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';
const SMS_CONFIGURED = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
const twilioClient = SMS_CONFIGURED ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;
const crmConfig = require('./config');
const { ensureDirectories, initializeDataFiles } = require('./setup');
const DATA_DIR = crmConfig.dataDir;
const LEADS_FILE = crmConfig.leadsFile;
const USERS_FILE = crmConfig.usersFile;
const TEMPLATES_FILE = crmConfig.emailTemplatesFile;
const TASKS_FILE = crmConfig.tasksFile;
const CONTACTS_FILE = crmConfig.contactsFile;
const ACTIVE_CUSTOMERS_FILE = crmConfig.activeCustomersFile;
const DEAL_TRACKERS_FILE = crmConfig.dealTrackersFile;
const DEALER_APPS_FILE = crmConfig.dealerAppsFile;
const CLOSING_DOCS_FILE = crmConfig.closingDocsFile;
const SETTINGS_FILE = crmConfig.settingsFile;
const DOCUMENTS_DIR = crmConfig.documentsDir;
const PUSH_SUBSCRIPTIONS_FILE = crmConfig.pushSubscriptionsFile;
const DEAL_PIPELINE_FILE = crmConfig.dealPipelineFile;

// Warn if running in production with default secret
if (NODE_ENV === 'production' && process.env.JWT_SECRET === undefined) {
  console.warn('⚠️  WARNING: Running in production with default JWT_SECRET. Set JWT_SECRET env var.');
}

const PIPELINE_STAGES = ['New Lead', 'Hot Lead', 'Appointment Set', 'Active', 'Dead', 'Junk'];
const CONTACT_PIPELINE_STAGES = [
  'App Submitted', 'Approve', 'In Process', 'Conditions Cleared', 'Closing Requested',
  'Closed', 'Pending Delivery', 'Delivered Pending Construction', 'Funded', 'Complete', 'Dead', 'DNQ'
];
// Map old lead statuses to new pipeline stages (for migration of existing data)
const LEAD_STATUS_MIGRATION_MAP = {
  'New': 'New Lead',
  'Contacted': 'Hot Lead',
  'Qualified': 'Hot Lead',
  'Proposal': 'Appointment Set',
  'Won': 'Active',
  'Lost': 'Dead'
};
const ACTIVE_CUSTOMER_STATUSES = [
  'Contact Status', 'App Submitted', 'Approved', 'Pending Conditions', 'Ready to Close',
  'Appraisal', 'Docs Ordered', 'Closed Pending Delivery', 'Delivered Pending Funding',
  'Funded', 'Trimout Pending', 'Trimmed Out Pending Addl Work', 'Completed', 'Closed'
];
const VALID_LENDERS = ['21ST Mortgage'];
const VALID_RESPONSE_STATUSES = ['answered', 'not_answered', 'left_vm', 'text'];
const VALID_LEAD_STATUSES = ['pending_info', 'completing_application', 'appointment_set', 'answered'];
const VALID_FINANCING = ['cash', 'finance', 'credit_repair'];
const VALID_MOVE_TIMELINES = ['90_days_or_less', '3_6_months', 'not_ready'];

// DocuSign configuration (set via environment variables)
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const DOCUSIGN_SECRET_KEY = process.env.DOCUSIGN_SECRET_KEY || '';
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID || '';
const DOCUSIGN_BASE_URL = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';

// DocuSign token cache
let _docusignAccessToken = null;
let _docusignTokenExpiry = 0;

const https = require('https');

async function docusignRequest(method, urlPath, body, accessToken) {
  return new Promise((resolve, reject) => {
    const baseUrl = new URL(DOCUSIGN_BASE_URL);
    const options = {
      hostname: baseUrl.hostname,
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getDocusignAccessToken() {
  if (_docusignAccessToken && Date.now() < _docusignTokenExpiry) {
    return _docusignAccessToken;
  }
  if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_SECRET_KEY) {
    throw new Error('DocuSign credentials not configured. Set DOCUSIGN_INTEGRATION_KEY and DOCUSIGN_SECRET_KEY environment variables.');
  }
  _docusignAccessToken = DOCUSIGN_SECRET_KEY;
  _docusignTokenExpiry = Date.now() + 3600 * 1000;
  return _docusignAccessToken;
}

function buildApplicationDocumentBase64(application) {
  const b = application.borrower || {};
  const emp = application.employment || {};
  const inc = application.incomeAssets || {};
  const prop = application.property || {};
  const home = application.homeSelection || {};
  const co = application.coBorrower || {};
  const lines = [
    'EXCLUSIVE MANUFACTURE HOMES AND TRANSPORT',
    'APPLICATION FOR MANUFACTURED HOME FINANCING',
    '='.repeat(60),
    '',
    `Date: ${new Date(application.submittedAt || Date.now()).toLocaleDateString()}`,
    `Application ID: ${application.id || ''}`,
    `Submitted By: ${application.submittedByName || ''}`,
    '',
    'BORROWER INFORMATION',
    '-'.repeat(40),
    `Name: ${b.firstName || ''} ${b.lastName || ''}`,
    `Date of Birth: ${b.dob || ''}`,
    `Phone: ${b.phone || ''}`,
    `Email: ${b.email || ''}`,
    `Address: ${b.address || ''}, ${b.city || ''}, ${b.state || ''} ${b.zip || ''}`,
    '',
    co.firstName ? [
      'CO-BORROWER INFORMATION',
      '-'.repeat(40),
      `Name: ${co.firstName || ''} ${co.lastName || ''}`,
      `Phone: ${co.phone || ''}`,
      `Email: ${co.email || ''}`,
      ''
    ].join('\n') : '',
    'EMPLOYMENT',
    '-'.repeat(40),
    `Employer: ${emp.employer || ''}`,
    `Position: ${emp.position || ''}`,
    `Years Employed: ${emp.yearsEmployed || ''}`,
    `Monthly Income: $${emp.monthlyIncome || '0'}`,
    `Employment Type: ${emp.employmentType || ''}`,
    '',
    'INCOME & ASSETS',
    '-'.repeat(40),
    `Other Monthly Income: $${inc.otherIncome || '0'}`,
    `Bank Name: ${inc.bankName || ''}`,
    `Account Balance: $${inc.accountBalance || '0'}`,
    `Other Assets: ${inc.otherAssets || ''}`,
    '',
    'PROPERTY INFORMATION',
    '-'.repeat(40),
    `Property Address: ${prop.address || ''}, ${prop.city || ''}, ${prop.state || ''} ${prop.zip || ''}`,
    `Land Status: ${prop.landOwned || ''}`,
    `Property Type: ${prop.propType || ''}`,
    '',
    'HOME SELECTION',
    '-'.repeat(40),
    `Model: ${home.model || ''}`,
    `Manufacturer: ${home.manufacturer || ''}`,
    `Year: ${home.year || ''}`,
    `Size: ${home.size || ''}`,
    `Condition: ${home.condition || ''}`,
    '',
    'NOTES',
    '-'.repeat(40),
    application.notes || '',
    '',
    '='.repeat(60),
    'SIGNATURE',
    '',
    'By signing below, I certify that the information provided is accurate and complete.',
    '',
    'Borrower Signature: ________________________  Date: __________',
    '',
    co.firstName ? 'Co-Borrower Signature: _____________________  Date: __________\n' : '',
    '='.repeat(60)
  ].filter((l) => l !== null && l !== undefined).join('\n');
  return Buffer.from(lines).toString('base64');
}

// Recall campaign schedule:
// Phase 1 (days 1-5): 4 calls/day at 7am, 11am, 3pm, 7pm
// Phase 2 (days 6-11): 2 calls on alternate days (6, 8, 10)
// Phase 3 (days 12-15): 1 call every 3rd day (12, 15)
// Day 16: mark dead
const PHASE1_HOURS = [7, 11, 15, 19]; // 7am, 11am, 3pm, 7pm

// Ensure data directories and files exist
ensureDirectories();
initializeDataFiles();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
}));

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
        role: 'admin',
        active: true,
        passwordHash: bcrypt.hashSync('demo123', 10)
      },
      'alex@crm.local': {
        id: 'user-2',
        email: 'alex@crm.local',
        name: 'Alex Morgan',
        isAdmin: false,
        role: 'phc',
        active: true,
        passwordHash: bcrypt.hashSync('alex123', 10)
      },
      'nmora_exclusive@outlook.com': {
        id: 'user-nmora',
        email: 'nmora_exclusive@outlook.com',
        name: 'N. Mora (Admin)',
        isAdmin: true,
        role: 'admin',
        active: true,
        passwordHash: bcrypt.hashSync(process.env.NMORA_PASSWORD || 'changeme123', 10)
      }
    };
    writeJson(USERS_FILE, seeded);
    return seeded;
  }
  // Ensure legacy users get isAdmin and role fields
  let changed = false;
  Object.values(users).forEach((u) => {
    if (u.isAdmin === undefined) {
      u.isAdmin = u.id === 'user-1';
      changed = true;
    }
    if (u.role === undefined) {
      u.role = u.isAdmin ? 'admin' : 'phc';
      changed = true;
    }
    if (u.active === undefined) {
      u.active = true;
      changed = true;
    }
  });
  // Ensure nmora_exclusive@outlook.com always has admin privileges
  const nmoraEmail = 'nmora_exclusive@outlook.com';
  if (!users[nmoraEmail]) {
    users[nmoraEmail] = {
      id: 'user-nmora',
      email: nmoraEmail,
      name: 'N. Mora (Admin)',
      isAdmin: true,
      role: 'admin',
      active: true,
      passwordHash: bcrypt.hashSync(process.env.NMORA_PASSWORD || 'changeme123', 10)
    };
    changed = true;
  } else if (!isAdminUser(users[nmoraEmail])) {
    users[nmoraEmail].isAdmin = true;
    users[nmoraEmail].role = 'admin';
    changed = true;
  }
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
    return migrateLeadStatuses(leads);
  }
  const leads = Array.isArray(raw) ? raw : [];
  return migrateLeadStatuses(leads);
}

// Migrate leads with old pipeline status values to new ones in-memory (and persist if changed)
function migrateLeadStatuses(leads) {
  let changed = false;
  const migrated = leads.map((lead) => {
    if (lead.status && !PIPELINE_STAGES.includes(lead.status)) {
      const newStatus = LEAD_STATUS_MIGRATION_MAP[lead.status] || 'New Lead';
      changed = true;
      return { ...lead, status: newStatus };
    }
    return lead;
  });
  if (changed) {
    writeJson(LEADS_FILE, migrated);
  }
  return migrated;
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

function readPushSubscriptions() {
  return readJson(PUSH_SUBSCRIPTIONS_FILE, {});
}
function writePushSubscriptions(data) {
  writeJson(PUSH_SUBSCRIPTIONS_FILE, data);
}

function readContacts() {
  return readJson(CONTACTS_FILE, []);
}
function writeContacts(contacts) {
  writeJson(CONTACTS_FILE, contacts);
}
function readActiveCustomers() {
  return readJson(ACTIVE_CUSTOMERS_FILE, []);
}
function writeActiveCustomers(customers) {
  writeJson(ACTIVE_CUSTOMERS_FILE, customers);
}
function readDealTrackers() { return readJson(DEAL_TRACKERS_FILE, []); }
function writeDealTrackers(data) { writeJson(DEAL_TRACKERS_FILE, data); }
function readDealPipeline() { return readJson(DEAL_PIPELINE_FILE, []); }
function writeDealPipeline(data) { writeJson(DEAL_PIPELINE_FILE, data); }
function readDealerApps() { return readJson(DEALER_APPS_FILE, []); }
function writeDealerApps(data) { writeJson(DEALER_APPS_FILE, data); }
function readClosingDocs() { return readJson(CLOSING_DOCS_FILE, {}); }
function writeClosingDocs(data) { writeJson(CLOSING_DOCS_FILE, data); }
const MORTGAGE_21ST_URL = 'https://www.21stmortgage.com/web/21stsite.nsf/calculators#mortgage-calculator';
function readSettings() { return readJson(SETTINGS_FILE, { calcUrl: MORTGAGE_21ST_URL }); }
function writeSettings(data) { writeJson(SETTINGS_FILE, data); }
function getCustomerDocDir(customerId) {
  const dir = path.join(DOCUMENTS_DIR, customerId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function readCustomerDocMeta(customerId) {
  const metaFile = path.join(getCustomerDocDir(customerId), 'metadata.json');
  return readJson(metaFile, []);
}
function writeCustomerDocMeta(customerId, meta) {
  const metaFile = path.join(getCustomerDocDir(customerId), 'metadata.json');
  writeJson(metaFile, meta);
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
  if (!isAdminUser(userRecord)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.isAdmin = true;
  next();
}

function isAdminUser(userRecord) {
  return userRecord && (userRecord.isAdmin || userRecord.role === 'admin');
}

// ─── Management access helpers ────────────────────────────────────────────────

/** Returns true if the user has management/review access. */
function hasManagementAccess(userRecord) {
  if (!userRecord || userRecord.active === false) return false;
  if (isAdminUser(userRecord)) return true;
  return !!(userRecord.pagePermissions && userRecord.pagePermissions.canReviewSubmittedApplications);
}

/** Finds all active users with management access (admin or canReviewSubmittedApplications). */
function getManagementUsers() {
  const users = readUsers();
  return Object.values(users).filter(hasManagementAccess);
}

/**
 * Creates review tasks and sends email notifications to all management users
 * for a newly submitted dealer/loan application.
 * Idempotent: skips users already listed in application.notificationTaskIds.
 */
async function notifyManagementOfSubmission(application) {
  const managers = getManagementUsers();
  if (managers.length === 0) return;

  const tasks = readTasks();
  const apps = readDealerApps();
  const appIdx = apps.findIndex((a) => a.id === application.id);

  // Build the set of userIds already notified
  const alreadyNotified = new Set(application.notificationTaskIds
    ? Object.keys(application.notificationTaskIds)
    : []);

  const newTaskIds = {};
  const emailPromises = [];
  const now = new Date().toISOString();
  const borrowerName = application.borrower
    ? `${application.borrower.firstName || ''} ${application.borrower.lastName || ''}`.trim()
    : 'Unknown';
  const appLink = `${process.env.APP_URL || ''}/`;

  for (const manager of managers) {
    if (alreadyNotified.has(manager.id)) continue;

    // Create in-app review task
    const task = {
      id: `task_${crypto.randomUUID()}`,
      type: 'review_application',
      title: `Review submitted loan application – ${borrowerName}`,
      applicationId: application.id,
      leadOwner: manager.id,
      scheduledAt: now,
      completed: false,
      completedAt: null,
      createdAt: now,
      metadata: {
        borrowerName,
        submittedByName: application.submittedByName || '',
        submittedAt: application.submittedAt,
        appLink
      }
    };
    tasks.push(task);
    newTaskIds[manager.id] = task.id;

    // Queue email notification
    if (manager.email) {
      emailPromises.push(
        sendEmail({
          to: manager.email,
          subject: `[CRM] Loan Application Submitted – ${borrowerName}`,
          text: [
            `A new loan application has been submitted and requires your review.`,
            ``,
            `Borrower: ${borrowerName}`,
            `Submitted by: ${application.submittedByName || 'Unknown'}`,
            `Submitted at: ${application.submittedAt}`,
            ``,
            `Log in to review: ${appLink}`
          ].join('\n'),
          html: `<p>A new loan application has been submitted and requires your review.</p>
<table style="border-collapse:collapse;font-family:sans-serif">
  <tr><td style="padding:4px 8px;font-weight:bold">Borrower</td><td style="padding:4px 8px">${escapeHtml(borrowerName)}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Submitted by</td><td style="padding:4px 8px">${escapeHtml(application.submittedByName || 'Unknown')}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Submitted at</td><td style="padding:4px 8px">${escapeHtml(application.submittedAt)}</td></tr>
</table>
<p><a href="${escapeHtml(appLink)}">Click here to log in and review the application</a></p>`
        }).catch((err) => console.error('[EMAIL] Failed to send notification:', err))
      );
    }
  }

  if (Object.keys(newTaskIds).length > 0) {
    writeTasks(tasks);

    // Persist notification task IDs on the application for idempotency
    if (appIdx > -1) {
      apps[appIdx].notificationTaskIds = {
        ...(apps[appIdx].notificationTaskIds || {}),
        ...newTaskIds
      };
      writeDealerApps(apps);
    }

    await Promise.all(emailPromises);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Lead helpers ─────────────────────────────────────────────────────────────

function sanitizeLeadInput(input) {
  const value = Number(input.estimatedValue || 0);
  const normalizedStatus = PIPELINE_STAGES.includes(input.status) ? input.status : 'New Lead';

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

// ─── Notification helpers ──────────────────────────────────────────────────────

async function sendPushNotification(userId, payload) {
  if (!PUSH_CONFIGURED) return;
  const subs = readPushSubscriptions();
  const userSubs = subs[userId] || [];
  const stale = [];
  await Promise.all(
    userSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.endpoint);
        }
      }
    })
  );
  if (stale.length > 0) {
    subs[userId] = userSubs.filter((s) => !stale.includes(s.endpoint));
    writePushSubscriptions(subs);
  }
}

async function sendSMS(phoneNumber, message) {
  if (!SMS_CONFIGURED || !phoneNumber) return;
  try {
    await twilioClient.messages.create({
      body: message,
      from: TWILIO_FROM_NUMBER,
      to: phoneNumber
    });
  } catch (err) {
    console.error('[SMS] Failed to send:', err.message);
  }
}

async function notifyTaskDueSoon(task) {
  const users = readUsers();
  const assignedUserId = task.assignedTo || task.leadOwner;
  if (!assignedUserId) return;

  const user = Object.values(users).find((u) => u.id === assignedUserId);
  if (!user) return;

  const title = task.title || 'Task due soon';
  const body = `Due in ~5 minutes: ${title}`;

  const pushPayload = {
    type: 'task_due_soon',
    title: '⏰ Task Due Soon',
    body,
    taskId: task.id,
    url: '/'
  };

  await Promise.all([
    sendPushNotification(assignedUserId, pushPayload),
    user.smsOptIn && user.phoneNumber
      ? sendSMS(user.phoneNumber, `[CRM] ${body}`)
      : Promise.resolve()
  ]);
}

async function notifyTaskAssigned(task) {
  const users = readUsers();
  const assignedUserId = task.assignedTo || task.leadOwner;
  if (!assignedUserId) return;

  const user = Object.values(users).find((u) => u.id === assignedUserId);
  if (!user) return;

  const title = task.title || 'New task';
  const body = `New task assigned: ${title}`;
  const dueStr = task.scheduledAt ? ` (due ${new Date(task.scheduledAt).toLocaleString()})` : '';

  const pushPayload = {
    type: 'task_assigned',
    title: '📋 Task Assigned',
    body: `${body}${dueStr}`,
    taskId: task.id,
    url: '/tasks'
  };

  await Promise.all([
    sendPushNotification(assignedUserId, pushPayload),
    user.smsOptIn && user.phoneNumber
      ? sendSMS(user.phoneNumber, `[CRM] ${body}${dueStr}`)
      : Promise.resolve()
  ]);
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

    // 5-min-prior notification (send once, deduplicate via dueSoonNotifiedAt)
    if (!task.dueSoonNotifiedAt && scheduledAt > now) {
      const minsUntilDue = (scheduledAt - now) / 60_000;
      if (minsUntilDue <= 5 && minsUntilDue > 0) {
        task.dueSoonNotifiedAt = now.toISOString();
        tasksChanged = true;
        notifyTaskDueSoon(task).catch((err) =>
          console.error('[NOTIFY] Due-soon notification failed:', err)
        );
      }
    }

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

  const role = user.role || (user.isAdmin ? 'admin' : 'phc');
  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, role }, JWT_SECRET, {
    expiresIn: '12h'
  });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, role } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  const users = readUsers();
  if (users[email]) return res.status(409).json({ error: 'Email already registered' });

  const userId = `user_${crypto.randomUUID()}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  // First registered user beyond demo becomes admin if no other admin exists
  const hasAdmin = Object.values(users).some(isAdminUser);
  const isAdmin = !hasAdmin;
  const role = isAdmin ? 'admin' : 'phc';
  users[email] = {
    id: userId,
    email,
    name: (name || email.split('@')[0]).trim(),
    isAdmin,
    role,
    active: true,
    passwordHash
  };
  writeUsers(users);

  const token = jwt.sign({ sub: userId, email, name: users[email].name, isAdmin, role }, JWT_SECRET, {
    expiresIn: '12h'
  });
  return res.status(201).json({ token, user: { id: userId, email, name: users[email].name, isAdmin, role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const role = userRecord ? (userRecord.role || (isAdmin ? 'admin' : 'phc')) : 'phc';
  const pagePermissions = userRecord ? (userRecord.pagePermissions || null) : null;
  res.json({ user: { ...req.user, isAdmin, role, pagePermissions } });
});

// ─── Leads routes ─────────────────────────────────────────────────────────────

app.use('/api/leads', authMiddleware);

// GET /api/leads — admins see all; PHC users see only their own
app.get('/api/leads', (req, res) => {
  const leads = readLeads();
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const { status, source, search, owner } = req.query;

  // PHC users can only see their own leads
  let filtered = isAdmin ? leads : leads.filter((l) => l.leadOwner === req.user.sub);
  if (status) filtered = filtered.filter((l) => l.status === status);
  if (source) filtered = filtered.filter((l) => l.source === source);
  if (owner && isAdmin) filtered = filtered.filter((l) => l.leadOwner === owner);
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
    createdBy: req.user.sub,
    createdByName: userRecord ? userRecord.name : req.user.name,
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
  const isAdmin = isAdminUser(userRecord);

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
  const previousStatus = lead.status;

  leads[idx] = {
    ...lead,
    ...patch,
    // immutable fields
    leadOwner: lead.leadOwner,
    leadOwnerName: lead.leadOwnerName,
    createdBy: lead.createdBy || lead.leadOwner,
    createdByName: lead.createdByName || lead.leadOwnerName,
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

  // Auto-convert to contact when status is set to 'Active' for the first time
  let conversionResult = null;
  if (patch.status === 'Active' && previousStatus !== 'Active') {
    conversionResult = convertLeadToContact(leads[idx], req.user.sub, readUsers());
  }

  const responsePayload = { lead: leads[idx] };
  if (conversionResult) {
    responsePayload.contact = conversionResult.contact;
    responsePayload.converted = conversionResult.created;
  }
  res.json(responsePayload);
});

// DELETE /api/leads/:id — only admins can delete leads
app.delete('/api/leads/:id', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  // Only admins can delete leads; PHC users cannot delete
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only admins can delete leads' });
  }

  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

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

// ─── Lead → Contact conversion helper ────────────────────────────────────────

/**
 * Idempotent conversion: if lead was already converted, returns existing contact.
 * Returns { contact, created: boolean }.
 */
function convertLeadToContact(lead, requestingUserId, users) {
  const contacts = readContacts();
  const now = new Date().toISOString();

  // Idempotency: if already converted, return existing contact
  if (lead.convertedToContactId) {
    const existing = contacts.find((c) => c.id === lead.convertedToContactId);
    if (existing) return { contact: existing, created: false };
  }

  // Also check by fromLeadId to handle data inconsistencies
  const byLeadId = contacts.find((c) => c.fromLeadId === lead.id);
  if (byLeadId) {
    // Patch back the lead record if missing convertedToContactId
    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === lead.id);
    if (idx !== -1 && !leads[idx].convertedToContactId) {
      leads[idx].convertedToContactId = byLeadId.id;
      leads[idx].convertedAt = byLeadId.createdAt;
      writeLeads(leads);
    }
    return { contact: byLeadId, created: false };
  }

  const ownerRecord = Object.values(users).find((u) => u.id === lead.leadOwner);

  const contact = {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    phone: lead.phone || '',
    email: lead.email || '',
    homeType: lead.homeType || '',
    route: lead.route || '',
    notes: lead.notes || '',
    source: lead.source || 'Other',
    pipelineStatus: 'App Submitted',
    owner: lead.leadOwner,
    ownerName: ownerRecord ? ownerRecord.name : (lead.leadOwnerName || ''),
    fromLeadId: lead.id,
    leadHistory: lead,
    emailsSent: [],
    documents: [],
    createdAt: now,
    updatedAt: now
  };

  contacts.unshift(contact);
  writeContacts(contacts);

  // Update lead with conversion metadata
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === lead.id);
  if (idx !== -1) {
    leads[idx].convertedToContactId = contact.id;
    leads[idx].convertedAt = now;
    writeLeads(leads);
  }

  return { contact, created: true };
}

// POST /api/leads/:id/convert-to-contact — explicit conversion endpoint
app.post('/api/leads/:id/convert-to-contact', authMiddleware, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  // Only lead owner or admin can convert
  if (lead.leadOwner !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the lead owner or admin can convert this lead' });
  }

  const result = convertLeadToContact(lead, req.user.sub, users);
  res.status(result.created ? 201 : 200).json({
    contact: result.contact,
    converted: result.created,
    message: result.created ? 'Lead converted to contact' : 'Lead was already converted — returning existing contact'
  });
});


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
  const isAdmin = isAdminUser(userRecord);

  // Admins see all tasks; regular users see tasks assigned to them or owned by them
  const ownedLeadIds = new Set(leads.filter((l) => l.leadOwner === req.user.sub).map((l) => l.id));
  let filtered = isAdmin
    ? tasks
    : tasks.filter(
        (t) =>
          t.assignedTo === req.user.sub ||
          (!t.assignedTo && t.leadOwner === req.user.sub) ||
          ownedLeadIds.has(t.leadId)
      );

  const { completed, leadId } = req.query;
  if (completed !== undefined) filtered = filtered.filter((t) => t.completed === (completed === 'true'));
  if (leadId) filtered = filtered.filter((t) => t.leadId === leadId);

  res.json({ tasks: filtered.sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt))) });
});

app.post('/api/tasks', (req, res) => {
  const { title, scheduledAt, assignedTo, notes, leadId } = req.body;
  if (!title || !scheduledAt) {
    return res.status(400).json({ error: 'title and scheduledAt are required' });
  }

  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  let resolvedAssignedTo = req.user.sub;
  if (assignedTo) {
    const assignee = Object.values(users).find((u) => u.id === assignedTo);
    if (!assignee) return res.status(400).json({ error: 'Assigned user not found' });
    if (!isAdmin && assignedTo !== req.user.sub) {
      return res.status(403).json({ error: 'Only admins can assign tasks to other users' });
    }
    resolvedAssignedTo = assignedTo;
  }

  const now = new Date().toISOString();
  const task = {
    id: `task_${crypto.randomUUID()}`,
    title: String(title).slice(0, 200),
    scheduledAt: new Date(scheduledAt).toISOString(),
    notes: notes ? String(notes).slice(0, 1000) : '',
    type: 'custom',
    leadId: leadId || null,
    leadOwner: req.user.sub,
    assignedTo: resolvedAssignedTo,
    completed: false,
    completedAt: null,
    dueSoonNotifiedAt: null,
    assignedNotifiedAt: null,
    createdAt: now
  };

  const tasks = readTasks();
  tasks.push(task);
  writeTasks(tasks);

  notifyTaskAssigned(task).catch((err) =>
    console.error('[NOTIFY] Task assignment notification failed:', err)
  );

  res.status(201).json({ task });
});

app.put('/api/tasks/:id/complete', (req, res) => {
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const task = tasks[idx];

  if (
    !isAdmin &&
    task.assignedTo !== req.user.sub &&
    task.leadOwner !== req.user.sub
  ) {
    return res.status(403).json({ error: 'Not authorized to complete this task' });
  }

  tasks[idx] = {
    ...task,
    completed: true,
    completedAt: new Date().toISOString()
  };
  writeTasks(tasks);
  res.json({ task: tasks[idx] });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

app.use('/api/admin', authMiddleware, adminMiddleware);

// GET /api/admin/users — list all users (for ownership transfer)
app.get('/api/admin/users', (req, res) => {
  const users = readUsers();
  const list = Object.values(users).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    role: u.role || (u.isAdmin ? 'admin' : 'phc'),
    active: u.active !== false
  }));
  res.json({ users: list });
});

// POST /api/admin/users — create a new user (admin only)
app.post('/api/admin/users', (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  const validRoles = ['admin', 'phc'];
  const assignedRole = validRoles.includes(role) ? role : 'phc';

  const users = readUsers();
  if (users[email]) return res.status(409).json({ error: 'Email already registered' });

  const userId = `user_${crypto.randomUUID()}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const isAdmin = assignedRole === 'admin';
  users[email] = {
    id: userId,
    email: email.toLowerCase(),
    name: (name || email.split('@')[0]).trim(),
    isAdmin,
    role: assignedRole,
    active: true,
    passwordHash
  };
  writeUsers(users);

  res.status(201).json({ user: { id: userId, email: email.toLowerCase(), name: users[email].name, isAdmin, role: assignedRole, active: true } });
});

// DELETE /api/admin/users/:id — delete a user (admin only)
app.delete('/api/admin/users/:id', (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const users = readUsers();
  const email = Object.keys(users).find((k) => users[k].id === req.params.id);
  if (!email) return res.status(404).json({ error: 'User not found' });
  delete users[email];
  writeUsers(users);
  res.json({ success: true });
});

// PUT /api/admin/users/:id — update user role or name (admin only)
app.put('/api/admin/users/:id', (req, res) => {
  const users = readUsers();
  const email = Object.keys(users).find((k) => users[k].id === req.params.id);
  if (!email) return res.status(404).json({ error: 'User not found' });

  const { role, name, active } = req.body;
  const validRoles = ['admin', 'phc'];
  if (role && validRoles.includes(role)) {
    users[email].role = role;
    users[email].isAdmin = role === 'admin';
  }
  if (name) users[email].name = name.trim();
  if (active !== undefined) users[email].active = Boolean(active);
  writeUsers(users);

  res.json({ user: { id: users[email].id, email, name: users[email].name, isAdmin: users[email].isAdmin, role: users[email].role, active: users[email].active } });
});

// PUT /api/admin/users/:id/permissions — save page permissions (admin only)
app.put('/api/admin/users/:id/permissions', (req, res) => {
  const users = readUsers();
  const email = Object.keys(users).find((k) => users[k].id === req.params.id);
  if (!email) return res.status(404).json({ error: 'User not found' });
  const { pagePermissions } = req.body;
  if (typeof pagePermissions !== 'object' || pagePermissions === null) {
    return res.status(400).json({ error: 'pagePermissions must be an object' });
  }
  users[email].pagePermissions = pagePermissions;
  writeUsers(users);
  res.json({ user: { id: users[email].id, email, pagePermissions } });
});

// POST /api/admin/approve-duplicate — admin handles duplicate lead entry
app.post('/api/admin/approve-duplicate', (req, res) => {
  const { approved, action, pendingLeadData, targetUserId, existingLeadId, note } = req.body;

  // Determine action — support both legacy `approved` boolean and new `action` string
  const resolvedAction = action || (approved === true ? 'allow' : 'decline');

  if (resolvedAction === 'decline') {
    return res.json({ success: true, message: 'Duplicate entry declined by admin' });
  }

  if (resolvedAction === 'change_owner') {
    // Change the owner of the existing lead to a different user
    if (!existingLeadId) return res.status(400).json({ error: 'existingLeadId is required for change_owner action' });
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required for change_owner action' });

    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === existingLeadId);
    if (idx === -1) return res.status(404).json({ error: 'Existing lead not found' });

    const users = readUsers();
    const newOwner = Object.values(users).find((u) => u.id === targetUserId);
    if (!newOwner) return res.status(404).json({ error: 'Target user not found' });

    leads[idx].leadOwner = newOwner.id;
    leads[idx].leadOwnerName = newOwner.name;
    leads[idx].duplicateMergeHistory = [
      ...(leads[idx].duplicateMergeHistory || []),
      { mergedAt: new Date().toISOString(), action: 'change_owner', actionedBy: req.user.sub, newOwner: newOwner.id, note: note || 'Admin changed lead owner via duplicate review' }
    ];
    leads[idx].updatedAt = new Date().toISOString();
    writeLeads(leads);

    return res.json({ lead: leads[idx], message: 'Lead ownership changed by admin' });
  }

  if (resolvedAction === 'merge') {
    // Merge new lead data into existing lead
    if (!existingLeadId) return res.status(400).json({ error: 'existingLeadId is required for merge action' });
    const mergeInput = sanitizeLeadInput(pendingLeadData || {});

    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === existingLeadId);
    if (idx === -1) return res.status(404).json({ error: 'Existing lead not found' });

    // Merge: fill in empty fields from new data
    const existing = leads[idx];
    const merged = { ...existing };
    Object.keys(mergeInput).forEach((key) => {
      if (!merged[key] && mergeInput[key]) merged[key] = mergeInput[key];
    });
    const now = new Date().toISOString();
    merged.updatedAt = now;
    merged.duplicateMergeHistory = [
      ...(existing.duplicateMergeHistory || []),
      { mergedAt: now, action: 'merge', actionedBy: req.user.sub, note: note || 'Admin merged duplicate entry' }
    ];
    leads[idx] = merged;
    writeLeads(leads);

    return res.json({ lead: leads[idx], message: 'Duplicate merged into existing lead' });
  }

  // action === 'allow' — create new lead
  const leadInput = sanitizeLeadInput(pendingLeadData || {});
  if (!ensureLeadRequired(leadInput)) {
    return res.status(400).json({ error: 'firstName and lastName are required in pendingLeadData' });
  }

  const users = readUsers();
  const ownerRecord = targetUserId
    ? Object.values(users).find((u) => u.id === targetUserId)
    : Object.values(users).find((u) => u.id === req.user.sub);
  const creatorRecord = Object.values(users).find((u) => u.id === req.user.sub);

  const now = new Date().toISOString();
  const lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...leadInput,
    leadOwner: ownerRecord ? ownerRecord.id : req.user.sub,
    leadOwnerName: ownerRecord ? ownerRecord.name : req.user.name,
    createdBy: req.user.sub,
    createdByName: creatorRecord ? creatorRecord.name : req.user.name,
    recallCampaignActive: false,
    recallCampaignStarted: null,
    lastContactAttempt: null,
    contactAttempts: 0,
    emailsSent: [],
    isDead: false,
    duplicateMergeHistory: [{ mergedAt: now, action: 'allow', actionedBy: req.user.sub, note: note || 'Admin approved duplicate entry' }],
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
    { mergedAt: new Date().toISOString(), action: 'transfer', actionedBy: req.user.sub, newOwner: newOwner.id, note: 'Lead transferred by admin' }
  ];
  leads[idx].updatedAt = new Date().toISOString();
  writeLeads(leads);

  res.json({ lead: leads[idx] });
});

// ─── Contacts routes ──────────────────────────────────────────────────────────

app.use('/api/contacts', authMiddleware);

// GET /api/contacts
app.get('/api/contacts', (req, res) => {
  const contacts = readContacts();
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const filtered = isAdmin ? contacts : contacts.filter((c) => c.owner === req.user.sub);
  res.json({ contacts: filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
});

// GET /api/contacts/:id
app.get('/api/contacts/:id', (req, res) => {
  const contacts = readContacts();
  const contact = contacts.find((c) => c.id === req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json({ contact });
});

// POST /api/contacts — create from lead conversion (fromLeadId required for non-admins)
app.post('/api/contacts', (req, res) => {
  const { fromLeadId, firstName, lastName, phone, email, homeType, route, notes, source } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'firstName and lastName are required' });

  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  // Non-admins must provide fromLeadId (contacts originate from leads only)
  if (!fromLeadId && !isAdmin) {
    return res.status(403).json({ error: 'Contacts must be created from a lead. Please convert the lead to a contact instead.' });
  }

  const now = new Date().toISOString();

  let leadHistory = null;
  if (fromLeadId) {
    const leads = readLeads();
    const lead = leads.find((l) => l.id === fromLeadId);
    if (lead) leadHistory = lead;
  }

  const contact = {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    firstName: (firstName || '').trim(),
    lastName: (lastName || '').trim(),
    phone: (phone || '').trim(),
    email: (email || '').trim().toLowerCase(),
    homeType: (homeType || '').trim(),
    route: (route || '').trim(),
    notes: (notes || '').trim(),
    source: (source || '').trim() || 'Other',
    pipelineStatus: 'App Submitted',
    owner: req.user.sub,
    ownerName: userRecord ? userRecord.name : req.user.name,
    fromLeadId: fromLeadId || null,
    leadHistory: leadHistory || null,
    emailsSent: [],
    documents: [],
    createdAt: now,
    updatedAt: now
  };

  const contacts = readContacts();
  contacts.unshift(contact);
  writeContacts(contacts);

  res.status(201).json({ contact });
});

// PUT /api/contacts/:id
app.put('/api/contacts/:id', (req, res) => {
  const contacts = readContacts();
  const idx = contacts.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact not found' });

  const contact = contacts[idx];
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  if (contact.owner !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the contact owner can modify this record' });
  }

  const { firstName, lastName, phone, email, homeType, route, notes, source, pipelineStatus } = req.body;
  const now = new Date().toISOString();

  contacts[idx] = {
    ...contact,
    firstName: firstName !== undefined ? (firstName || '').trim() : contact.firstName,
    lastName: lastName !== undefined ? (lastName || '').trim() : contact.lastName,
    phone: phone !== undefined ? (phone || '').trim() : contact.phone,
    email: email !== undefined ? (email || '').trim().toLowerCase() : contact.email,
    homeType: homeType !== undefined ? (homeType || '').trim() : contact.homeType,
    route: route !== undefined ? (route || '').trim() : contact.route,
    notes: notes !== undefined ? (notes || '').trim() : contact.notes,
    source: source !== undefined ? (source || '').trim() : contact.source,
    pipelineStatus: pipelineStatus && CONTACT_PIPELINE_STAGES.includes(pipelineStatus) ? pipelineStatus : contact.pipelineStatus,
    updatedAt: now
  };

  writeContacts(contacts);
  res.json({ contact: contacts[idx] });
});

// DELETE /api/contacts/:id — admin only
app.delete('/api/contacts/:id', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  if (!isAdminUser(userRecord)) return res.status(403).json({ error: 'Only admins can delete contacts' });

  const contacts = readContacts();
  const idx = contacts.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact not found' });

  contacts.splice(idx, 1);
  writeContacts(contacts);
  res.json({ success: true });
});

// POST /api/contacts/:id/send-email
app.post('/api/contacts/:id/send-email', (req, res) => {
  const contacts = readContacts();
  const idx = contacts.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact not found' });

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

  if (!Array.isArray(contacts[idx].emailsSent)) contacts[idx].emailsSent = [];
  contacts[idx].emailsSent.push(emailRecord);
  contacts[idx].updatedAt = new Date().toISOString();
  writeContacts(contacts);

  res.json({ email: emailRecord });
});

// POST /api/contacts/:id/promote — promote contact to active customer
app.post('/api/contacts/:id/promote', (req, res) => {
  const contacts = readContacts();
  const idx = contacts.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact not found' });

  const contact = contacts[idx];
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  if (contact.owner !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the contact owner can promote this record' });
  }

  const now = new Date().toISOString();
  const customer = {
    id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    email: contact.email,
    homeType: contact.homeType,
    route: contact.route,
    notes: contact.notes,
    source: contact.source,
    owner: contact.owner,
    ownerName: contact.ownerName,
    fromContactId: contact.id,
    fromLeadId: contact.fromLeadId || null,
    status: 'App Submitted',
    lender: null,
    checklist: {
      type: null,
      orderStock: null,
      factory: null,
      modular: null,
      swDwTw: null,
      payStubs: false,
      w2s: false,
      vod: false,
      voeVor: false,
      bids: false,
      lenderDoc: false,
      deedLandContract: false,
      siteInspection: false,
      survey: false,
      appraisal: false,
      title: false,
      address911: false,
      specSheet: false,
      cocs: false,
      conditionsMet: false
    },
    estimatedValue: 0,
    monthYear: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
    emailsSent: contact.emailsSent || [],
    createdAt: now,
    updatedAt: now
  };

  const customers = readActiveCustomers();
  customers.unshift(customer);
  writeActiveCustomers(customers);

  // Mark contact as promoted
  contacts[idx].promotedToCustomer = customer.id;
  contacts[idx].updatedAt = now;
  writeContacts(contacts);

  res.status(201).json({ customer });
});

// ─── Active Customers routes ──────────────────────────────────────────────────

app.use('/api/active-customers', authMiddleware);

// GET /api/active-customers
app.get('/api/active-customers', (req, res) => {
  const customers = readActiveCustomers();
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const filtered = isAdmin ? customers : customers.filter((c) => c.owner === req.user.sub);
  res.json({ customers: filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
});

// GET /api/active-customers/:id
app.get('/api/active-customers/:id', (req, res) => {
  const customers = readActiveCustomers();
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});

// PUT /api/active-customers/:id
app.put('/api/active-customers/:id', (req, res) => {
  const customers = readActiveCustomers();
  const idx = customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });

  const customer = customers[idx];
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  if (customer.owner !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the customer owner can modify this record' });
  }

  const { status, lender, checklist, estimatedValue, notes, homeType, route, monthYear, firstName, lastName, phone, email,
    loanType, modelName, modelFactory, homeName, ordered, specced, estGrossProfit } = req.body;
  const VALID_LOAN_TYPES = ['Chattel', 'Cash', 'FHA', 'LH'];
  const now = new Date().toISOString();

  customers[idx] = {
    ...customer,
    firstName: firstName !== undefined ? (firstName || '').trim() : customer.firstName,
    lastName: lastName !== undefined ? (lastName || '').trim() : customer.lastName,
    phone: phone !== undefined ? (phone || '').trim() : customer.phone,
    email: email !== undefined ? (email || '').trim().toLowerCase() : customer.email,
    homeType: homeType !== undefined ? (homeType || '').trim() : customer.homeType,
    route: route !== undefined ? (route || '').trim() : customer.route,
    notes: notes !== undefined ? (notes || '').trim() : customer.notes,
    status: status && ACTIVE_CUSTOMER_STATUSES.includes(status) ? status : customer.status,
    lender: lender && VALID_LENDERS.includes(lender) ? lender : (lender === '' ? null : customer.lender),
    checklist: checklist && typeof checklist === 'object' ? { ...customer.checklist, ...checklist } : customer.checklist,
    estimatedValue: estimatedValue !== undefined ? Number(estimatedValue) || 0 : customer.estimatedValue,
    monthYear: monthYear || customer.monthYear,
    loanType: loanType && VALID_LOAN_TYPES.includes(loanType) ? loanType : (loanType === '' ? null : customer.loanType),
    modelName: modelName !== undefined ? (modelName || '').trim() : customer.modelName,
    modelFactory: modelFactory !== undefined ? (modelFactory || '').trim() : customer.modelFactory,
    homeName: homeName !== undefined ? (homeName || '').trim() : customer.homeName,
    ordered: ordered !== undefined ? Boolean(ordered) : customer.ordered,
    specced: specced !== undefined ? Boolean(specced) : customer.specced,
    estGrossProfit: estGrossProfit !== undefined ? Number(estGrossProfit) || 0 : customer.estGrossProfit,
    updatedAt: now
  };

  writeActiveCustomers(customers);

  // ── Automation: notify management when status reaches "Completed" ──────────
  const newStatus = customers[idx].status;
  const oldStatus = customer.status;
  if (newStatus === 'Completed' && oldStatus !== 'Completed') {
    const tasks = readTasks();
    // Idempotency: skip if a review task already exists for this customer
    const alreadyExists = tasks.some(
      (t) => t.customerId === customer.id && t.type === 'review_completed_app' && !t.completed
    );
    if (!alreadyExists) {
      const adminUsers = Object.values(users).filter((u) => isAdminUser(u) && u.active !== false);
      const taskNow = new Date().toISOString();
      const customerName = `${customers[idx].firstName} ${customers[idx].lastName}`.trim();
      adminUsers.forEach((adminUser) => {
        tasks.push({
          id: `task_${crypto.randomUUID()}`,
          customerId: customer.id,
          leadId: customer.leadId || null,
          leadOwner: adminUser.id,
          type: 'review_completed_app',
          phase: null,
          title: `Review Completed Application: ${customerName}`,
          notes: `Application for ${customerName} has been marked Completed. Submitted ${customers[idx].createdAt ? new Date(customers[idx].createdAt).toLocaleDateString() : 'N/A'}. Review record at /active-customers/${customer.id}.`,
          scheduledAt: taskNow,
          completed: false,
          completedAt: null,
          createdAt: taskNow
        });
      });
      writeTasks(tasks);
    }
  }

  res.json({ customer: customers[idx] });
});
app.delete('/api/active-customers/:id', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  if (!isAdminUser(userRecord)) return res.status(403).json({ error: 'Only admins can delete customers' });

  const customers = readActiveCustomers();
  const idx = customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });

  customers.splice(idx, 1);
  writeActiveCustomers(customers);
  res.json({ success: true });
});

// POST /api/active-customers/:id/send-email
app.post('/api/active-customers/:id/send-email', (req, res) => {
  const customers = readActiveCustomers();
  const idx = customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });

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

  if (!Array.isArray(customers[idx].emailsSent)) customers[idx].emailsSent = [];
  customers[idx].emailsSent.push(emailRecord);
  customers[idx].updatedAt = new Date().toISOString();
  writeActiveCustomers(customers);

  res.json({ email: emailRecord });
});

// ─── Document routes ──────────────────────────────────────────────────────────

app.use('/api/documents', authMiddleware);

// GET /api/documents/:customerId — list documents
app.get('/api/documents/:customerId', (req, res) => {
  const { customerId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(customerId)) {
    return res.status(400).json({ error: 'Invalid customer ID' });
  }
  const meta = readCustomerDocMeta(customerId);
  res.json({ documents: meta });
});

// POST /api/documents/:customerId/upload — upload document (base64 JSON)
app.post('/api/documents/:customerId/upload', (req, res) => {
  const { customerId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(customerId)) {
    return res.status(400).json({ error: 'Invalid customer ID' });
  }

  const { fileName, fileType, docCategory, data } = req.body;
  if (!fileName || !data) return res.status(400).json({ error: 'fileName and data are required' });
  // Max base64 string length for 10MB binary: 10 * 1024 * 1024 * (4/3) ≈ 14,000,000 chars
  const MAX_UPLOAD_B64 = 14_000_000;
  if (typeof data === 'string' && data.length > MAX_UPLOAD_B64) {
    return res.status(413).json({ error: 'File too large (max 10MB)' });
  }

  const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');

  const docId = `doc_${crypto.randomUUID()}`;
  const docDir = getCustomerDocDir(customerId);
  const filePath = path.join(docDir, docId);
  // Verify resolved path is within DOCUMENTS_DIR to prevent traversal
  if (!path.resolve(filePath).startsWith(path.resolve(DOCUMENTS_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save file' });
  }

  const meta = readCustomerDocMeta(customerId);
  const docRecord = {
    id: docId,
    fileName: safeFileName,
    fileType: fileType || 'application/octet-stream',
    docCategory: docCategory || 'Other',
    size: Buffer.byteLength(data, 'base64'),
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user.sub,
    uploadedByName: req.user.name
  };
  meta.push(docRecord);
  writeCustomerDocMeta(customerId, meta);

  res.status(201).json({ document: docRecord });
});

// DELETE /api/documents/:customerId/:docId
app.delete('/api/documents/:customerId/:docId', (req, res) => {
  const { customerId, docId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(customerId) || !/^[a-zA-Z0-9_-]+$/.test(docId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const meta = readCustomerDocMeta(customerId);
  const idx = meta.findIndex((d) => d.id === docId);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(DOCUMENTS_DIR, customerId, docId);
  // Verify resolved path is within DOCUMENTS_DIR to prevent traversal
  if (!path.resolve(filePath).startsWith(path.resolve(DOCUMENTS_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to delete document file:', err);
    }
  }

  meta.splice(idx, 1);
  writeCustomerDocMeta(customerId, meta);
  res.json({ success: true });
});

// GET /api/documents/:customerId/:docId/download
app.get('/api/documents/:customerId/:docId/download', (req, res) => {
  const { customerId, docId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(customerId) || !/^[a-zA-Z0-9_-]+$/.test(docId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const meta = readCustomerDocMeta(customerId);
  const doc = meta.find((d) => d.id === docId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(DOCUMENTS_DIR, customerId, docId);
  // Verify resolved path is within DOCUMENTS_DIR to prevent traversal
  if (!path.resolve(filePath).startsWith(path.resolve(DOCUMENTS_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
  res.setHeader('Content-Type', doc.fileType || 'application/octet-stream');
  res.sendFile(filePath);
});

// ─── Pipeline advanced report (with projected funding dates) ─────────────────

function calcProjectedFundingDate(status) {
  const FUNDING_OFFSETS = {
    'App Submitted': 0,
    'Approved': 7,
    'Pending Conditions': 14,
    'Ready to Close': 21,
    'Appraisal': 14,
    'Docs Ordered': 10,
    'Closed Pending Delivery': 30,
    'Delivered Pending Funding': 5,
    'Funded': 0,
    'Trimout Pending': 15,
    'Trimmed Out Pending Addl Work': 10,
    'Completed': 7,
    'Closed': 0
  };
  const offset = FUNDING_OFFSETS[status];
  if (offset === undefined) return null;
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function fundingMonthLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  // Parse as UTC components to avoid timezone shifting the month
  const [year, month] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

app.get('/api/pipeline/advanced-report', authMiddleware, (req, res) => {
  const customers = readActiveCustomers();
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const visible = isAdmin ? customers : customers.filter((c) => c.owner === req.user.sub);

  const enriched = visible.map((c) => {
    const projectedFundingDate = calcProjectedFundingDate(c.status);
    const fundingMonth = fundingMonthLabel(projectedFundingDate);
    const cl = c.checklist || {};
    const checklistSummary = {
      conditionsCleared: Boolean(cl.conditionsMet),
      landInspected: Boolean(cl.siteInspection),
      deliveryInspection: Boolean(cl.survey),
      closed: Boolean(cl.title),
      delivered: Boolean(cl.deedLandContract),
      funded: c.status === 'Funded' || c.status === 'Completed' || c.status === 'Closed',
      completed: c.status === 'Completed' || c.status === 'Closed',
      closedFinal: c.status === 'Closed'
    };
    const completedCount = Object.values(checklistSummary).filter(Boolean).length;
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      status: c.status,
      lender: c.lender,
      loanType: c.loanType || null,
      modelName: c.modelName || null,
      modelFactory: c.modelFactory || null,
      homeName: c.homeName || null,
      ordered: Boolean(c.ordered),
      specced: Boolean(c.specced),
      estGrossProfit: c.estGrossProfit || 0,
      projectedFundingDate,
      fundingMonth,
      checklistSummary,
      completionPct: Math.round((completedCount / 8) * 100),
      ownerName: c.ownerName,
      createdAt: c.createdAt
    };
  });

  // Group by funding month
  const monthOrder = {};
  enriched.forEach((c) => {
    if (!monthOrder[c.fundingMonth]) monthOrder[c.fundingMonth] = [];
    monthOrder[c.fundingMonth].push(c);
  });

  // Sort months chronologically using the earliest projected funding date in each group
  const sortedMonths = Object.keys(monthOrder).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    const dateA = monthOrder[a].map((c) => c.projectedFundingDate).filter(Boolean).sort()[0] || '';
    const dateB = monthOrder[b].map((c) => c.projectedFundingDate).filter(Boolean).sort()[0] || '';
    return dateA.localeCompare(dateB);
  });

  res.json({
    months: sortedMonths.map((month) => ({
      month,
      customers: monthOrder[month],
      total: monthOrder[month].length
    }))
  });
});

// ─── Pipeline monthly report ──────────────────────────────────────────────────

app.get('/api/pipeline/monthly', authMiddleware, (req, res) => {
  const customers = readActiveCustomers();
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);

  const visible = isAdmin ? customers : customers.filter((c) => c.owner === req.user.sub);

  const monthMap = {};
  visible.forEach((c) => {
    const month = c.monthYear || 'Unknown';
    if (!monthMap[month]) monthMap[month] = {};
    const status = c.status || 'Unknown';
    monthMap[month][status] = (monthMap[month][status] || 0) + 1;
  });

  const months = Object.keys(monthMap).sort((a, b) => {
    const da = new Date(a + ' 1');
    const db = new Date(b + ' 1');
    return isNaN(db) - isNaN(da) || db - da;
  });

  res.json({
    months: months.map((month) => ({
      month,
      statusCounts: monthMap[month],
      total: Object.values(monthMap[month]).reduce((s, n) => s + n, 0)
    }))
  });
});

// ─── Deal Pipeline ────────────────────────────────────────────────────────────

app.use('/api/deal-pipeline', authMiddleware);

app.get('/api/deal-pipeline', (req, res) => {
  const deals = readDealPipeline();
  res.json(deals);
});

app.post('/api/deal-pipeline', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

  const { salesperson, customerName, homeModel, price, lender, dealStatus, month, homeType, notes, conditionsCleared } = req.body;
  if (!customerName || !customerName.trim()) return res.status(400).json({ error: 'customerName is required' });

  const deals = readDealPipeline();
  const now = new Date().toISOString();
  const newDeal = {
    id: `dp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    salesperson: (salesperson || '').trim(),
    customerName: customerName.trim(),
    homeModel: (homeModel || '').trim(),
    price: Number(price) || 0,
    lender: (lender || '').trim(),
    dealStatus: (dealStatus || '').trim(),
    month: (month || '').trim(),
    homeType: (homeType || '').trim(),
    notes: (notes || '').trim(),
    conditionsCleared: conditionsCleared === true || conditionsCleared === 'true',
    createdBy: req.user.sub,
    createdByName: userRecord ? userRecord.name : '',
    createdAt: now,
    updatedAt: now
  };
  deals.push(newDeal);
  writeDealPipeline(deals);
  res.status(201).json(newDeal);
});

app.put('/api/deal-pipeline/:id', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

  const deals = readDealPipeline();
  const idx = deals.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deal not found' });

  const { salesperson, customerName, homeModel, price, lender, dealStatus, month, homeType, notes, conditionsCleared } = req.body;
  deals[idx] = {
    ...deals[idx],
    salesperson: salesperson !== undefined ? (salesperson || '').trim() : deals[idx].salesperson,
    customerName: customerName !== undefined ? customerName.trim() : deals[idx].customerName,
    homeModel: homeModel !== undefined ? (homeModel || '').trim() : deals[idx].homeModel,
    price: price !== undefined ? (Number(price) || 0) : deals[idx].price,
    lender: lender !== undefined ? (lender || '').trim() : deals[idx].lender,
    dealStatus: dealStatus !== undefined ? (dealStatus || '').trim() : deals[idx].dealStatus,
    month: month !== undefined ? (month || '').trim() : deals[idx].month,
    homeType: homeType !== undefined ? (homeType || '').trim() : deals[idx].homeType,
    notes: notes !== undefined ? (notes || '').trim() : deals[idx].notes,
    conditionsCleared: conditionsCleared !== undefined ? (conditionsCleared === true || conditionsCleared === 'true') : (deals[idx].conditionsCleared || false),
    updatedAt: new Date().toISOString()
  };
  writeDealPipeline(deals);
  res.json(deals[idx]);
});

app.delete('/api/deal-pipeline/:id', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

  const deals = readDealPipeline();
  const idx = deals.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deal not found' });
  deals.splice(idx, 1);
  writeDealPipeline(deals);
  res.json({ success: true });
});

// ─── Deal Trackers ────────────────────────────────────────────────────────────

app.use('/api/deal-trackers', authMiddleware);

app.get('/api/deal-trackers', (req, res) => {
  const trackers = readDealTrackers();
  res.json({ trackers });
});

app.post('/api/deal-trackers', (req, res) => {
  const trackers = readDealTrackers();
  const now = new Date().toISOString();
  const tracker = {
    id: `dt_${crypto.randomUUID()}`,
    createdBy: req.user.sub,
    createdByName: req.user.name,
    createdAt: now,
    updatedAt: now,
    master: req.body.master || {},
    bidRequest: req.body.bidRequest || {},
    cocs: req.body.cocs || {},
    commissionPricing: req.body.commissionPricing || {},
    estimateSheet: req.body.estimateSheet || {}
  };
  trackers.unshift(tracker);
  writeDealTrackers(trackers);
  res.status(201).json({ tracker });
});

app.get('/api/deal-trackers/:id', (req, res) => {
  const trackers = readDealTrackers();
  const tracker = trackers.find((t) => t.id === req.params.id);
  if (!tracker) return res.status(404).json({ error: 'Deal tracker not found' });
  res.json({ tracker });
});

app.put('/api/deal-trackers/:id', (req, res) => {
  const trackers = readDealTrackers();
  const idx = trackers.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deal tracker not found' });
  trackers[idx] = {
    ...trackers[idx],
    master: req.body.master !== undefined ? req.body.master : trackers[idx].master,
    bidRequest: req.body.bidRequest !== undefined ? req.body.bidRequest : trackers[idx].bidRequest,
    cocs: req.body.cocs !== undefined ? req.body.cocs : trackers[idx].cocs,
    commissionPricing: req.body.commissionPricing !== undefined ? req.body.commissionPricing : trackers[idx].commissionPricing,
    estimateSheet: req.body.estimateSheet !== undefined ? req.body.estimateSheet : trackers[idx].estimateSheet,
    updatedAt: new Date().toISOString()
  };
  writeDealTrackers(trackers);
  res.json({ tracker: trackers[idx] });
});

app.delete('/api/deal-trackers/:id', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  const trackers = readDealTrackers();
  const idx = trackers.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deal tracker not found' });
  if (!isAdmin && trackers[idx].createdBy !== req.user.sub) {
    return res.status(403).json({ error: 'Only the creator or admin can delete this record' });
  }
  trackers.splice(idx, 1);
  writeDealTrackers(trackers);
  res.json({ success: true });
});

// ─── Dealer Applications ─────────────────────────────────────────────────────

app.use('/api/dealer-applications', authMiddleware);

app.get('/api/dealer-applications', (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  if (!isAdminUser(userRecord)) return res.status(403).json({ error: 'Admin access required' });
  const apps = readDealerApps();
  res.json({ applications: apps });
});

app.post('/api/dealer-applications', async (req, res) => {
  const apps = readDealerApps();
  const now = new Date().toISOString();
  const application = {
    id: `app_${crypto.randomUUID()}`,
    submittedBy: req.user.sub,
    submittedByName: req.user.name,
    submittedAt: now,
    ...req.body
  };
  apps.unshift(application);
  writeDealerApps(apps);

  // Notify management asynchronously (don't block the response)
  notifyManagementOfSubmission(application).catch((err) =>
    console.error('[NOTIFY] Management notification failed:', err)
  );

  res.status(201).json({ application });
});

// POST /api/dealer-applications/:id/docusign — send application for DocuSign signature
app.post('/api/dealer-applications/:id/docusign', async (req, res) => {
  const apps = readDealerApps();
  const idx = apps.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });

  const application = apps[idx];
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  const isAdmin = isAdminUser(userRecord);
  if (application.submittedBy !== req.user.sub && !isAdmin) {
    return res.status(403).json({ error: 'Only the application creator or admin can send for signature' });
  }

  if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_SECRET_KEY || !DOCUSIGN_ACCOUNT_ID) {
    return res.status(503).json({ error: 'DocuSign is not configured. Please set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_SECRET_KEY, and DOCUSIGN_ACCOUNT_ID environment variables.' });
  }

  try {
    const accessToken = await getDocusignAccessToken();
    const b = application.borrower || {};
    const signerName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Applicant';
    const signerEmail = b.email || req.user.email || '';
    if (!signerEmail) {
      return res.status(400).json({ error: 'Borrower email is required to send for DocuSign signature' });
    }

    const docBase64 = buildApplicationDocumentBase64(application);
    const envelopeBody = {
      emailSubject: 'Please sign your Manufactured Home Application',
      documents: [
        {
          documentBase64: docBase64,
          name: 'Application',
          fileExtension: 'txt',
          documentId: '1'
        }
      ],
      recipients: {
        signers: [
          {
            email: signerEmail,
            name: signerName,
            recipientId: '1',
            tabs: {
              signHereTabs: [
                { anchorString: 'Borrower Signature:', anchorUnits: 'pixels', anchorXOffset: '200', anchorYOffset: '-5' }
              ],
              dateSignedTabs: [
                { anchorString: 'Borrower Signature:', anchorUnits: 'pixels', anchorXOffset: '370', anchorYOffset: '-5' }
              ]
            }
          }
        ]
      },
      status: 'sent'
    };

    const urlPath = `/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`;
    const result = await docusignRequest('POST', urlPath, envelopeBody, accessToken);

    if (result.status !== 201) {
      return res.status(502).json({ error: 'DocuSign API error', details: result.data });
    }

    const envelopeId = result.data.envelopeId;
    const now = new Date().toISOString();

    let signingUrl = null;
    const returnUrl = req.body.returnUrl || `${process.env.APP_URL || 'http://localhost:3001'}/docusign-complete`;
    const viewBody = {
      returnUrl,
      authenticationMethod: 'none',
      email: signerEmail,
      userName: signerName,
      recipientId: '1'
    };
    const viewPath = `/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/views/recipient`;
    const viewResult = await docusignRequest('POST', viewPath, viewBody, accessToken);
    if (viewResult.status === 201 && viewResult.data.url) {
      signingUrl = viewResult.data.url;
    }

    apps[idx] = { ...application, docusignEnvelopeId: envelopeId, docusignStatus: 'sent', docusignSentAt: now, docusignSigningUrl: signingUrl, updatedAt: now };
    writeDealerApps(apps);

    res.json({ envelopeId, signingUrl, status: 'sent' });
  } catch (err) {
    console.error('DocuSign error:', err);
    res.status(500).json({ error: err.message || 'Failed to send DocuSign envelope' });
  }
});

// GET /api/dealer-applications/:id/docusign/status — poll envelope status
app.get('/api/dealer-applications/:id/docusign/status', async (req, res) => {
  const apps = readDealerApps();
  const application = apps.find((a) => a.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  if (!application.docusignEnvelopeId) {
    return res.json({ status: 'not_sent', envelopeId: null });
  }

  if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_SECRET_KEY || !DOCUSIGN_ACCOUNT_ID) {
    return res.json({ status: application.docusignStatus || 'unknown', envelopeId: application.docusignEnvelopeId });
  }

  try {
    const accessToken = await getDocusignAccessToken();
    const urlPath = `/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${application.docusignEnvelopeId}`;
    const result = await docusignRequest('GET', urlPath, null, accessToken);
    if (result.status === 200) {
      const liveStatus = result.data.status;
      const appIdx = apps.findIndex((a) => a.id === req.params.id);
      if (appIdx !== -1 && liveStatus) {
        apps[appIdx].docusignStatus = liveStatus;
        apps[appIdx].updatedAt = new Date().toISOString();
        writeDealerApps(apps);
      }
      return res.json({ status: liveStatus, envelopeId: application.docusignEnvelopeId, signingUrl: application.docusignSigningUrl });
    }
    res.json({ status: application.docusignStatus || 'unknown', envelopeId: application.docusignEnvelopeId });
  } catch (err) {
    console.error('DocuSign status error:', err);
    res.json({ status: application.docusignStatus || 'unknown', envelopeId: application.docusignEnvelopeId });
  }
});

// ─── Closing Docs ─────────────────────────────────────────────────────────────

app.use('/api/closing-docs', authMiddleware);

app.get('/api/closing-docs/:customerId', (req, res) => {
  const docs = readClosingDocs();
  res.json({ closingDocs: docs[req.params.customerId] || {} });
});

app.put('/api/closing-docs/:customerId', (req, res) => {
  const docs = readClosingDocs();
  docs[req.params.customerId] = req.body.checklist || {};
  writeClosingDocs(docs);
  res.json({ closingDocs: docs[req.params.customerId] });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', authMiddleware, (req, res) => {
  res.json({ settings: readSettings() });
});

app.put('/api/settings', authMiddleware, adminMiddleware, (req, res) => {
  const current = readSettings();
  const updated = { ...current };
  if (req.body.calcUrl !== undefined) updated.calcUrl = String(req.body.calcUrl || '').trim();
  writeSettings(updated);
  res.json({ settings: updated });
});

// ─── Push Notification Routes ──────────────────────────────────────────────────

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY || null });
});

app.post('/api/push/subscribe', authMiddleware, (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'subscription object with endpoint required' });
  }
  const subs = readPushSubscriptions();
  const userId = req.user.sub;
  if (!subs[userId]) subs[userId] = [];
  const exists = subs[userId].some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs[userId].push(subscription);
    writePushSubscriptions(subs);
  }
  res.json({ success: true });
});

app.delete('/api/push/unsubscribe', authMiddleware, (req, res) => {
  const { endpoint } = req.body;
  const subs = readPushSubscriptions();
  const userId = req.user.sub;
  if (subs[userId]) {
    subs[userId] = subs[userId].filter((s) => s.endpoint !== endpoint);
    writePushSubscriptions(subs);
  }
  res.json({ success: true });
});

// ─── User profile routes ───────────────────────────────────────────────────────

app.get('/api/users/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  if (!userRecord) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _h, ...safeUser } = userRecord;
  res.json({ user: safeUser });
});

app.put('/api/users/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const userRecord = Object.values(users).find((u) => u.id === req.user.sub);
  if (!userRecord) return res.status(404).json({ error: 'User not found' });

  const { phoneNumber, smsOptIn, name } = req.body;
  if (phoneNumber !== undefined) {
    const cleaned = String(phoneNumber).replace(/[^\d+]/g, '');
    userRecord.phoneNumber = cleaned || null;
  }
  if (smsOptIn !== undefined) userRecord.smsOptIn = Boolean(smsOptIn);
  if (name !== undefined && typeof name === 'string' && name.trim()) {
    userRecord.name = name.trim();
  }

  users[userRecord.email] = userRecord;
  writeUsers(users);

  const { passwordHash: _h, ...safeUser } = userRecord;
  res.json({ user: safeUser });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Document upload/download ─────────────────────────────────────────────────

app.use('/api/documents', require('./routes/documents'));

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

// Only listen when this file is run directly (not when required for testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ CRM server running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${NODE_ENV}`);
    console.log(`🔐 Auth: JWT (${JWT_SECRET === 'dev-only-secret-change-in-production' ? 'default secret' : 'custom secret'})`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
  });
}

// Export for testing
module.exports = {
  app,
  hasManagementAccess,
  getManagementUsers,
  notifyManagementOfSubmission,
  readUsers,
  readTasks,
  readDealerApps,
  writeTasks,
  writeDealerApps,
  writeUsers,
  isAdminUser,
  MORTGAGE_21ST_URL,
  buildApplicationDocumentBase64
};
