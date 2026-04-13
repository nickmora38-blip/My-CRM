#!/usr/bin/env node
'use strict';

/**
 * One-time migration script: JSON files → PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=postgres://... node server/db/migrate.js
 *
 * The script is safe to re-run; all inserts use ON CONFLICT DO UPDATE so
 * existing rows are updated rather than duplicated.
 *
 * What is migrated:
 *   - users.json     → users table
 *   - leads.json     → leads table
 *   - tasks.json     → kv_store (key = "tasks")
 *   - contacts.json  → kv_store (key = "contacts")
 *   - activeCustomers.json    → kv_store (key = "activeCustomers")
 *   - dealPipeline.json       → kv_store (key = "dealPipeline")
 *   - dealTrackers.json       → kv_store (key = "dealTrackers")
 *   - dealerApplications.json → kv_store (key = "dealerApplications")
 *   - closingDocs.json        → kv_store (key = "closingDocs")
 *   - emailTemplates.json     → kv_store (key = "emailTemplates")
 *   - settings.json           → kv_store (key = "settings")
 */

const fs   = require('fs');
const path = require('path');
const db   = require('./index');

const config = require('../config');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`  ⚠ Could not parse ${path.basename(filePath)}: ${err.message}`);
    return fallback;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function migrate() {
  if (!db.isConfigured()) {
    console.error('❌  DATABASE_URL is not set.  Export it before running this script.');
    process.exit(1);
  }

  console.log('🚀 Starting migration …');
  console.log(`📁 Reading JSON files from: ${config.dataDir}\n`);

  // Initialise schema first
  const ok = await db.initializeSchema();
  if (!ok) {
    console.error('❌  Schema initialisation failed.  Check database connectivity.');
    process.exit(1);
  }

  // ── 1. Users ────────────────────────────────────────────────────────────
  console.log('→ Migrating users …');
  const usersRaw = readJsonFile(config.usersFile, {});
  const userEntries = Object.values(usersRaw);
  let userCount = 0;

  for (const u of userEntries) {
    if (!u.id || !u.email || !u.passwordHash) {
      console.warn(`  ⚠ Skipping user with missing fields: ${JSON.stringify(u)}`);
      continue;
    }
    await db.query(
      `INSERT INTO users
         (id, email, name, password_hash, is_admin, role, active,
          page_permissions, phone, sms_notifications, push_subscription)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         email             = EXCLUDED.email,
         name              = EXCLUDED.name,
         password_hash     = EXCLUDED.password_hash,
         is_admin          = EXCLUDED.is_admin,
         role              = EXCLUDED.role,
         active            = EXCLUDED.active,
         page_permissions  = EXCLUDED.page_permissions,
         phone             = EXCLUDED.phone,
         sms_notifications = EXCLUDED.sms_notifications,
         push_subscription = EXCLUDED.push_subscription,
         updated_at        = NOW()`,
      [
        u.id,
        u.email,
        u.name || null,
        u.passwordHash,
        u.isAdmin || false,
        u.role || 'phc',
        u.active !== false,
        u.pagePermissions ? JSON.stringify(u.pagePermissions) : null,
        u.phone || null,
        u.smsNotifications || false,
        u.pushSubscription ? JSON.stringify(u.pushSubscription) : null,
      ]
    );
    userCount++;
  }
  console.log(`  ✓ ${userCount} user(s) migrated`);

  // ── 2. Leads ────────────────────────────────────────────────────────────
  console.log('→ Migrating leads …');
  let leadsRaw = readJsonFile(config.leadsFile, []);

  // Handle legacy {users: {}} format
  if (leadsRaw && leadsRaw.users && !Array.isArray(leadsRaw)) {
    const flat = [];
    Object.entries(leadsRaw.users).forEach(([userId, userLeads]) => {
      if (Array.isArray(userLeads)) {
        userLeads.forEach((l) => flat.push({ ...l, leadOwner: l.leadOwner || userId }));
      }
    });
    leadsRaw = flat;
  }

  let leadCount = 0;
  for (const lead of (Array.isArray(leadsRaw) ? leadsRaw : [])) {
    if (!lead.id) continue;
    await db.query(
      `INSERT INTO leads (id, data, lead_owner, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         data       = EXCLUDED.data,
         lead_owner = EXCLUDED.lead_owner,
         status     = EXCLUDED.status,
         updated_at = NOW()`,
      [lead.id, JSON.stringify(lead), lead.leadOwner || null, lead.status || null]
    );
    leadCount++;
  }
  console.log(`  ✓ ${leadCount} lead(s) migrated`);

  // ── 3. KV collections ───────────────────────────────────────────────────
  const kvFiles = [
    { key: 'tasks',              file: config.tasksFile,          fallback: [] },
    { key: 'contacts',           file: config.contactsFile,       fallback: [] },
    { key: 'activeCustomers',    file: config.activeCustomersFile, fallback: [] },
    { key: 'dealPipeline',       file: config.dealPipelineFile,   fallback: [] },
    { key: 'dealTrackers',       file: config.dealTrackersFile,   fallback: [] },
    { key: 'dealerApplications', file: config.dealerAppsFile,     fallback: [] },
    { key: 'closingDocs',        file: config.closingDocsFile,    fallback: {} },
    { key: 'emailTemplates',     file: config.emailTemplatesFile, fallback: [] },
    { key: 'settings',           file: config.settingsFile,       fallback: {} },
  ];

  for (const { key, file, fallback } of kvFiles) {
    console.log(`→ Migrating ${key} …`);
    const value = readJsonFile(file, fallback);
    await db.kvSet(key, value);
    const count = Array.isArray(value) ? value.length : Object.keys(value).length;
    console.log(`  ✓ ${count} record(s) migrated`);
  }

  console.log('\n✅  Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
