const express = require('express');
const apiRoutes = require('./routes/api');
const checkoutRoutes = require('./routes/checkout');
const dashboardRoutes = require('./routes/dashboard');
const sdkRoutes = require('./routes/sdk');

const app = express();
const PORT = process.env.PORT || 3001;

// Allow cross-origin requests (the JS SDK runs on the app's origin, not the mock server's)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all API requests
app.use((req, res, next) => {
  if (req.path.startsWith('/v1/') || req.path.startsWith('/checkout/preferences') ||
      req.path.startsWith('/preapproval') || req.path.startsWith('/merchant_orders') ||
      req.path.startsWith('/authorized_payments') || req.path.startsWith('/oauth') ||
      req.path.startsWith('/users/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.use(apiRoutes);       // /v1/* — MercadoPago API mock
app.use(checkoutRoutes);  // /checkout/* — Mock checkout pages
app.use(dashboardRoutes); // /dashboard/* — Admin dashboard
app.use(sdkRoutes);       // /js/v2 — Fake JS SDK

// Catch-all for unmatched routes — helps debug what the SDK is actually requesting
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/health' || req.path.startsWith('/dashboard')) return next();
  console.log(`[404] Unhandled: ${req.method} ${req.path}`);
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}`, status: 404 });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mercadopago-mock-server' });
});

// Root redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  MercadoPago Mock Server');
  console.log('  ─────────────────────────────────');
  console.log(`  API:        http://localhost:${PORT}/v1/...`);
  console.log(`  JS SDK:     http://localhost:${PORT}/js/v2`);
  console.log(`  Dashboard:  http://localhost:${PORT}/dashboard`);
  console.log(`  Webhook URL: ${process.env.WEBHOOK_URL || '(not configured)'}`);
  console.log('  ─────────────────────────────────');
  console.log('');
});
