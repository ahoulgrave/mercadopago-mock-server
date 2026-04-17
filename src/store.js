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
  customers: new Map(),
  customerCards: new Map(),   // key: `${customerId}:${cardId}`
  refunds: new Map(),         // key: refundId, value includes payment_id
  orders: new Map(),
  orderTransactions: new Map(), // key: `${orderId}:${transactionId}`
  merchantOrders: new Map(),
  authorizedPayments: new Map(),
  chargebacks: new Map(),
  webhookLogs: [],
};

// ─── Generic search helper ──────────────────────────────────────────
function searchCollection(map, filters = {}, offset = 0, limit = 30) {
  let results = [...map.values()];
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    results = results.filter(item => {
      const itemVal = item[key];
      if (itemVal === undefined) return false;
      return String(itemVal) === String(value);
    });
  }
  const total = results.length;
  results = results.slice(offset, offset + limit);
  return { results, paging: { total, offset, limit } };
}

// ─── Preferences ────────────────────────────────────────────────────

function createPreference(data) {
  const id = nextId();
  const now = new Date().toISOString();
  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;

  const preference = {
    id,
    items: data.items || [],
    payer: data.payer || {},
    external_reference: data.external_reference || '',
    back_urls: data.back_urls || {},
    notification_url: data.notification_url || '',
    auto_return: data.auto_return || '',
    payment_methods: data.payment_methods || {},
    statement_descriptor: data.statement_descriptor || '',
    additional_info: data.additional_info || '',
    expires: data.expires || false,
    expiration_date_from: data.expiration_date_from || null,
    expiration_date_to: data.expiration_date_to || null,
    marketplace: data.marketplace || 'NONE',
    marketplace_fee: data.marketplace_fee || 0,
    binary_mode: data.binary_mode || false,
    init_point: `${baseUrl}/checkout/${id}`,
    sandbox_init_point: `${baseUrl}/checkout/${id}`,
    date_created: now,
    collector_id: 123456789,
    operation_type: 'regular_payment',
    _status: 'pending',
    _payment_id: null,
  };

  store.preferences.set(id, preference);
  return preference;
}

function updatePreference(id, data) {
  const preference = store.preferences.get(id);
  if (!preference) return null;

  const mutableFields = [
    'items', 'payer', 'external_reference', 'back_urls', 'notification_url',
    'auto_return', 'payment_methods', 'statement_descriptor', 'additional_info',
    'expires', 'expiration_date_from', 'expiration_date_to', 'binary_mode',
    'marketplace_fee',
  ];
  for (const field of mutableFields) {
    if (data[field] !== undefined) preference[field] = data[field];
  }
  return preference;
}

function searchPreferences(filters, offset, limit) {
  return searchCollection(store.preferences, filters, offset, limit);
}

// ─── Payments ───────────────────────────────────────────────────────

function createPayment(data) {
  const id = parseInt(nextId());
  const now = new Date().toISOString();

  const status = data.status || 'approved';
  const statusDetailMap = {
    approved: 'accredited',
    rejected: 'cc_rejected_other_reason',
    pending: 'pending_review_manual',
    in_process: 'pending_review_manual',
    authorized: 'pending_capture',
  };

  const payment = {
    id,
    status,
    status_detail: statusDetailMap[status] || 'pending_review_manual',
    payment_type_id: data.payment_type_id || 'credit_card',
    payment_method_id: data.payment_method_id || 'visa',
    issuer_id: data.issuer_id || '1',
    transaction_amount: data.transaction_amount || 0,
    transaction_amount_refunded: 0,
    currency_id: data.currency_id || 'ARS',
    description: data.description || '',
    external_reference: data.external_reference || '',
    notification_url: data.notification_url || '',
    installments: data.installments || 1,
    token: data.token || null,
    statement_descriptor: data.statement_descriptor || '',
    capture: data.capture !== undefined ? data.capture : true,
    binary_mode: data.binary_mode || false,
    payer: data.payer || { email: 'test@test.com' },
    additional_info: data.additional_info || {},
    metadata: data.metadata || {},
    date_created: now,
    date_approved: status === 'approved' ? now : null,
    date_last_updated: now,
    live_mode: false,
    operation_type: 'regular_payment',
    collector_id: 123456789,
    money_release_date: status === 'approved' ? now : null,
    _preference_id: data._preference_id || null,
  };

  store.payments.set(id, payment);
  return payment;
}

