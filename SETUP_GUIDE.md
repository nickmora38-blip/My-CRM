# CRM Setup Guide

This guide explains how to run the CRM application locally with persistent data storage on your desktop.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/nickmora38-blip/My-CRM.git
cd My-CRM

# 2. Install dependencies
npm install

# 3. Start the server (setup runs automatically)
npm start
```

Open your browser at **http://localhost:3001**

## What Happens on First Run

When you run `npm start` or `npm run dev`, the server automatically:

1. Creates `~/Desktop/CRM-Data/` and its subdirectories
2. Initializes empty JSON data files for all CRM entities
3. Starts the Express server on port 3001

### Directory Structure Created

```
~/Desktop/CRM-Data/
├── leads.json              # All leads
├── contacts.json           # Converted contacts
├── activeCustomers.json    # Active customer records
├── dealTrackers.json       # Deal tracker entries
├── dealPipeline.json       # Deal pipeline stages
├── dealerApplications.json # Dealer loan applications
├── closingDocs.json        # Closing document checklists
├── emailTemplates.json     # Custom email templates
├── tasks.json              # Scheduled tasks
├── settings.json           # Application settings
├── users.json              # User accounts
├── pushSubscriptions.json  # Push notification subscriptions
├── leads/                  # Per-lead attachments
├── customers/              # Per-customer attachments
├── documents/              # Uploaded documents
└── backups/                # Automated backups
```

## Manual Setup (Optional)

To run the directory setup without starting the server:

```bash
npm run setup
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run setup then start the production server |
| `npm run dev` | Run setup then start the development server |
| `npm run setup` | Initialize data directories and files only |
| `npm run build` | Install all server dependencies |
| `npm test` | Run the test suite |

## Document Upload

Customer documents are stored in `~/Desktop/CRM-Data/documents/`. The API endpoints are:

- `POST /api/documents/upload` – Upload a document (multipart/form-data)
- `GET /api/documents/:fileName` – Download a document
- `DELETE /api/documents/:fileName` – Remove a document

All endpoints require a valid Bearer token in the `Authorization` header.

## Backups

Run the included backup script manually or schedule it via cron:

```bash
# Manual backup
bash backup.sh

# Schedule daily at 2 AM (add to crontab with `crontab -e`)
0 2 * * * /path/to/My-CRM/backup.sh >> ~/Desktop/CRM-Data/backups/backup.log 2>&1
```

Backups are saved to `~/Desktop/CRM-Data/backups/` as timestamped zip files. Backups older than 30 days are automatically removed.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `JWT_SECRET` | `dev-only-secret-change-in-production` | JWT signing secret |
| `NODE_ENV` | `development` | Runtime environment |
| `DATA_DIR_OVERRIDE` | *(unset)* | Override the data directory (used in tests) |
| `SMTP_HOST` | *(unset)* | SMTP server host for email |
| `SMTP_USER` | *(unset)* | SMTP username |
| `SMTP_PASS` | *(unset)* | SMTP password |

Create a `.env` file in the project root to set environment variables locally (never commit this file):

```env
JWT_SECRET=your-secure-secret-here
NODE_ENV=development
```

## Deploying to Render

1. Push your changes to GitHub
2. In Render, create a new **Web Service** pointing to your repository
3. Set the following:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:** `JWT_SECRET`, `NODE_ENV=production`

On Render, `DATA_DIR_OVERRIDE` is not set, so the server uses the in-container path. For persistent storage on Render, attach a **Disk** and set `DATA_DIR_OVERRIDE` to the disk mount path (e.g., `/data`).

## Development Workflow

```bash
# Make changes locally
npm run dev                  # Auto-runs setup on launch

# Data lives at ~/Desktop/CRM-Data/ across restarts

# Commit and push when ready
git add .
git commit -m "feat: your feature description"
git push
```
