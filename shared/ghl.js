const GHL_API_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

function providerError(provider, status, phase) {
  const error = new Error('provider_request_failed');
  error.provider = provider;
  error.status = status;
  error.phase = phase;
  return error;
}

function getGhlConfig() {
  const required = [
    'GHL_PRIVATE_INTEGRATION_TOKEN',
    'GHL_LOCATION_ID',
    'GHL_LEAD_SOURCE_FIELD_ID',
    'GHL_SELECTED_SESSION_FIELD_ID',
    'GHL_SELECTED_DATE_FIELD_ID',
    'GHL_UTM_SOURCE_FIELD_ID',
    'GHL_UTM_CAMPAIGN_FIELD_ID',
    'GHL_UTM_MEDIUM_FIELD_ID',
    'GHL_REGISTRATION_DATE_FIELD_ID',
    'GHL_PAGE_OF_ORIGIN_FIELD_ID',
    'GHL_PROPERTIES_OWNED_FIELD_ID',
  ];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    const customFieldNames = required.filter((name) => name.endsWith('_FIELD_ID'));
    const missingCustomFields = missing.filter((name) => customFieldNames.includes(name));
    const missingCredentials = missing.filter((name) => !customFieldNames.includes(name));
    const messages = [];

    if (missingCredentials.length > 0) {
      messages.push(`Missing GoHighLevel environment variable(s): ${missingCredentials.join(', ')}`);
    }

    if (missingCustomFields.length > 0) {
      messages.push(
        `Missing GoHighLevel custom-field ID(s): ${missingCustomFields.join(', ')}. ` +
        'Create the corresponding fields under Settings -> Custom Fields in the GHL sub-account, then set their field IDs.',
      );
    }

    const error = providerError('ghl', 'config', 'configuration');
    error.message = messages.join(' ');
    throw error;
  }

  return {
    locationId: process.env.GHL_LOCATION_ID,
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
    funnelStageFieldId: process.env.GHL_FUNNEL_STAGE_FIELD_ID,
    leadSourceFieldId: process.env.GHL_LEAD_SOURCE_FIELD_ID,
    selectedSessionFieldId: process.env.GHL_SELECTED_SESSION_FIELD_ID,
    selectedDateFieldId: process.env.GHL_SELECTED_DATE_FIELD_ID,
    utmSourceFieldId: process.env.GHL_UTM_SOURCE_FIELD_ID,
    utmCampaignFieldId: process.env.GHL_UTM_CAMPAIGN_FIELD_ID,
    utmMediumFieldId: process.env.GHL_UTM_MEDIUM_FIELD_ID,
    registrationDateFieldId: process.env.GHL_REGISTRATION_DATE_FIELD_ID,
    pageOfOriginFieldId: process.env.GHL_PAGE_OF_ORIGIN_FIELD_ID,
    propertiesOwnedFieldId: process.env.GHL_PROPERTIES_OWNED_FIELD_ID,
    tags: String(process.env.GHL_TAGS || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function getContactData(registrant) {
  const required = ['firstName', 'lastName', 'email'];
  const missing = required.filter((name) => !registrant[name]);

  if (missing.length > 0) {
    throw new Error(`Missing GoHighLevel registrant field(s): ${missing.join(', ')}`);
  }

  const {
    firstName,
    lastName,
    email,
    mobile,
    selectedSession,
    selectedDate,
    leadSource,
    utmSource,
    utmCampaign,
    utmMedium,
    registrationDate,
    funnelStage,
    page,
    propertiesOwned,
  } = registrant;
  const config = getGhlConfig();
  const customFields = [
    [config.funnelStageFieldId, funnelStage],
    [config.leadSourceFieldId, leadSource],
    [config.selectedSessionFieldId, selectedSession],
    [config.selectedDateFieldId, selectedDate],
    [config.utmSourceFieldId, utmSource],
    [config.utmCampaignFieldId, utmCampaign],
    [config.utmMediumFieldId, utmMedium],
    [config.registrationDateFieldId, registrationDate],
    [config.pageOfOriginFieldId, page],
    [config.propertiesOwnedFieldId, propertiesOwned],
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([id, value]) => ({ id, field_value: value }));

  const contact = {
    locationId: config.locationId,
    firstName,
    lastName,
    email,
    customFields,
  };

  if (mobile) contact.phone = mobile;
  if (config.tags.length > 0) contact.tags = config.tags;
  return contact;
}

async function ghlRequest(path, options, phase = 'request') {
  const config = getGhlConfig();
  let response;
  try {
    response = await fetch(`${GHL_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Version: GHL_API_VERSION,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw providerError('ghl', 'network', phase);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw providerError('ghl', response.status, phase);
  }

  if (!response.ok) {
    const detail = payload.message || payload.error || `HTTP ${response.status}`;
    throw providerError('ghl', response.status, phase);
  }

  return payload;
}

async function findContactByEmail(email) {
  const config = getGhlConfig();
  const payload = await ghlRequest('/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      locationId: config.locationId,
      pageLimit: 1,
      filters: [{ field: 'email', operator: 'eq', value: email }],
    }),
  }, 'contact_search');

  return payload.contacts?.[0] || null;
}

async function createOrUpdateGhlContact(registrant) {
  const contact = getContactData(registrant);
  const existingContact = await findContactByEmail(contact.email);

  if (existingContact) {
    return ghlRequest(`/contacts/${existingContact.id}`, {
      method: 'PUT',
      body: JSON.stringify(contact),
    }, 'contact_update');
  }

  return ghlRequest('/contacts/', {
    method: 'POST',
    body: JSON.stringify(contact),
  }, 'contact_create');
}

module.exports = { createOrUpdateGhlContact };