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
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// Product routes
app.use('/api/products', require('./routes/product.routes'));

// Cart routes (placeholder for future)
// app.use("/api/cart", require("./routes/cart.routes"));

// Order routes (placeholder for future)
// app.use("/api/orders", require("./routes/order.routes"));

// Design routes (placeholder for future)
// app.use("/api/designs", require("./routes/design.routes"));

// Admin routes (placeholder for future)
// app.use("/api/admin", require("./routes/admin.routes"));

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

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

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
