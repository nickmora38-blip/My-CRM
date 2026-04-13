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

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3001 | Server port |
| `JWT_SECRET` | dev-only-secret-change-in-production | JWT signing key (MUST change in production) |
| `NODE_ENV` | development | Environment mode |
| `DOCUSIGN_INTEGRATION_KEY` | *(unset)* | DocuSign OAuth integration key / client ID |
| `DOCUSIGN_SECRET_KEY` | *(unset)* | DocuSign access token (or OAuth secret) |
| `DOCUSIGN_ACCOUNT_ID` | *(unset)* | DocuSign account/API account ID |
| `DOCUSIGN_BASE_URL` | `https://demo.docusign.net/restapi` | DocuSign REST API base URL (use `https://www.docusign.net/restapi` for production) |
| `APP_URL` | `http://localhost:3001` | Base URL of this application (used for DocuSign return URLs) |

## DocuSign Setup

1. **Create a DocuSign Developer Account** at [https://developers.docusign.com](https://developers.docusign.com).
2. **Create an Integration Key (App)** in the DocuSign Admin console under **Settings → Apps and Keys**.
3. **Generate an Access Token** for testing via **User Settings → Generate Access Token** in the DocuSign sandbox.
4. **Get your Account ID** from the DocuSign Admin dashboard or the REST API.
5. **Set environment variables:**
   ```bash
   export DOCUSIGN_INTEGRATION_KEY=your-integration-key
   export DOCUSIGN_SECRET_KEY=your-access-token
   export DOCUSIGN_ACCOUNT_ID=your-account-id
   ```
6. **Using the DocuSign feature:** Submit a Dealer Application, then admin users can click **📋 View Apps** and **📤 Send for DocuSign** to create a signing envelope. The borrower receives a DocuSign signing invitation.

> **Note:** When `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`, and `DOCUSIGN_ACCOUNT_ID` are not set, the endpoint returns `503` gracefully.

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
2. **Set NODE_ENV=production** for Heroku
3. **Use HTTPS** (Heroku provides this by default)
4. **Consider real database** for production data persistence
5. **Add rate limiting** before production launch
6. **Implement user registration** if multi-tenant (currently demo users only)

## Troubleshooting

**"Invalid token" error:**
- Ensure `JWT_SECRET` matches between requests
- Token may have expired (12hr limit)
- Re-login to get fresh token

**Leads not persisting:**
- Check file permissions on `server/data/leads.json`
- Ensure write access to `server/data/` directory
- On Heroku, use a persistent database instead of file storage

**Port in use:**
- Change `PORT` environment variable
- Or kill existing process on port 3001

## License

ISC
