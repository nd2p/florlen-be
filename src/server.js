const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

// Routes & Config
const authRoutes = require('./routes/auth.routes');
const swaggerSpecs = require('./config/swagger');

// Initialize Express app
const app = express();

/**
 * ============================================
 * MIDDLEWARE — Security & Parsing
 * ============================================
 */

// Security headers
app.use(helmet());

// CORS Configuration
// Determine allowed origins depending on environment
const NODE_ENV = process.env.NODE_ENV || 'development';
let allowedOrigins = [];

if (NODE_ENV === 'development') {
  allowedOrigins = ['http://localhost:3000'];
} else {
  allowedOrigins = process.env.FRONTEND_URL;
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware (simple)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * ============================================
 * ROUTES
 * ============================================
 */

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Florlen API is running',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Swagger API documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

// Auth routes
app.use('/api/auth', authRoutes);

// Upload routes
app.use('/api/uploads', require('./routes/upload.routes'));

// Product routes
app.use('/api/products', require('./routes/product.routes'));

// Collection routes
app.use('/api/collections', require('./routes/collection.routes'));

// Cart routes
app.use('/api/cart', require('./routes/cart.routes'));

// Address routes
app.use('/api/addresses', require('./routes/address.routes'));

// Order routes
app.use('/api/orders', require('./routes/order.routes'));

// Webhook routes (PayOS payment callbacks — no auth)
app.use('/api/webhooks', require('./routes/webhook.routes'));

// Design routes
app.use('/api/designs', require('./routes/design.routes'));

// Admin routes
app.use('/api/admin', require('./routes/admin.routes'));

// Discount routes
app.use('/api/discounts', require('./routes/discount.routes'));

/**
 * ============================================
 * 404 & ERROR HANDLING
 * ============================================
 */

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Error:', err);

  const status =
    err.status ||
    err.statusCode ||
    (err.code === 'LIMIT_FILE_SIZE' ? 413 : err.code === 'LIMIT_FILE_COUNT' ? 400 : 500);
  const message = err.message || 'Internal server error';

  res.status(status).json({
    message,
    status,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

/**
 * ============================================
 * SERVER STARTUP
 * ============================================
 */

const PORT = process.env.PORT || process.env.LOCAL_PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     Florlen Backend Server              ║
╠════════════════════════════════════════╣
║ Port:       ${PORT.toString().padEnd(26)} ║
║ Environment: ${NODE_ENV.padEnd(23)} ║
║ Supabase:   ${(process.env.SUPABASE_URL ? '✓ Connected' : '✗ Missing').padEnd(23)} ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
