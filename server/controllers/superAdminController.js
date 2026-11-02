import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';
import { 
  Business, GlobalSettings, User, Customer, Supplier, Sale, StockEntry, 
  Ledger, Payment, AuditLog, Expense, Truck, Employee, Salary, SalaryAdvance,
  Announcement, Plan, Product
} from '../models/index.js';
import { BusinessSettings } from '../models/settings.js';
import { generateSuggestedArthiCode, validateArthiCode } from '../utils/counter.js';
import { beginImpersonatedSession } from '../utils/authTokens.js';

// 1. Get List of All Businesses (Enhanced with all required fields)
export async function getBusinesses(req, res) {
  try {
    const businesses = await Business.find({ isDeleted: { $ne: true } });
    const allUsers = await User.find({ isDeleted: { $ne: true } });
    const allLogs = await AuditLog.find();
    const today = new Date().toISOString().split('T')[0];

    // Enrich businesses with normalized fields
    const enriched = businesses.map(biz => {
      const bizUsers = allUsers.filter(u => u.tenantId === biz.tenantId);
      const nameVal = biz.name || biz.businessName || 'Mandi Business';
      const planVal = biz.plan || biz.subscriptionPlan || 'Pro';
      const rawStatus = biz.status || biz.subscriptionStatus || (biz.isActive !== false ? 'Active' : 'Suspended');
      const expiryVal = biz.subscriptionExpiresAt || biz.subscriptionExpiryDate || '';
      const arthiCodeVal = biz.arthiCode || generateSuggestedArthiCode(nameVal);
      const businessCodeVal = biz.businessCode || `BUS-${1000 + (biz.id ? parseInt(String(biz.id).slice(-3), 16) % 900 : 100)}`;

      // Derive status if expired
      let finalStatus = rawStatus;
      if (rawStatus !== 'Suspended' && expiryVal && expiryVal < today) {
        finalStatus = 'Expired';
      }

      // Determine last activity from AuditLog or updatedAt
      const tenantLogs = allLogs.filter(l => l.tenantId === biz.tenantId);
      let lastActivity = biz.updatedAt || biz.createdAt || '';
      if (tenantLogs.length > 0) {
        const sortedLogs = [...tenantLogs].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        lastActivity = sortedLogs[0].timestamp || lastActivity;
      }

      const locationVal = [biz.city, biz.address, biz.country || 'Pakistan'].filter(Boolean).join(', ') || 'N/A';

      return {
        ...biz,
        id: biz.id || biz._id,
        _id: biz._id || biz.id,
        name: nameVal,
        businessName: nameVal,
        businessCode: businessCodeVal,
        arthiCode: arthiCodeVal,
        ownerName: biz.ownerName || 'Admin',
        email: biz.email || '',
        phone: biz.phone || '',
        city: biz.city || '',
        address: biz.address || '',
        country: biz.country || 'Pakistan',
        location: locationVal,
        plan: planVal,
        subscriptionPlan: planVal,
        status: finalStatus,
        subscriptionStatus: finalStatus,
        subscriptionExpiresAt: expiryVal,
        subscriptionExpiryDate: expiryVal,
        registrationDate: biz.createdAt || biz.subscriptionStartDate || '',
        createdAt: biz.createdAt || biz.subscriptionStartDate || '',
        totalUsers: bizUsers.length,
        lastActivity,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses list.' });
  }
}

// 2. Create Business
export async function createBusiness(req, res) {
  try {
    const name = req.body.name || req.body.businessName;
    const ownerName = req.body.ownerName;
    const email = req.body.email;
    const password = req.body.password;
    const phone = req.body.phone || '';
    const address = req.body.address || '';
    const city = req.body.city || '';
    const country = req.body.country || 'Pakistan';
    const plan = req.body.plan || req.body.subscriptionPlan || 'Pro';
    const maxUsers = req.body.maxUsers || 10;
    const subscriptionExpiresAt = req.body.subscriptionExpiresAt || req.body.subscriptionExpiryDate;
    const logo = req.body.logo || '';
    const customTenantId = req.body.tenantId;
    const rawArthiCode = req.body.arthiCode;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in Business Name, Email, and Owner Password.' });
    }

    // Process & validate Arthi Code (platform-wide unique, 2-5 uppercase alphanumeric)
    const cleanArthiCode = (rawArthiCode ? rawArthiCode.trim() : generateSuggestedArthiCode(name)).toUpperCase();
    if (!validateArthiCode(cleanArthiCode)) {
      return res.status(400).json({ error: 'Arthi Code must be 2 to 5 alphanumeric characters (e.g. RT, BFM).' });
    }

    // Platform-wide uniqueness check
    const allBusinesses = await Business.find();
    const isDuplicateArthi = allBusinesses.some(b => 
      !b.isDeleted && b.arthiCode && b.arthiCode.trim().toUpperCase() === cleanArthiCode
    );
    if (isDuplicateArthi) {
      return res.status(400).json({ error: `Arthi Code "${cleanArthiCode}" is already in use by another registered business. Please choose a unique code.` });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // Generate unique tenantId and businessCode
    const tenantId = customTenantId && customTenantId.trim() !== ''
      ? customTenantId.trim()
      : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const totalCount = await Business.countDocuments();
    const businessCode = `REG-${1001 + totalCount}`;

    const startDate = new Date().toISOString().split('T')[0];
    const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create Business Document
    const business = await Business.create({
      name,
      businessName: name,
      businessCode,
      arthiCode: cleanArthiCode,
      ownerName: ownerName || 'Admin',
      email,
      phone,
      address,
      city,
      country,
      logo,
      tenantId,
      plan,
      subscriptionPlan: plan,
      status: 'Active',
      subscriptionStatus: 'Active',
      subscriptionStartDate: startDate,
      subscriptionExpiresAt: subscriptionExpiresAt || defaultExpiry,
      subscriptionExpiryDate: subscriptionExpiresAt || defaultExpiry,
      maxUsers: Number(maxUsers) || 10,
      isActive: true,
      isDeleted: false,
    });

    // Create Owner User Account
    const salt = bcryptjs.genSaltSync(10);
    const hashedPassword = bcryptjs.hashSync(password, salt);

    const ownerUser = await User.create({
      tenantId,
      name: ownerName || 'Admin',
      email,
      password: hashedPassword,
      phone,
      address,
      role: 'Admin',
      status: 'Active',
    });

    // Create Default Business Settings for this tenant
    await BusinessSettings.create({
      tenantId,
      businessName: name,
      ownerName: ownerName || 'Admin',
      email,
      mobileNumber: phone,
      whatsAppNumber: phone,
      address,
      city,
      country,
      currency: 'PKR',
      currencySymbol: 'Rs.',
    });

    // Audit Log for Super Admin Action
    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'BUSINESS_REGISTERED',
      details: `Registered new business "${name}" (${businessCode}) with Plan: ${plan}, Owner: ${ownerName || 'Admin'}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      message: 'Business created successfully.',
      business,
      owner: {
        id: ownerUser.id || ownerUser._id,
        name: ownerUser.name,
        email: ownerUser.email,
        role: ownerUser.role,
      }
    });

  } catch (err) {
    console.error('Error creating business:', err);
    res.status(500).json({ error: 'Failed to create business profile.' });
  }
}

// 3. Edit Business
export async function editBusiness(req, res) {
  try {
    const { id } = req.params;
    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    const bName = req.body.name || req.body.businessName || business.name || business.businessName;
    const bOwner = req.body.ownerName || business.ownerName;
    const bEmail = req.body.email || business.email;
    const bPhone = req.body.phone !== undefined ? req.body.phone : business.phone;
    const bCity = req.body.city !== undefined ? req.body.city : business.city;
    const bAddress = req.body.address !== undefined ? req.body.address : business.address;
    const bCountry = req.body.country !== undefined ? req.body.country : (business.country || 'Pakistan');
    const bBusinessCode = req.body.businessCode || business.businessCode;
    const bPlan = req.body.plan || req.body.subscriptionPlan || business.plan || business.subscriptionPlan;
    const bStatus = req.body.status || req.body.subscriptionStatus || business.status || business.subscriptionStatus || 'Active';
    const bExpiry = req.body.subscriptionExpiresAt || req.body.subscriptionExpiryDate || business.subscriptionExpiresAt || business.subscriptionExpiryDate;

    let bArthiCode = business.arthiCode;
    if (req.body.arthiCode !== undefined && req.body.arthiCode.trim() !== '') {
      const cleanArthi = req.body.arthiCode.trim().toUpperCase();
      if (!validateArthiCode(cleanArthi)) {
        return res.status(400).json({ error: 'Arthi Code must be 2 to 5 alphanumeric characters (e.g. RT, BFM).' });
      }
      // Check uniqueness across other businesses
      const allBusinesses = await Business.find();
      const isDuplicate = allBusinesses.some(b => {
        const bId = b.id || b._id?.toString();
        return (bId !== id && String(bId) !== String(id)) &&
               !b.isDeleted &&
               b.arthiCode &&
               b.arthiCode.trim().toUpperCase() === cleanArthi;
      });
      if (isDuplicate) {
        return res.status(400).json({ error: `Arthi Code "${cleanArthi}" is already assigned to another business.` });
      }
      bArthiCode = cleanArthi;
    }

    const updateData = {
      name: bName,
      businessName: bName,
      businessCode: bBusinessCode,
      arthiCode: bArthiCode,
      ownerName: bOwner,
      email: bEmail,
      phone: bPhone,
      city: bCity,
      address: bAddress,
      country: bCountry,
      plan: bPlan,
      subscriptionPlan: bPlan,
      status: bStatus,
      subscriptionStatus: bStatus,
      subscriptionExpiresAt: bExpiry,
      subscriptionExpiryDate: bExpiry,
      isActive: bStatus === 'Active',
    };

    const updated = await Business.findByIdAndUpdate(id, updateData);

    // Update Owner User and BusinessSettings if info changed
    if (business.tenantId) {
      const ownerUser = await User.findOne({ tenantId: business.tenantId, role: 'Admin' });
      if (ownerUser) {
        await User.findByIdAndUpdate(ownerUser.id || ownerUser._id, {
          name: bOwner || ownerUser.name,
          phone: bPhone || ownerUser.phone,
          status: bStatus === 'Active' ? 'Active' : 'Inactive'
        });
      }

      const bizSettings = await BusinessSettings.findOne({ tenantId: business.tenantId });
      if (bizSettings) {
        await BusinessSettings.findByIdAndUpdate(bizSettings.id || bizSettings._id, {
          businessName: bName,
          ownerName: bOwner,
          email: bEmail,
          mobileNumber: bPhone,
          city: bCity,
          address: bAddress,
        });
      }
    }

    // Audit Log for Super Admin Action
    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'BUSINESS_EDITED',
      details: `Edited business details for "${bName}" (Tenant: ${business.tenantId}). Status: ${bStatus}, Plan: ${bPlan}.`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating business:', err);
    res.status(500).json({ error: 'Failed to update business details.' });
  }
}

// 4. Toggle Suspend / Activate Business
export async function toggleBusinessStatus(req, res) {
  try {
    const { id } = req.params;
    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    const newStatus = req.body.status || (req.body.isActive === false ? 'Suspended' : 'Active');
    const isActive = newStatus === 'Active';

    const updated = await Business.findByIdAndUpdate(id, {
      status: newStatus,
      subscriptionStatus: newStatus,
      isActive,
    });

    if (business.tenantId) {
      const ownerUser = await User.findOne({ tenantId: business.tenantId, role: 'Admin' });
      if (ownerUser) {
        await User.findByIdAndUpdate(ownerUser.id || ownerUser._id, {
          status: isActive ? 'Active' : 'Inactive'
        });
      }
    }

    // Audit Log for Super Admin Action
    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: isActive ? 'BUSINESS_ACTIVATED' : 'BUSINESS_SUSPENDED',
      details: `${isActive ? 'Activated' : 'Suspended'} business "${business.name || business.businessName}" (Tenant: ${business.tenantId}).`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: `Business status updated to ${newStatus}.`,
      business: updated
    });
  } catch (err) {
    console.error('Error toggling business status:', err);
    res.status(500).json({ error: 'Failed to change business status.' });
  }
}

// 5. Reset Business Owner Password
export async function resetOwnerPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    const ownerUser = await User.findOne({ tenantId: business.tenantId, role: 'Admin' }) || await User.findOne({ email: business.email });
    if (!ownerUser) {
      return res.status(404).json({ error: 'Owner user account not found for this business.' });
    }

    const salt = bcryptjs.genSaltSync(10);
    const hashedPassword = bcryptjs.hashSync(newPassword, salt);

    await User.findByIdAndUpdate(ownerUser.id || ownerUser._id, { password: hashedPassword });

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'PASSWORD_RESET',
      details: `Reset owner password for business "${business.name || business.businessName}" (${ownerUser.email}).`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: `Successfully reset password for owner ${ownerUser.email}.` });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset owner password.' });
  }
}

// 6. Renew / Extend Business Subscription & Change Plan
export async function renewSubscription(req, res) {
  try {
    const { id } = req.params;
    const { subscriptionExpiryDate, subscriptionPlan, extendDays } = req.body;

    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    let calculatedExpiry = subscriptionExpiryDate;
    if (extendDays && !subscriptionExpiryDate) {
      const currentExpiry = business.subscriptionExpiresAt || business.subscriptionExpiryDate;
      const baseDate = (currentExpiry && new Date(currentExpiry) > new Date()) 
        ? new Date(currentExpiry) 
        : new Date();
      baseDate.setDate(baseDate.getDate() + Number(extendDays));
      calculatedExpiry = baseDate.toISOString().split('T')[0];
    }

    if (!calculatedExpiry) {
      return res.status(400).json({ error: 'Please provide a valid subscription expiry date or extend days.' });
    }

    const nextPlan = subscriptionPlan || business.plan || business.subscriptionPlan || 'Pro';

    const updated = await Business.findByIdAndUpdate(id, {
      subscriptionExpiresAt: calculatedExpiry,
      subscriptionExpiryDate: calculatedExpiry,
      plan: nextPlan,
      subscriptionPlan: nextPlan,
      status: 'Active',
      subscriptionStatus: 'Active',
      isActive: true,
    });

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: subscriptionPlan && subscriptionPlan !== business.plan ? 'SUBSCRIPTION_CHANGED' : 'SUBSCRIPTION_EXTENDED',
      details: `Updated subscription for "${business.name || business.businessName}" to Plan: ${nextPlan}, Expiry: ${calculatedExpiry}${extendDays ? ` (+${extendDays} days)` : ''}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: 'Subscription updated and extended successfully.',
      business: updated
    });
  } catch (err) {
    console.error('Error renewing subscription:', err);
    res.status(500).json({ error: 'Failed to renew subscription.' });
  }
}

// 7. Soft Delete Business
export async function deleteBusiness(req, res) {
  try {
    const { id } = req.params;
    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    const updated = await Business.findByIdAndUpdate(id, {
      isDeleted: true,
      isActive: false,
      status: 'Suspended',
      subscriptionStatus: 'Suspended',
    });

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'BUSINESS_SUSPENDED',
      details: `Soft deleted and deactivated business "${business.name || business.businessName}" (${business.tenantId}).`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Business deleted successfully.' });
  } catch (err) {
    console.error('Error deleting business:', err);
    res.status(500).json({ error: 'Failed to delete business.' });
  }
}

// 8. Super Admin Dashboard Statistics & Analytics
export async function getSuperAdminStats(req, res) {
  try {
    const businesses = await Business.find({ isDeleted: { $ne: true } });
    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const thirtyDaysStr = thirtyDaysAhead.toISOString().split('T')[0];

    const totalBusinesses = businesses.length;
    
    // Categorize status with expiration logic
    let activeBusinesses = 0;
    let suspendedBusinesses = 0;
    let expiredBusinesses = 0;
    let trialBusinesses = 0;
    let expiringSoonBusinesses = 0;
    const expiringSoonList = [];

    businesses.forEach(b => {
      const plan = b.plan || b.subscriptionPlan || 'Pro';
      const status = b.status || b.subscriptionStatus || 'Active';
      const expiry = b.subscriptionExpiresAt || b.subscriptionExpiryDate;

      if (plan === 'Trial') trialBusinesses++;

      if (status === 'Suspended' || !b.isActive) {
        suspendedBusinesses++;
      } else if (expiry && expiry < today) {
        expiredBusinesses++;
      } else {
        activeBusinesses++;
      }

      // Check upcoming expiry (within next 30 days)
      if (expiry && expiry >= today && expiry <= thirtyDaysStr) {
        expiringSoonBusinesses++;
        const expDate = new Date(expiry);
        const diffTime = expDate - todayDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        expiringSoonList.push({
          id: b.id || b._id,
          name: b.name || b.businessName,
          tenantId: b.tenantId,
          ownerName: b.ownerName,
          phone: b.phone,
          email: b.email,
          plan,
          expiry,
          daysLeft: diffDays,
        });
      }
    });

    const allUsers = await User.find({ isDeleted: { $ne: true } });
    const tenantUsersCount = allUsers.filter(u => u.role !== 'super_admin').length;

    // Registrations over time (monthly breakdown for the last 6 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};
    
    // Initialize last 6 months
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${monthNames[past.getMonth()]} ${past.getFullYear().toString().slice(-2)}`;
      monthlyMap[key] = { month: key, count: 0, active: 0 };
    }

    businesses.forEach(b => {
      if (b.createdAt) {
        const created = new Date(b.createdAt);
        const key = `${monthNames[created.getMonth()]} ${created.getFullYear().toString().slice(-2)}`;
        if (monthlyMap[key]) {
          monthlyMap[key].count++;
          if (b.isActive && b.status === 'Active') monthlyMap[key].active++;
        }
      }
    });

    const registrationsOverTime = Object.values(monthlyMap);

    // Plan distribution counts
    const planCounts = {
      Trial: 0,
      Basic: 0,
      Pro: 0,
      Enterprise: 0,
      Custom: 0,
    };
    businesses.forEach(b => {
      const p = b.plan || b.subscriptionPlan || 'Pro';
      if (planCounts[p] !== undefined) {
        planCounts[p]++;
      } else {
        planCounts.Custom++;
      }
    });

    // Recent businesses
    const recentBusinesses = [...businesses]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
      .map(b => ({
        id: b.id || b._id,
        name: b.name || b.businessName,
        tenantId: b.tenantId,
        ownerName: b.ownerName,
        plan: b.plan || b.subscriptionPlan,
        status: b.status || b.subscriptionStatus,
        createdAt: b.createdAt,
      }));

    res.json({
      totalBusinesses,
      activeBusinesses,
      trialBusinesses,
      suspendedBusinesses,
      expiredBusinesses,
      expiringSoonBusinesses,
      expiringSoonList: expiringSoonList.sort((a, b) => a.daysLeft - b.daysLeft),
      totalUsers: tenantUsersCount,
      registrationsOverTime,
      planCounts,
      recentBusinesses,
    });
  } catch (err) {
    console.error('Error fetching Super Admin stats:', err);
    res.status(500).json({ error: 'Failed to load system statistics.' });
  }
}

// 9. Get All System Users Across Tenants
export async function getAllUsers(req, res) {
  try {
    const users = await User.find({ isDeleted: { $ne: true } });
    const businesses = await Business.find();
    const allLogs = await AuditLog.find();

    const bizMap = {};
    businesses.forEach(b => {
      bizMap[b.tenantId] = {
        name: b.name || b.businessName,
        code: b.businessCode || b.arthiCode,
      };
    });

    const enriched = users.map(u => {
      const uId = u.id || u._id;
      // Find latest activity or login for this user
      const userLogs = allLogs.filter(l => l.userId === uId || l.userName === u.name || l.details?.includes(u.email));
      let lastLogin = u.updatedAt || u.createdAt || '';
      if (userLogs.length > 0) {
        const sorted = [...userLogs].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        lastLogin = sorted[0].timestamp || lastLogin;
      }

      const tenantInfo = bizMap[u.tenantId];

      return {
        id: uId,
        _id: uId,
        name: u.name || 'User',
        email: u.email || 'N/A',
        phone: u.phone || 'N/A',
        role: u.role || 'Clerk',
        status: u.status || 'Active',
        tenantId: u.tenantId || 'platform',
        businessName: u.role === 'super_admin' ? 'MandiOS Platform Core' : (tenantInfo?.name || 'Unknown Business'),
        businessCode: tenantInfo?.code || '',
        lastLogin,
        createdAt: u.createdAt,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching all users:', err);
    res.status(500).json({ error: 'Failed to fetch platform users.' });
  }
}

// 10. Toggle User Status (Super Admin)
export async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot deactivate Super Admin user.' });
    }

    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const updated = await User.findByIdAndUpdate(id, { status: nextStatus });

    // Audit Log for Super Admin Action
    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: nextStatus === 'Active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      details: `${nextStatus === 'Active' ? 'Activated' : 'Deactivated'} user "${user.name}" (${user.email}, Role: ${user.role}, Tenant: ${user.tenantId}).`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: `User status changed to ${nextStatus}.`, user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status.' });
  }
}

// 11. Super Admin Global Cross-Tenant Search
export async function searchSuperAdminGlobal(req, res) {
  try {
    const { q = '' } = req.query;
    const queryStr = String(q).trim().toLowerCase();

    if (!queryStr) {
      return res.json({
        businesses: [],
        users: [],
        customers: [],
        suppliers: [],
      });
    }

    const [businesses, users, customers, suppliers] = await Promise.all([
      Business.find({ isDeleted: { $ne: true } }),
      User.find({ isDeleted: { $ne: true } }),
      Customer.find({ isDeleted: { $ne: true } }),
      Supplier.find({ isDeleted: { $ne: true } }),
    ]);

    const bizMap = {};
    businesses.forEach(b => {
      bizMap[b.tenantId] = b.name || b.businessName;
    });

    const matches = (val, term) => {
      if (!val) return false;
      return String(val).toLowerCase().includes(term);
    };

    // 1. Businesses
    const matchedBusinesses = [];
    businesses.forEach(b => {
      if (
        matches(b.name, queryStr) ||
        matches(b.businessName, queryStr) ||
        matches(b.businessCode, queryStr) ||
        matches(b.arthiCode, queryStr) ||
        matches(b.ownerName, queryStr) ||
        matches(b.email, queryStr) ||
        matches(b.phone, queryStr) ||
        matches(b.city, queryStr) ||
        matches(b.tenantId, queryStr)
      ) {
        matchedBusinesses.push({
          id: b.id || b._id,
          name: b.name || b.businessName,
          ownerName: b.ownerName,
          businessCode: b.businessCode || 'N/A',
          arthiCode: b.arthiCode || 'N/A',
          tenantId: b.tenantId,
          email: b.email,
          phone: b.phone,
          city: b.city,
          plan: b.plan || b.subscriptionPlan,
          status: b.status || b.subscriptionStatus,
          expiry: b.subscriptionExpiresAt || b.subscriptionExpiryDate,
          type: 'Business / Tenant',
        });
      }
    });

    // 2. Users
    const matchedUsers = [];
    users.forEach(u => {
      if (
        matches(u.name, queryStr) ||
        matches(u.email, queryStr) ||
        matches(u.phone, queryStr) ||
        matches(u.role, queryStr)
      ) {
        matchedUsers.push({
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          tenantId: u.tenantId,
          businessName: u.role === 'super_admin' ? 'MandiOS Core' : (bizMap[u.tenantId] || 'Default Market'),
          type: 'Platform User',
        });
      }
    });

    // 3. Customers
    const matchedCustomers = [];
    customers.forEach(c => {
      if (
        matches(c.name, queryStr) ||
        matches(c.phone, queryStr) ||
        matches(c.khataId, queryStr) ||
        matches(c.address, queryStr)
      ) {
        matchedCustomers.push({
          id: c.id || c._id,
          name: c.name,
          phone: c.phone,
          khataId: c.khataId || 'N/A',
          address: c.address || 'N/A',
          tenantId: c.tenantId,
          businessName: bizMap[c.tenantId] || 'Mandi Business',
          currentBalance: c.currentBalance || 0,
          type: 'Customer Portfolio',
        });
      }
    });

    // 4. Suppliers
    const matchedSuppliers = [];
    suppliers.forEach(s => {
      if (
        matches(s.name, queryStr) ||
        matches(s.phone, queryStr) ||
        matches(s.cnic, queryStr) ||
        matches(s.khataId, queryStr) ||
        matches(s.address, queryStr)
      ) {
        matchedSuppliers.push({
          id: s.id || s._id,
          name: s.name,
          phone: s.phone,
          cnic: s.cnic || 'N/A',
          khataId: s.khataId || 'N/A',
          address: s.address || 'N/A',
          tenantId: s.tenantId,
          businessName: bizMap[s.tenantId] || 'Mandi Business',
          currentBalance: s.currentBalance || 0,
          type: 'Supplier Catalog',
        });
      }
    });

    res.json({
      query: queryStr,
      totalMatches: matchedBusinesses.length + matchedUsers.length + matchedCustomers.length + matchedSuppliers.length,
      businesses: matchedBusinesses,
      users: matchedUsers,
      customers: matchedCustomers,
      suppliers: matchedSuppliers,
    });
  } catch (err) {
    console.error('Super Admin Global search error:', err);
    res.status(500).json({ error: 'Failed to perform search query.' });
  }
}

// 12. Super Admin Activity / Audit Logs
export async function getSuperAdminAuditLogs(req, res) {
  try {
    const allLogs = await AuditLog.find();
    const businesses = await Business.find();
    
    const bizMap = {};
    businesses.forEach(b => {
      bizMap[b.tenantId] = b.name || b.businessName;
    });

    const enriched = allLogs.map(l => {
      const tId = l.tenantId || 'platform';
      const bName = tId === 'super_admin_logs' ? 'Super Admin System' : (bizMap[tId] || 'Platform Central');
      return {
        id: l.id || l._id,
        action: l.action,
        performedBy: l.userName || 'Super Admin',
        userRole: l.userRole || 'super_admin',
        userId: l.userId,
        tenantId: tId,
        businessName: bName,
        details: l.details || '',
        timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
      };
    });

    const sorted = enriched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(sorted.slice(0, 200));
  } catch (err) {
    console.error('Error fetching Super Admin audit logs:', err);
    res.status(500).json({ error: 'Failed to fetch security audit logs.' });
  }
}

// 13. Global Settings
export async function getGlobalSettings(req, res) {
  try {
    let settings = await GlobalSettings.findOne({});
    if (!settings) {
      settings = await GlobalSettings.create({
        platformName: 'MandiOS Cloud ERP',
        maintenanceMode: false,
        supportEmail: 'support@mandios.com',
        supportPhone: '03000000000',
        defaultTrialDays: 30,
        allowSelfRegistration: false,
      });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch global settings.' });
  }
}

export async function updateGlobalSettings(req, res) {
  try {
    let settings = await GlobalSettings.findOne({});
    if (!settings) {
      settings = await GlobalSettings.create(req.body);
    } else {
      settings = await GlobalSettings.findByIdAndUpdate(settings.id || settings._id, req.body);
    }

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'SETTINGS_UPDATED',
      details: 'Updated global platform configuration settings.',
      timestamp: new Date().toISOString(),
    });

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update global settings.' });
  }
}

// 14. Super Admin Profile Update
export async function updateSuperAdminProfile(req, res) {
  try {
    const { name, email, phone, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized profile update.' });
    }

    const updateData = {
      name: name || user.name,
      email: email || user.email,
      phone: phone || user.phone,
    };

    if (newPassword) {
      if (!currentPassword || !bcryptjs.compareSync(currentPassword, user.password)) {
        return res.status(400).json({ error: 'Current password confirmation is incorrect.' });
      }
      const salt = bcryptjs.genSaltSync(10);
      updateData.password = bcryptjs.hashSync(newPassword, salt);
    }

    const updated = await User.findByIdAndUpdate(user.id || user._id, updateData);
    res.json({ message: 'Profile updated successfully.', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

// 15. Suggest Unique Arthi Code
export async function suggestArthiCodeHandler(req, res) {
  try {
    const { name } = req.query;
    const base = generateSuggestedArthiCode(name || '');
    const allBiz = await Business.find({ isDeleted: { $ne: true } });
    let candidate = base;
    let suffix = 1;
    while (allBiz.some(b => b.arthiCode && b.arthiCode.trim().toUpperCase() === candidate.toUpperCase())) {
      candidate = (base.substring(0, 4) + suffix).substring(0, 5).toUpperCase();
      suffix++;
    }
    res.json({ suggestedCode: candidate });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate suggested code.' });
  }
}

// 16. Impersonate Business (Login as Tenant Admin for Support)
export async function impersonateBusiness(req, res) {
  try {
    const { id } = req.params;
    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    // Find the Admin user for this tenant
    let targetUser = await User.findOne({ tenantId: business.tenantId, role: 'Admin' });
    if (!targetUser) {
      targetUser = await User.findOne({ email: business.email });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'No Admin user account exists for this business to impersonate.' });
    }

    // Record in global Audit Log
    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'SUPPORT_IMPERSONATION',
      details: `Super Admin started support impersonation session for "${business.name || business.businessName}" (Tenant: ${business.tenantId}).`,
      timestamp: new Date().toISOString(),
    });

    const impersonatedUserPayload = {
      id: targetUser.id || targetUser._id,
      email: targetUser.email,
      khataId: targetUser.khataId || '',
      name: targetUser.name,
      role: 'Admin',
      tenantId: business.tenantId,
      isImpersonated: true,
      impersonatedBy: req.user?.id,
      businessName: business.name || business.businessName,
      impersonationExpiresAt: Date.now() + 4 * 60 * 60 * 1000,
    };
    if (!beginImpersonatedSession(req, res, impersonatedUserPayload)) {
      return res.status(401).json({ error: 'Superadmin refresh session is missing or invalid.' });
    }

    res.json({
      success: true,
      message: `Support Impersonation active for ${business.name || business.businessName}`,
      business: {
        id: business.id || business._id,
        name: business.name || business.businessName,
        tenantId: business.tenantId,
        arthiCode: business.arthiCode,
        plan: business.plan || business.subscriptionPlan,
      }
    });
  } catch (err) {
    console.error('Error impersonating business:', err);
    res.status(500).json({ error: 'Failed to initiate support impersonation session.' });
  }
}

// 17. Real-time Platform Health & Telemetry
export async function getSystemHealth(req, res) {
  try {
    const isMongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    const memory = process.memoryUsage();
    const uptimeSec = process.uptime();

    const [
      businessCount,
      userCount,
      customerCount,
      supplierCount,
      saleCount,
      stockCount,
      paymentCount,
      auditLogCount,
      announcementCount,
      productCount
    ] = await Promise.all([
      Business.countDocuments ? Business.countDocuments() : (await Business.find()).length,
      User.countDocuments ? User.countDocuments() : (await User.find()).length,
      Customer.countDocuments ? Customer.countDocuments() : (await Customer.find()).length,
      Supplier.countDocuments ? Supplier.countDocuments() : (await Supplier.find()).length,
      Sale.countDocuments ? Sale.countDocuments() : (await Sale.find()).length,
      StockEntry.countDocuments ? StockEntry.countDocuments() : (await StockEntry.find()).length,
      Payment.countDocuments ? Payment.countDocuments() : (await Payment.find()).length,
      AuditLog.countDocuments ? AuditLog.countDocuments() : (await AuditLog.find()).length,
      Announcement.countDocuments ? Announcement.countDocuments() : (await Announcement.find()).length,
      Product.countDocuments ? Product.countDocuments() : (await Product.find()).length,
    ]);

    const formatUptime = (seconds) => {
      const d = Math.floor(seconds / (3600 * 24));
      const h = Math.floor((seconds % (3600 * 24)) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
    };

    res.json({
      status: isMongoReady ? 'Operational' : 'Ready (Persistent File DB)',
      database: {
        engine: isMongoReady ? 'MongoDB' : 'Local JSON Persistence Engine',
        state: isMongoReady ? 'Connected' : 'Persistent Storage Active',
        host: mongoose.connection?.host || 'local-mandi-data',
        dbName: mongoose.connection?.name || 'mandi_db',
      },
      server: {
        uptime: formatUptime(uptimeSec),
        uptimeSeconds: Math.floor(uptimeSec),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      memory: {
        rssMb: (memory.rss / 1024 / 1024).toFixed(1),
        heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMb: (memory.heapTotal / 1024 / 1024).toFixed(1),
      },
      counts: {
        businesses: businessCount,
        users: userCount,
        customers: customerCount,
        suppliers: supplierCount,
        products: productCount,
        sales: saleCount,
        stockEntries: stockCount,
        payments: paymentCount,
        auditLogs: auditLogCount,
        announcements: announcementCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching system health:', err);
    res.status(500).json({ error: 'Failed to retrieve system telemetry.' });
  }
}

// 18. Database Backup Export
export async function exportAllDatabaseBackup(req, res) {
  try {
    const [
      businesses, users, customers, suppliers, products,
      sales, stockEntries, ledgers, payments, expenses,
      trucks, employees, salaries, announcements, plans, globalSettings
    ] = await Promise.all([
      Business.find(), User.find(), Customer.find(), Supplier.find(), Product.find(),
      Sale.find(), StockEntry.find(), Ledger.find(), Payment.find(), Expense.find(),
      Truck.find(), Employee.find(), Salary.find(), Announcement.find(), Plan.find(), GlobalSettings.find()
    ]);

    const sanitizedUsers = users.map(u => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });

    const snapshot = {
      meta: {
        system: 'MandiOS Cloud ERP Platform Backup',
        version: '3.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email || 'super_admin',
        totalRecords: businesses.length + users.length + customers.length + suppliers.length + sales.length + stockEntries.length,
      },
      data: {
        businesses,
        users: sanitizedUsers,
        customers,
        suppliers,
        products,
        sales,
        stockEntries,
        ledgers,
        payments,
        expenses,
        trucks,
        employees,
        salaries,
        announcements,
        plans,
        globalSettings,
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=mandios_full_backup_${Date.now()}.json`);
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error('Error creating database backup:', err);
    res.status(500).json({ error: 'Failed to generate database backup.' });
  }
}

