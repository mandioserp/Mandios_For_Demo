import { BoliSession, Sale, StockEntry, Customer } from '../models/index.js';
import { buildTenantQuery, assertTenantOwnership, getTenantId } from '../utils/tenant.js';
import { sanitizeCustomerData, sanitizeCustomerSale } from '../utils/customerDataAccess.js';
import { withMongoTransaction } from '../config/db.js';
import { createSaleBatchFromPayload } from './saleController.js';

export async function listBoliSessions(req, res) {
  try {
    const sessions = await BoliSession.find(buildTenantQuery(req)).sort({ createdAt: -1 });
    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(sessions) : sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load Boli sessions.' });
  }
}

export async function createBoliSession(req, res) {
  try {
    const { lotId, commissionType = 'Percentage', commissionValue = 0 } = req.body || {};
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!lotId) {
      return res.status(400).json({ error: 'Please select a lot to start a Boli Session.' });
    }

    const existingOpen = await BoliSession.findOne({
      tenantId,
      lotId,
      status: 'Open',
    });

    if (existingOpen) {
      return res.status(200).json(existingOpen);
    }

    const lot = await StockEntry.findById(lotId);
    if (!lot) {
      return res.status(404).json({ error: 'Lot not found.' });
    }
    if (!assertTenantOwnership(req, lot)) return res.status(404).json({ error: 'Lot not found.' });

    const session = await BoliSession.create({
      tenantId,
      lotId: lot._id || lot.id,
      stockEntryId: lot._id || lot.id,
      productId: lot.productId,
      productName: lot.productName,
      supplierId: lot.supplierId,
      supplierName: lot.supplierName,
      commissionType,
      commissionValue: Number(commissionValue) || 0,
      status: 'Open',
      createdBy: req.user?.id || req.user?._id || 'system',
    });

    res.status(201).json(session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create Boli session.' });
  }
}

export async function getBoliSession(req, res) {
  try {
    const session = await BoliSession.findOne({
      _id: req.params.id,
      ...buildTenantQuery(req),
    });
    if (!session) {
      return res.status(404).json({ error: 'Boli session not found.' });
    }

    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(session) : session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load Boli session.' });
  }
}

export async function getBoliSessionSales(req, res) {
  try {
    const session = await BoliSession.findOne({
      _id: req.params.id,
      ...buildTenantQuery(req),
    });

    if (!session) {
      return res.status(404).json({ error: 'Boli session not found.' });
    }

    const sales = await Sale.find({
      tenantId: session.tenantId,
      boliSessionId: session._id,
    });
    let visibleSales = sales;
    if (req.user?.role === 'Customer') {
      const customer = await Customer.findOne(buildTenantQuery(req, { userId: req.user.id }));
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      const customerId = String(customer.id || customer._id);
      visibleSales = sales.filter(sale => String(sale.customerId) === customerId).map(sanitizeCustomerSale);
    }
    visibleSales.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    res.json(visibleSales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load Boli session sales.' });
  }
}

export async function addSaleToBoliSession(req, res) {
  try {
    const session = await BoliSession.findOne({
      _id: req.params.id,
      ...buildTenantQuery(req),
    });

    if (!session) {
      return res.status(404).json({ error: 'Boli session not found.' });
    }

    if (session.status === 'Closed') {
      return res.status(400).json({ error: 'This Boli session is closed. Reopen it to add more sales.' });
    }

    const { customerId, quantity, saleRate, date, isWalkIn, walkInName, walkInMobile, walkInVehicle, remarks, discount, idempotencyKey } = req.body || {};

    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Please provide a valid sale quantity.' });
    }
    if (!Number.isFinite(Number(saleRate)) || Number(saleRate) <= 0) {
      return res.status(400).json({ error: 'Please provide a valid sale rate.' });
    }
    if (!customerId && !isWalkIn) {
      return res.status(400).json({ error: 'Please select a customer or mark as walk-in.' });
    }

    const stockEntry = await StockEntry.findById(session.stockEntryId || session.lotId);
    if (!stockEntry) {
      return res.status(404).json({ error: 'Lot no longer exists.' });
    }
    if (!assertTenantOwnership(req, stockEntry)) return res.status(404).json({ error: 'Lot not found.' });

    const payload = {
      req,
      stockEntryId: stockEntry._id || stockEntry.id,
      saleRate,
      date: date || new Date().toISOString().split('T')[0],
      buyers: [{
        customerId: isWalkIn ? null : customerId,
        quantity: Number(quantity),
        saleRate: Number(saleRate),
        discount: Number(discount) || 0,
        isWalkIn: !!isWalkIn,
        walkInName: walkInName || 'Walk-In Customer',
        walkInMobile: walkInMobile || '',
        walkInVehicle: walkInVehicle || '',
        remarks: remarks || '',
      }],
      customCommission: Number(session.commissionValue) || 0,
      customCommissionType: session.commissionType || 'Percentage',
      boliSessionId: session._id,
      tenantId: session.tenantId,
      idempotencyKey,
    };
    const result = stockEntry.businessMode === 'Own Trading'
      ? await withMongoTransaction(dbSession => createSaleBatchFromPayload({ ...payload, session: dbSession }))
      : await createSaleBatchFromPayload(payload);

    res.status(201).json({
      success: true,
      session,
      sales: result.createdSales,
      remainingConsignmentQuantity: result.remainingConsignmentQuantity,
      duplicate: result.duplicate === true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to add sale to Boli session.' });
  }
}

export async function closeBoliSession(req, res) {
  try {
    const session = await BoliSession.findOne({
      _id: req.params.id,
      ...buildTenantQuery(req),
    });

    if (!session) {
      return res.status(404).json({ error: 'Boli session not found.' });
    }

    session.status = 'Closed';
    session.closedBy = req.user?.id || req.user?._id || 'system';
    session.closedAt = new Date();
    await session.save();

    res.json(session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to close Boli session.' });
  }
}

export async function reopenBoliSession(req, res) {
  try {
    const session = await BoliSession.findOne({
      _id: req.params.id,
      ...buildTenantQuery(req),
    });

    if (!session) {
      return res.status(404).json({ error: 'Boli session not found.' });
    }

    session.status = 'Open';
    session.closedBy = undefined;
    session.closedAt = undefined;
    await session.save();

    res.json(session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reopen Boli session.' });
  }
}
