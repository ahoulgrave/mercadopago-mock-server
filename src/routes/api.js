const { Router } = require('express');
const store = require('../store');
const { sendWebhook } = require('../webhooks');

const router = Router();

function getWebhookUrl(resource) {
  return resource?.notification_url || process.env.WEBHOOK_URL || '';
}

// ─── Auth middleware (log access token) ────────────────────────────
router.use((req, res, next) => {
  // Accept any Bearer token — we're a mock
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    req.accessToken = auth.slice(7);
  }
  next();
});

// ─── OAuth ─────────────────────────────────────────────────────────
router.post('/oauth/token', (req, res) => {
  const now = new Date().toISOString();
  res.json({
    access_token: 'APP_USR-mock-access-token-' + Date.now(),
    token_type: 'Bearer',
    expires_in: 21600,
    scope: 'offline_access read write',
    user_id: 123456789,
    refresh_token: 'TG-mock-refresh-token-' + Date.now(),
    public_key: 'APP_USR-mock-public-key',
    live_mode: false,
    date_created: now,
  });
});

// ─── Preferences (Checkout Pro) ─────────────────────────────────────
router.post('/checkout/preferences', (req, res) => {
  const preference = store.createPreference(req.body);
  console.log(`[api] Created preference ${preference.id}`);
  res.status(201).json(preference);
});

router.get('/checkout/preferences/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchPreferences(filters, parseInt(offset), parseInt(limit)));
});

router.get('/checkout/preferences/:id', (req, res) => {
  const preference = store.store.preferences.get(req.params.id);
  if (!preference) return res.status(404).json({ message: 'Preference not found', status: 404 });
  res.json(preference);
});

router.put('/checkout/preferences/:id', (req, res) => {
  const preference = store.updatePreference(req.params.id, req.body);
  if (!preference) return res.status(404).json({ message: 'Preference not found', status: 404 });
  console.log(`[api] Updated preference ${preference.id}`);
  res.json(preference);
});

// ─── Payments ───────────────────────────────────────────────────────
router.post('/v1/payments', async (req, res) => {
  const payment = store.createPayment(req.body);
  console.log(`[api] Created payment ${payment.id} (${payment.status})`);
  const url = getWebhookUrl(payment);
  if (url) await sendWebhook(url, 'payment', payment.id);
  res.status(201).json(payment);
});

router.get('/v1/payments/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchPayments(filters, parseInt(offset), parseInt(limit)));
});

router.get('/v1/payments/:id', (req, res) => {
  const payment = store.getPayment(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found', status: 404 });
  res.json(payment);
});

router.put('/v1/payments/:id', async (req, res) => {
  const payment = store.updatePayment(req.params.id, req.body);
  if (!payment) return res.status(404).json({ message: 'Payment not found', status: 404 });
  console.log(`[api] Updated payment ${payment.id} (${payment.status})`);
  const url = getWebhookUrl(payment);
  if (url) await sendWebhook(url, 'payment', payment.id, { action: 'payment.updated' });
  res.json(payment);
});

// ─── Refunds ────────────────────────────────────────────────────────
router.post('/v1/payments/:paymentId/refunds', (req, res) => {
  const refund = store.createRefund(req.params.paymentId, req.body);
  if (!refund) return res.status(404).json({ message: 'Payment not found', status: 404 });
  console.log(`[api] Created refund ${refund.id} for payment ${req.params.paymentId}`);
  res.status(201).json(refund);
});

router.get('/v1/payments/:paymentId/refunds', (req, res) => {
  const refunds = store.listRefunds(req.params.paymentId);
  res.json(refunds);
});

router.get('/v1/payments/:paymentId/refunds/:refundId', (req, res) => {
  const refund = store.getRefund(req.params.paymentId, req.params.refundId);
  if (!refund) return res.status(404).json({ message: 'Refund not found', status: 404 });
  res.json(refund);
});

// ─── Customers ──────────────────────────────────────────────────────
router.post('/v1/customers', (req, res) => {
  const customer = store.createCustomer(req.body);
  console.log(`[api] Created customer ${customer.id}`);
  res.status(201).json(customer);
});

router.get('/v1/customers/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchCustomers(filters, parseInt(offset), parseInt(limit)));
});

