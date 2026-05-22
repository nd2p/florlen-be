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
        url: 'https://api.florlen.com',
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
      },
    },
  },
  apis: [
    './src/routes/auth.routes.js',
    './src/routes/upload.routes.js',
    './src/routes/product.routes.js',
    './src/routes/cart.routes.js',
    './src/routes/order.routes.js',
    './src/routes/design.routes.js',
    './src/routes/admin.routes.js',
    './src/routes/collection.routes.js',
    './src/routes/address.routes.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
