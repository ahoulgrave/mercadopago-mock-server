# MercadoPago Mock Server

A local mock server for testing MercadoPago integrations without hitting the real API. Supports payments, subscriptions, customers, orders, webhooks with HMAC-SHA256 signatures, and a fake JS SDK for card tokenization.

> **Note:** This project was mostly vibe coded. It works well for local development and testing, but may not cover every edge case. Contributions, bug reports, and improvements are very welcome — feel free to open an issue or PR!

## Features

- **Full API mock** — Payments, Preferences, Customers, Refunds, Orders, Merchant Orders, PreApproval Plans, PreApprovals (subscriptions), Card Tokens, and more (40+ endpoints matching the official Python, PHP, and .NET SDKs)
- **Webhook delivery** — Sends properly signed webhooks (HMAC-SHA256) matching MercadoPago's production format, with separate body structures for payment and subscription topics
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
docker run -p 3001:3001 \
  -e WEBHOOK_URL=http://host.docker.internal:8031/api/webhooks/mercadopago \
  -e WEBHOOK_SECRET=your-secret \
  ghcr.io/ahoulgrave/mercadopago-mock-server:latest
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `PUBLIC_URL` | `http://localhost:$PORT` | Base URL for generated `init_point` URLs |
| `WEBHOOK_URL` | _(none)_ | Default URL to send webhooks to |
| `WEBHOOK_SECRET` | `mock-webhook-secret` | HMAC-SHA256 secret for signing webhooks |

## Endpoints

### MercadoPago API

| Method | Path | Description |
|---|---|---|
| **Payments** | | |
| `POST` | `/v1/payments` | Create payment |
| `GET` | `/v1/payments/:id` | Get payment |
| `PUT` | `/v1/payments/:id` | Update payment |
| `GET` | `/v1/payments/search` | Search payments |
| **Refunds** | | |
| `POST` | `/v1/payments/:id/refunds` | Create refund |
| `GET` | `/v1/payments/:id/refunds` | List refunds |
| `GET` | `/v1/payments/:id/refunds/:refundId` | Get refund |
| **Preferences** | | |
| `POST` | `/checkout/preferences` | Create preference |
| `GET` | `/checkout/preferences/:id` | Get preference |
| `PUT` | `/checkout/preferences/:id` | Update preference |
| `GET` | `/checkout/preferences/search` | Search preferences |
| **Customers** | | |
| `POST` | `/v1/customers` | Create customer |
| `GET` | `/v1/customers/:id` | Get customer |
| `PUT` | `/v1/customers/:id` | Update customer |
| `DELETE` | `/v1/customers/:id` | Delete customer |
| `GET` | `/v1/customers/search` | Search customers |
| **Customer Cards** | | |
| `POST` | `/v1/customers/:id/cards` | Create card |
| `GET` | `/v1/customers/:id/cards` | List cards |
| `GET` | `/v1/customers/:id/cards/:cardId` | Get card |
| `PUT` | `/v1/customers/:id/cards/:cardId` | Update card |
| `DELETE` | `/v1/customers/:id/cards/:cardId` | Delete card |
| **Card Tokens** | | |
| `POST` | `/v1/card_tokens` | Create card token |
| `GET` | `/v1/card_tokens/:id` | Get card token |
| **Orders** | | |
| `POST` | `/v1/orders` | Create order |
| `GET` | `/v1/orders/:id` | Get order |
| `POST` | `/v1/orders/:id/process` | Process order |
| `POST` | `/v1/orders/:id/capture` | Capture order |
| `POST` | `/v1/orders/:id/cancel` | Cancel order |
| `POST` | `/v1/orders/:id/refund` | Refund order |
| `POST` | `/v1/orders/:id/transactions` | Create transaction |
| `PUT` | `/v1/orders/:id/transactions/:txId` | Update transaction |
| `DELETE` | `/v1/orders/:id/transactions/:txId` | Delete transaction |
| **Merchant Orders** | | |
| `POST` | `/merchant_orders` | Create merchant order |
| `GET` | `/merchant_orders/:id` | Get merchant order |
| `PUT` | `/merchant_orders/:id` | Update merchant order |
| `GET` | `/merchant_orders/search` | Search merchant orders |
| **Subscription Plans** | | |
| `POST` | `/preapproval_plan` | Create plan |
| `GET` | `/preapproval_plan/:id` | Get plan |
| `PUT` | `/preapproval_plan/:id` | Update plan |
| `GET` | `/preapproval_plan/search` | Search plans |
| **Subscriptions** | | |
| `POST` | `/preapproval` | Create subscription |
| `GET` | `/preapproval/:id` | Get subscription |
| `PUT` | `/preapproval/:id` | Update subscription |
| `GET` | `/preapproval/search` | Search subscriptions |
| **Other** | | |
| `GET` | `/v1/identification_types` | List identification types |
| `GET` | `/v1/payment_methods` | List payment methods |
| `GET` | `/users/me` | Get current user |
| `POST` | `/oauth/token` | Create/refresh OAuth token |
| `GET` | `/authorized_payments/:id` | Get authorized payment |
| `GET` | `/authorized_payments/search` | Search authorized payments |
| `GET` | `/v1/chargebacks/:id` | Get chargeback |
| `GET` | `/v1/chargebacks/search` | Search chargebacks |

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

if ($mode === 'local') {
    MercadoPagoConfig::$BASE_URL = 'http://mercadopago-mock:3001';
}
```

## Integration with JS SDK

```js
// Change this:
script.src = 'https://sdk.mercadopago.com/js/v2'

// To this (when running locally):
script.src = 'http://localhost:3001/js/v2'
```

The fake SDK implements the `MercadoPago` constructor, `fields.create()`, `fields.createCardToken()`, and `cardForm()`. It renders plain HTML inputs (no iframes) and generates mock tokens via the local server.

## Docker Compose

```yaml
services:
  mercadopago-mock:
    image: ghcr.io/ahoulgrave/mercadopago-mock-server:latest
    ports:
      - "3001:3001"
    environment:
      WEBHOOK_URL: http://your-app:8080/api/webhooks/mercadopago
      WEBHOOK_SECRET: your-webhook-secret
```

## How Webhooks Work

When a payment or subscription is created/updated, the mock server sends a webhook to your configured URL with the correct format per topic type.

**Payment topics:**
```json
{"action":"payment.created","api_version":"v1","data":{"id":"12345"},"date_created":"...","id":123,"live_mode":false,"type":"payment","user_id":"123456789"}
```

**Subscription topics:**
```json
{"action":"created","application_id":1234567890123456,"data":{"id":"12345"},"date":"...","entity":"preapproval","id":123,"type":"subscription_preapproval","version":0}
```

**Headers:**
- `x-signature: ts=1234567890,v1=<hmac-sha256-hex>`
- `x-request-id: <uuid>`

**Query params:** `?data.id=12345&type=payment`

The HMAC signature matches MercadoPago's production format:
```
manifest = "id:{data.id};request-id:{x-request-id};ts:{timestamp};"
signature = HMAC-SHA256(manifest, WEBHOOK_SECRET)
```

## Contributing

This project is open to contributions! If you find a missing endpoint, incorrect response format, or have ideas for improvements, please open an issue or submit a pull request.

## License

MIT