router.get('/v1/customers/:id', (req, res) => {
  const customer = store.getCustomer(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found', status: 404 });
  res.json(customer);
});

router.put('/v1/customers/:id', (req, res) => {
  const customer = store.updateCustomer(req.params.id, req.body);
  if (!customer) return res.status(404).json({ message: 'Customer not found', status: 404 });
  console.log(`[api] Updated customer ${customer.id}`);
  res.json(customer);
});

router.delete('/v1/customers/:id', (req, res) => {
  const customer = store.deleteCustomer(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found', status: 404 });
  console.log(`[api] Deleted customer ${req.params.id}`);
  res.json(customer);
});

// ─── Customer Cards ─────────────────────────────────────────────────
router.post('/v1/customers/:customerId/cards', (req, res) => {
  const card = store.createCustomerCard(req.params.customerId, req.body);
  if (!card) return res.status(404).json({ message: 'Customer not found', status: 404 });
  console.log(`[api] Created card ${card.id} for customer ${req.params.customerId}`);
  res.status(201).json(card);
});

router.get('/v1/customers/:customerId/cards', (req, res) => {
  const cards = store.listCustomerCards(req.params.customerId);
  res.json(cards);
});

router.get('/v1/customers/:customerId/cards/:cardId', (req, res) => {
  const card = store.getCustomerCard(req.params.customerId, req.params.cardId);
  if (!card) return res.status(404).json({ message: 'Card not found', status: 404 });
  res.json(card);
});

router.put('/v1/customers/:customerId/cards/:cardId', (req, res) => {
  const card = store.updateCustomerCard(req.params.customerId, req.params.cardId, req.body);
  if (!card) return res.status(404).json({ message: 'Card not found', status: 404 });
  res.json(card);
});

router.delete('/v1/customers/:customerId/cards/:cardId', (req, res) => {
  const card = store.deleteCustomerCard(req.params.customerId, req.params.cardId);
  if (!card) return res.status(404).json({ message: 'Card not found', status: 404 });
  console.log(`[api] Deleted card ${req.params.cardId} from customer ${req.params.customerId}`);
  res.json(card);
});

// ─── Card Tokens ──────────────────────────────────────────────────
router.post('/v1/card_tokens', (req, res) => {
  const token = store.createCardToken(req.body);
  console.log(`[api] Created card token ${token.id}`);
  res.status(201).json(token);
});

router.get('/v1/card_tokens/:id', (req, res) => {
  const token = store.getCardToken(req.params.id);
  if (!token) return res.status(404).json({ message: 'Card token not found', status: 404 });
  res.json(token);
});

// ─── Orders (new API) ──────────────────────────────────────────────
router.post('/v1/orders', (req, res) => {
  const order = store.createOrder(req.body);
  console.log(`[api] Created order ${order.id}`);
  res.status(201).json(order);
});

router.get('/v1/orders/:id', (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', status: 404 });
  res.json(order);
});

router.post('/v1/orders/:id/process', (req, res) => {
  const order = store.processOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', status: 404 });
  console.log(`[api] Processed order ${order.id}`);
  res.json(order);
});

router.post('/v1/orders/:id/capture', (req, res) => {
  const order = store.captureOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', status: 404 });
  console.log(`[api] Captured order ${order.id}`);
  res.json(order);
});

router.post('/v1/orders/:id/cancel', (req, res) => {
  const order = store.cancelOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', status: 404 });
  console.log(`[api] Cancelled order ${order.id}`);
  res.json(order);
});

router.post('/v1/orders/:id/refund', (req, res) => {
  const order = store.refundOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', status: 404 });
  console.log(`[api] Refunded order ${order.id}`);
  res.json(order);
});

router.post('/v1/orders/:id/transactions', (req, res) => {
  const tx = store.createOrderTransaction(req.params.id, req.body);
  if (!tx) return res.status(404).json({ message: 'Order not found', status: 404 });
  console.log(`[api] Created transaction ${tx.id} for order ${req.params.id}`);
  res.status(201).json(tx);
});

router.put('/v1/orders/:id/transactions/:transactionId', (req, res) => {
  const tx = store.updateOrderTransaction(req.params.id, req.params.transactionId, req.body);
  if (!tx) return res.status(404).json({ message: 'Transaction not found', status: 404 });
  res.json(tx);
});

router.delete('/v1/orders/:id/transactions/:transactionId', (req, res) => {
  const tx = store.deleteOrderTransaction(req.params.id, req.params.transactionId);
  if (!tx) return res.status(404).json({ message: 'Transaction not found', status: 404 });
  console.log(`[api] Deleted transaction ${req.params.transactionId} from order ${req.params.id}`);
  res.json(tx);
});

// ─── Merchant Orders ────────────────────────────────────────────────
router.post('/merchant_orders', (req, res) => {
  const mo = store.createMerchantOrder(req.body);
  console.log(`[api] Created merchant order ${mo.id}`);
  res.status(201).json(mo);
});

router.get('/merchant_orders/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchMerchantOrders(filters, parseInt(offset), parseInt(limit)));
});

router.get('/merchant_orders/:id', (req, res) => {
  const mo = store.getMerchantOrder(req.params.id);
  if (!mo) return res.status(404).json({ message: 'Merchant order not found', status: 404 });
  res.json(mo);
});

router.put('/merchant_orders/:id', (req, res) => {
  const mo = store.updateMerchantOrder(req.params.id, req.body);
  if (!mo) return res.status(404).json({ message: 'Merchant order not found', status: 404 });
  console.log(`[api] Updated merchant order ${mo.id}`);
  res.json(mo);
});

// ─── PreApproval Plans (Subscription Plans) ─────────────────────────
router.post('/preapproval_plan', (req, res) => {
  const plan = store.createPlan(req.body);
  console.log(`[api] Created plan ${plan.id}`);
  res.status(201).json(plan);
});

router.get('/preapproval_plan/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchPlans(filters, parseInt(offset), parseInt(limit)));
});