function createPaymentFromPreference(preferenceId, status = 'approved') {
  const preference = store.preferences.get(preferenceId);
  if (!preference) return null;

  const payment = createPayment({
    status,
    transaction_amount: preference.items?.[0]?.unit_price || 0,
    currency_id: preference.items?.[0]?.currency_id || 'ARS',
    description: preference.items?.[0]?.title || '',
    external_reference: preference.external_reference,
    notification_url: preference.notification_url,
    _preference_id: preferenceId,
  });

  preference._payment_id = payment.id;
  preference._status = status;
  return payment;
}

function getPayment(id) {
  return store.payments.get(parseInt(id)) || store.payments.get(String(id)) || null;
}

function updatePayment(id, data) {
  const payment = getPayment(id);
  if (!payment) return null;

  const now = new Date().toISOString();
  if (data.status) {
    payment.status = data.status;
    if (data.status === 'approved') {
      payment.status_detail = 'accredited';
      payment.date_approved = now;
    } else if (data.status === 'rejected') {
      payment.status_detail = 'cc_rejected_other_reason';
    } else if (data.status === 'cancelled') {
      payment.status_detail = 'by_collector';
    } else if (data.status === 'refunded') {
      payment.status_detail = 'refunded';
    }
  }
  if (data.capture !== undefined) payment.capture = data.capture;
  if (data.metadata) payment.metadata = { ...payment.metadata, ...data.metadata };
  if (data.transaction_amount) payment.transaction_amount = data.transaction_amount;
  payment.date_last_updated = now;
  return payment;
}

function updatePaymentStatus(id, status) {
  return updatePayment(id, { status });
}

function searchPayments(filters, offset, limit) {
  return searchCollection(store.payments, filters, offset, limit);
}

// ─── Refunds ────────────────────────────────────────────────────────

function createRefund(paymentId, data = {}) {
  const payment = getPayment(paymentId);
  if (!payment) return null;

  const id = parseInt(nextId());
  const now = new Date().toISOString();
  const amount = data.amount || payment.transaction_amount;

  const refund = {
    id,
    payment_id: payment.id,
    amount,
    status: 'approved',
    reason: data.reason || '',
    source: { id: String(payment.id), name: 'buyer', type: 'player' },
    date_created: now,
    unique_sequence_number: null,
    refund_mode: 'standard',
    adjustment_amount: 0,
    metadata: data.metadata || {},
  };

  payment.transaction_amount_refunded = (payment.transaction_amount_refunded || 0) + amount;
  if (payment.transaction_amount_refunded >= payment.transaction_amount) {
    payment.status = 'refunded';
    payment.status_detail = 'refunded';
  }
  payment.date_last_updated = now;

  store.refunds.set(id, refund);
  return refund;
}

function getRefund(paymentId, refundId) {
  const refund = store.refunds.get(parseInt(refundId));
  if (!refund || refund.payment_id !== parseInt(paymentId)) return null;
  return refund;
}

function listRefunds(paymentId) {
  return [...store.refunds.values()].filter(r => r.payment_id === parseInt(paymentId));
}

// ─── Customers ──────────────────────────────────────────────────────

function createCustomer(data) {
  const id = nextId();
  const now = new Date().toISOString();

  const customer = {
    id,
    email: data.email || '',
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    phone: data.phone || {},
    identification: data.identification || {},
    address: data.address || {},
    description: data.description || '',
    default_card: data.default_card || null,
    default_address: data.default_address || null,
    date_registered: data.date_registered || now,
    date_created: now,
    date_last_updated: now,
    metadata: data.metadata || {},
    cards: { data: [], paging: { total: 0, limit: 10, offset: 0 } },
    addresses: { data: [], paging: { total: 0, limit: 10, offset: 0 } },
    live_mode: false,
    status: 'active',
  };

  store.customers.set(id, customer);
  return customer;
}

