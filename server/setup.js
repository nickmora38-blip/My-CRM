'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

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

function setup() {
  console.log('🚀 Setting up CRM local environment...');
  console.log(`📁 Data directory: ${config.dataDir}\n`);

  try {
    ensureDirectories();
    initializeDataFiles();
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

module.exports = { setup, ensureDirectories, initializeDataFiles };
