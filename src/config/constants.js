const ROLE = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

const ADMIN_ROLES = Object.freeze([ROLE.ADMIN, ROLE.SUPER_ADMIN]);

const PRODUCT_TYPE = Object.freeze({
  NORMAL: 'normal',
  AI_BASE: 'ai_base',
  ADD_ONS: 'add_ons',
});

const PRODUCT_TYPES = Object.freeze([
  PRODUCT_TYPE.NORMAL,
  PRODUCT_TYPE.AI_BASE,
  PRODUCT_TYPE.ADD_ONS,
]);

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  IN_PRODUCTION: 'in_production',
  QUALITY_CHECK: 'quality_check',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPING: 'shipping',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const VALID_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.IN_PRODUCTION, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_PRODUCTION]: [
    ORDER_STATUS.QUALITY_CHECK,
    ORDER_STATUS.READY_TO_SHIP,
    ORDER_STATUS.SHIPPING,
  ],
  [ORDER_STATUS.QUALITY_CHECK]: [ORDER_STATUS.READY_TO_SHIP, ORDER_STATUS.SHIPPING],
  [ORDER_STATUS.READY_TO_SHIP]: [ORDER_STATUS.SHIPPING],
  [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.COMPLETED],
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
});

const PAYMENT_TYPE = Object.freeze({
  DEPOSIT: 'deposit',
  REMAINING_BALANCE: 'remaining_balance',
  FULL_PAYMENT: 'full_payment',
});

const PAYMENT_METHOD = Object.freeze({
  PAYOS_QR: 'payos_qr',
  BANK_TRANSFER: 'bank_transfer',
  MANUAL: 'manual',
});

module.exports = {
  ROLE,
  ADMIN_ROLES,
  PRODUCT_TYPE,
  PRODUCT_TYPES,
  ORDER_STATUS,
  VALID_TRANSITIONS,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  PAYMENT_METHOD,
};
