# My CRM — Lead Management System

A full-stack web application for managing real estate leads with JWT authentication, per-user data isolation, pipeline tracking, and board/list views.

## Features

- **JWT Authentication** — Secure sign-in with bearer tokens
- **Leads API** — Full CRUD with per-user data isolation
- **List & Board Views** — Toggle between table and kanban board
- **Sortable Columns** — Click headers to sort by contact, status, value, or source
- **Pipeline Stage Bar** — Click to advance through New → Contacted → Qualified → Proposal → Won (or Mark Lost)
- **Inline Status Update** — Click status badge to change without opening full edit modal
- **CSV Export** — Download currently filtered leads
- **Lead Detail Page** — Full profile with contact info, transport details, notes, and interactive pipeline actions
- **Edit Modal** — Create/update leads with all fields including Move Date picker
- **Delete Confirmation** — Safe lead removal with confirmation dialog

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla JavaScript (SPA)
- **Database:** JSON file (server/data/leads.json) with per-user isolation
- **Auth:** JWT

## Local Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Default: http://localhost:3001
# Demo credentials: demo@crm.local / demo123
```

## Deployment to Heroku

### Prerequisites
- Heroku CLI installed
- Git repo initialized
- Heroku account

### Steps

1. **Create Heroku app:**
   ```bash
   heroku create my-crm-app
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set JWT_SECRET=your-secret-key-here
   heroku config:set PORT=5000
   ```

3. **Deploy:**
   ```bash
   git push heroku main
   ```

4. **View logs:**
   ```bash
   heroku logs --tail
   ```

5. **Open app:**
   ```bash
   heroku open
   ```

## Environment Variables

### Required for production

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing key — **MUST** be set to a strong random value in production. Use `openssl rand -hex 32` to generate one. |
| `NODE_ENV` | Set to `production` on Render/Heroku. |

### Optional — core app works without these

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3001 | Server port (Render/Heroku inject this automatically — do not set manually). |

### Optional — DocuSign features only

These vars are **only** needed for the DocuSign signing flow. The application starts normally and login works without them. Missing values cause the `POST /api/dealer-applications/:id/docusign` endpoint to return `503` rather than blocking any other functionality.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOCUSIGN_INTEGRATION_KEY` | *(unset)* | DocuSign OAuth integration key / client ID |
| `DOCUSIGN_SECRET_KEY` | *(unset)* | DocuSign access token (or OAuth secret) |
| `DOCUSIGN_ACCOUNT_ID` | *(unset)* | DocuSign account/API account ID |
| `DOCUSIGN_BASE_URL` | `https://demo.docusign.net/restapi` | DocuSign REST API base URL |
| `DOCUSIGN_USER_ID` | *(unset)* | DocuSign user ID (JWT grant flow) |
| `DOCUSIGN_PRIVATE_KEY` | *(unset)* | DocuSign RSA private key (JWT grant flow) |
| `APP_URL` | `http://localhost:3001` | Base URL used for DocuSign return URLs |

## DocuSign Setup

