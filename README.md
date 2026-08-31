# 🚀 PostPulse — Automated Daily LinkedIn Poster (Vercel Ready)

A production-ready automated daily LinkedIn posting system with AI content generation, automated daily cron scheduling, live feed preview, and a modern dashboard.

---

## ⚡ 1-Minute Deployment to Vercel

### Step 1: Push Code to GitHub
Initialize a git repository in this folder and push to your GitHub:
```bash
git init
git add .
git commit -m "Initial commit for LinkedIn Auto Poster"
git branch -M main
# Link to your new github repo:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

### Step 2: Import into Vercel
1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Select your GitHub repository and click **Import**.
3. Under **Environment Variables**, add:
   * `LINKEDIN_CLIENT_ID`: `77yhoqzulb69y2`
   * `LINKEDIN_CLIENT_SECRET`: `your_linkedin_client_secret`
   * `LINKEDIN_REDIRECT_URI`: `https://YOUR_VERCEL_APP.vercel.app/auth/callback` *(replace with your actual Vercel domain)*
   * `GEMINI_API_KEY`: *(Optional: free key from https://aistudio.google.com/)*
4. Click **Deploy**!

---

### Step 3: Add Free 1-Click Database (Vercel KV / Upstash Redis)
Because Vercel is serverless, storing your LinkedIn access token and post queue permanently requires a lightweight free database:
1. In your Vercel Project Dashboard $\rightarrow$ go to the **Storage** tab.
2. Click **Create Database** $\rightarrow$ select **KV** (or **Upstash Redis** from Marketplace).
3. Click **Connect to Project**.
*(Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your environment variables!)*

---

### Step 4: Update LinkedIn Developer Portal Redirect URL
1. Open your app at: [https://www.linkedin.com/developers/apps/264409202/auth](https://www.linkedin.com/developers/apps/264409202/auth)
2. Under **Authorized redirect URLs for your app**, click the **Pencil (Edit)** icon and add your Vercel callback URL:
   ```text
   https://YOUR_VERCEL_APP.vercel.app/auth/callback
   ```
3. Click **Update**.

---

### Step 5: Connect & Activate!
1. Open your live Vercel URL (`https://YOUR_VERCEL_APP.vercel.app`).
2. Click **"Connect LinkedIn"** at the top right.
3. Your daily LinkedIn auto-poster is now 100% active and running on Vercel Cron! 🚀

---

## ⏰ Daily Cron Schedule on Vercel
The automated posting schedule is configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-post",
      "schedule": "0 9 * * 1-5"
    }
  ]
}
```
* Default: Runs at 09:00 AM UTC, Monday through Friday.
* You can adjust the schedule anytime by editing `vercel.json` or triggering it on demand from the dashboard.
