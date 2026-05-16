const ROLE = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

const ADMIN_ROLES = Object.freeze([ROLE.ADMIN, ROLE.SUPER_ADMIN]);

const PRODUCT_TYPE = Object.freeze({
  NORMAL: 'normal',
  AI_BASE: 'ai_base',
});

const PRODUCT_TYPES = Object.freeze([PRODUCT_TYPE.NORMAL, PRODUCT_TYPE.AI_BASE]);

module.exports = {
  ROLE,
  ADMIN_ROLES,
  PRODUCT_TYPE,
  PRODUCT_TYPES,
};
