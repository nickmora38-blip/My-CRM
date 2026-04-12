# Deployment Instructions for My-CRM

This document outlines the steps necessary to deploy the My-CRM application to Render, including setup for push notifications and SMS.

## Prerequisites
- GitHub account with the My-CRM repository
- Render account (sign up at [Render](https://render.com))

## Steps to Deploy

### 1. Push your code to GitHub
Ensure your latest code is pushed to the `main` branch:
```bash
git push origin main
```

### 2. Build the client before deploying
The React client must be built before the server can serve it:
```bash
cd client && npm install && npm run build
cd ..
git add public/ && git commit -m "Build client" && git push
```

### 3. Create a Web Service on Render
- Go to the [Render Dashboard](https://dashboard.render.com)
- Click **"New +"** and select **"Web Service"**
- Connect your GitHub repository (`nickmora38-blip/My-CRM`)
- Select the `main` branch

### 4. Configure the Service
Use the following settings:
- **Name**: `my-crm`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free (or paid if preferred)

### 5. Set Environment Variables
In the **"Environment"** section, add the following variables:

| Variable | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | Generate a random secret (32+ chars) | ✅ |
| `VAPID_PUBLIC_KEY` | See below | For push notifications |
| `VAPID_PRIVATE_KEY` | See below | For push notifications |
| `VAPID_SUBJECT` | `mailto:you@yourdomain.com` | For push notifications |
| `TWILIO_ACCOUNT_SID` | From Twilio console | For SMS |
| `TWILIO_AUTH_TOKEN` | From Twilio console | For SMS |
| `TWILIO_FROM_NUMBER` | E.g. `+15551234567` | For SMS |
| `SMTP_HOST` | E.g. `smtp.sendgrid.net` | For email |
| `SMTP_PORT` | `587` | For email |
| `SMTP_USER` | SMTP username | For email |
| `SMTP_PASS` | SMTP password | For email |

> **Note:** `PORT` is automatically provided by Render — do not set it manually.

### 6. Deploy
Click **"Create Web Service"**. Render will automatically build and deploy your application.

---

## Setting Up Push Notifications (PWA)

### Generate VAPID Keys
Run this once locally:
```bash
npx web-push generate-vapid-keys
```

Copy the output `Public Key` and `Private Key` into your Render environment variables:
- `VAPID_PUBLIC_KEY` = the public key
- `VAPID_PRIVATE_KEY` = the private key
- `VAPID_SUBJECT` = `mailto:your-email@domain.com`

### Enable on User Devices
1. Open the CRM in a browser (Chrome, Edge, or Firefox recommended)
2. Navigate to **Profile & Notifications**
3. Click **"Enable Push Notifications"**
4. Accept the browser permission prompt

On iOS, users must first **"Add to Home Screen"** (via Safari Share menu), then open the installed PWA and enable push from the Profile page.

### How it works
- When a task is created and assigned to a user, they receive an instant push notification
- 5 minutes before any task is due, the assigned user receives a "due soon" reminder
- Notifications are only sent once per task (deduplicated via `dueSoonNotifiedAt`)

---

## Setting Up SMS Notifications (Twilio)

### Create a Twilio Account
1. Sign up at [twilio.com](https://www.twilio.com)
2. Get a phone number from the Twilio console
3. Note your **Account SID** and **Auth Token**

### Configure Environment Variables
Set the following in Render:
- `TWILIO_ACCOUNT_SID` = your Account SID
- `TWILIO_AUTH_TOKEN` = your Auth Token
- `TWILIO_FROM_NUMBER` = your Twilio phone number (E.164 format: `+15551234567`)

### Enable Per-User
1. Each user navigates to **Profile & Notifications**
2. Enter their phone number in E.164 format (e.g., `+15551234567`)
3. Toggle **"Receive SMS notifications"** to on
4. Save changes

Users will then receive SMS for:
- Task assignment: when a task is assigned to them
- Due-soon reminder: 5 minutes before a task is due

---

## Scheduler / Background Processing

The server runs a background scheduler every 60 seconds that:
1. Checks for tasks due in the next 5 minutes
2. Sends push notifications and SMS to the assigned user (once per task)
3. Processes auto-campaign tasks (mark-dead, drip enrollment)

> **Note on Render Free Tier:** Render free instances spin down after 15 minutes of inactivity. This means the scheduler may miss notifications if the server is sleeping. For reliable notifications, use a paid Render instance or upgrade to a plan that keeps the server always-on.

---

## Monitoring
- Your app will be live at the URL provided by Render (e.g., `https://my-crm.onrender.com`)
- View logs and deployment status in the Render dashboard
- The `/health` endpoint (`GET /health`) can be used to verify the service is running
