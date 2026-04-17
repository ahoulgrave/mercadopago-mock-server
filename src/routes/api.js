const { Router } = require('express');
const store = require('../store');

const router = Router();

// ─── Preferences (Checkout Pro) ─────────────────────────────────────
router.post('/v1/preferences', (req, res) => {
  const preference = store.createPreference(req.body);
  console.log(`[api] Created preference ${preference.id}`);
  res.status(201).json(preference);
});

router.get('/v1/preferences/:id', (req, res) => {
  const preference = store.store.preferences.get(req.params.id);
  if (!preference) return res.status(404).json({ message: 'Preference not found', status: 404 });
  res.json(preference);
});

// ─── Payments ───────────────────────────────────────────────────────
router.get('/v1/payments/:id', (req, res) => {
  const payment = store.getPayment(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found', status: 404 });
  res.json(payment);
});

// ─── PreApproval Plans (Subscription Plans) ─────────────────────────
router.post('/v1/preapproval_plans', (req, res) => {
  const plan = store.createPlan(req.body);
  console.log(`[api] Created plan ${plan.id}`);
  res.status(201).json(plan);
});

router.get('/v1/preapproval_plans/:id', (req, res) => {
  const plan = store.store.plans.get(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Plan not found', status: 404 });
  res.json(plan);
});

router.put('/v1/preapproval_plans/:id', (req, res) => {
  const plan = store.updatePlan(req.params.id, req.body);
  if (!plan) return res.status(404).json({ message: 'Plan not found', status: 404 });
  console.log(`[api] Updated plan ${plan.id}`);
  res.json(plan);
});

// ─── PreApprovals (Subscriptions) ───────────────────────────────────
router.post('/v1/preapprovals', (req, res) => {
  const preapproval = store.createPreapproval(req.body);
  console.log(`[api] Created preapproval ${preapproval.id}`);
  res.status(201).json(preapproval);
});

router.get('/v1/preapprovals/:id', (req, res) => {
  const preapproval = store.getPreapproval(req.params.id);
  if (!preapproval) return res.status(404).json({ message: 'PreApproval not found', status: 404 });
  res.json(preapproval);
});

router.put('/v1/preapprovals/:id', (req, res) => {
  const preapproval = store.updatePreapproval(req.params.id, req.body);
  if (!preapproval) return res.status(404).json({ message: 'PreApproval not found', status: 404 });
  console.log(`[api] Updated preapproval ${preapproval.id}`);
  res.json(preapproval);
});

// ─── Card Tokens (JS SDK backend) ──────────────────────────────────
router.post('/v1/card_tokens', (req, res) => {
  const token = store.createCardToken(req.body);
  console.log(`[api] Created card token ${token.id}`);
  res.status(201).json(token);
});

module.exports = router;
