require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const db = require('./src/database');
const linkedin = require('./src/linkedin');
const aiGenerator = require('./src/aiGenerator');
const scheduler = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Async state loader middleware for serverless / Vercel KV persistence
app.use(async (req, res, next) => {
  try {
    await db.loadStateAsync();
  } catch (e) {
    // Continue with local cache
  }
  next();
});

// Serve static frontend dashboard
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. OAUTH & AUTHENTICATION ROUTES
// ==========================================

// Initiate LinkedIn OAuth Flow
app.get('/auth/linkedin', (req, res) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const dynamicRedirectUri = host && !host.includes('localhost')
      ? `${protocol}://${host}/auth/callback`
      : undefined;

    const authUrl = linkedin.getAuthorizationUrl(undefined, dynamicRedirectUri);
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).send(`Error starting LinkedIn OAuth: ${err.message}`);
  }
});

// OAuth Callback from LinkedIn
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('LinkedIn OAuth returned error:', error, error_description);
    return res.redirect(`/?auth_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/?auth_error=No_authorization_code_received');
  }

  try {
    console.log('[Auth] Exchanging authorization code for access token...');
    const tokenResponse = await linkedin.exchangeCodeForToken(code, req);
    const accessToken = tokenResponse.access_token;
    const expiresIn = tokenResponse.expires_in || 5184000; // default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('[Auth] Fetching LinkedIn user profile...');
    const profile = await linkedin.getProfileInfo(accessToken);

    // Save tokens and user info to persistent storage
    db.saveTokens({
      accessToken,
      refreshToken: tokenResponse.refresh_token || null,
      expiresAt,
      profile,
    });

    console.log(`[Auth] ✅ Successfully connected LinkedIn account: ${profile.name} (${profile.urn})`);
    res.redirect('/?connected=true');
  } catch (err) {
    console.error('[Auth] ❌ Failed to complete LinkedIn OAuth:', err.message);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// Disconnect LinkedIn Account
app.post('/api/auth/disconnect', (req, res) => {
  db.clearTokens();
  res.json({ success: true, message: 'LinkedIn account disconnected.' });
});

// Get user's managed organizations / company pages
app.get('/api/linkedin/organizations', async (req, res) => {
  try {
    const tokens = db.getTokens();
    if (!tokens.accessToken) {
      return res.json({ success: false, organizations: [] });
    }
    const orgs = await linkedin.getUserOrganizations(tokens.accessToken);
    res.json({ success: true, organizations: orgs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. DASHBOARD & STATUS APIS
// ==========================================

app.get('/api/status', (req, res) => {
  const stats = db.getStats();
  const settings = db.getSettings();
  res.json({
    ...stats,
    settings,
  });
});

// ==========================================
// 3. AI POST GENERATOR APIS
// ==========================================

app.post('/api/posts/generate', async (req, res) => {
  try {
    const { topic, tone, customPrompt } = req.body;
    const generated = await aiGenerator.generatePost({ topic, tone, customPrompt });
    const imageConcept = aiGenerator.generateImageConcept(topic, generated.content);

    res.json({
      success: true,
      ...generated,
      imageUrl: imageConcept,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/posts/publish-now', async (req, res) => {
  const { content, topic, imageUrl, imageData, targetType, organizationUrn } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content cannot be empty.' });
  }

  try {
    console.log('[API] Publishing post to LinkedIn...');
    const result = await linkedin.publishPost(content.trim(), {
      imageUrl,
      imageData,
      targetType,
      organizationUrn,
    });

    const record = db.addToHistory({
      content: content.trim(),
      topic: topic || 'Manual Publish',
      status: 'success',
      linkedinPostUrn: result.postUrn,
      authorUrn: result.authorUrn,
      imageUrl: imageUrl || (imageData ? 'Attached Image' : null),
    });

    res.json({
      success: true,
      message: 'Post published successfully to LinkedIn!',
      postUrn: result.postUrn,
      authorUrn: result.authorUrn,
      historyItem: record,
    });
  } catch (err) {
    console.error('[API] ❌ Failed to publish post:', err.message);

    db.addToHistory({
      content: content.trim(),
      topic: topic || 'Manual Publish',
      status: 'failed',
      error: err.message,
    });

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// 4. QUEUE & SCHEDULER APIS
// ==========================================

app.get('/api/queue', (req, res) => {
  res.json(db.getQueue());
});

app.post('/api/queue', (req, res) => {
  const { content, topic, tone, imageUrl, scheduledFor } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required.' });
  }
  const post = db.addToQueue({ content: content.trim(), topic, tone, imageUrl, scheduledFor });
  res.json({ success: true, post });
});

app.put('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  const updated = db.updateQueueItem(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Queued post not found.' });
  }
  res.json({ success: true, post: updated });
});

app.delete('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  const removed = db.removeFromQueue(id);
  res.json({ success: removed });
});

app.get('/api/history', (req, res) => {
  res.json(db.getHistory());
});

// ==========================================
// 5. VERCEL CRON & SETTINGS APIS
// ==========================================

app.all(['/api/cron/daily-post', '/api/scheduler/trigger-now'], async (req, res) => {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
  }

  try {
    const result = await scheduler.executeScheduledRun();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    scheduler.reloadScheduler();
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. SERVER START / EXPORT FOR VERCEL
// ==========================================

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 LinkedIn Auto-Poster is running at http://localhost:${PORT}`);
    console.log(`🔑 Client ID: ${process.env.LINKEDIN_CLIENT_ID || '77yhoqzulb69y2'}`);
    console.log(`🌐 OAuth Redirect URI: ${process.env.LINKEDIN_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`}`);
    console.log(`=======================================================`);

    scheduler.initScheduler();
  });
}

module.exports = app;
