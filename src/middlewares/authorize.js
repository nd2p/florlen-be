const { ADMIN_ROLES } = require('../config/constants');

const authorize = (...allowedRoles) => {
  const normalizedRoles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!normalizedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};

const authorizeAdmin = authorize(ADMIN_ROLES);

module.exports = {
  authorize,
  authorizeAdmin,
};
