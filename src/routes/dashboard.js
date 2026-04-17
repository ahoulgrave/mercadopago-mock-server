const { Router } = require('express');
const { getAllResources, getPayment, updatePaymentStatus, getPreapproval, updatePreapproval, updatePayment, store } = require('../store');
const { sendWebhook } = require('../webhooks');

const router = Router();

router.get('/dashboard', (req, res) => {
  res.send(dashboardPage());
});

// Dashboard API
router.get('/dashboard/api/state', (req, res) => {
  res.json(getAllResources());
});

router.post('/dashboard/api/webhook', async (req, res) => {
  const { type, resourceId, status } = req.body;

  if (type === 'payment') {
    const payment = getPayment(resourceId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (status) updatePaymentStatus(resourceId, status);

    const webhookUrl = payment.notification_url || process.env.WEBHOOK_URL || '';
    const result = await sendWebhook(webhookUrl, 'payment', payment.id);
    return res.json({ ok: true, ...result });
  }

  if (type === 'subscription_preapproval') {
    const preapproval = getPreapproval(resourceId);
    if (!preapproval) return res.status(404).json({ error: 'Preapproval not found' });

    if (status) updatePreapproval(resourceId, { status });

    const webhookUrl = process.env.WEBHOOK_URL || '';
    const result = await sendWebhook(webhookUrl, 'subscription_preapproval', preapproval.id);
    return res.json({ ok: true, ...result });
  }

  res.status(400).json({ error: 'Unknown webhook type' });
});

function dashboardPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MercadoPago Mock - Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; }
    .header { background: #009ee3; color: white; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 18px; font-weight: 600; }
    .badge { background: #ff6b35; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .content { max-width: 1200px; margin: 24px auto; padding: 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 16px; }
    .section { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .section h2 { font-size: 14px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section h2 .count { background: #009ee3; color: white; font-size: 11px; padding: 1px 6px; border-radius: 10px; }
    .item { border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 13px; }
    .item:last-child { margin-bottom: 0; }
    .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .item-id { font-weight: 600; font-family: monospace; font-size: 12px; }
    .status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
    .status-approved, .status-authorized, .status-active { background: #e6f9ee; color: #00a650; }
    .status-rejected, .status-cancelled { background: #fde8ea; color: #f23d4f; }
    .status-pending { background: #fff4e0; color: #ff9900; }
    .status-refunded { background: #e8eaf6; color: #5c6bc0; }
    .item-detail { color: #666; font-size: 12px; margin-top: 4px; }
    .item-actions { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
    .item-actions button { font-size: 11px; padding: 4px 10px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: white; transition: all 0.15s; }
    .item-actions button:hover { background: #f5f5f5; }
    .item-actions button.action-approve { border-color: #00a650; color: #00a650; }
    .item-actions button.action-reject { border-color: #f23d4f; color: #f23d4f; }
    .item-actions button.action-refund { border-color: #5c6bc0; color: #5c6bc0; }
    .item-actions button.action-webhook { border-color: #009ee3; color: #009ee3; }
    .empty { color: #999; font-size: 13px; text-align: center; padding: 24px; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #333; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; opacity: 0; transition: opacity 0.3s; z-index: 100; }
    .toast.show { opacity: 1; }
    .log-entry { font-family: monospace; font-size: 11px; padding: 6px 8px; border-left: 3px solid #009ee3; margin-bottom: 4px; background: #f8f9fa; border-radius: 0 4px 4px 0; }
    .log-entry.log-error { border-left-color: #f23d4f; }
    .log-entry.log-delivered { border-left-color: #00a650; }
    .refresh-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .refresh-bar button { background: #009ee3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .refresh-bar button:hover { background: #0088cc; }
    .auto-refresh { font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MercadoPago Mock Server</h1>
    <span class="badge">LOCAL</span>
  </div>

  <div class="content">
    <div class="refresh-bar">
      <div class="auto-refresh">Auto-refreshes every 3s</div>
      <button onclick="refresh()">Refresh Now</button>
    </div>

    <div class="grid">
      <div class="section" id="preferences-section">
        <h2>Preferences <span class="count" id="pref-count">0</span></h2>
        <div id="preferences" class="empty">No preferences yet</div>
      </div>

      <div class="section" id="payments-section">
        <h2>Payments <span class="count" id="pay-count">0</span></h2>
        <div id="payments" class="empty">No payments yet</div>
      </div>

      <div class="section" id="plans-section">
        <h2>Plans <span class="count" id="plan-count">0</span></h2>
        <div id="plans" class="empty">No plans yet</div>
      </div>

      <div class="section" id="preapprovals-section">
        <h2>Subscriptions <span class="count" id="sub-count">0</span></h2>
        <div id="preapprovals" class="empty">No subscriptions yet</div>
      </div>

      <div class="section" id="customers-section">
        <h2>Customers <span class="count" id="cust-count">0</span></h2>
        <div id="customers" class="empty">No customers yet</div>
      </div>

      <div class="section" id="orders-section">
        <h2>Orders <span class="count" id="order-count">0</span></h2>
        <div id="orders" class="empty">No orders yet</div>
      </div>

      <div class="section" id="merchant-orders-section">
        <h2>Merchant Orders <span class="count" id="mo-count">0</span></h2>
        <div id="merchantOrders" class="empty">No merchant orders yet</div>
      </div>

      <div class="section" style="grid-column: 1 / -1;">
        <h2>Webhook Log <span class="count" id="log-count">0</span></h2>
        <div id="webhookLogs" class="empty">No webhooks sent yet</div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    function toast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2500);
    }

    async function sendWebhook(type, resourceId, status) {
      try {
        const res = await fetch('/dashboard/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, resourceId, status }),
        });
        const data = await res.json();
        toast(data.sent ? 'Webhook sent (' + (data.status || 'ok') + ')' : 'Webhook failed: ' + (data.error || data.reason));
        setTimeout(refresh, 500);
      } catch (e) {
        toast('Error: ' + e.message);
      }
    }

    function renderPreferences(items) {
      document.getElementById('pref-count').textContent = items.length;
      if (!items.length) { document.getElementById('preferences').innerHTML = '<div class="empty">No preferences yet</div>'; return; }
      document.getElementById('preferences').innerHTML = items.map(p => {
        const item = p.items?.[0] || {};
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + p.id + '</span><span class="status status-' + p._status + '">' + p._status + '</span></div>' +
          '<div class="item-detail">' + esc(item.title || '-') + ' &mdash; ' + (item.currency_id || '') + ' ' + (item.unit_price || 0) + '</div>' +
          '<div class="item-detail">Ref: ' + esc(p.external_reference) + '</div>' +
          '<div class="item-detail"><a href="' + p.init_point + '" target="_blank">Open checkout &rarr;</a></div>' +
        '</div>';
      }).join('');
    }

    function renderPayments(items) {
      document.getElementById('pay-count').textContent = items.length;
      if (!items.length) { document.getElementById('payments').innerHTML = '<div class="empty">No payments yet</div>'; return; }
      document.getElementById('payments').innerHTML = items.map(p => {
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + p.id + '</span><span class="status status-' + p.status + '">' + p.status + '</span></div>' +
          '<div class="item-detail">' + (p.currency_id || 'ARS') + ' ' + p.transaction_amount + ' &mdash; ' + esc(p.external_reference || '') + '</div>' +
          '<div class="item-actions">' +
            '<button class="action-approve" onclick="sendWebhook(&#39;payment&#39;,&#39;' + p.id + '&#39;,&#39;approved&#39;)">Approve</button>' +
            '<button class="action-reject" onclick="sendWebhook(&#39;payment&#39;,&#39;' + p.id + '&#39;,&#39;rejected&#39;)">Reject</button>' +
            '<button class="action-refund" onclick="sendWebhook(&#39;payment&#39;,&#39;' + p.id + '&#39;,&#39;refunded&#39;)">Refund</button>' +
            '<button class="action-webhook" onclick="sendWebhook(&#39;payment&#39;,&#39;' + p.id + '&#39;)">Re-send Webhook</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderPlans(items) {
      document.getElementById('plan-count').textContent = items.length;
      if (!items.length) { document.getElementById('plans').innerHTML = '<div class="empty">No plans yet</div>'; return; }
      document.getElementById('plans').innerHTML = items.map(p => {
        const r = p.auto_recurring || {};
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + p.id + '</span><span class="status status-' + p.status + '">' + p.status + '</span></div>' +
          '<div class="item-detail">' + esc(p.reason) + ' &mdash; ' + (r.currency_id || '') + ' ' + (r.transaction_amount || 0) + ' / ' + (r.frequency || 1) + ' ' + (r.frequency_type || 'months') + '</div>' +
        '</div>';
      }).join('');
    }

    function renderPreapprovals(items) {
      document.getElementById('sub-count').textContent = items.length;
      if (!items.length) { document.getElementById('preapprovals').innerHTML = '<div class="empty">No subscriptions yet</div>'; return; }
      document.getElementById('preapprovals').innerHTML = items.map(p => {
        const r = p.auto_recurring || {};
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + p.id + '</span><span class="status status-' + p.status + '">' + p.status + '</span></div>' +
          '<div class="item-detail">' + esc(p.reason) + ' &mdash; ' + (r.currency_id || '') + ' ' + (r.transaction_amount || 0) + '</div>' +
          '<div class="item-detail">Email: ' + esc(p.payer_email) + ' | Ref: ' + esc(p.external_reference) + '</div>' +
          '<div class="item-actions">' +
            '<button class="action-approve" onclick="sendWebhook(&#39;subscription_preapproval&#39;,&#39;' + p.id + '&#39;,&#39;authorized&#39;)">Authorize</button>' +
            '<button class="action-reject" onclick="sendWebhook(&#39;subscription_preapproval&#39;,&#39;' + p.id + '&#39;,&#39;cancelled&#39;)">Cancel</button>' +
            '<button class="action-webhook" onclick="sendWebhook(&#39;subscription_preapproval&#39;,&#39;' + p.id + '&#39;)">Re-send Webhook</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderLogs(items) {
      document.getElementById('log-count').textContent = items.length;
      if (!items.length) { document.getElementById('webhookLogs').innerHTML = '<div class="empty">No webhooks sent yet</div>'; return; }
      document.getElementById('webhookLogs').innerHTML = items.slice().reverse().map(l => {
        return '<div class="log-entry log-' + l.status + '">' +
          '<strong>' + l.type + ':' + l.dataId + '</strong> &rarr; ' + esc(l.url || '') +
          ' [' + l.status + (l.responseStatus ? ' ' + l.responseStatus : '') + ']' +
          ' <span style="color:#999">' + (l.timestamp || '') + '</span>' +
          (l.error ? ' <span style="color:#f23d4f">' + esc(l.error) + '</span>' : '') +
        '</div>';
      }).join('');
    }

    function renderCustomers(items) {
      document.getElementById('cust-count').textContent = items.length;
      if (!items.length) { document.getElementById('customers').innerHTML = '<div class="empty">No customers yet</div>'; return; }
      document.getElementById('customers').innerHTML = items.map(c => {
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + c.id + '</span><span class="status status-active">' + c.status + '</span></div>' +
          '<div class="item-detail">' + esc(c.email) + '</div>' +
          '<div class="item-detail">' + esc((c.first_name || '') + ' ' + (c.last_name || '')).trim() + '</div>' +
          '<div class="item-detail">Cards: ' + (c.cards?.paging?.total || 0) + '</div>' +
        '</div>';
      }).join('');
    }

    function renderOrders(items) {
      document.getElementById('order-count').textContent = items.length;
      if (!items.length) { document.getElementById('orders').innerHTML = '<div class="empty">No orders yet</div>'; return; }
      document.getElementById('orders').innerHTML = items.map(o => {
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + o.id + '</span><span class="status status-' + o.status + '">' + o.status + '</span></div>' +
          '<div class="item-detail">' + esc(o.description || '-') + ' &mdash; ' + (o.total_amount || 0) + '</div>' +
          '<div class="item-detail">Ref: ' + esc(o.external_reference) + ' | Txns: ' + (o.transactions?.payments?.length || 0) + '</div>' +
        '</div>';
      }).join('');
    }

    function renderMerchantOrders(items) {
      document.getElementById('mo-count').textContent = items.length;
      if (!items.length) { document.getElementById('merchantOrders').innerHTML = '<div class="empty">No merchant orders yet</div>'; return; }
      document.getElementById('merchantOrders').innerHTML = items.map(m => {
        return '<div class="item">' +
          '<div class="item-header"><span class="item-id">' + m.id + '</span><span class="status status-' + (m.cancelled ? 'cancelled' : 'active') + '">' + m.order_status + '</span></div>' +
          '<div class="item-detail">Total: ' + (m.total_amount || 0) + ' | Paid: ' + (m.paid_amount || 0) + '</div>' +
          '<div class="item-detail">Ref: ' + esc(m.external_reference) + '</div>' +
        '</div>';
      }).join('');
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    async function refresh() {
      try {
        const res = await fetch('/dashboard/api/state');
        const data = await res.json();
        renderPreferences(data.preferences);
        renderPayments(data.payments);
        renderPlans(data.plans);
        renderPreapprovals(data.preapprovals);
        renderCustomers(data.customers);
        renderOrders(data.orders);
        renderMerchantOrders(data.merchantOrders);
        renderLogs(data.webhookLogs);
      } catch (e) {
        console.error('Refresh failed:', e);
      }
    }

    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}

module.exports = router;
