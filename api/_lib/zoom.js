const { getZoomAccessToken } = require('./zoomAuth');

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

function getZoomRegistrationConfig() {
  return {
    day1WebinarId: process.env.ZOOM_DAY_1_WEBINAR_ID,
    day2WebinarId: process.env.ZOOM_DAY_2_WEBINAR_ID,
    webinarIds: Object.fromEntries(
      Object.entries(process.env)
        .filter(([name, value]) => /^ZOOM_WEBINAR_ID_[A-Z0-9_]+$/.test(name) && value)
        .map(([name, value]) => [name.replace('ZOOM_WEBINAR_ID_', '').toLowerCase(), value]),
    ),
  };
}

function requiredWebinarIds(registration, config) {
  if (registration.program === 'intensive') {
    return [
      ['day1', config.day1WebinarId],
      ['day2', config.day2WebinarId],
    ];
  }

  if (registration.sessionId === 'd0919') return [['d0919', config.day1WebinarId]];
  if (registration.sessionId === 'd0920') return [['d0920', config.day2WebinarId]];
  return [[registration.sessionId.toLowerCase(), config.webinarIds[registration.sessionId.toLowerCase()]]];
}

function createZoomClient({ fetchImpl = fetch, getAccessToken = getZoomAccessToken } = {}) {
  return {
    async register(registration) {
      const config = getZoomRegistrationConfig();
      const targets = requiredWebinarIds(registration, config);
      const missing = targets.filter(([, webinarId]) => !webinarId).map(([name]) => name);
      if (missing.length > 0) throw new Error(`Missing Zoom webinar ID configuration for: ${missing.join(', ')}`);

      const token = await getAccessToken();
      const results = [];
      for (const [name, webinarId] of targets) {
        const response = await fetchImpl(`${ZOOM_API_BASE_URL}/webinars/${encodeURIComponent(webinarId)}/registrants`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            first_name: registration.firstName,
            last_name: registration.lastName,
            email: registration.email,
            phone: registration.mobile,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Zoom ${name} registration failed (HTTP ${response.status})`);
        results.push({ name, joinUrl: payload.join_url || null, registrantId: payload.registrant_id || null });
      }
      return results;
    },
  };
}

module.exports = { createZoomClient, getZoomRegistrationConfig };