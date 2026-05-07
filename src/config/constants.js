const ROLE = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

const ADMIN_ROLES = Object.freeze([ROLE.ADMIN, ROLE.SUPER_ADMIN]);

module.exports = {
  ROLE,
  ADMIN_ROLES,
};
