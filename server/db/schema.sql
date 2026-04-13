-- My-CRM PostgreSQL Schema
-- Run this manually to inspect the schema, or use server/db/index.js which
-- calls initializeSchema() on startup to apply it automatically.

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                TEXT        PRIMARY KEY,
  email             TEXT        UNIQUE NOT NULL,
  name              TEXT,
  password_hash     TEXT        NOT NULL,
  is_admin          BOOLEAN     NOT NULL DEFAULT false,
  role              TEXT        NOT NULL DEFAULT 'phc',     -- 'admin' | 'phc'
  active            BOOLEAN     NOT NULL DEFAULT true,
  page_permissions  JSONB,                                  -- {canReviewSubmittedApplications: bool, ...}
  phone             TEXT,
  sms_notifications BOOLEAN     DEFAULT false,
  push_subscription JSONB,                                  -- Web Push subscription object
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─── Leads ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,          -- full lead document (all fields)
  lead_owner  TEXT        REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT,                          -- denormalised for quick filtering
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_lead_owner ON leads (lead_owner);
CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads (status);

-- ─── Generic KV store ────────────────────────────────────────────────────────
-- Used for tasks, contacts, activeCustomers, dealPipeline, emailTemplates,
-- dealerApplications, closingDocs, settings, pushSubscriptions, etc.

CREATE TABLE IF NOT EXISTS kv_store (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
