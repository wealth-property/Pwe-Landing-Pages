const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

let cachedToken = null;
let tokenExpiresAt = 0;

function getZoomConfig() {
  const required = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing Zoom environment variable(s): ${missing.join(', ')}`);
  }

  return {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
  };
}

async function requestZoomToken() {
  const { accountId, clientId, clientSecret } = getZoomConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: accountId,
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Zoom OAuth returned an invalid response (HTTP ${response.status})`);
  }

  if (!response.ok || !payload.access_token) {
    const detail = payload.reason || payload.message || `HTTP ${response.status}`;
    throw new Error(`Zoom OAuth failed: ${detail}`);
  }

  const expiresInMs = Number(payload.expires_in) * 1000;
  cachedToken = payload.access_token;
  tokenExpiresAt = Date.now() + Math.max(expiresInMs - TOKEN_EXPIRY_BUFFER_MS, 0);

  return cachedToken;
}

async function getZoomAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  return requestZoomToken();
}

module.exports = { getZoomAccessToken };
