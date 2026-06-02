const swaggerJsdoc = require('swagger-jsdoc');
const { ROLE } = require('./constants');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Florlen API',
      version: '1.0.0',
      description: 'API documentation for Florlen e-commerce platform (crochet handmade)',
      contact: {
        name: 'Florlen Support',
        url: 'https://florlen.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.florlen.id.vn',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login or /api/auth/register',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            full_name: {
              type: 'string',
            },
            display_name: {
              type: 'string',
            },
            avatar_url: {
              type: 'string',
              format: 'uri',
            },
            role: {
              type: 'string',
              enum: [ROLE.CUSTOMER, ROLE.ADMIN, ROLE.SUPER_ADMIN],
            },
            is_active: {
              type: 'boolean',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            sku: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            slug: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            short_description: {
              type: 'string',
            },
            product_type: {
              type: 'string',
              enum: ['normal', 'ai_base', 'add_ons'],
            },
            base_price: {
              type: 'number',
              format: 'double',
            },
            customization_fee: {
              type: 'number',
              format: 'double',
            },
            production_days_min: {
              type: 'integer',
            },
            production_days_max: {
              type: 'integer',
            },
            is_active: {
              type: 'boolean',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            deleted_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  url: { type: 'string' },
                  storage_path: { type: 'string', nullable: true },
                  alt_text: { type: 'string' },
                  is_primary: { type: 'boolean' },
                },
              },
            },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  sku_suffix: { type: 'string' },
                  size: { type: 'string' },
                  color_name: { type: 'string' },
                  additional_price: { type: 'number', format: 'double' },
                  stock_qty: { type: 'integer' },
                },
              },
            },
          },
        },
        UserAddress: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            label: { type: 'string', nullable: true, example: 'Home' },
            is_default: { type: 'boolean' },
            recipient_name: { type: 'string', example: 'Nguyen Van A' },
            phone_number: { type: 'string', example: '0987654321' },
            address_line_1: { type: 'string', example: '123 Nguyen Trai, Ward 2' },
            city: { type: 'string', example: 'Ho Chi Minh City' },
            country_code: { type: 'string', example: 'VN' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_number: { type: 'string', example: 'FLR-20260001' },
            user_id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: [
                'pending_payment',
                'confirmed',
                'in_production',
                'quality_check',
                'awaiting_remaining_payment',
                'ready_to_ship',
                'shipping',
                'completed',
                'cancelled',
              ],
            },
            product_name: { type: 'string' },
            product_image_url: { type: 'string', nullable: true },
            total_amount: { type: 'number' },
            deposit_amount: { type: 'number' },
            remaining_amount: { type: 'number' },
            payment_option: { type: 'string', enum: ['full', 'deposit'] },
            payment_stage: {
              type: 'string',
              enum: ['deposit_pending', 'deposit_paid', 'fully_paid', 'refunded'],
            },
            recipient_name: { type: 'string' },
            recipient_phone: { type: 'string' },
            shipping_address: { type: 'object' },
            estimated_delivery: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            payment_intent_id: { type: 'string' },
            payment_type: {
              type: 'string',
              enum: ['deposit', 'remaining_balance', 'full_payment'],
            },
            payment_method: {
              type: 'string',
              enum: ['payos_qr', 'bank_transfer', 'momo', 'vnpay', 'manual'],
            },
            gateway: { type: 'string', enum: ['payos', 'manual'] },
            amount: { type: 'number' },
            currency: { type: 'string', example: 'VND' },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'],
            },
            qr_code_url: { type: 'string', nullable: true },
            paid_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Design: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid', nullable: true },
            product_id: { type: 'string', format: 'uuid' },
            prompt_text: { type: 'string', nullable: true, maxLength: 500 },
            selected_colors: { type: 'object', nullable: true, description: 'Selected options snapshot' },
            complexity_score: { type: 'integer', nullable: true },
            mockup_image_url: { type: 'string', nullable: true },
            mockup_storage_path: { type: 'string', nullable: true },
            ai_prompt_used: { type: 'string', nullable: true },
            color_palette: { type: 'array', items: { type: 'string' }, nullable: true },
            material_suggestions: { type: 'array', items: { type: 'string' }, nullable: true },
            customization_fee: { type: 'number', format: 'double' },
            status: {
              type: 'string',
              enum: ['draft', 'generating', 'failed', 'ready', 'finalized'],
            },
            generation_attempts: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
            },
            status: {
              type: 'integer',
            },
          },
        },
        Voucher: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string', example: 'FLORLEN50' },
            discount_type: { type: 'string', enum: ['percentage', 'fixed_amount', 'free_shipping'] },
            discount_value: { type: 'number', example: 50000 },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time', nullable: true },
            usage_limit: { type: 'integer', nullable: true },
            used_count: { type: 'integer' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: [
    './src/routes/auth.routes.js',
    './src/routes/upload.routes.js',
    './src/routes/product.routes.js',
    './src/routes/cart.routes.js',
    './src/routes/order.routes.js',
    './src/routes/webhook.routes.js',
    './src/routes/design.routes.js',
    './src/routes/admin.routes.js',
    './src/routes/collection.routes.js',
    './src/routes/address.routes.js',
    './src/routes/discount.routes.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
