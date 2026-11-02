import jwt from 'jsonwebtoken';
import { getTenantId } from '../utils/tenant.js';
import { AUTH_COOKIE_NAMES, readCookie } from '../utils/authTokens.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required to authenticate requests.');
}

function collectClientTenantIds(value, tenantIds = []) {
  if (!value || typeof value !== 'object') return tenantIds;

  for (const [key, child] of Object.entries(value)) {
    if (/^(?:current[_-]?)?tenant[_-]?id$/i.test(key)) {
      tenantIds.push(child);
    } else if (child && typeof child === 'object') {
      collectClientTenantIds(child, tenantIds);
    }
  }

  return tenantIds;
}

function hasMismatchedClientTenant(req) {
  const clientTenantIds = [
    ...collectClientTenantIds(req.body),
    ...collectClientTenantIds(req.query),
    ...collectClientTenantIds(req.params),
  ];

  for (const [key, value] of Object.entries(req.headers)) {
    if (/^(?:x-)?(?:current[_-]?)?tenant[_-]?id$/i.test(key)) {
      clientTenantIds.push(value);
    }
  }

  const isBusinessProvisioning = req.method === 'POST' &&
    req.originalUrl.split('?')[0].endsWith('/super-admin/businesses');
  if (isBusinessProvisioning) {
    const requestedTenantId = req.body?.tenantId;
    const index = clientTenantIds.indexOf(requestedTenantId);
    if (index !== -1) clientTenantIds.splice(index, 1);
  }

  const tenantId = getTenantId(req);
  return clientTenantIds.some((clientTenantId) =>
    clientTenantId != null && String(clientTenantId) !== String(tenantId ?? '')
  );
}

export function authenticateJWT(req, res, next) {
  const token = readCookie(req, AUTH_COOKIE_NAMES.access);

  if (!token) {
    return res.status(401).json({ error: 'Authentication cookie is missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || decoded.tokenUse === 'refresh') {
      return res.status(401).json({ error: 'Token is invalid or expired' });
    }

    if (decoded.isImpersonated && decoded.impersonationExpiresAt <= Date.now()) {
      return res.status(401).json({ error: 'Impersonation session has expired.' });
    }

    req.user = decoded;
    req.tenantId = decoded.tenantId ?? null;

    if (req.user.role !== 'super_admin' && !req.tenantId) {
      return res.status(401).json({ error: 'Token does not contain a valid tenant.' });
    }

    if (hasMismatchedClientTenant(req)) {
      return res.status(403).json({ error: 'Requested tenant does not match the authenticated session.' });
    }

    next();
  });
}


export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User is not authenticated' });
    }

    if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied: Role '${req.user.role}' is not authorized to access this resource`
    });
  };
}
