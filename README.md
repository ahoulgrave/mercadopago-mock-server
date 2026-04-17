# MercadoPago Mock Server

A local mock server for testing MercadoPago integrations without hitting the real API. Supports payments, subscriptions, webhooks with HMAC-SHA256 signatures, and a fake JS SDK for card tokenization.

## Features

- **Full API mock** — Preferences, Payments, PreApproval Plans, PreApprovals (subscriptions)
- **Webhook delivery** — Sends properly signed webhooks (HMAC-SHA256) matching MercadoPago's format
- **Mock checkout pages** — Click "Approve", "Reject", or "Pending" instead of entering real card details
- **Fake JS SDK** — Drop-in replacement for `https://sdk.mercadopago.com/js/v2` that renders real inputs and generates mock card tokens
- **Dashboard** — Web UI to view all resources and trigger webhooks manually
- **Zero dependencies** beyond Express

## Quick Start

```bash
npm install
npm start
```

Or with Docker:

```bash
docker build -t mercadopago-mock .
docker run -p 3000:3000 -e WEBHOOK_URL=http://host.docker.internal:8031/api/webhooks/mercadopago -e WEBHOOK_SECRET=your-secret mercadopago-mock
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `PUBLIC_URL` | `http://localhost:$PORT` | Base URL for generated `init_point` URLs |
| `WEBHOOK_URL` | _(none)_ | Default URL to send webhooks to |
| `WEBHOOK_SECRET` | `mock-webhook-secret` | HMAC-SHA256 secret for signing webhooks |

## Endpoints

### MercadoPago API (used by the PHP/Python SDK)

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/preferences` | Create payment preference |
| `GET` | `/v1/preferences/:id` | Get preference |
| `GET` | `/v1/payments/:id` | Get payment |
| `POST` | `/v1/preapproval_plans` | Create subscription plan |
| `GET` | `/v1/preapproval_plans/:id` | Get plan |
| `PUT` | `/v1/preapproval_plans/:id` | Update plan |
| `POST` | `/v1/preapprovals` | Create subscription |
| `GET` | `/v1/preapprovals/:id` | Get subscription |
| `PUT` | `/v1/preapprovals/:id` | Update/cancel subscription |
| `POST` | `/v1/card_tokens` | Create card token (used by JS SDK) |

### Mock Pages

| Path | Description |
|---|---|
| `/checkout/:id` | Mock checkout page with Approve/Reject/Pending buttons |
| `/subscription/:id` | Mock subscription authorization page |
| `/dashboard` | Admin dashboard |
| `/js/v2` | Fake MercadoPago JS SDK |

## Integration with PHP SDK

The official MercadoPago PHP SDK (`mercadopago/dx-php`) uses a public static `$BASE_URL`. Override it to point to the mock:

```php
use MercadoPago\MercadoPagoConfig;

// In your service initialization:
if ($mode === 'local') {
    MercadoPagoConfig::$BASE_URL = 'http://mercadopago-mock:3000';
}
```

## Integration with JS SDK

Instead of loading the real SDK:

```js
// Change this:
script.src = 'https://sdk.mercadopago.com/js/v2'

// To this (when running locally):
script.src = 'http://localhost:3000/js/v2'
```

The fake SDK implements the `MercadoPago` constructor and `cardForm()` method. It renders plain HTML inputs (no iframes) and generates mock tokens via the local server.

## Docker Compose

```yaml
services:
  mercadopago-mock:
    image: ghcr.io/ahoulgrave/mercadopago-mock-server:latest
    # or build: ./path/to/mercadopago-mock-server
    ports:
      - "3000:3000"
    environment:
      WEBHOOK_URL: http://php:8031/api/webhooks/mercadopago
      WEBHOOK_SECRET: your-webhook-secret
```

## How Webhooks Work

When a payment is approved (via checkout page or dashboard), the mock server sends a webhook to your configured URL with:

- **Body**: `{ "type": "payment", "data": { "id": "12345" }, ... }`
- **Headers**:
  - `x-signature: ts=1234567890,v1=<hmac-sha256-hex>`
  - `x-request-id: <uuid>`
- **Query params**: `?data_id=12345&type=payment`

The HMAC signature is computed exactly as MercadoPago does it:
```
manifest = "id:{data_id};request-id:{x-request-id};ts:{timestamp};"
signature = HMAC-SHA256(manifest, WEBHOOK_SECRET)
```

## License

MIT
