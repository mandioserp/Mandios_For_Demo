import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required to authenticate requests.');
}

export const AUTH_COOKIE_NAMES = {
  access: 'mandi_access',
  refresh: 'mandi_refresh',
  superAdminRefresh: 'mandi_super_admin_refresh',
};

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/api',
};

export function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.tokenUse === 'refresh' ? decoded : null;
  } catch {
    return null;
  }
}

export function setAuthCookies(res, payload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign(
    { ...payload, tokenUse: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );

  res.cookie(AUTH_COOKIE_NAMES.access, accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie(AUTH_COOKIE_NAMES.refresh, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function beginImpersonatedSession(req, res, payload) {
  const refreshToken = readCookie(req, AUTH_COOKIE_NAMES.refresh);
  const refreshClaims = verifyRefreshToken(refreshToken);

  if (
    !refreshClaims ||
    refreshClaims.role !== 'super_admin' ||
    String(refreshClaims.id) !== String(req.user?.id)
  ) {
    return false;
  }

  res.cookie(AUTH_COOKIE_NAMES.superAdminRefresh, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  setAuthCookies(res, payload);
  return true;
}

export function clearAuthCookies(res) {
  for (const name of Object.values(AUTH_COOKIE_NAMES)) {
    res.clearCookie(name, cookieOptions);
  }
}