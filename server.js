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

// Middleware to parse cookies and authorization headers for unbreakable auth
app.use(async (req, res, next) => {
  try {
    await db.loadStateAsync();
  } catch (e) {}

  // Check client Authorization header, cookie, or query parameter for token fallback
  const authHeader = req.headers['authorization'] || req.headers['x-linkedin-token'];
  const cookieHeader = req.headers['cookie'];
  const queryToken = req.query?.token;

  let clientToken = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    clientToken = authHeader.replace('Bearer ', '').trim();
  } else if (authHeader) {
    clientToken = authHeader.trim();
  } else if (queryToken && typeof queryToken === 'string') {
    clientToken = queryToken.trim();
  } else if (cookieHeader) {
    const match = cookieHeader.match(/postpulse_token=([^;]+)/);
    if (match) clientToken = decodeURIComponent(match[1]);
  }

  if (clientToken && (!db.getTokens().accessToken || db.getTokens().accessToken !== clientToken)) {
    const userUrn = req.headers['x-user-urn'] ? decodeURIComponent(req.headers['x-user-urn']) : 'urn:li:person:me';
    const userName = req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name']) : 'Connected User';
    const userAvatar = req.headers['x-user-avatar'] ? decodeURIComponent(req.headers['x-user-avatar']) : null;

    db.saveTokens({
      accessToken: clientToken,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      profile: {
        id: 'me',
        urn: userUrn,
        name: userName,
        email: '',
        picture: userAvatar,
      },
    });
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
    let profile = null;
    try {
      profile = await linkedin.getProfileInfo(accessToken);
    } catch (profErr) {
      console.warn('[Auth] Profile fetch fallback:', profErr.message);
      profile = {
        id: 'me',
        urn: 'urn:li:person:me',
        name: 'LinkedIn User',
        email: '',
        picture: null,
      };
    }

    // Await save to database / Upstash Redis
    await db.saveTokensAsync({
      accessToken,
      refreshToken: tokenResponse.refresh_token || null,
      expiresAt,
      profile,
    });

    console.log(`[Auth] ✅ Successfully saved LinkedIn account for: ${profile.name}`);

    // Set cookie and pass URL parameters for unbreakable client-side caching
    res.setHeader('Set-Cookie', `postpulse_token=${encodeURIComponent(accessToken)}; Path=/; Max-Age=5184000; SameSite=Lax`);
    const params = new URLSearchParams({
      connected: 'true',
      token: accessToken,
      name: profile.name || 'LinkedIn User',
      urn: profile.urn || 'urn:li:person:me',
      avatar: profile.picture || '',
    });

    res.redirect(`/?${params.toString()}`);
  } catch (err) {
    console.error('[Auth] ❌ Failed to complete LinkedIn OAuth:', err.message);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// Disconnect LinkedIn Account
app.post('/api/auth/disconnect', async (req, res) => {
  await db.clearTokensAsync();
  res.setHeader('Set-Cookie', 'postpulse_token=; Path=/; Max-Age=0');
  res.json({ success: true, message: 'LinkedIn account disconnected.' });
});

// Manual Access Token Setup
app.post('/api/auth/manual-token', async (req, res) => {
  const { accessToken, personUrn, name } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  try {
    let profile = null;
    try {
      profile = await linkedin.getProfileInfo(accessToken);
    } catch {
      profile = {
        id: personUrn ? personUrn.replace('urn:li:person:', '') : 'me',
        urn: personUrn || 'urn:li:person:me',
        name: name || 'LinkedIn User',
        email: '',
        picture: null,
      };
    }

    await db.saveTokensAsync({
      accessToken,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      profile,
    });

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch user's managed company pages
app.get('/api/linkedin/organizations', async (req, res) => {
  const tokens = db.getTokens();
  if (!tokens.accessToken) {
    return res.status(401).json({ error: 'LinkedIn not connected' });
  }
  try {
    const orgs = await linkedin.getUserOrganizations(tokens.accessToken);
    res.json({ success: true, organizations: orgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. DASHBOARD & STATUS APIS
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    app: 'PostPulse Personal AI Studio',
    target: 'Personal LinkedIn Profile',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', (req, res) => {
  const stats = db.getStats();
  const settings = db.getSettings();
  const isConn = !!stats.isConnected;
  const prof = stats.profile;

  res.json({
    ...stats,
    connected: isConn,
    isConnected: isConn,
    user: prof,
    profile: prof,
    settings,
  });
});

// ==========================================
// 3. AI POST GENERATOR APIS
// ==========================================

app.get('/api/ai/image-styles', (req, res) => {
  res.json({
    success: true,
    styles: aiGenerator.IMAGE_STYLES,
  });
});

app.post('/api/posts/generate', async (req, res) => {
  try {
    const { topic, tone, customPrompt, customImagePrompt, style, aspectRatio, geminiApiKey } = req.body;
    const clientKey = geminiApiKey || req.headers['x-gemini-api-key'] || '';

    const generated = await aiGenerator.generatePost({
      topic,
      tone,
      customPrompt,
      customImagePrompt,
      style: style || 'cinematic',
      aspectRatio: aspectRatio || '16:9',
      geminiApiKey: clientKey,
    });

    res.json({
      success: true,
      ...generated,
    });
  } catch (err) {
    console.error('[API] Generation error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated endpoint to generate / regenerate tailored AI image
app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const { prompt, topic, postContent, style, aspectRatio, geminiApiKey } = req.body;
    const settings = db.getSettings();
    const apiKey = geminiApiKey || req.headers['x-gemini-api-key'] || settings.geminiApiKey || process.env.GEMINI_API_KEY;

    let finalPrompt = prompt;
    if (!finalPrompt || !finalPrompt.trim()) {
      finalPrompt = aiGenerator.createImagePrompt(topic || 'Technology', postContent || '', style || 'cinematic');
    }

    const imageResult = await aiGenerator.generateAiImage(finalPrompt.trim(), apiKey, {
      style: style || 'cinematic',
      aspectRatio: aspectRatio || '16:9',
    });

    res.json({
      success: true,
      ...imageResult,
    });
  } catch (err) {
    console.error('[API] AI Image generation error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to verify and persist user's Google Gemini API Key
app.post('/api/ai/verify-gemini-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, error: 'API key is required.' });
    }

    const verification = await aiGenerator.verifyGeminiKey(apiKey.trim());
    if (verification.valid) {
      // Persist to settings
      await db.updateSettingsAsync({ geminiApiKey: apiKey.trim() });
      res.json({
        success: true,
        message: 'Google Gemini 2.0 Flash & Imagen 3 connected and verified successfully!',
        modelsCount: verification.modelsCount,
      });
    } else {
      res.status(400).json({
        success: false,
        error: verification.error || 'Failed to verify key with Google Gemini API.',
      });
    }
  } catch (err) {
    console.error('[API] Key verification error:', err.message);
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

    const record = await db.addToHistoryAsync({
      content: content.trim(),
      topic: topic || 'Manual Publish',
      status: 'success',
      linkedinPostUrn: result.postUrn,
      authorUrn: result.authorUrn,
      imageUrl: imageUrl || (imageData ? 'Attached Image' : null),
    });

    res.json({
      success: true,
      message: result.fallbackNote || 'Post published successfully to LinkedIn!',
      postUrn: result.postUrn,
      authorUrn: result.authorUrn,
      fallbackNote: result.fallbackNote || null,
      historyItem: record,
    });
  } catch (err) {
    console.error('[API] ❌ Failed to publish post:', err.message);

    await db.addToHistoryAsync({
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

app.post('/api/queue', async (req, res) => {
  const { content, topic, tone, imageUrl, scheduledFor } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required.' });
  }
  const post = await db.addToQueueAsync({ content: content.trim(), topic, tone, imageUrl, scheduledFor });
  res.json({ success: true, post });
});

app.put('/api/queue/:id', async (req, res) => {
  const { id } = req.params;
  const updated = await db.updateQueueItemAsync(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Queued post not found.' });
  }
  res.json({ success: true, post: updated });
});

app.delete('/api/queue/:id', async (req, res) => {
  const { id } = req.params;
  const removed = await db.removeFromQueueAsync(id);
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

app.post('/api/settings', async (req, res) => {
  try {
    const updated = await db.updateSettingsAsync(req.body);
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