function getCustomer(id) {
  return store.customers.get(id) || null;
}

function updateCustomer(id, data) {
  const customer = store.customers.get(id);
  if (!customer) return null;

  const mutableFields = [
    'email', 'first_name', 'last_name', 'phone', 'identification',
    'address', 'description', 'default_card', 'default_address', 'metadata',
  ];
  for (const field of mutableFields) {
    if (data[field] !== undefined) customer[field] = data[field];
  }
  customer.date_last_updated = new Date().toISOString();
  return customer;
}

function deleteCustomer(id) {
  const customer = store.customers.get(id);
  if (!customer) return null;
  store.customers.delete(id);
  return customer;
}

function searchCustomers(filters, offset, limit) {
  return searchCollection(store.customers, filters, offset, limit);
}

// ─── Customer Cards ─────────────────────────────────────────────────

function createCustomerCard(customerId, data) {
  const customer = store.customers.get(customerId);
  if (!customer) return null;

  const id = nextId();
  const now = new Date().toISOString();

  const card = {
    id,
    customer_id: customerId,
    expiration_month: data.expiration_month || 12,
    expiration_year: data.expiration_year || 2030,
    first_six_digits: data.first_six_digits || '424242',
    last_four_digits: data.last_four_digits || '4242',
    payment_method: data.payment_method || { id: 'visa', name: 'Visa', payment_type_id: 'credit_card' },
    security_code: { length: 3, card_location: 'back' },
    issuer: data.issuer || { id: 1, name: 'Mock Bank' },
    cardholder: data.cardholder || { name: 'TEST USER', identification: {} },
    date_created: now,
    date_last_updated: now,
    token: data.token || '',
  };

  const key = `${customerId}:${id}`;
  store.customerCards.set(key, card);

  // Update customer's card list
  customer.cards.data.push(card);
  customer.cards.paging.total = customer.cards.data.length;
  customer.default_card = customer.default_card || id;

  return card;
}

function getCustomerCard(customerId, cardId) {
  return store.customerCards.get(`${customerId}:${cardId}`) || null;
}

function updateCustomerCard(customerId, cardId, data) {
  const card = getCustomerCard(customerId, cardId);
  if (!card) return null;
  if (data.token) card.token = data.token;
  if (data.expiration_month) card.expiration_month = data.expiration_month;
  if (data.expiration_year) card.expiration_year = data.expiration_year;
  card.date_last_updated = new Date().toISOString();
  return card;
}

function deleteCustomerCard(customerId, cardId) {
  const key = `${customerId}:${cardId}`;
  const card = store.customerCards.get(key);
  if (!card) return null;
  store.customerCards.delete(key);

  const customer = store.customers.get(customerId);
  if (customer) {
    customer.cards.data = customer.cards.data.filter(c => c.id !== cardId);
    customer.cards.paging.total = customer.cards.data.length;
  }
  return card;
}

function listCustomerCards(customerId) {
  return [...store.customerCards.values()].filter(c => c.customer_id === customerId);
}

// ─── Card Tokens ────────────────────────────────────────────────────

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

function getCardToken(id) {
  return store.cardTokens.get(id) || null;
}

// ─── Plans (PreApproval Plans) ──────────────────────────────────────

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
    collector_id: 123456789,
    application_id: 1234567890,
    init_point: '',
    sandbox_init_point: '',
    frequency_type: data.auto_recurring?.frequency_type || 'months',
    frequency: data.auto_recurring?.frequency || 1,
    live_mode: false,
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
  if (data.reason) plan.reason = data.reason;
  if (data.back_url) plan.back_url = data.back_url;
  if (data.status) plan.status = data.status;
  plan.last_modified = new Date().toISOString();
  return plan;
}

function searchPlans(filters, offset, limit) {
  return searchCollection(store.plans, filters, offset, limit);
}