1. **Create a DocuSign Developer Account** at [https://developers.docusign.com](https://developers.docusign.com).

2. **Create an Integration Key (App)** in the DocuSign Admin console:
   - Go to **Settings → Apps and Keys**
   - Click **Add App and Integration Key**
   - Note the **Integration Key** (this is `DOCUSIGN_INTEGRATION_KEY`)

3. **Generate an Access Token** for testing:
   - In the DocuSign demo sandbox, go to **User Settings → Generate Access Token**
   - Copy the token; this is your `DOCUSIGN_SECRET_KEY` for initial setup

4. **Get your Account ID**:
   - From [https://demo.docusign.net/restapi/v2.1/accounts](https://demo.docusign.net/restapi/v2.1/accounts) (with your token)
   - Or from the DocuSign Admin dashboard under Account Profile

5. **Set environment variables** (local development):
   ```bash
   export DOCUSIGN_INTEGRATION_KEY=your-integration-key
   export DOCUSIGN_SECRET_KEY=your-access-token
   export DOCUSIGN_ACCOUNT_ID=your-account-id
   # Optional: use production URL when ready
   export DOCUSIGN_BASE_URL=https://www.docusign.net/restapi
   ```

6. **On Heroku / Render:**
   ```bash
   heroku config:set DOCUSIGN_INTEGRATION_KEY=your-integration-key
   heroku config:set DOCUSIGN_SECRET_KEY=your-access-token
   heroku config:set DOCUSIGN_ACCOUNT_ID=your-account-id
   ```

7. **Using the DocuSign feature**:
   - Submit a Dealer Application via the **📄 Dealer App** button
   - Admin users can view submitted applications via **📋 View Apps**
   - Click **📤 Send for DocuSign** next to any application to create a signing envelope
   - The borrower's email will receive a DocuSign signing invitation
   - Click **🔄 Refresh Status** to check the signing status
   - If an embedded signing URL is returned, a **🖊 Sign Now** link will appear

> **Note:** The application document ("Application") is auto-generated from the form data and includes all borrower, employment, property, and home selection fields. DocuSign anchor tabs place a signature field at the `Borrower Signature:` line.

## API Reference

### Authentication

**POST /api/auth/login**
```json
{
  "email": "demo@crm.local",
  "password": "demo123"
}
```

Response: `{ token, user }`

**GET /api/auth/me** (requires Bearer token)

Returns authenticated user info.

### Leads (all require Bearer token)

**GET /api/leads?status=New&source=Facebook&search=austin**

List leads with optional filters.

**GET /api/leads/:id**

Get single lead detail.

**POST /api/leads**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "555-0123",
  "email": "john@example.com",
  "homeType": "Double-wide",
  "route": "Austin -> Waco",
  "estimatedValue": 150000,
  "source": "Facebook",
  "status": "New",
  "moveDate": "2026-06-15",
  "transportDetails": "Via truck, requires escort",
  "notes": "Qualified buyer"
}
```

**PUT /api/leads/:id**

Update any combination of fields.

**DELETE /api/leads/:id**

Permanently delete lead.

## Demo Users

| Email | Password |
|-------|----------|
| demo@crm.local | demo123 |
| alex@crm.local | alex123 |

## Development Notes

- Data is persisted to `server/data/leads.json`
- Each authenticated user has isolated leads via their user ID
- No database migrations needed (file-based storage)
- JWT tokens expire after 12 hours
- For production, use a real database (PostgreSQL, MongoDB) instead of JSON file

## Project Structure

```
.
├── server/
│   ├── server.js          # Express app + JWT middleware
│   └── data/
│       └── leads.json     # User leads store
├── public/
│   ├── index.html         # SPA shell
│   ├── app.js             # Frontend logic
│   └── styles.css         # Responsive styling
├── package.json
├── Procfile               # Heroku config
└── README.md
```

## Security Notes

1. **Change JWT_SECRET** in production (use `openssl rand -hex 32`)
2. **Set NODE_ENV=production** for Heroku/Render
3. **Use HTTPS** (Render/Heroku provides this by default)
4. **Consider real database** for production data persistence
5. **Rate limiting** is enabled (200 requests per 15 minutes per IP)

## Troubleshooting

### Login screen is "stuck" / won't accept credentials

1. **Check the browser Network tab** — open DevTools → Network → look for `POST /api/auth/login`.
   - If the request is **missing**, the JavaScript may not have loaded correctly. Hard-refresh (`Ctrl+Shift+R`).
   - If it returns **401**, the credentials are wrong.
   - If it returns **4xx/5xx**, check server logs for details.
2. **Verify the server started** — check logs for `✅ CRM server running on http://localhost:PORT`.
3. **Check `JWT_SECRET`** — if you change this value between deployments, existing browser tokens become invalid. Users must log in again.
4. **DocuSign variables are NOT required for login** — the application starts and authentication works fully without any `DOCUSIGN_*` environment variables.
5. **After login still shows login screen** — this can happen if a post-login data fetch fails and an older version of the code swallowed the navigation. Ensure you are running the latest code with the `Promise.allSettled` fix.

### Test login from the command line

```bash
curl -s -X POST https://<your-domain>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@crm.local","password":"demo123"}' | python3 -m json.tool
```

You should see `{"token": "...", "user": {...}}`. If you see an error, check server logs.

### "Invalid token" error

- Ensure `JWT_SECRET` matches between requests
- Token may have expired (12 hr limit)
- Re-login to get a fresh token

### Leads not persisting

- Check file permissions on `server/data/leads.json`
- Ensure write access to `server/data/` directory
- On Heroku/Render free tier, the filesystem is ephemeral — data is lost on restart. Use a persistent database for production.

### DocuSign "Send for DocuSign" returns an error

- This feature requires `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`, and `DOCUSIGN_ACCOUNT_ID` to be set.
- If these are missing the endpoint returns `503`. Core CRM features (leads, contacts, tasks) are unaffected.

### Port in use

- Change `PORT` environment variable, or kill the existing process on port 3001.

## License

ISC
