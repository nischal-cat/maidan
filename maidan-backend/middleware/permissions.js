const PERMISSION_ROLES = ['grounds', 'slots', 'bookings', 'reports', 'sellers', 'users'];

function hasPermission(user, perm) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'owner') return true; // per-owner checks still apply in controllers
  if (user.role === 'subadmin') {
    return Array.isArray(user.permissions) && user.permissions.includes(perm);
  }
  return false;
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!hasPermission(req.user, perm)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requirePermission, hasPermission, PERMISSION_ROLES };