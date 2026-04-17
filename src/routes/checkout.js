const { Router } = require('express');
const { store, createPaymentFromPreference, createPayment } = require('../store');
const { sendWebhook } = require('../webhooks');

const router = Router();

/**
 * Mock checkout page — replaces MercadoPago's hosted checkout.
 * When the user clicks init_point, they land here and can choose
 * to approve, reject, or leave the payment pending.
 */
router.get('/checkout/:preferenceId', (req, res) => {
  const preference = store.preferences.get(req.params.preferenceId);
  if (!preference) {
    return res.status(404).send('<h1>Preference not found</h1>');
  }

  const item = preference.items?.[0] || {};
  const backUrls = preference.back_urls || {};

  res.send(checkoutPage(preference, item, backUrls));
});

/**
 * Process a checkout action (approve/reject/pending).
 * Creates a payment, sends a webhook, then redirects to the back_url.
 */
router.post('/checkout/:preferenceId/pay', async (req, res) => {
  const preference = store.preferences.get(req.params.preferenceId);
  if (!preference) {
    return res.status(404).json({ error: 'Preference not found' });
  }

  const status = req.body.status || 'approved';
  const payment = createPaymentFromPreference(req.params.preferenceId, status);

  // Send webhook
  const webhookUrl = preference.notification_url;
  if (webhookUrl) {
    await sendWebhook(webhookUrl, 'payment', payment.id);
  }

  // Redirect to appropriate back_url
  const backUrls = preference.back_urls || {};
  let redirectUrl;
  if (status === 'approved' && backUrls.success) redirectUrl = backUrls.success;
  else if (status === 'rejected' && backUrls.failure) redirectUrl = backUrls.failure;
  else if (backUrls.pending) redirectUrl = backUrls.pending;

  if (redirectUrl) {
    const sep = redirectUrl.includes('?') ? '&' : '?';
    redirectUrl += `${sep}payment_id=${payment.id}&status=${status}&external_reference=${preference.external_reference}`;
  }

  res.json({
    payment_id: payment.id,
    status,
    redirect_url: redirectUrl || null,
  });
});

/**
 * Mock subscription authorization page.
 */
router.get('/subscription/:preapprovalId', (req, res) => {
  const preapproval = store.preapprovals.get(req.params.preapprovalId);
  if (!preapproval) {
    return res.status(404).send('<h1>Subscription not found</h1>');
  }

  res.send(subscriptionPage(preapproval));
});

router.post('/subscription/:preapprovalId/authorize', async (req, res) => {
  const preapproval = store.preapprovals.get(req.params.preapprovalId);
  if (!preapproval) {
    return res.status(404).json({ error: 'Preapproval not found' });
  }

  const status = req.body.status || 'authorized';
  preapproval.status = status;
  preapproval.last_modified = new Date().toISOString();

  const plan = preapproval.preapproval_plan_id ? store.plans.get(preapproval.preapproval_plan_id) : null;
  const recurring = preapproval.auto_recurring || {};

  // When authorized, create a payment for the first billing cycle (like the real API does)
  let payment = null;
  if (status === 'authorized') {
    payment = createPayment({
      status: 'approved',
      payment_type_id: 'credit_card',
      payment_method_id: 'visa',
      transaction_amount: recurring.transaction_amount || 0,
      currency_id: recurring.currency_id || 'ARS',
      description: preapproval.reason || 'Subscription payment',
      external_reference: preapproval.external_reference || '',
      payer: { email: preapproval.payer_email || 'test@test.com' },
    });
    console.log(`[checkout] Created payment ${payment.id} for subscription ${preapproval.id}`);
  }

  // Send webhooks
  const notificationUrl = process.env.WEBHOOK_URL || '';
  if (notificationUrl) {
    await sendWebhook(notificationUrl, 'subscription_preapproval', preapproval.id);
    if (payment) {
      await sendWebhook(notificationUrl, 'payment', payment.id);
    }
  }

  const backUrl = plan?.back_url || '';

  res.json({
    preapproval_id: preapproval.id,
    payment_id: payment ? payment.id : null,
    status,
    redirect_url: backUrl || null,
  });
});

// ─── HTML Templates ─────────────────────────────────────────────────