router.get('/preapproval_plan/:id', (req, res) => {
  const plan = store.store.plans.get(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Plan not found', status: 404 });
  res.json(plan);
});

router.put('/preapproval_plan/:id', (req, res) => {
  const plan = store.updatePlan(req.params.id, req.body);
  if (!plan) return res.status(404).json({ message: 'Plan not found', status: 404 });
  console.log(`[api] Updated plan ${plan.id}`);
  res.json(plan);
});

// ─── PreApprovals (Subscriptions) ───────────────────────────────────
router.post('/preapproval', async (req, res) => {
  const preapproval = store.createPreapproval(req.body);
  console.log(`[api] Created preapproval ${preapproval.id}`);
  const url = getWebhookUrl(preapproval) || process.env.WEBHOOK_URL || '';
  if (url) await sendWebhook(url, 'subscription_preapproval', preapproval.id);
  res.status(201).json(preapproval);
});

router.get('/preapproval/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchPreapprovals(filters, parseInt(offset), parseInt(limit)));
});

router.get('/preapproval/:id', (req, res) => {
  const preapproval = store.getPreapproval(req.params.id);
  if (!preapproval) return res.status(404).json({ message: 'PreApproval not found', status: 404 });
  res.json(preapproval);
});

router.put('/preapproval/:id', async (req, res) => {
  const preapproval = store.updatePreapproval(req.params.id, req.body);
  if (!preapproval) return res.status(404).json({ message: 'PreApproval not found', status: 404 });
  console.log(`[api] Updated preapproval ${preapproval.id}`);
  const url = getWebhookUrl(preapproval) || process.env.WEBHOOK_URL || '';
  if (url) await sendWebhook(url, 'subscription_preapproval', preapproval.id, { action: 'updated' });
  res.json(preapproval);
});

// ─── Authorized Payments (Invoices) ─────────────────────────────────
router.get('/authorized_payments/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchAuthorizedPayments(filters, parseInt(offset), parseInt(limit)));
});

router.get('/authorized_payments/:id', (req, res) => {
  const ap = store.getAuthorizedPayment(req.params.id);
  if (!ap) return res.status(404).json({ message: 'Authorized payment not found', status: 404 });
  res.json(ap);
});

// ─── Chargebacks ────────────────────────────────────────────────────
router.get('/v1/chargebacks/search', (req, res) => {
  const { offset = 0, limit = 30, ...filters } = req.query;
  res.json(store.searchChargebacks(filters, parseInt(offset), parseInt(limit)));
});

router.get('/v1/chargebacks/:id', (req, res) => {
  const cb = store.getChargeback(req.params.id);
  if (!cb) return res.status(404).json({ message: 'Chargeback not found', status: 404 });
  res.json(cb);
});

// ─── Identification Types ───────────────────────────────────────────
router.get('/v1/identification_types', (req, res) => {
  res.json([
    { id: 'DNI', name: 'DNI', min_length: 7, max_length: 8, type: 'number' },
    { id: 'CI', name: 'Cédula', min_length: 1, max_length: 9, type: 'number' },
    { id: 'LC', name: 'Libreta Cívica', min_length: 6, max_length: 7, type: 'number' },
    { id: 'LE', name: 'Libreta de Enrolamiento', min_length: 6, max_length: 7, type: 'number' },
    { id: 'CUIT', name: 'CUIT', min_length: 11, max_length: 11, type: 'number' },
    { id: 'CUIL', name: 'CUIL', min_length: 11, max_length: 11, type: 'number' },
    { id: 'Otro', name: 'Otro', min_length: 5, max_length: 20, type: 'number' },
  ]);
});

