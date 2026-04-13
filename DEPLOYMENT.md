# Deployment Instructions for My-CRM

This document outlines the steps necessary to deploy the My-CRM application to Render.

## Prerequisites
- GitHub account with the My-CRM repository
- Render account (sign up at [Render](https://render.com))

## Steps to Deploy

1. **Push your code to GitHub**  
   Ensure your latest code is pushed to the `main` branch:
   ```bash
   git push origin main
   ```

2. **Create a Web Service on Render**  
   - Go to the [Render Dashboard](https://dashboard.render.com)
   - Click **"New +"** and select **"Web Service"**
   - Connect your GitHub repository (`nickmora38-blip/My-CRM`)
   - Select the `main` branch

3. **Configure the Service**  
   Use the following settings:
   - **Name**: `my-crm`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid if preferred)

4. **Set Environment Variables**  
   In the **"Environment"** section, add the **required** variables:

   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | Generate with `openssl rand -hex 32` — **do not leave blank** |

   > `PORT` is injected automatically by Render — do not set it manually.

   The following variables are **optional** and only needed for the DocuSign signing feature. Login and all other CRM features work without them:

   | Variable | Purpose |
   |----------|---------|
   | `DOCUSIGN_INTEGRATION_KEY` | DocuSign integration key |
   | `DOCUSIGN_SECRET_KEY` | DocuSign access token |
   | `DOCUSIGN_ACCOUNT_ID` | DocuSign account ID |

5. **Deploy**  
   Click **"Create Web Service"**. Render will automatically build and deploy your application.

6. **Verify login works**  
   After deployment, test the login endpoint:
   ```bash
   curl -s -X POST https://<your-render-url>/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"demo@crm.local","password":"demo123"}'
   ```
   You should receive `{"token":"...","user":{...}}`. If you get an error, check the Render logs.

7. **Monitor**  
   - Your app will be live at the URL provided by Render (e.g., `https://my-crm.onrender.com`)
   - View logs and deployment status in the Render dashboard

## Troubleshooting

### Login screen is stuck / won't accept credentials

1. Open browser DevTools → **Network tab** → look for `POST /api/auth/login`.
2. Check the response: `401` = wrong credentials, `5xx` = server error.
3. Check Render logs for startup errors.
4. Ensure `JWT_SECRET` is set — without it the server uses a default development key that will not persist across restarts.
5. DocuSign variables are **not** required for login. Authentication works without them.

### Data disappears on restart

Render's free tier uses ephemeral storage — JSON data files are lost on restart. For persistent data, use a database service (e.g., PostgreSQL via Render).

## Conclusion
Your My-CRM application should now be up and running on Render!

For more information, refer to the [Render Documentation](https://render.com/docs).