// ─── PreApprovals (Subscriptions) ───────────────────────────────────

function createPreapproval(data) {
  const id = nextId();
  const now = new Date().toISOString();
  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;

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
    back_url: data.back_url || '',
    init_point: `${baseUrl}/subscription/${id}`,
    sandbox_init_point: `${baseUrl}/subscription/${id}`,
    collector_id: 123456789,
    date_created: now,
    last_modified: now,
    live_mode: false,
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
  if (data.reason) preapproval.reason = data.reason;
  if (data.back_url) preapproval.back_url = data.back_url;
  if (data.external_reference) preapproval.external_reference = data.external_reference;
  preapproval.last_modified = new Date().toISOString();
  return preapproval;
}

function searchPreapprovals(filters, offset, limit) {
  return searchCollection(store.preapprovals, filters, offset, limit);
}

// ─── Orders ─────────────────────────────────────────────────────────

function createOrder(data) {
  const id = nextId();
  const now = new Date().toISOString();

  const order = {
    id,
    type: data.type || 'online',
    status: 'opened',
    external_reference: data.external_reference || '',
    total_amount: data.total_amount || null,
    description: data.description || '',
    payer: data.payer || {},
    transactions: { payments: [] },
    processing_mode: data.processing_mode || 'automatic',
    notification_url: data.notification_url || '',
    marketplace: data.marketplace || 'NONE',
    date_created: now,
    date_last_updated: now,
    live_mode: false,
  };

  store.orders.set(id, order);
  return order;
}

function getOrder(id) {
  return store.orders.get(id) || null;
}

function processOrder(id) {
  const order = store.orders.get(id);
  if (!order) return null;
  order.status = 'processed';
  order.date_last_updated = new Date().toISOString();
  return order;
}

function captureOrder(id) {
  const order = store.orders.get(id);
  if (!order) return null;
  order.status = 'captured';
  order.date_last_updated = new Date().toISOString();
  return order;
}

function cancelOrder(id) {
  const order = store.orders.get(id);
  if (!order) return null;
  order.status = 'cancelled';
  order.date_last_updated = new Date().toISOString();
  return order;
}

function refundOrder(id) {
  const order = store.orders.get(id);
  if (!order) return null;
  order.status = 'refunded';
  order.date_last_updated = new Date().toISOString();
  return order;
}

function createOrderTransaction(orderId, data) {
  const order = store.orders.get(orderId);
  if (!order) return null;

  const txId = nextId();
  const now = new Date().toISOString();

  const transaction = {
    id: txId,
    payment_method: data.payment_method || {},
    amount: data.amount || null,
    status: 'pending',
    date_created: now,
    date_last_updated: now,
  };

  order.transactions.payments.push(transaction);
  store.orderTransactions.set(`${orderId}:${txId}`, transaction);
  order.date_last_updated = now;
  return transaction;
}

function updateOrderTransaction(orderId, transactionId, data) {
  const key = `${orderId}:${transactionId}`;
  const tx = store.orderTransactions.get(key);
  if (!tx) return null;
  if (data.payment_method) tx.payment_method = data.payment_method;
  if (data.amount) tx.amount = data.amount;
  tx.date_last_updated = new Date().toISOString();
  return tx;
}

function deleteOrderTransaction(orderId, transactionId) {
  const key = `${orderId}:${transactionId}`;
  const tx = store.orderTransactions.get(key);
  if (!tx) return null;
  store.orderTransactions.delete(key);

  const order = store.orders.get(orderId);
  if (order) {
    order.transactions.payments = order.transactions.payments.filter(t => t.id !== transactionId);
    order.date_last_updated = new Date().toISOString();
  }
  return tx;
}

// ─── Merchant Orders ────────────────────────────────────────────────

