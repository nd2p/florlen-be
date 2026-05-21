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

module.exports = {
  ROLE,
  ADMIN_ROLES,
  PRODUCT_TYPE,
  PRODUCT_TYPES,
};
