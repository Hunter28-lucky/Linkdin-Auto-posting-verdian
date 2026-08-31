const https = require('https');
const querystring = require('querystring');
const db = require('./database');

function getAuthConfig(customRedirectUri) {
  const clientId = process.env.LINKEDIN_CLIENT_ID || '77yhoqzulb69y2';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  const redirectUri = customRedirectUri || process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/callback';
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
      if (host && !host.includes('localhost') && !process.env.LINKEDIN_REDIRECT_URI) {
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
 * Publish Post via LinkedIn REST API (or UGC fallback)
 */
async function publishPost(content) {
  const tokens = db.getTokens();
  if (!tokens.accessToken) {
    throw new Error('LinkedIn account is not connected. Please connect your account first.');
  }

  const personUrn = tokens.profile?.urn;
  if (!personUrn) {
    throw new Error('LinkedIn Person URN is missing. Please reconnect your account.');
  }

  try {
    const result = await publishViaRestApi(tokens.accessToken, personUrn, content);
    return result;
  } catch (restErr) {
    console.warn('REST API post failed, attempting UGC Posts API fallback...', restErr.message);
    try {
      const ugcResult = await publishViaUgcApi(tokens.accessToken, personUrn, content);
      return ugcResult;
    } catch (ugcErr) {
      throw new Error(`LinkedIn posting failed. REST API: ${restErr.message} | UGC API: ${ugcErr.message}`);
    }
  }
}

function publishViaRestApi(accessToken, authorUrn, text) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify({
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
    });

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
              publishedAt: new Date().toISOString(),
            });
          } catch {
            resolve({
              success: true,
              postUrn: 'urn:li:ugcPost:created',
              api: 'UGC',
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
  publishPost,
};