function createMerchantOrder(data) {
  const id = nextId();
  const now = new Date().toISOString();

  const merchantOrder = {
    id,
    status: 'opened',
    external_reference: data.external_reference || '',
    preference_id: data.preference_id || '',
    items: data.items || [],
    payments: data.payments || [],
    shipments: data.shipments || [],
    payer: data.payer || {},
    collector: { id: 123456789 },
    marketplace: data.marketplace || 'NONE',
    notification_url: data.notification_url || '',
    additional_info: data.additional_info || '',
    application_id: data.application_id || '',
    site_id: data.site_id || 'MLA',
    total_amount: data.total_amount || 0,
    paid_amount: 0,
    refunded_amount: 0,
    shipping_cost: 0,
    cancelled: false,
    order_status: 'payment_required',
    date_created: now,
    last_updated: now,
    live_mode: false,
  };

  store.merchantOrders.set(id, merchantOrder);
  return merchantOrder;
}

function getMerchantOrder(id) {
  return store.merchantOrders.get(id) || null;
}

function updateMerchantOrder(id, data) {
  const mo = store.merchantOrders.get(id);
  if (!mo) return null;

  const mutableFields = [
    'external_reference', 'preference_id', 'items', 'payments',
    'shipments', 'notification_url', 'additional_info', 'site_id',
    'total_amount',
  ];
  for (const field of mutableFields) {
    if (data[field] !== undefined) mo[field] = data[field];
  }
  mo.last_updated = new Date().toISOString();
  return mo;
}

function searchMerchantOrders(filters, offset, limit) {
  return searchCollection(store.merchantOrders, filters, offset, limit);
}

// ─── Authorized Payments (Invoices) ─────────────────────────────────

function getAuthorizedPayment(id) {
  return store.authorizedPayments.get(id) || null;
}

function searchAuthorizedPayments(filters, offset, limit) {
  return searchCollection(store.authorizedPayments, filters, offset, limit);
}

// ─── Chargebacks ────────────────────────────────────────────────────

function getChargeback(id) {
  return store.chargebacks.get(id) || null;
}

function searchChargebacks(filters, offset, limit) {
  return searchCollection(store.chargebacks, filters, offset, limit);
}

// ─── Dashboard / Utility ────────────────────────────────────────────

function getAllResources() {
  return {
    preferences: [...store.preferences.values()],
    payments: [...store.payments.values()],
    plans: [...store.plans.values()],
    preapprovals: [...store.preapprovals.values()],
    customers: [...store.customers.values()],
    orders: [...store.orders.values()],
    merchantOrders: [...store.merchantOrders.values()],
    webhookLogs: store.webhookLogs.slice(-50),
  };
}

function logWebhook(entry) {
  store.webhookLogs.push({ ...entry, timestamp: new Date().toISOString() });
  if (store.webhookLogs.length > 200) {
    store.webhookLogs = store.webhookLogs.slice(-200);
  }
}

module.exports = {
  store,
  // Preferences
  createPreference,
  updatePreference,
  searchPreferences,
  // Payments
  createPayment,
  createPaymentFromPreference,
  getPayment,
  updatePayment,
  updatePaymentStatus,
  searchPayments,
  // Refunds
  createRefund,
  getRefund,
  listRefunds,
  // Customers
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  // Customer Cards
  createCustomerCard,
  getCustomerCard,
  updateCustomerCard,
  deleteCustomerCard,
  listCustomerCards,
  // Card Tokens
  createCardToken,
  getCardToken,
  // Plans
  createPlan,
  updatePlan,
  searchPlans,
  // PreApprovals
  createPreapproval,
  getPreapproval,
  updatePreapproval,
  searchPreapprovals,
  // Orders
  createOrder,
  getOrder,
  processOrder,
  captureOrder,
  cancelOrder,
  refundOrder,
  createOrderTransaction,
  updateOrderTransaction,
  deleteOrderTransaction,
  // Merchant Orders
  createMerchantOrder,
  getMerchantOrder,
  updateMerchantOrder,
  searchMerchantOrders,
  // Authorized Payments
  getAuthorizedPayment,
  searchAuthorizedPayments,
  // Chargebacks
  getChargeback,
  searchChargebacks,
  // Utility
  getAllResources,
  logWebhook,
};
