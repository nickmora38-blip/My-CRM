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
   In the **"Environment"** section, add the following variables:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: Generate a secure random value or provide your own
   - `PORT`: Automatically provided by Render — do not set this manually

5. **Deploy**  
   Click **"Create Web Service"**. Render will automatically build and deploy your application.

6. **Monitor**  
   - Your app will be live at the URL provided by Render (e.g., `https://my-crm.onrender.com`)
   - View logs and deployment status in the Render dashboard
   - The `/health` endpoint (`GET /health`) can be used to verify the service is running

## Conclusion
Your My-CRM application should now be up and running on Render!

For troubleshooting and further information, refer to the [Render Documentation](https://render.com/docs).