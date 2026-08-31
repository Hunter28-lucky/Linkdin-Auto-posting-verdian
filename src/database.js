const fs = require('fs');
const path = require('path');
const https = require('https');

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
    topics: ['Hiring Remote Sales', 'AI & Tech Trends', 'Software Engineering Tips', 'Career & Productivity Growth'],
    defaultTone: 'engaging',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    targetType: 'organization',
    organizationUrn: 'urn:li:organization:117254291',
    organizationName: 'Veridian',
  },
  queue: [],
  history: [],
};

let memoryCache = null;

function getUpstashConfig() {
  let url = process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_URL;
  let token = process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_TOKEN;

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
 * Robust Upstash REST API caller
 */
function callUpstash(method, pathName, rawBody = null) {
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
          'Content-Type': 'text/plain',
        },
      };

      if (rawBody) {
        options.headers['Content-Length'] = Buffer.byteLength(rawBody);
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.result !== undefined ? parsed.result : parsed);
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', (e) => {
        console.warn('[Upstash Error]', e.message);
        resolve(null);
      });

      if (rawBody) req.write(rawBody);
      req.end();
    } catch (e) {
      console.warn('[Upstash Exception]', e.message);
      resolve(null);
    }
  });
}

function ensureLocalDb() {
  if (memoryCache) return memoryCache;

  if (!fs.existsSync(DB_DIR)) {
    try {
      fs.mkdirSync(DB_DIR, { recursive: true });
    } catch {}
  }

  if (!fs.existsSync(DB_FILE)) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    } catch {}
    memoryCache = { ...DEFAULT_DB };
    return memoryCache;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    memoryCache = {
      tokens: { ...DEFAULT_DB.tokens, ...(parsed.tokens || {}) },
      settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
      queue: parsed.queue || [],
      history: parsed.history || [],
    };
    return memoryCache;
  } catch {
    memoryCache = { ...DEFAULT_DB };
    return memoryCache;
  }
}

async function saveStateAsync(data) {
  memoryCache = data;

  try {
    ensureLocalDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}

  const upstash = getUpstashConfig();
  if (upstash) {
    try {
      await callUpstash('POST', '/set/postpulse_state', JSON.stringify(data));
      console.log('[Database] ✅ State synced to Upstash Redis');
    } catch (e) {
      console.warn('[Database] Sync to Upstash failed:', e.message);
    }
  }
}

function saveLocalDb(data) {
  memoryCache = data;
  try {
    ensureLocalDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}

  const upstash = getUpstashConfig();
  if (upstash) {
    callUpstash('POST', '/set/postpulse_state', JSON.stringify(data)).catch(() => {});
  }
}

async function loadStateAsync() {
  const upstash = getUpstashConfig();
  if (upstash) {
    try {
      const rawResult = await callUpstash('GET', '/get/postpulse_state');
      if (rawResult) {
        let parsed = rawResult;
        if (typeof rawResult === 'string') {
          try { parsed = JSON.parse(rawResult); } catch {}
        }
        if (parsed && typeof parsed === 'object') {
          memoryCache = {
            tokens: { ...DEFAULT_DB.tokens, ...(parsed.tokens || {}) },
            settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
            queue: parsed.queue || [],
            history: parsed.history || [],
          };
          return memoryCache;
        }
      }
    } catch (e) {
      console.warn('[Database] Could not load from Upstash:', e.message);
    }
  }
  return ensureLocalDb();
}

function getTokens() {
  const db = ensureLocalDb();
  return db.tokens;
}

async function saveTokensAsync(tokens) {
  const db = ensureLocalDb();
  db.tokens = { ...db.tokens, ...tokens };
  await saveStateAsync(db);
  return db.tokens;
}

function saveTokens(tokens) {
  const db = ensureLocalDb();
  db.tokens = { ...db.tokens, ...tokens };
  saveLocalDb(db);
  return db.tokens;
}

async function clearTokensAsync() {
  const db = ensureLocalDb();
  db.tokens = { ...DEFAULT_DB.tokens };
  await saveStateAsync(db);
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

async function updateSettingsAsync(newSettings) {
  const db = ensureLocalDb();
  db.settings = { ...db.settings, ...newSettings };
  await saveStateAsync(db);
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

async function addToQueueAsync(item) {
  const db = ensureLocalDb();
  const post = {
    id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    content: item.content,
    topic: item.topic || 'General',
    tone: item.tone || 'engaging',
    imageUrl: item.imageUrl || null,
    scheduledFor: item.scheduledFor || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.queue.push(post);
  await saveStateAsync(db);
  return post;
}

function addToQueue(item) {
  const db = ensureLocalDb();
  const post = {
    id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    content: item.content,
    topic: item.topic || 'General',
    tone: item.tone || 'engaging',
    imageUrl: item.imageUrl || null,
    scheduledFor: item.scheduledFor || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.queue.push(post);
  saveLocalDb(db);
  return post;
}

async function updateQueueItemAsync(id, data) {
  const db = ensureLocalDb();
  const index = db.queue.findIndex((p) => p.id === id);
  if (index !== -1) {
    db.queue[index] = { ...db.queue[index], ...data, updatedAt: new Date().toISOString() };
    await saveStateAsync(db);
    return db.queue[index];
  }
  return null;
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

async function removeFromQueueAsync(id) {
  const db = ensureLocalDb();
  const beforeLength = db.queue.length;
  db.queue = db.queue.filter((p) => p.id !== id);
  await saveStateAsync(db);
  return db.queue.length < beforeLength;
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

async function addToHistoryAsync(entry) {
  const db = ensureLocalDb();
  const record = {
    id: 'hist_' + Date.now(),
    content: entry.content,
    topic: entry.topic || 'Manual / AI',
    publishedAt: new Date().toISOString(),
    status: entry.status || 'success',
    linkedinPostUrn: entry.linkedinPostUrn || null,
    authorUrn: entry.authorUrn || null,
    imageUrl: entry.imageUrl || null,
    error: entry.error || null,
  };
  db.history.push(record);
  await saveStateAsync(db);
  return record;
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
    authorUrn: entry.authorUrn || null,
    imageUrl: entry.imageUrl || null,
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
  const isConnected = !!(db.tokens.accessToken);
  const tokenExpiresAt = db.tokens.expiresAt;
  const isTokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < now : true;
  const hasCloudStorage = !!getUpstashConfig();

  return {
    totalPublished,
    queuedCount,
    isConnected: isConnected && !isTokenExpired,
    profile: db.tokens.profile || (isConnected ? { name: 'Connected User', urn: 'urn:li:person:me' } : null),
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
  saveTokensAsync,
  clearTokens,
  clearTokensAsync,
  getSettings,
  updateSettings,
  updateSettingsAsync,
  getQueue,
  addToQueue,
  addToQueueAsync,
  updateQueueItem,
  updateQueueItemAsync,
  removeFromQueue,
  removeFromQueueAsync,
  popNextQueuedPost,
  getHistory,
  addToHistory,
  addToHistoryAsync,
  getStats,
};
