// Same middleware logic, identical to auth-service version.
// Each service has its own copy so services are independently deployable.
const jwt = require('jsonwebtoken');
const fs  = require('fs');

const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem');

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    req.user = payload;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }
}

const ROLE_RANK = { user: 0, admin: 1 };

function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] ?? -1;
    const minRank  = ROLE_RANK[minRole] ?? 99;
    if (userRank < minRank) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

module.exports = { verifyJWT, requireRole };
