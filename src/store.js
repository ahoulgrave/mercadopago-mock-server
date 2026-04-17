/**
 * In-memory store for all MercadoPago mock resources.
 * Everything resets on server restart (by design — it's a mock).
 */

let idCounter = 1000000000;
function nextId() {
  return String(++idCounter);
}

const store = {
  preferences: new Map(),
  payments: new Map(),
  plans: new Map(),
  preapprovals: new Map(),
  cardTokens: new Map(),
  webhookLogs: [],
};

function createPreference(data) {
  const id = nextId();
  const now = new Date().toISOString();
  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

  const preference = {
    id,
    items: data.items || [],
    external_reference: data.external_reference || '',
    back_urls: data.back_urls || {},
    notification_url: data.notification_url || '',
    auto_return: data.auto_return || '',
    init_point: `${baseUrl}/checkout/${id}`,
    sandbox_init_point: `${baseUrl}/checkout/${id}`,
    date_created: now,
    // Track internally for webhook triggering
    _status: 'pending',
    _payment_id: null,
  };

  store.preferences.set(id, preference);
  return preference;
}

function createPaymentFromPreference(preferenceId, status = 'approved') {
  const preference = store.preferences.get(preferenceId);
  if (!preference) return null;

  const id = parseInt(nextId());
  const now = new Date().toISOString();

  const payment = {
    id,
    status,
    status_detail: status === 'approved' ? 'accredited' : status === 'rejected' ? 'cc_rejected_other_reason' : 'pending_review_manual',
    payment_type_id: 'credit_card',
    payment_method_id: 'visa',
    transaction_amount: preference.items?.[0]?.unit_price || 0,
    currency_id: preference.items?.[0]?.currency_id || 'ARS',
    description: preference.items?.[0]?.title || '',
    external_reference: preference.external_reference,
    notification_url: preference.notification_url,
    date_created: now,
    date_approved: status === 'approved' ? now : null,
    date_last_updated: now,
    payer: {
      email: 'test@test.com',
      identification: { type: 'DNI', number: '12345678' },
    },
    _preference_id: preferenceId,
  };

  preference._payment_id = id;
  preference._status = status;
  store.payments.set(id, payment);
  return payment;
}

function getPayment(id) {
  return store.payments.get(parseInt(id)) || store.payments.get(String(id)) || null;
}

function updatePaymentStatus(id, status) {
  const payment = getPayment(id);
  if (!payment) return null;

  const now = new Date().toISOString();
  payment.status = status;
  payment.date_last_updated = now;

  if (status === 'approved') {
    payment.status_detail = 'accredited';
    payment.date_approved = now;
  } else if (status === 'rejected') {
    payment.status_detail = 'cc_rejected_other_reason';
  } else if (status === 'refunded') {
    payment.status_detail = 'refunded';
  }

  return payment;
}

function createPlan(data) {
  const id = nextId();
  const now = new Date().toISOString();

  const plan = {
    id,
    status: 'active',
    reason: data.reason || '',
    auto_recurring: data.auto_recurring || {},
    back_url: data.back_url || '',
    date_created: now,
    last_modified: now,
  };

  store.plans.set(id, plan);
  return plan;
}

function updatePlan(id, data) {
  const plan = store.plans.get(id);
  if (!plan) return null;

  if (data.auto_recurring) {
    plan.auto_recurring = { ...plan.auto_recurring, ...data.auto_recurring };
  }
  plan.last_modified = new Date().toISOString();
  return plan;
}

function createPreapproval(data) {
  const id = nextId();
  const now = new Date().toISOString();
  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

  // If linked to a plan, inherit plan's auto_recurring
  let autoRecurring = data.auto_recurring || {};
  if (data.preapproval_plan_id) {
    const plan = store.plans.get(data.preapproval_plan_id);
    if (plan) {
      autoRecurring = { ...plan.auto_recurring, ...autoRecurring };
    }
  }

  const preapproval = {
    id,
    status: data.status || 'pending',
    preapproval_plan_id: data.preapproval_plan_id || null,
    reason: data.reason || '',
    external_reference: data.external_reference || '',
    payer_email: data.payer_email || '',
    card_token_id: data.card_token_id || null,
    auto_recurring: autoRecurring,
    init_point: `${baseUrl}/subscription/${id}`,
    sandbox_init_point: `${baseUrl}/subscription/${id}`,
    date_created: now,
    last_modified: now,
    // Internal notification URL from the plan or preference
    _notification_url: null,
  };

  store.preapprovals.set(id, preapproval);
  return preapproval;
}

function getPreapproval(id) {
  return store.preapprovals.get(id) || null;
}

function updatePreapproval(id, data) {
  const preapproval = store.preapprovals.get(id);
  if (!preapproval) return null;

  if (data.status) preapproval.status = data.status;
  if (data.auto_recurring) {
    preapproval.auto_recurring = { ...preapproval.auto_recurring, ...data.auto_recurring };
  }
  preapproval.last_modified = new Date().toISOString();
  return preapproval;
}

function createCardToken(data) {
  const id = `tok_mock_${nextId()}`;

  const cardNumber = data.card_number || '';
  const token = {
    id,
    public_key: data.public_key || '',
    card_id: null,
    card_number_length: cardNumber.length || 16,
    first_six_digits: cardNumber.substring(0, 6) || '424242',
    last_four_digits: cardNumber.slice(-4) || '4242',
    status: 'active',
    date_used: null,
    date_created: new Date().toISOString(),
    date_last_updated: new Date().toISOString(),
    date_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    expiration_month: data.expiration_month || 12,
    expiration_year: data.expiration_year || 2030,
    luhn_validation: true,
    live_mode: false,
    cardholder: data.cardholder || { name: 'TEST USER' },
    security_code_length: data.security_code ? data.security_code.length : 3,
  };

  store.cardTokens.set(id, token);
  return token;
}

function getAllResources() {
  return {
    preferences: [...store.preferences.values()],
    payments: [...store.payments.values()],
    plans: [...store.plans.values()],
    preapprovals: [...store.preapprovals.values()],
    webhookLogs: store.webhookLogs.slice(-50),
  };
}

function logWebhook(entry) {
  store.webhookLogs.push({ ...entry, timestamp: new Date().toISOString() });
  // Keep last 200
  if (store.webhookLogs.length > 200) {
    store.webhookLogs = store.webhookLogs.slice(-200);
  }
}

module.exports = {
  store,
  createPreference,
  createPaymentFromPreference,
  getPayment,
  updatePaymentStatus,
  createPlan,
  updatePlan,
  createPreapproval,
  getPreapproval,
  updatePreapproval,
  createCardToken,
  getAllResources,
  logWebhook,
};