// 19. Export Single Tenant Data JSON
export async function exportTenantData(req, res) {
  try {
    const { tenantId } = req.params;
    const business = await Business.findOne({ tenantId });
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    const [users, customers, suppliers, products, sales, stockEntries, ledgers, payments, expenses, trucks, employees] = await Promise.all([
      User.find({ tenantId }),
      Customer.find({ tenantId }),
      Supplier.find({ tenantId }),
      Product.find({ tenantId }),
      Sale.find({ tenantId }),
      StockEntry.find({ tenantId }),
      Ledger.find({ tenantId }),
      Payment.find({ tenantId }),
      Expense.find({ tenantId }),
      Truck.find({ tenantId }),
      Employee.find({ tenantId }),
    ]);

    const sanitizedUsers = users.map(u => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });

    const tenantSnapshot = {
      meta: {
        tenantId,
        businessName: business.name || business.businessName,
        arthiCode: business.arthiCode,
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email || 'super_admin',
      },
      data: {
        business,
        users: sanitizedUsers,
        customers,
        suppliers,
        products,
        sales,
        stockEntries,
        ledgers,
        payments,
        expenses,
        trucks,
        employees,
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=tenant_${tenantId}_export_${Date.now()}.json`);
    res.send(JSON.stringify(tenantSnapshot, null, 2));
  } catch (err) {
    console.error('Error exporting tenant data:', err);
    res.status(500).json({ error: 'Failed to export tenant data.' });
  }
}

// 20. Subscription Plans Management
export async function getSubscriptionPlans(req, res) {
  try {
    let plans = await Plan.find();
    if (!plans || plans.length === 0) {
      plans = [
        await Plan.create({
          name: 'Basic',
          priceMonthly: 3000,
          priceAnnual: 30000,
          maxUsers: 3,
          maxProducts: 25,
          duration: '1 Month',
          description: 'Essential Mandi Ledger for small single-clerk commission shops.',
          features: { logistics: false, multiLanguage: true, reportsExport: true, returnsModule: false, smsWhatsApp: false, prioritySupport: false },
          isPopular: false,
          status: 'Active',
        }),
        await Plan.create({
          name: 'Pro',
          priceMonthly: 6000,
          priceAnnual: 60000,
          maxUsers: 10,
          maxProducts: 150,
          duration: '1 Year',
          description: 'Full-featured Mandi ERP with truck arrivals, crates & returns tracking.',
          features: { logistics: true, multiLanguage: true, reportsExport: true, returnsModule: true, smsWhatsApp: true, prioritySupport: false },
          isPopular: true,
          status: 'Active',
        }),
        await Plan.create({
          name: 'Enterprise',
          priceMonthly: 15000,
          priceAnnual: 150000,
          maxUsers: 50,
          maxProducts: 1000,
          duration: '1 Year',
          description: 'High-volume market brokers with multi-branch staff & dedicated support.',
          features: { logistics: true, multiLanguage: true, reportsExport: true, returnsModule: true, smsWhatsApp: true, prioritySupport: true },
          isPopular: false,
          status: 'Active',
        })
      ];
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription plans.' });
  }
}

export async function createSubscriptionPlan(req, res) {
  try {
    const { name, priceMonthly, priceAnnual, duration, maxUsers, maxProducts, description, features, isPopular, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Plan name is required.' });

    const newPlan = await Plan.create({
      name,
      priceMonthly: Number(priceMonthly) || 0,
      priceAnnual: Number(priceAnnual) || 0,
      duration: duration || '1 Month',
      maxUsers: Number(maxUsers) || 5,
      maxProducts: Number(maxProducts) || 50,
      description: description || '',
      features: features || { logistics: true, multiLanguage: true, reportsExport: true, returnsModule: true, smsWhatsApp: false, prioritySupport: false },
      isPopular: Boolean(isPopular),
      status: status || 'Active',
    });

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'PLAN_CREATED',
      details: `Created new SaaS subscription plan "${name}" (PKR ${priceMonthly}/mo).`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(newPlan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan.' });
  }
}

export async function updateSubscriptionPlan(req, res) {
  try {
    const { id } = req.params;
    const updated = await Plan.findByIdAndUpdate(id, req.body);

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'PLAN_UPDATED',
      details: `Updated subscription plan "${req.body.name || updated?.name || id}".`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan.' });
  }
}

export async function toggleSubscriptionPlanStatus(req, res) {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    const nextStatus = plan.status === 'Active' ? 'Inactive' : 'Active';
    const updated = await Plan.findByIdAndUpdate(id, { status: nextStatus });

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'PLAN_STATUS_CHANGED',
      details: `${nextStatus === 'Active' ? 'Activated' : 'Deactivated'} plan "${plan.name}".`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle plan status.' });
  }
}

export async function deleteSubscriptionPlan(req, res) {
  try {
    const { id } = req.params;
    await Plan.findByIdAndDelete(id);
    res.json({ message: 'Plan deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan.' });
  }
}

// 21. Announcements
export async function getAnnouncements(req, res) {
  try {
    const list = await Announcement.find();
    res.json(list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements.' });
  }
}

export async function createAnnouncement(req, res) {
  try {
    const { title, message, type, targetAudience, expiresAt } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    const item = await Announcement.create({
      title,
      message,
      type: type || 'info',
      targetAudience: targetAudience || 'All',
      isActive: true,
      createdBy: req.user?.name || 'Super Admin',
      expiresAt: expiresAt || '',
    });

    await AuditLog.create({
      tenantId: 'super_admin_logs',
      userId: req.user?.id || 'super_admin',
      userName: req.user?.name || 'Super Admin',
      userRole: 'super_admin',
      action: 'CREATE_SYSTEM_BROADCAST',
      details: `Published platform broadcast: "${title}".`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish announcement.' });
  }
}

export async function toggleAnnouncementStatus(req, res) {
  try {
    const { id } = req.params;
    const item = await Announcement.findById(id);
    if (!item) return res.status(404).json({ error: 'Announcement not found.' });

    const updated = await Announcement.findByIdAndUpdate(id, { isActive: !item.isActive });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update announcement.' });
  }
}

export async function deleteAnnouncement(req, res) {
  try {
    const { id } = req.params;
    await Announcement.findByIdAndDelete(id);
    res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete announcement.' });
  }
}

export async function getActiveAnnouncements(req, res) {
  try {
    const now = new Date().toISOString();
    const list = await Announcement.find({ isActive: true });
    const valid = list.filter(a => !a.expiresAt || a.expiresAt >= now);
    res.json(valid);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active announcements.' });
  }
}

export async function updateTenantFeatures(req, res) {
  try {
    const { id } = req.params;
    const { features } = req.body;
    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ error: 'Business not found.' });

    const updated = await Business.findByIdAndUpdate(id, {
      features: { ...(business.features || {}), ...(features || {}) }
    });
    res.json({ message: 'Tenant features updated.', business: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tenant features.' });
  }
}

