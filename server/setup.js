'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Repository seed data lives alongside this file in server/data/
const REPO_DATA_DIR = path.join(__dirname, 'data');

// Files to seed from the repository data directory when the active file is empty
const SEED_FILES = [
  { name: 'dealPipeline.json', configKey: 'dealPipelineFile' },
  { name: 'activeCustomers.json', configKey: 'activeCustomersFile' },
  { name: 'contacts.json', configKey: 'contactsFile' },
];

function ensureDirectories() {
  const dirs = [
    config.dataDir,
    config.leadsDir,
    config.documentsDir,
    config.customersDir,
    config.backupsDir,
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    }
  });
}

function initializeDataFiles() {
  const files = [
    { path: config.leadsFile, default: [] },
    { path: config.dealPipelineFile, default: [] },
    { path: config.dealTrackersFile, default: [] },
    { path: config.tasksFile, default: [] },
    { path: config.contactsFile, default: [] },
    { path: config.activeCustomersFile, default: [] },
    { path: config.dealerAppsFile, default: [] },
    { path: config.closingDocsFile, default: {} },
    { path: config.emailTemplatesFile, default: [] },
    { path: config.pushSubscriptionsFile, default: {} },
    { path: config.usersFile, default: [] },
    { path: config.settingsFile, default: { calcUrl: 'https://www.21stmortgage.com/web/21stsite.nsf/calculators#mortgage-calculator' } },
  ];

  files.forEach((file) => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2));
      console.log(`✓ Initialized: ${path.basename(file.path)}`);
    }
  });
}

/**
 * Seed active data files from the repository JSON files when the active file
 * is empty (i.e. just initialized or wiped by ephemeral storage on Render).
 * Pass force=true to overwrite existing data (used by the admin reseed endpoint).
 * Returns the number of files that were seeded.
 */
function seedDataFiles({ force = false } = {}) {
  let seeded = 0;

  const isEmpty = (d) => (Array.isArray(d) ? d.length === 0 : Object.keys(d).length === 0);

  SEED_FILES.forEach(({ name, configKey }) => {
    const srcPath = path.join(REPO_DATA_DIR, name);
    const destPath = config[configKey];

    if (!fs.existsSync(srcPath)) return;

    let srcData;
    try {
      srcData = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    } catch (e) {
      console.warn(`⚠️  Could not parse seed file ${name}: ${e.message}`);
      return;
    }

    if (isEmpty(srcData)) return;

    let destData;
    try {
      destData = JSON.parse(fs.readFileSync(destPath, 'utf8'));
    } catch {
      destData = Array.isArray(srcData) ? [] : {};
    }

    if (force || isEmpty(destData)) {
      fs.writeFileSync(destPath, JSON.stringify(srcData, null, 2));
      console.log(`✓ Seeded ${name} with ${Array.isArray(srcData) ? srcData.length : Object.keys(srcData).length} record(s) from repository`);
      seeded++;
    }
  });

  return seeded;
}

function setup() {
  console.log('🚀 Setting up CRM local environment...');
  console.log(`📁 Data directory: ${config.dataDir}\n`);

  try {
    ensureDirectories();
    initializeDataFiles();
    seedDataFiles();
    console.log('\n✅ Setup complete! Your CRM is ready to run.');
    console.log(`\n📊 Data stored at: ${config.dataDir}`);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setup();
}

module.exports = { setup, ensureDirectories, initializeDataFiles, seedDataFiles };
