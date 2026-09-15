const crypto = require('node:crypto');

const PROGRAMS = new Set(['intensive', 'webinar']);

function normalizeRegistration(input) {
  const source = input && typeof input === 'object' ? input : {};
  const utm = source.utm && typeof source.utm === 'object' ? source.utm : {};
  return {
    firstName: String(source.firstName || '').trim(),
    lastName: String(source.lastName || '').trim(),
    email: String(source.email || '').trim().toLowerCase(),
    mobile: String(source.mobile || '').trim(),
    program: String(source.program || '').trim().toLowerCase(),
    sessionId: String(source.sessionId || '').trim(),
    sessionDate: String(source.sessionDate || '').trim(),
    propertiesOwned: String(source.propertiesOwned || '').trim(),
    page: String(source.page || '').trim(),
    leadSource: String(source.leadSource || 'pwe-landing-page').trim(),
    selectedSession: String(source.sessionId || '').trim(),
    selectedDate: String(source.sessionDate || '').trim(),
    utmSource: String(utm.source || '').trim(),
    utmCampaign: String(utm.campaign || '').trim(),
    utmMedium: String(utm.medium || '').trim(),
    registrationDate: new Date().toISOString(),
  };
}

function validateRegistration(registration) {
  const errors = {};
  const required = ['firstName', 'lastName', 'email', 'mobile', 'program'];
  const missing = required.filter((field) => !registration[field]);
  if (missing.length) errors.missing = missing;
  if (registration.email && !/^\S+@\S+\.\S+$/.test(registration.email)) errors.email = 'Invalid email address.';
  if (registration.program && !PROGRAMS.has(registration.program)) errors.program = 'Unsupported program.';
  if (registration.program === 'webinar' && !registration.sessionId) errors.sessionId = 'Session is required.';
  return errors;
}

function registrationKey(registration) {
  return crypto.createHash('sha256')
    .update(`${registration.program}|${registration.email}|${registration.sessionId}|${registration.sessionDate}`)
    .digest('hex');
}

class MemoryIdempotencyStore {
  constructor() { this.records = new Map(); }
  async get(key) { return this.records.get(key) || null; }
  async set(key, value) { this.records.set(key, value); }
}

function createRegistrationService({ ghl, zoom, idempotencyStore = new MemoryIdempotencyStore(), logger = console }) {
  const inFlight = new Map();
  return async function register(input) {
    const registration = normalizeRegistration(input);
    const errors = validateRegistration(registration);
    if (Object.keys(errors).length) return { ok: false, status: 400, error: { code: 'VALIDATION_ERROR', details: errors } };
    const key = registrationKey(registration);
    const existing = await idempotencyStore.get(key);
    if (existing) return existing;
    if (inFlight.has(key)) return inFlight.get(key);

    const operation = (async () => {
      logger.info('registration.started', { key, program: registration.program });
      try {
        const contact = await ghl.upsertContact(registration);
        const zoomRegistrations = await zoom.register(registration);
        const result = {
          ok: true,
          status: 200,
          data: {
            registrationId: key,
            contactId: contact.id || contact.contact?.id || null,
            zoom: zoomRegistrations,
            message: 'Registration received. Check your email for the Zoom details.',
          },
        };
        await idempotencyStore.set(key, result);
        logger.info('registration.completed', { key, program: registration.program });
        return result;
      } catch (error) {
        const provider = error;
        logger.error('registration.failed', {
          key,
          program: registration.program,
          provider: provider && provider.provider ? provider.provider : 'unknown',
          status: provider && provider.status ? provider.status : 'unknown',
          phase: provider && provider.phase ? provider.phase : 'unknown',
          error: 'provider_request_failed',
        });
        return { ok: false, status: 502, error: { code: 'REGISTRATION_PROVIDER_ERROR', message: 'Registration could not be completed.' } };
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, operation);
    return operation;
  };
}

module.exports = { MemoryIdempotencyStore, createRegistrationService };
