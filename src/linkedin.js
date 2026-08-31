const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const db = require('./database');

function getAuthConfig(customRedirectUri) {
  const defaultSecret = Buffer.from('V1BMX0FQMS5XMThzM25iUHREWURMN2lNLk05T3BzUT09', 'base64').toString('utf-8');
  const clientId = (process.env.LINKEDIN_CLIENT_ID || '77yhoqzulb69y2').trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET || defaultSecret).trim();
  const redirectUri = (customRedirectUri || process.env.LINKEDIN_REDIRECT_URI || 'https://linkdinautopostingverdian.vercel.app/auth/callback').trim();
  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate LinkedIn OAuth 2.0 Authorization URL
 */
function getAuthorizationUrl(state = 'linkedin_auto_auth_' + Date.now(), customRedirectUri) {
  const { clientId, redirectUri } = getAuthConfig(customRedirectUri);
  const scopes = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

  const params = querystring.stringify({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: scopes,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

/**
 * Exchange OAuth Authorization Code for Access Token
 */
function exchangeCodeForToken(code, req) {
  return new Promise((resolve, reject) => {
    let customRedirectUri = null;
    if (req) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      if (host && !host.includes('localhost')) {
        customRedirectUri = `${protocol}://${host}/auth/callback`;
      }
    }

    const { clientId, clientSecret, redirectUri } = getAuthConfig(customRedirectUri);

    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const options = {
      hostname: 'www.linkedin.com',
      port: 443,
      path: '/oauth/v2/accessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            const errorMsg = parsed.error_description || parsed.error || `HTTP ${res.statusCode}: ${data}`;
            reject(new Error(`Failed to obtain access token: ${errorMsg}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    request.on('error', (e) => reject(e));
    request.write(postData);
    request.end();
  });
}

/**
 * Fetch Profile info using LinkedIn UserInfo endpoint
 */
function getProfileInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: '/v2/userinfo',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.sub) {
            const profile = {
              id: parsed.sub,
              urn: `urn:li:person:${parsed.sub}`,
              name: parsed.name || `${parsed.given_name || ''} ${parsed.family_name || ''}`.trim() || 'LinkedIn User',
              email: parsed.email || '',
              picture: parsed.picture || null,
            };
            resolve(profile);
          } else {
            getLegacyProfile(accessToken)
              .then(resolve)
              .catch(() => resolve({
                id: 'me',
                urn: 'urn:li:person:me',
                name: 'LinkedIn User',
                email: '',
                picture: null,
              }));
          }
        } catch (e) {
          resolve({
            id: 'me',
            urn: 'urn:li:person:me',
            name: 'LinkedIn User',
            email: '',
            picture: null,
          });
        }
      });
    });

    req.on('error', () => resolve({
      id: 'me',
      urn: 'urn:li:person:me',
      name: 'LinkedIn User',
      email: '',
      picture: null,
    }));
    req.end();
  });
}

function getLegacyProfile(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: '/v2/me',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            resolve({
              id: parsed.id,
              urn: `urn:li:person:${parsed.id}`,
              name: `${parsed.localizedFirstName || ''} ${parsed.localizedLastName || ''}`.trim() || 'LinkedIn User',
              email: '',
              picture: null,
            });
          } else {
            reject(new Error(parsed.message || 'Legacy profile failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

/**
 * Upload Image to LinkedIn REST API
 */
async function uploadImageToLinkedIn(accessToken, authorUrn, imageSource) {
  try {
    let imageBuffer = null;
    let contentType = 'image/jpeg';

    if (imageSource.startsWith('data:')) {
      const match = imageSource.match(/^data:(image\/[a-zA-Z0-9\+\-]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        imageBuffer = Buffer.from(match[2], 'base64');
      }
    } else if (imageSource.startsWith('/assets/')) {
      const localPath = path.join(__dirname, '..', 'public', imageSource.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        imageBuffer = fs.readFileSync(localPath);
      }
    } else if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      imageBuffer = await fetchImageBuffer(imageSource);
    }

    if (!imageBuffer) return null;

    // Step 1: Initialize Image Upload
    const initData = JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
      },
    });

    const initOptions = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: '/rest/images?action=initializeUpload',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(initData),
      },
    };

    const initRes = await makeHttpsRequest(initOptions, initData);
    const uploadUrl = initRes.value?.uploadUrl;
    const imageUrn = initRes.value?.image;

    if (!uploadUrl || !imageUrn) {
      console.warn('[LinkedIn Image] Could not get upload URL:', initRes);
      return null;
    }

    // Step 2: PUT image binary to uploadUrl
    await uploadBinary(uploadUrl, imageBuffer, contentType);
    console.log('[LinkedIn Image] ✅ Image uploaded successfully. URN:', imageUrn);
    return imageUrn;
  } catch (err) {
    console.warn('[LinkedIn Image] Image upload failed, fallback to text-only:', err.message);
    return null;
  }
}

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function uploadBinary(uploadUrl, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Binary PUT failed HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function makeHttpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Clean and format organization ID / URN
 */
function resolveOrganizationUrn(rawInput) {
  if (!rawInput) return '';
  const input = String(rawInput).trim();
  if (input.startsWith('urn:li:organization:')) return input;
  if (/^\d+$/.test(input)) return `urn:li:organization:${input}`;
  
  // Parse from URL like https://www.linkedin.com/company/105829104/admin or /company/verdian
  const urlMatch = input.match(/\/company\/([0-9a-zA-Z\-_]+)/);
  if (urlMatch) {
    const slugOrId = urlMatch[1];
    return /^\d+$/.test(slugOrId) ? `urn:li:organization:${slugOrId}` : slugOrId;
  }

  return input.startsWith('urn:li:') ? input : `urn:li:organization:${input}`;
}

/**
 * Publish Post via LinkedIn REST API
 * STRICT: If target is organization, ONLY posts to organization. Never leaks to personal account.
 */
async function publishPost(content, options = {}) {
  const tokens = db.getTokens();
  const settings = db.getSettings();

  if (!tokens.accessToken) {
    throw new Error('LinkedIn account is not connected. Please connect your account first.');
  }

  const targetType = options.targetType || settings.targetType || 'organization';
  let authorUrn = null;

  if (targetType === 'organization') {
    const rawOrg = options.organizationUrn || settings.organizationUrn;
    const resolvedOrg = resolveOrganizationUrn(rawOrg);

    if (!resolvedOrg || resolvedOrg === 'urn:li:organization:') {
      throw new Error('Verdian Company Page ID/URN is not configured. Please enter your Company Page ID or URL (e.g. 105829104 or https://linkedin.com/company/105829104) in Target Settings.');
    }

    authorUrn = resolvedOrg;
    console.log(`[LinkedIn] 🏢 STRICT MODE: Publishing to Company Page (${authorUrn})`);
  } else {
    authorUrn = tokens.profile?.urn;
    if (!authorUrn) {
      throw new Error('Personal LinkedIn profile ID was not found. Please reconnect your account.');
    }
    console.log(`[LinkedIn] 👤 Publishing to Personal Profile (${authorUrn})`);
  }

  // Upload image if present
  let imageUrn = null;
  const imageToUpload = options.imageData || options.imageUrl || (options.attachPoster ? '/assets/veridian-hiring-poster.jpg' : null);
  if (imageToUpload) {
    imageUrn = await uploadImageToLinkedIn(tokens.accessToken, authorUrn, imageToUpload);
  }

  // Attempt REST API publish
  try {
    const result = await publishViaRestApi(tokens.accessToken, authorUrn, content, imageUrn);
    return result;
  } catch (restErr) {
    console.warn('REST API post failed, attempting UGC Posts API fallback...', restErr.message);
    try {
      const ugcResult = await publishViaUgcApi(tokens.accessToken, authorUrn, content);
      return ugcResult;
    } catch (ugcErr) {
      throw new Error(`LinkedIn posting failed for ${authorUrn}: ${restErr.message}`);
    }
  }
}

function publishViaRestApi(accessToken, authorUrn, text, imageUrn) {
  return new Promise((resolve, reject) => {
    const postPayload = {
      author: authorUrn,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    if (imageUrn) {
      postPayload.content = {
        media: {
          id: imageUrn,
          title: 'Veridian Post Visual',
        },
      };
    }

    const postBody = JSON.stringify(postPayload);

    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: '/rest/posts',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(postBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const postUrn = res.headers['x-restli-id'] || res.headers['x-linkedin-id'];
        if (res.statusCode === 201 || (res.statusCode >= 200 && res.statusCode < 300)) {
          resolve({
            success: true,
            postUrn: postUrn || 'urn:li:post:created',
            api: 'REST',
            authorUrn,
            publishedAt: new Date().toISOString(),
          });
        } else {
          try {
            const parsed = JSON.parse(data);
            const msg = parsed.message || parsed.description || `HTTP ${res.statusCode}: ${data}`;
            reject(new Error(msg));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postBody);
    req.end();
  });
}

function publishViaUgcApi(accessToken, authorUrn, text) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    });

    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: '/v2/ugcPosts',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(postBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 201 || (res.statusCode >= 200 && res.statusCode < 300)) {
          try {
            const parsed = JSON.parse(data);
            resolve({
              success: true,
              postUrn: parsed.id || 'urn:li:ugcPost:created',
              api: 'UGC',
              authorUrn,
              publishedAt: new Date().toISOString(),
            });
          } catch {
            resolve({
              success: true,
              postUrn: 'urn:li:ugcPost:created',
              api: 'UGC',
              authorUrn,
              publishedAt: new Date().toISOString(),
            });
          }
        } else {
          try {
            const parsed = JSON.parse(data);
            const msg = parsed.message || parsed.description || `HTTP ${res.statusCode}: ${data}`;
            reject(new Error(msg));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postBody);
    req.end();
  });
}

module.exports = {
  getAuthConfig,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getProfileInfo,
  resolveOrganizationUrn,
  uploadImageToLinkedIn,
  publishPost,
};
