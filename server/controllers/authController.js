import bcryptjs from 'bcryptjs';
import { User, Business, AuditLog, Customer, Supplier } from '../models/index.js';
import {
  AUTH_COOKIE_NAMES,
  clearAuthCookies,
  readCookie,
  setAuthCookies,
  verifyRefreshToken,
} from '../utils/authTokens.js';

function getUserTokenPayload(user, khataId = user.khataId || '') {
  return {
    id: user.id || user._id,
    email: user.email,
    khataId,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId || (user.role === 'super_admin' ? null : 'tenant_default_001'),
  };
}

export async function login(req, res) {
  try {
    const rawIdentifier = req.body.identifier || req.body.khataId || req.body.email;
    const { password, role } = req.body;

    const isParty = role === 'Customer' || role === 'Supplier';

    if (!rawIdentifier || !password) {
      return res.status(400).json({ 
        error: isParty ? 'Please provide Khata ID and password.' : 'Please provide email and password.' 
      });
    }

    const cleanInput = rawIdentifier.trim();
    const cleanLower = cleanInput.toLowerCase();
    const cleanUpper = cleanInput.toUpperCase();

    // Prevent Customer and Supplier from logging in with an email address
    if (isParty && cleanInput.includes('@')) {
      return res.status(400).json({
        error: `${role} accounts can only log in using their assigned Khata ID (e.g. SFM-C-1). Email login is not allowed for ${role}s.`
      });
    }

    let user = null;

    if (isParty) {
      // Strictly lookup by Khata ID for Customer and Supplier
      user = await User.findOne({ role, khataId: cleanUpper, isDeleted: { $ne: true } });

      // If not directly on User object, check linked Customer/Supplier collection by Khata ID
      if (!user && role === 'Customer') {
        const matchedCust = await Customer.findOne({ khataId: cleanUpper, isDeleted: { $ne: true } });
        if (matchedCust && matchedCust.userId) {
          user = await User.findOne({ _id: matchedCust.userId, role, isDeleted: { $ne: true } });
        }
      } else if (!user && role === 'Supplier') {
        const matchedSupp = await Supplier.findOne({ khataId: cleanUpper, isDeleted: { $ne: true } });
        if (matchedSupp && matchedSupp.userId) {
          user = await User.findOne({ _id: matchedSupp.userId, role, isDeleted: { $ne: true } });
        }
      }

    } else {
      // For Admin, Clerk, and Super Admin, lookup strictly by email
      user = await User.findOne({ email: cleanLower, isDeleted: { $ne: true } });

      // If a Customer or Supplier account tries to log in with email without selecting role, disallow customer/supplier email login
      if (user && (user.role === 'Customer' || user.role === 'Supplier')) {
        return res.status(403).json({
          error: `${user.role}s must select "${user.role}" role and log in using their Khata ID (${user.khataId || 'assigned ID'}). Email login is disabled for ${user.role}s.`
        });
      }
    }

    if (!user) {
      return res.status(401).json({ 
        error: isParty ? 'Invalid Khata ID or password.' : 'Invalid email or password.' 
      });
    }

    // Check soft deletion
    if (user.isDeleted) {
      return res.status(403).json({ error: 'Your account has been deleted. Please contact Admin.' });
    }

    // Check status
    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'Your account is currently inactive. Contact Admin.' });
    }

    // Role check (allow super_admin if user is super_admin regardless of dropdown role)
    const isSuperAdmin = user.role === 'super_admin' || user.role === 'Super Admin' || cleanLower === 'superadmin@mandios.com';
    if (!isSuperAdmin && role && user.role.toLowerCase() !== role.toLowerCase()) {
      return res.status(401).json({ error: `Selected role (${role}) does not match your registered profile.` });
    }

    // Password validation requires a stored bcrypt hash.
    let isMatch = false;
    if (user.password) {
      try {
        isMatch = bcryptjs.compareSync(password.trim(), user.password);
      } catch {
        isMatch = false;
      }
    }

    if (!isMatch) {
      const isParty = user.role === 'Customer' || user.role === 'Supplier';
      return res.status(401).json({ 
        error: isParty ? 'Invalid Khata ID or password.' : 'Invalid email or password.' 
      });
    }

    // Business tenant status check for non-super_admin users
    if (user.role !== 'super_admin' && user.tenantId) {
      const biz = await Business.findOne({ tenantId: user.tenantId });
      if (biz) {
        if (biz.isDeleted) {
          return res.status(403).json({ error: 'This business account has been removed.' });
        }
        if (!biz.isActive || biz.subscriptionStatus === 'Suspended') {
          return res.status(403).json({ error: 'Your business account is currently suspended. Please contact MandiOS support.' });
        }
        if (biz.subscriptionExpiryDate) {
          const today = new Date().toISOString().split('T')[0];
          if (biz.subscriptionExpiryDate < today) {
            return res.status(403).json({ error: 'Your business subscription has expired. Please contact MandiOS support to renew.' });
          }
        }
      }
    }

    // Fetch Khata ID if not directly attached
    let userKhataId = user.khataId || '';
    if (!userKhataId && user.role === 'Customer') {
      const cust = await Customer.findOne({ userId: user.id || user._id });
      if (cust && cust.khataId) userKhataId = cust.khataId;
    } else if (!userKhataId && user.role === 'Supplier') {
      const supp = await Supplier.findOne({ userId: user.id || user._id });
      if (supp && supp.khataId) userKhataId = supp.khataId;
    }

    // Generate JWT
    setAuthCookies(res, getUserTokenPayload(user, userKhataId));

    // Create Audit Log
    await AuditLog.create({
      tenantId: user.tenantId || 'tenant_default_001',
      userId: user.id || user._id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      details: `User logged in as ${user.role}${userKhataId ? ` (Khata ID: ${userKhataId})` : ''}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      user: {
        id: user.id || user._id,
        email: user.email,
        khataId: userKhataId,
        name: user.name,
        role: user.role,
        phone: user.phone,
        address: user.address,
        tenantId: user.tenantId || (user.role === 'super_admin' ? null : 'tenant_default_001'),
      }
    });

  } catch (err) {
    console.error('Error logging in user:', err);
    res.status(500).json({ error: 'Server error during login authentication.' });
  }
}

export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    let userKhataId = user.khataId || '';
    if (!userKhataId && user.role === 'Customer') {
      const cust = await Customer.findOne({ userId: user.id || user._id });
      if (cust && cust.khataId) userKhataId = cust.khataId;
    } else if (!userKhataId && user.role === 'Supplier') {
      const supp = await Supplier.findOne({ userId: user.id || user._id });
      if (supp && supp.khataId) userKhataId = supp.khataId;
    }

    res.json({
      id: user.id || user._id,
      email: user.email,
      khataId: userKhataId,
      name: user.name,
      role: user.role,
      phone: user.phone,
      address: user.address,
      status: user.status,
      tenantId: user.tenantId || (user.role === 'super_admin' ? null : 'tenant_default_001'),
      isImpersonated: Boolean(req.user?.isImpersonated),
      impersonatedBy: req.user?.impersonatedBy || null,
      businessName: req.user?.businessName || null,
    });
  } catch (err) {
    console.error('Error in getProfile:', err);
    res.status(500).json({ error: 'Server error retrieving profile.' });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Please fill all 3 fields: current password, new password, and confirm password.' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        error: 'New password and confirm password do not match.' 
      });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters long.' 
      });
    }

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user session.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Verify current password with bcryptjs
    let isCurrentValid = false;
    if (user.password) {
      try {
        isCurrentValid = bcryptjs.compareSync(currentPassword.trim(), user.password);
      } catch {
        isCurrentValid = false;
      }
    }

    if (!isCurrentValid) {
      return res.status(400).json({ 
        error: 'Current password is incorrect. Please verify your old password and try again.' 
      });
    }

    // Hash the new password securely
    const salt = bcryptjs.genSaltSync(10);
    const hashedPassword = bcryptjs.hashSync(newPassword.trim(), salt);

    await User.findByIdAndUpdate(user.id || user._id, {
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

    // Create Audit Log entry
    await AuditLog.create({
      tenantId: user.tenantId || 'tenant_default_001',
      userId: user.id || user._id,
      userName: user.name,
      userRole: user.role,
      action: 'PASSWORD_CHANGE',
      details: `${user.role} "${user.name}" updated their password.`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ 
      success: true,
      message: 'Password changed successfully! You can now use your new password.' 
    });
  } catch (err) {
    console.error('Error changing password:', err);
    return res.status(500).json({ error: err.message || 'Server error while changing password.' });
  }
}

export async function refreshSession(req, res) {
  try {
    const refreshClaims = verifyRefreshToken(readCookie(req, AUTH_COOKIE_NAMES.refresh));
    if (!refreshClaims) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token is missing, invalid, or expired.' });
    }

    const user = await User.findById(refreshClaims.id);
    if (!user || user.isDeleted || user.status === 'Inactive') {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'User session is no longer valid.' });
    }
    if (refreshClaims.isImpersonated && refreshClaims.impersonationExpiresAt <= Date.now()) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Impersonation session has expired.' });
    }

    const payload = getUserTokenPayload(user, refreshClaims.khataId || user.khataId || '');
    if (refreshClaims.isImpersonated) {
      payload.isImpersonated = true;
      payload.impersonatedBy = refreshClaims.impersonatedBy;
      payload.businessName = refreshClaims.businessName;
      payload.impersonationExpiresAt = refreshClaims.impersonationExpiresAt;
    }

    setAuthCookies(res, payload);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error refreshing user session:', err);
    clearAuthCookies(res);
    return res.status(500).json({ error: 'Server error refreshing session.' });
  }
}

export function logout(req, res) {
  clearAuthCookies(res);
  return res.json({ success: true });
}

export async function exitImpersonation(req, res) {
  try {
    if (!req.user?.isImpersonated) {
      return res.status(403).json({ error: 'This session is not impersonating a tenant.' });
    }

    const refreshClaims = verifyRefreshToken(readCookie(req, AUTH_COOKIE_NAMES.superAdminRefresh));
    if (
      !refreshClaims ||
      refreshClaims.role !== 'super_admin' ||
      String(refreshClaims.id) !== String(req.user.impersonatedBy)
    ) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'The original superadmin session is no longer valid.' });
    }

    const user = await User.findById(refreshClaims.id);
    if (!user || user.role !== 'super_admin' || user.isDeleted || user.status === 'Inactive') {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'The original superadmin account is no longer valid.' });
    }

    setAuthCookies(res, getUserTokenPayload(user));
    res.clearCookie(AUTH_COOKIE_NAMES.superAdminRefresh, { httpOnly: true, secure: true, sameSite: 'none', path: '/api' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error exiting impersonation:', err);
    clearAuthCookies(res);
    return res.status(500).json({ error: 'Server error ending impersonation session.' });
  }
}
