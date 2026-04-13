'use strict';

/**
 * PostgreSQL database layer.
 *
 * When DATABASE_URL is set the app uses PostgreSQL as its primary data store.
 * A synchronous in-memory cache is kept so that all existing synchronous
 * read helpers in server.js continue to work without modification.
 *
 * When DATABASE_URL is NOT set the module is a no-op and the server falls
 * back to JSON file storage (the default development behaviour).
 */

const { Pool } = require('pg');

let pool = null;

/** Returns true when DATABASE_URL is configured. */
function isConfigured() {
  return !!process.env.DATABASE_URL;
}

/** Lazy-initialises (once) and returns the connection pool. */
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

/** Executes a parameterised SQL query. Throws if no pool is available. */
async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('Database not configured – set DATABASE_URL');
  return p.query(text, params);
}

/**
 * Creates all required tables and indexes (idempotent – uses IF NOT EXISTS).
 * Returns true on success, false on failure.
 */
async function initializeSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        name          TEXT,
        password_hash TEXT NOT NULL,
        is_admin      BOOLEAN     NOT NULL DEFAULT false,
        role          TEXT        NOT NULL DEFAULT 'phc',
        active        BOOLEAN     NOT NULL DEFAULT true,
        page_permissions JSONB,
        phone         TEXT,
        sms_notifications BOOLEAN DEFAULT false,
        push_subscription JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id          TEXT PRIMARY KEY,
        data        JSONB        NOT NULL,
        lead_owner  TEXT,
        status      TEXT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      -- Generic key-value store for all other JSON data files
      -- (tasks, contacts, activeCustomers, dealPipeline, etc.)
      CREATE TABLE IF NOT EXISTS kv_store (
        key         TEXT PRIMARY KEY,
        value       JSONB        NOT NULL,
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_lead_owner ON leads (lead_owner);
      CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads (status);
      CREATE INDEX IF NOT EXISTS idx_users_email       ON users (email);
    `);

    console.log('[DB] Schema initialised');
    return true;
  } catch (err) {
    console.error('[DB] Schema initialisation failed:', err.message);
    return false;
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

/** Load all users from PostgreSQL and return them as the {email: userObj} map
 *  that server.js already expects.  Returns null if nothing is in the DB yet. */
async function loadUsersFromDb() {
  const result = await query('SELECT * FROM users ORDER BY created_at');
  if (result.rows.length === 0) return null;

  const users = {};
  for (const row of result.rows) {
    users[row.email] = {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      isAdmin: row.is_admin,
      role: row.role,
      active: row.active,
      pagePermissions: row.page_permissions || null,
      phone: row.phone || null,
      smsNotifications: row.sms_notifications || false,
      pushSubscription: row.push_subscription || null,
    };
  }
  return users;
}

/** Persist the full users map to PostgreSQL (upsert each user). */
async function saveUsersToDb(users) {
  const entries = Object.values(users);
  if (entries.length === 0) return;

  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    for (const u of entries) {
      await client.query(
        `INSERT INTO users
           (id, email, name, password_hash, is_admin, role, active,
            page_permissions, phone, sms_notifications, push_subscription, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
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
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Leads ────────────────────────────────────────────────────────────────────

/** Load all leads from PostgreSQL as a flat array.
 *  Returns null if nothing is in the DB yet. */
async function loadLeadsFromDb() {
  const result = await query('SELECT data FROM leads ORDER BY created_at');
  if (result.rows.length === 0) return null;
  return result.rows.map((r) => r.data);
}

/** Persist the full leads array to PostgreSQL (upsert each lead). */
async function saveLeadsToDb(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return;

  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // Delete leads that are no longer present (handles deletes)
    const ids = leads.map((l) => l.id).filter(Boolean);
    if (ids.length > 0) {
      await client.query(
        `DELETE FROM leads WHERE id != ALL($1::text[])`,
        [ids]
      );
    } else {
      await client.query('DELETE FROM leads');
    }

    for (const lead of leads) {
      if (!lead.id) continue;
      await client.query(
        `INSERT INTO leads (id, data, lead_owner, status, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET
           data       = EXCLUDED.data,
           lead_owner = EXCLUDED.lead_owner,
           status     = EXCLUDED.status,
           updated_at = NOW()`,
        [lead.id, JSON.stringify(lead), lead.leadOwner || null, lead.status || null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Generic KV store ─────────────────────────────────────────────────────────

/** Read a named collection from the kv_store table.
 *  Returns null if the key does not exist. */
async function kvGet(key) {
  const result = await query('SELECT value FROM kv_store WHERE key = $1', [key]);
  if (result.rows.length === 0) return null;
  return result.rows[0].value;
}

/** Write a value to the kv_store table (upsert). */
async function kvSet(key, value) {
  await query(
    `INSERT INTO kv_store (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

module.exports = {
  isConfigured,
  getPool,
  query,
  initializeSchema,
  loadUsersFromDb,
  saveUsersToDb,
  loadLeadsFromDb,
  saveLeadsToDb,
  kvGet,
  kvSet,
};
