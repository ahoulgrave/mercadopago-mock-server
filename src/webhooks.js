const crypto = require('crypto');
const { logWebhook } = require('./store');

/**
 * Send a webhook to the configured URL with MercadoPago-compatible HMAC-SHA256 signature.
 *
 * Official MercadoPago signature format:
 *   x-signature: ts={timestamp},v1={hmac}
 *   manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
 *
 * Query params sent: data.id={id}&type={type}
 * See: https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */

const MOCK_USER_ID = '123456789';
const MOCK_APPLICATION_ID = 1234567890123456;

// Subscription-related topics use a different body format than payment topics
const SUBSCRIPTION_TYPES = new Set([
  'subscription_authorized_payment',
  'subscription_preapproval',
  'subscription_preapproval_plan',
]);

function buildWebhookBody(type, dataId, action) {
  const notificationId = parseInt(crypto.randomBytes(4).toString('hex'), 16);
  const dataIdStr = String(dataId);

  if (SUBSCRIPTION_TYPES.has(type)) {
    // Subscription webhook format (matches production logs)
    const entityMap = {
      subscription_authorized_payment: 'authorized_payment',
      subscription_preapproval: 'preapproval',
      subscription_preapproval_plan: 'preapproval_plan',
    };
    return {
      action: action || 'created',
      application_id: MOCK_APPLICATION_ID,
      data: { id: dataIdStr },
      date: new Date().toISOString(),
      entity: entityMap[type] || type,
      id: notificationId,
      type,
      version: 0,
    };
  }

  // Standard webhook format (payment, merchant_order, etc.)
  return {
    id: notificationId,
    live_mode: false,
    type,
    date_created: new Date().toISOString(),
    user_id: MOCK_USER_ID,
    api_version: 'v1',
    action: action || `${type}.created`,
    data: { id: dataIdStr },
  };
}

async function sendWebhook(url, type, dataId, { secret, action } = {}) {
  if (!url) {
    console.log(`[webhook] No URL configured, skipping webhook for ${type}:${dataId}`);
    return { sent: false, reason: 'no_url' };
  }

  const webhookSecret = secret || process.env.WEBHOOK_SECRET || 'mock-webhook-secret';
  const requestId = crypto.randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();
  const dataIdStr = String(dataId);

  // Build HMAC signature per official docs
  const manifest = `id:${dataIdStr};request-id:${requestId};ts:${ts};`;
  const signature = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  const body = buildWebhookBody(type, dataIdStr, action);

  // MercadoPago sends data.id as a query parameter
  const separator = url.includes('?') ? '&' : '?';
  const webhookUrl = `${url}${separator}data.id=${dataIdStr}&type=${type}`;

  const headers = {
    'Content-Type': 'application/json',
    'x-signature': `ts=${ts},v1=${signature}`,
    'x-request-id': requestId,
    'user-agent': 'MercadoPago WebHook v1.0',
  };

  const logEntry = {
    url: webhookUrl,
    type,
    dataId: dataIdStr,
    requestId,
    action: body.action,
    status: 'pending',
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    logEntry.status = response.ok ? 'delivered' : 'failed';
    logEntry.responseStatus = response.status;
    logEntry.responseBody = await response.text().catch(() => '');
    logWebhook(logEntry);

    console.log(`[webhook] ${body.action} ${type}:${dataIdStr} → ${url} (${response.status})`);
    return { sent: true, status: response.status };
  } catch (err) {
    logEntry.status = 'error';
    logEntry.error = err.message;
    logWebhook(logEntry);

    console.error(`[webhook] Failed to send ${type}:${dataIdStr} → ${url}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendWebhook };
