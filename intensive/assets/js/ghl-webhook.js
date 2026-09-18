/* ==========================================================================
   PWE — GoHighLevel webhook helper
   --------------------------------------------------------------------------
   Posts landing-page registrations straight to a GoHighLevel inbound webhook.
   No backend, no serverless function.

   SETUP: replace the placeholder below with the real webhook URL from the
   GHL team. That is the only line that needs changing.
   ========================================================================== */

var GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/Ukte3caBgOBOSNZNJuPe/webhook-trigger/1c305648-7f32-4d66-81d9-92bc631e93de';

var GHL_TIMEOUT_MS = 10000;

/* --------------------------------------------------------------------------
   UTM + page metadata — read once on load, used at submit time
   -------------------------------------------------------------------------- */

function readTracking() {
  var params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || 'organic',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    landingPage: window.location.href
  };
}

var PWE_TRACKING = readTracking();

/* --------------------------------------------------------------------------
   Post to GoHighLevel
   Always resolves. Never throws. Returns { ok: true } or { ok: false, error }.
   -------------------------------------------------------------------------- */

async function postToGHL(payload) {
  if (!GHL_WEBHOOK_URL || GHL_WEBHOOK_URL === 'REPLACE_WITH_GHL_WEBHOOK_URL') {
    return { ok: false, error: 'Webhook URL not configured yet.' };
  }

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, GHL_TIMEOUT_MS);

  var body = Object.assign({}, PWE_TRACKING, payload, {
    registrationDate: new Date().toISOString()
  });

  try {
    var response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { ok: false, error: 'Request failed (' + response.status + ').' };
    }
    return { ok: true };

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out.' };
    }
    return { ok: false, error: 'Network error.' };
  }
}

/* --------------------------------------------------------------------------
   Honeypot check — the webhook URL is public, so block obvious bots.
   Add a CSS-hidden input named "company_url" to each form.
   -------------------------------------------------------------------------- */

function isBotSubmission(form) {
  var trap = form.querySelector('[name="company_url"]');
  return Boolean(trap && trap.value);
}