function checkoutPage(preference, item, backUrls) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Checkout - MercadoPago</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">MP</div>
      <h1>MercadoPago Mock Checkout</h1>
      <span class="badge">LOCAL MOCK</span>
    </div>

    <div class="card">
      <h2>${escapeHtml(item.title || 'Payment')}</h2>
      <div class="amount">${item.currency_id || 'ARS'} ${item.unit_price || '0'}</div>
      <div class="ref">Ref: ${escapeHtml(preference.external_reference || '-')}</div>
    </div>

    <p class="hint">Choose a payment outcome:</p>

    <div class="actions">
      <button class="btn btn-success" onclick="pay('approved')">Approve Payment</button>
      <button class="btn btn-danger" onclick="pay('rejected')">Reject Payment</button>
      <button class="btn btn-warning" onclick="pay('pending')">Leave Pending</button>
    </div>

    <div id="result" class="result" style="display:none"></div>
  </div>

  <script>
    async function pay(status) {
      document.querySelectorAll('.btn').forEach(b => b.disabled = true);
      const res = await fetch('/checkout/${preference.id}/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      const el = document.getElementById('result');
      el.style.display = 'block';
      el.className = 'result result-' + status;
      el.innerHTML = '<strong>Payment ' + status + '</strong> (ID: ' + data.payment_id + ')';

      if (data.redirect_url) {
        el.innerHTML += '<br><a href="' + data.redirect_url + '">Continue to site &rarr;</a>';
      }
    }
  </script>
</body>
</html>`;
}

function subscriptionPage(preapproval) {
  const recurring = preapproval.auto_recurring || {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Subscription - MercadoPago</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">MP</div>
      <h1>MercadoPago Mock Subscription</h1>
      <span class="badge">LOCAL MOCK</span>
    </div>

    <div class="card">
      <h2>${escapeHtml(preapproval.reason || 'Subscription')}</h2>
      <div class="amount">${recurring.currency_id || 'ARS'} ${recurring.transaction_amount || '0'} / ${recurring.frequency || 1} ${recurring.frequency_type || 'months'}</div>
      <div class="ref">Email: ${escapeHtml(preapproval.payer_email || '-')}</div>
    </div>

    <p class="hint">Choose a subscription outcome:</p>

    <div class="actions">
      <button class="btn btn-success" onclick="authorize('authorized')">Authorize</button>
      <button class="btn btn-danger" onclick="authorize('cancelled')">Reject</button>
      <button class="btn btn-warning" onclick="authorize('pending')">Leave Pending</button>
    </div>

    <div id="result" class="result" style="display:none"></div>
  </div>

  <script>
    async function authorize(status) {
      document.querySelectorAll('.btn').forEach(b => b.disabled = true);
      const res = await fetch('/subscription/${preapproval.id}/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      const el = document.getElementById('result');
      el.style.display = 'block';
      el.className = 'result result-' + status;
      el.innerHTML = '<strong>Subscription ' + status + '</strong>';

      if (data.redirect_url) {
        el.innerHTML += '<br><a href="' + data.redirect_url + '">Continue to site &rarr;</a>';
      }
    }
  </script>
</body>
</html>`;
}

function sharedStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .container { max-width: 440px; width: 100%; padding: 20px; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #009ee3; color: white; border-radius: 12px; font-weight: 700; font-size: 18px; margin-bottom: 12px; }
    h1 { font-size: 20px; color: #333; }
    .badge { display: inline-block; background: #ff6b35; color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 8px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px; text-align: center; }
    .card h2 { font-size: 16px; color: #333; margin-bottom: 8px; }
    .amount { font-size: 32px; font-weight: 700; color: #009ee3; margin: 12px 0; }
    .ref { font-size: 13px; color: #999; }
    .hint { text-align: center; color: #666; font-size: 14px; margin-bottom: 12px; }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    .btn { padding: 14px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; color: white; }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-success { background: #00a650; }
    .btn-danger { background: #f23d4f; }
    .btn-warning { background: #ff9900; }
    .result { margin-top: 16px; padding: 16px; border-radius: 8px; text-align: center; font-size: 14px; }
    .result-approved, .result-authorized { background: #e6f9ee; color: #00a650; }
    .result-rejected, .result-cancelled { background: #fde8ea; color: #f23d4f; }
    .result-pending { background: #fff4e0; color: #ff9900; }
    .result a { color: inherit; margin-top: 8px; display: inline-block; }
  `;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
