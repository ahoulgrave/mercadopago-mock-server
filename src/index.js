const express = require('express');
const apiRoutes = require('./routes/api');
const checkoutRoutes = require('./routes/checkout');
const dashboardRoutes = require('./routes/dashboard');
const sdkRoutes = require('./routes/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all API requests
app.use((req, res, next) => {
  if (req.path.startsWith('/v1/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.use(apiRoutes);       // /v1/* — MercadoPago API mock
app.use(checkoutRoutes);  // /checkout/* — Mock checkout pages
app.use(dashboardRoutes); // /dashboard/* — Admin dashboard
app.use(sdkRoutes);       // /js/v2 — Fake JS SDK

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
