'use strict';

const path = require('path');
const os = require('os');

// Desktop data directory – override via DATA_DIR_OVERRIDE env var (used in tests)
const desktopPath = path.join(os.homedir(), 'Desktop', 'CRM-Data');
const DATA_DIR = process.env.DATA_DIR_OVERRIDE || desktopPath;

const config = {
  // Data persistence paths
  dataDir: DATA_DIR,
  leadsDir: path.join(DATA_DIR, 'leads'),
  documentsDir: path.join(DATA_DIR, 'documents'),
  customersDir: path.join(DATA_DIR, 'customers'),
  backupsDir: path.join(DATA_DIR, 'backups'),

  // Data files
  leadsFile: path.join(DATA_DIR, 'leads.json'),
  dealPipelineFile: path.join(DATA_DIR, 'dealPipeline.json'),
  dealTrackersFile: path.join(DATA_DIR, 'dealTrackers.json'),
  usersFile: path.join(DATA_DIR, 'users.json'),
  settingsFile: path.join(DATA_DIR, 'settings.json'),
  tasksFile: path.join(DATA_DIR, 'tasks.json'),
  contactsFile: path.join(DATA_DIR, 'contacts.json'),
  activeCustomersFile: path.join(DATA_DIR, 'activeCustomers.json'),
  dealerAppsFile: path.join(DATA_DIR, 'dealerApplications.json'),
  closingDocsFile: path.join(DATA_DIR, 'closingDocs.json'),
  emailTemplatesFile: path.join(DATA_DIR, 'emailTemplates.json'),
  pushSubscriptionsFile: path.join(DATA_DIR, 'pushSubscriptions.json'),

  // Server config
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = config;
