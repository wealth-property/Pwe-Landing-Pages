const { createOrUpdateGhlContact } = require('./_lib/ghl');
const { createZoomClient } = require('./_lib/zoom');
const { createRegistrationService, MemoryIdempotencyStore } = require('./_lib/registration');

const idempotencyStore = new MemoryIdempotencyStore();

function isDryRun() {
  return String(process.env.INTEGRATION_DRY_RUN || '').toLowerCase() === 'true';
}

function createClients() {
  if (isDryRun()) {
    return {
      ghl: { upsertContact: async () => ({ id: 'dry-run-contact' }) },
      zoom: { register: async () => [{ name: 'dry-run', joinUrl: null, registrantId: null }] },
    };
  }
  return { ghl: { upsertContact: createOrUpdateGhlContact }, zoom: createZoomClient() };
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const body = await readBody(request);
    const service = createRegistrationService({ ...createClients(), idempotencyStore });
    const result = await service(body);
    return sendJson(response, result.status, result);
  } catch {
    return sendJson(response, 400, { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON request.' } });
  }
}

module.exports = handler;
