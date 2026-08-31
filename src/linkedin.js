const https = require('https');
const http = require('http');
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
 * Requests permissions for both personal profile & organization pages
 */
function getAuthorizationUrl(state = 'linkedin_auto_auth_' + Date.now(), customRedirectUri) {
  const { clientId, redirectUri } = getAuthConfig(customRedirectUri);
  const scopes = [
    'openid',
    'profile',
    'email',
    'w_member_social',
    'w_organization_social',
    'r_organization_social',
    'rw_organization_admin',
  ].join(' ');

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
              .catch(() => reject(new Error(parsed.message || `Profile request failed (HTTP ${res.statusCode})`)));
          }
        } catch (e) {
          reject(new Error(`Failed to parse profile response: ${data}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
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
 * Fetch list of organization/company pages user manages
 */
function getUserOrganizations(accessToken) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: '/v2/organizationalEntityAcls?q=roleAssignee',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.elements && parsed.elements.length > 0) {
            const orgs = parsed.elements.map((el) => {
              const urn = el.organizationalTarget;
              const orgId = urn ? urn.split(':').pop() : '';
              return {
                urn: urn,
                id: orgId,
                role: el.role,
                name: `Organization (${orgId})`,
              };
            });
            resolve(orgs);
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
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
    console.warn('[LinkedIn Image] Image upload failed, will post text-only fallback:', err.message);
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
 * Publish Post via LinkedIn REST API
 * Supports both Organization and Personal Profile target URNs and optional Images
 */
async function publishPost(content, options = {}) {
  const tokens = db.getTokens();
  const settings = db.getSettings();

  if (!tokens.accessToken) {
    throw new Error('LinkedIn account is not connected. Please connect your account first.');
  }

  // Determine Author URN: Organization Page vs Personal Profile
  let authorUrn = tokens.profile?.urn;
  const targetType = options.targetType || settings.targetType || 'organization';

  if (targetType === 'organization') {
    // If organization URN specified in settings, use it
    if (settings.organizationUrn && settings.organizationUrn.trim()) {
      authorUrn = settings.organizationUrn.trim();
      if (!authorUrn.startsWith('urn:li:organization:')) {
        authorUrn = `urn:li:organization:${authorUrn}`;
      }
    } else {
      // Look up if user has organization in state
      console.log(`[LinkedIn] Posting to default/configured Organization page...`);
    }
  }

  console.log(`[LinkedIn] Publishing post as author: ${authorUrn} (Target: ${targetType})`);

  let imageUrn = null;
  if (options.imageUrl || options.imageData) {
    imageUrn = await uploadImageToLinkedIn(tokens.accessToken, authorUrn, options.imageUrl || options.imageData);
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
      throw new Error(`LinkedIn posting failed. REST API: ${restErr.message} | UGC API: ${ugcErr.message}`);
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
          title: 'Post Image',
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
  getUserOrganizations,
  uploadImageToLinkedIn,
  publishPost,
};
