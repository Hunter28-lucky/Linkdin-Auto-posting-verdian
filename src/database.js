const fs = require('fs');
const path = require('path');
const https = require('https');

// For local development or temporary fallback on Vercel
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const DB_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const DEFAULT_DB = {
  tokens: {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    profile: null,
  },
  settings: {
    schedulerActive: true,
    scheduleTime: '09:00',
    scheduleDays: ['1', '2', '3', '4', '5'],
    autopilotMode: 'autopilot',
    topics: ['AI & Tech Trends', 'Software Engineering Tips', 'Career & Productivity Growth', 'Future of Work'],
    defaultTone: 'engaging',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
  },
  queue: [],
  history: [],
};

// In-memory cache for ultra-fast reads during Lambda lifecycle
let memoryCache = null;

function getUpstashConfig() {
  // Check direct standard names and custom prefix like STORAGE_REST_API_URL / STORAGE_URL
  let url = process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_URL;
  let token = process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_TOKEN;

  // Dynamic fallback search for any *_REST_API_URL in environment
  if (!url || !token) {
    for (const key in process.env) {
      if (key.endsWith('_REST_API_URL')) {
        url = process.env[key];
        const prefix = key.replace('_REST_API_URL', '');
        token = process.env[`${prefix}_REST_API_TOKEN`] || process.env[`${prefix}_TOKEN`];
        if (url && token) break;
      }
    }
  }

  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/**
 * Perform HTTPS request to Upstash / Vercel KV REST API
 */
function callUpstash(method, pathName, bodyData = null) {
  const config = getUpstashConfig();
  if (!config) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const urlObj = new URL(`${config.url}${pathName}`);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.result !== undefined ? parsed.result : parsed);
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      if (bodyData) req.write(JSON.stringify(bodyData));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function ensureLocalDb() {
  if (memoryCache) return memoryCache;

  if (!fs.existsSync(DB_DIR)) {
    try {
      fs.mkdirSync(DB_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create DB dir:', e.message);
    }
  }

  if (!fs.existsSync(DB_FILE)) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    } catch {
      // Ephemeral fallback
    }
    memoryCache = { ...DEFAULT_DB };
    return memoryCache;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    memoryCache = {
      tokens: { ...DEFAULT_DB.tokens, ...parsed.tokens },
      settings: { ...DEFAULT_DB.settings, ...parsed.settings },
      queue: parsed.queue || [],
      history: parsed.history || [],
    };
    return memoryCache;
  } catch (err) {
    memoryCache = { ...DEFAULT_DB };
    return memoryCache;
  }
}

function saveLocalDb(data) {
  memoryCache = data;
  try {
    ensureLocalDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ephemeral write
  }

  // Also sync to cloud KV if configured (async background sync)
  const upstash = getUpstashConfig();
  if (upstash) {
    callUpstash('POST', '/set/postpulse_state', JSON.stringify(data)).catch(() => {});
  }
}

/**
 * Load state from KV / Redis if available, or local file
 */
async function loadStateAsync() {
  const upstash = getUpstashConfig();
  if (upstash) {
    try {
      const rawResult = await callUpstash('GET', '/get/postpulse_state');
      if (rawResult) {
        const parsed = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
        memoryCache = {
          tokens: { ...DEFAULT_DB.tokens, ...(parsed.tokens || {}) },
          settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
          queue: parsed.queue || [],
          history: parsed.history || [],
        };
        return memoryCache;
      }
    } catch (e) {
      console.warn('Could not load from Upstash:', e.message);
    }
  }
  return ensureLocalDb();
}

// Synchronous and Async Helper methods
function getTokens() {
  const db = ensureLocalDb();
  return db.tokens;
}

function saveTokens(tokens) {
  const db = ensureLocalDb();
  db.tokens = { ...db.tokens, ...tokens };
  saveLocalDb(db);
  return db.tokens;
}

function clearTokens() {
  const db = ensureLocalDb();
  db.tokens = { ...DEFAULT_DB.tokens };
  saveLocalDb(db);
  return db.tokens;
}

function getSettings() {
  const db = ensureLocalDb();
  return db.settings;
}

function updateSettings(newSettings) {
  const db = ensureLocalDb();
  db.settings = { ...db.settings, ...newSettings };
  saveLocalDb(db);
  return db.settings;
}

function getQueue() {
  const db = ensureLocalDb();
  return db.queue;
}

function addToQueue(item) {
  const db = ensureLocalDb();
  const post = {
    id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    content: item.content,
    topic: item.topic || 'General',
    tone: item.tone || 'engaging',
    scheduledFor: item.scheduledFor || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.queue.push(post);
  saveLocalDb(db);
  return post;
}

function updateQueueItem(id, data) {
  const db = ensureLocalDb();
  const index = db.queue.findIndex((p) => p.id === id);
  if (index !== -1) {
    db.queue[index] = { ...db.queue[index], ...data, updatedAt: new Date().toISOString() };
    saveLocalDb(db);
    return db.queue[index];
  }
  return null;
}

function removeFromQueue(id) {
  const db = ensureLocalDb();
  const beforeLength = db.queue.length;
  db.queue = db.queue.filter((p) => p.id !== id);
  saveLocalDb(db);
  return db.queue.length < beforeLength;
}

function popNextQueuedPost() {
  const db = ensureLocalDb();
  if (db.queue.length === 0) return null;
  const post = db.queue.shift();
  saveLocalDb(db);
  return post;
}

function getHistory() {
  const db = ensureLocalDb();
  return db.history.slice().reverse();
}

function addToHistory(entry) {
  const db = ensureLocalDb();
  const record = {
    id: 'hist_' + Date.now(),
    content: entry.content,
    topic: entry.topic || 'Manual / AI',
    publishedAt: new Date().toISOString(),
    status: entry.status || 'success',
    linkedinPostUrn: entry.linkedinPostUrn || null,
    error: entry.error || null,
  };
  db.history.push(record);
  saveLocalDb(db);
  return record;
}

function getStats() {
  const db = ensureLocalDb();
  const now = new Date();
  const totalPublished = db.history.filter((h) => h.status === 'success').length;
  const queuedCount = db.queue.length;
  const isConnected = !!(db.tokens.accessToken && db.tokens.profile?.urn);
  const tokenExpiresAt = db.tokens.expiresAt;
  const isTokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < now : true;
  const hasCloudStorage = !!getUpstashConfig();

  return {
    totalPublished,
    queuedCount,
    isConnected: isConnected && !isTokenExpired,
    profile: db.tokens.profile,
    tokenExpiresAt,
    isTokenExpired,
    schedulerActive: db.settings.schedulerActive,
    scheduleTime: db.settings.scheduleTime,
    scheduleDays: db.settings.scheduleDays,
    autopilotMode: db.settings.autopilotMode,
    isVercel,
    hasCloudStorage,
  };
}

module.exports = {
  loadStateAsync,
  getTokens,
  saveTokens,
  clearTokens,
  getSettings,
  updateSettings,
  getQueue,
  addToQueue,
  updateQueueItem,
  removeFromQueue,
  popNextQueuedPost,
  getHistory,
  addToHistory,
  getStats,
};