// ─── Payment Methods ────────────────────────────────────────────────
router.get('/v1/payment_methods', (req, res) => {
  res.json([
    {
      id: 'visa',
      name: 'Visa',
      payment_type_id: 'credit_card',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/visa.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/visa.gif',
      deferred_capture: 'supported',
      settings: [{ card_number: { length: 16, validation: 'standard' }, security_code: { length: 3, card_location: 'back', mode: 'mandatory' } }],
      additional_info_needed: ['cardholder_name', 'cardholder_identification_number', 'cardholder_identification_type'],
      min_allowed_amount: 1,
      max_allowed_amount: 5000000,
      accreditation_time: 2880,
      processing_modes: ['aggregator'],
    },
    {
      id: 'master',
      name: 'Mastercard',
      payment_type_id: 'credit_card',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/master.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/master.gif',
      deferred_capture: 'supported',
      settings: [{ card_number: { length: 16, validation: 'standard' }, security_code: { length: 3, card_location: 'back', mode: 'mandatory' } }],
      additional_info_needed: ['cardholder_name', 'cardholder_identification_number', 'cardholder_identification_type'],
      min_allowed_amount: 1,
      max_allowed_amount: 5000000,
      accreditation_time: 2880,
      processing_modes: ['aggregator'],
    },
    {
      id: 'amex',
      name: 'American Express',
      payment_type_id: 'credit_card',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/amex.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/amex.gif',
      deferred_capture: 'supported',
      settings: [{ card_number: { length: 15, validation: 'standard' }, security_code: { length: 4, card_location: 'front', mode: 'mandatory' } }],
      additional_info_needed: ['cardholder_name', 'cardholder_identification_number', 'cardholder_identification_type'],
      min_allowed_amount: 1,
      max_allowed_amount: 5000000,
      accreditation_time: 2880,
      processing_modes: ['aggregator'],
    },
    {
      id: 'debvisa',
      name: 'Visa Débito',
      payment_type_id: 'debit_card',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/debvisa.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/debvisa.gif',
      deferred_capture: 'unsupported',
      settings: [{ card_number: { length: 16, validation: 'standard' }, security_code: { length: 3, card_location: 'back', mode: 'mandatory' } }],
      additional_info_needed: ['cardholder_name', 'cardholder_identification_number', 'cardholder_identification_type'],
      min_allowed_amount: 1,
      max_allowed_amount: 5000000,
      accreditation_time: 0,
      processing_modes: ['aggregator'],
    },
    {
      id: 'debmaster',
      name: 'Mastercard Débito',
      payment_type_id: 'debit_card',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/debmaster.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/debmaster.gif',
      deferred_capture: 'unsupported',
      settings: [{ card_number: { length: 16, validation: 'standard' }, security_code: { length: 3, card_location: 'back', mode: 'mandatory' } }],
      additional_info_needed: ['cardholder_name', 'cardholder_identification_number', 'cardholder_identification_type'],
      min_allowed_amount: 1,
      max_allowed_amount: 5000000,
      accreditation_time: 0,
      processing_modes: ['aggregator'],
    },
    {
      id: 'rapipago',
      name: 'Rapipago',
      payment_type_id: 'ticket',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/rapipago.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/rapipago.gif',
      deferred_capture: 'does_not_apply',
      settings: [],
      additional_info_needed: [],
      min_allowed_amount: 1,
      max_allowed_amount: 60000,
      accreditation_time: 0,
      processing_modes: ['aggregator'],
    },
    {
      id: 'pagofacil',
      name: 'Pago Fácil',
      payment_type_id: 'ticket',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/pagofacil.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/pagofacil.gif',
      deferred_capture: 'does_not_apply',
      settings: [],
      additional_info_needed: [],
      min_allowed_amount: 1,
      max_allowed_amount: 60000,
      accreditation_time: 10080,
      processing_modes: ['aggregator'],
    },
    {
      id: 'account_money',
      name: 'Dinero en cuenta',
      payment_type_id: 'account_money',
      status: 'active',
      secure_thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/account_money.gif',
      thumbnail: 'https://www.mercadopago.com/org-img/MP3/API/logos/account_money.gif',
      deferred_capture: 'does_not_apply',
      settings: [],
      additional_info_needed: [],
      min_allowed_amount: 0.5,
      max_allowed_amount: 50000000,
      accreditation_time: 0,
      processing_modes: ['aggregator'],
    },
  ]);
});

// ─── Users ──────────────────────────────────────────────────────────
router.get('/users/me', (req, res) => {
  res.json({
    id: 123456789,
    nickname: 'MOCK_USER',
    registration_date: '2020-01-01T00:00:00.000-04:00',
    first_name: 'Mock',
    last_name: 'User',
    country_id: 'AR',
    email: 'mock_user@testuser.com',
    identification: { number: '12345678', type: 'DNI' },
    address: { city: 'Buenos Aires', state: 'AR-C', zip_code: '1000' },
    phone: { area_code: '011', extension: '', number: '12345678', verified: false },
    site_id: 'MLA',
    points: 0,
    tags: ['normal', 'test_user'],
    logo: null,
    status: { billing: { allow: true }, buy: { allow: true }, sell: { allow: true }, list: { allow: true } },
  });
});

module.exports = router;
