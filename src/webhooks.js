const crypto = require('crypto');
const { logWebhook } = require('./store');

/**
 * Send a webhook to the configured URL with MercadoPago-compatible HMAC-SHA256 signature.
 *
 * MercadoPago signature format:
 *   x-signature: ts={timestamp},v1={hmac}
 *   manifest: id:{data.id};request-id:{requestId};ts:{ts};
 */
async function sendWebhook(url, type, dataId, { secret } = {}) {
  if (!url) {
    console.log(`[webhook] No URL configured, skipping webhook for ${type}:${dataId}`);
    return { sent: false, reason: 'no_url' };
  }

  const webhookSecret = secret || process.env.WEBHOOK_SECRET || 'mock-webhook-secret';
  const requestId = crypto.randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();

  // Build signature
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const signature = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  const body = {
    action: `${type}.updated`,
    api_version: 'v1',
    data: { id: String(dataId) },
    date_created: new Date().toISOString(),
    id: parseInt(crypto.randomBytes(4).toString('hex'), 16),
    live_mode: false,
    type,
    user_id: 'mock-user',
  };

  // MercadoPago sends data_id as a query parameter
  const separator = url.includes('?') ? '&' : '?';
  const webhookUrl = `${url}${separator}data_id=${dataId}&type=${type}`;

  const headers = {
    'Content-Type': 'application/json',
    'x-signature': `ts=${ts},v1=${signature}`,
    'x-request-id': requestId,
    'user-agent': 'MercadoPago-Mock/1.0',
  };

  const logEntry = {
    url: webhookUrl,
    type,
    dataId: String(dataId),
    requestId,
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

    console.log(`[webhook] ${type}:${dataId} → ${url} (${response.status})`);
    return { sent: true, status: response.status };
  } catch (err) {
    logEntry.status = 'error';
    logEntry.error = err.message;
    logWebhook(logEntry);

    console.error(`[webhook] Failed to send ${type}:${dataId} → ${url}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendWebhook };
