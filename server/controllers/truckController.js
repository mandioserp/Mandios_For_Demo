import { Truck, AuditLog, Supplier, Product } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { normalizeTruckBeoparis, normalizeTruckForResponse } from '../utils/truckCargo.js';

async function resolveBeoparis(req, input) {
  const beoparis = normalizeTruckBeoparis(input);
  const tenantQuery = buildTenantQuery(req);
  const supplierIds = [...new Set(beoparis.map(entry => entry.supplierId))];
  const suppliers = await Supplier.find({ ...tenantQuery, _id: { $in: supplierIds } });
  const suppliersById = new Map(suppliers.map(supplier => [String(supplier.id || supplier._id), supplier]));
  if (suppliersById.size !== supplierIds.length) {
    const error = new Error('One or more selected beopari were not found in this business.');
    error.status = 404;
    throw error;
  }

  const productIds = [...new Set(beoparis.flatMap(entry => entry.products.map(product => product.productId)).filter(Boolean))];
  const products = productIds.length
    ? await Product.find({ ...tenantQuery, _id: { $in: productIds } })
    : [];
  const validProductIds = new Set(products.map(product => String(product.id || product._id)));
  if (productIds.some(productId => !validProductIds.has(productId))) {
    const error = new Error('One or more selected products were not found in this business.');
    error.status = 404;
    throw error;
  }

  return beoparis.map(entry => ({
    ...entry,
    supplierName: suppliersById.get(entry.supplierId).name,
  }));
}

function legacyFieldsFromBeoparis(beoparis) {
  const first = beoparis[0];
  const cargoDescription = beoparis.map(entry =>
    `${entry.supplierName}: ${entry.products.map(product => `${product.productName} (${product.quantity} ${product.unit})`).join(', ')}`
  ).join('; ');
  return {
    supplierId: first.supplierId,
    supplierName: first.supplierName,
    // These legacy fields remain for older screens and analytics. Cargo quantities
    // are stored per product in beoparis to avoid summing unlike units.
    quantityLoaded: 0,
    description: cargoDescription,
    notes: cargoDescription,
  };
}

export async function getTrucks(req, res) {
  try {
    const trucks = await Truck.find(buildTenantQuery(req));
    res.json(trucks.map(normalizeTruckForResponse));
  } catch {
    res.status(500).json({ error: 'Failed to fetch trucks.' });
  }
}

export async function addTruck(req, res) {
  try {
    const { truckNumber, vehicleType, status, arrivalDate, dispatchDate, supplierId, driverName, driverPhone, notes, quantityLoaded, description, beoparis: inputBeoparis } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!truckNumber || !arrivalDate) {
      return res.status(400).json({ error: 'Please provide truck number and arrival date.' });
    }

    const beoparis = inputBeoparis === undefined ? undefined : await resolveBeoparis(req, inputBeoparis);
    let supplierName = '';
    if (supplierId && !beoparis) {
      const supplier = await Supplier.findOne({ ...buildTenantQuery(req), _id: supplierId });
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      supplierName = supplier.name;
    }

    const legacyCargo = beoparis ? legacyFieldsFromBeoparis(beoparis) : {};
    const truck = await Truck.create({
      tenantId,
      truckNumber: String(truckNumber).trim(),
      vehicleType: String(vehicleType || 'Truck').trim() || 'Truck',
      status: status || 'Arrived',
      arrivalDate,
      dispatchDate: dispatchDate || '',
      supplierId: beoparis ? legacyCargo.supplierId : (supplierId || ''),
      supplierName: beoparis ? legacyCargo.supplierName : supplierName,
      driverName: driverName || '',
      driverPhone: driverPhone || '',
      quantityLoaded: beoparis ? legacyCargo.quantityLoaded : (quantityLoaded !== undefined ? Number(quantityLoaded) : 0),
      description: beoparis ? legacyCargo.description : (description || notes || ''),
      notes: beoparis ? legacyCargo.notes : (notes || description || ''),
      ...(beoparis ? { beoparis } : {}),
    });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'ADD_TRUCK',
      details: `Registered truck ${truckNumber} from supplier${beoparis?.length === 1 ? '' : 's'} ${(beoparis || []).map(entry => entry.supplierName).join(', ') || supplierName || 'N/A'}.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(normalizeTruckForResponse(truck));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err instanceof TypeError || (err instanceof Error && /beopari|product|quantity|unit/i.test(err.message))) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to record truck entry.' });
  }
}

export async function editTruck(req, res) {
  try {
    const { id } = req.params;
    const { truckNumber, vehicleType, status, arrivalDate, dispatchDate, supplierId, driverName, driverPhone, notes, quantityLoaded, description, beoparis: inputBeoparis } = req.body;

    const truck = await Truck.findById(id);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }
    if (!assertTenantOwnership(req, truck)) return res.status(404).json({ error: 'Truck not found.' });

    let supplierName = truck.supplierName;
    if (supplierId && supplierId !== truck.supplierId && inputBeoparis === undefined) {
      const supplier = await Supplier.findOne({ ...buildTenantQuery(req), _id: supplierId });
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      supplierName = supplier.name;
    }

    const tenantId = getTenantId(req) || truck.tenantId || 'tenant_default_001';
    const beoparis = inputBeoparis === undefined ? undefined : await resolveBeoparis(req, inputBeoparis);
    const legacyCargo = beoparis ? legacyFieldsFromBeoparis(beoparis) : null;
    const update = {
      truckNumber: truckNumber || truck.truckNumber,
      vehicleType: vehicleType !== undefined ? (String(vehicleType).trim() || 'Truck') : (truck.vehicleType || 'Truck'),
      status: status || truck.status,
      arrivalDate: arrivalDate || truck.arrivalDate,
      dispatchDate: dispatchDate !== undefined ? dispatchDate : truck.dispatchDate,
      driverName: driverName !== undefined ? driverName : truck.driverName,
      driverPhone: driverPhone !== undefined ? driverPhone : truck.driverPhone,
      quantityLoaded: beoparis ? legacyCargo.quantityLoaded : (quantityLoaded !== undefined ? Number(quantityLoaded) : truck.quantityLoaded),
      description: beoparis ? legacyCargo.description : (description !== undefined ? description : (notes !== undefined ? notes : truck.description)),
      notes: beoparis ? legacyCargo.notes : (notes !== undefined ? notes : (description !== undefined ? description : truck.notes)),
      supplierId: beoparis ? legacyCargo.supplierId : (supplierId !== undefined ? supplierId : truck.supplierId),
      supplierName: beoparis ? legacyCargo.supplierName : (supplierId !== undefined ? supplierName : truck.supplierName),
    };
    if (beoparis !== undefined) update.beoparis = beoparis;

    const updated = await Truck.findByIdAndUpdate(id, update, { new: true });

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'EDIT_TRUCK',
      details: `Updated truck ${truckNumber || truck.truckNumber} details (Status: ${status || truck.status}).`,
      timestamp: new Date().toISOString(),
    });

    res.json(normalizeTruckForResponse(updated));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err instanceof TypeError || (err instanceof Error && /beopari|product|quantity|unit/i.test(err.message))) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update truck details.' });
  }
}

export async function deleteTruck(req, res) {
  try {
    const { id } = req.params;
    const truck = await Truck.findById(id);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }
    if (!assertTenantOwnership(req, truck)) return res.status(404).json({ error: 'Truck not found.' });

    const tenantId = getTenantId(req) || truck.tenantId || 'tenant_default_001';

    await Truck.findByIdAndDelete(id);

    await AuditLog.create({
      tenantId,
      userId: req.user ? req.user.id : 'system',
      userName: req.user ? req.user.name : 'System',
      userRole: req.user ? req.user.role : 'Admin',
      action: 'DELETE_TRUCK',
      details: `Deleted truck registration ${truck.truckNumber}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Truck registration deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete truck registration.' });
  }
}
