import { Product, AuditLog } from '../models/index.js';
import { assertTenantOwnership, buildTenantQuery, getTenantId } from '../utils/tenant.js';
import { sanitizeCustomerData } from '../utils/customerDataAccess.js';

export async function getProducts(req, res) {
  try {
    const products = await Product.find(buildTenantQuery(req));
    res.json(req.user?.role === 'Customer' ? sanitizeCustomerData(products) : products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
}

export async function addProduct(req, res) {
  try {
    const { name, category, unit, currentQuantity, purchaseRate, saleRate, status,
      defaultCommission, commissionType, defaultUnit, averageWeight, minPrice, maxPrice
    } = req.body;
    const tenantId = getTenantId(req) || 'tenant_default_001';

    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Name, Category and Unit are required fields.' });
    }

    const product = await Product.create({
      tenantId,
      name,
      category,
      unit,
      currentQuantity: Number(currentQuantity) || 0,
      purchaseRate: Number(purchaseRate) || 0,
      saleRate: Number(saleRate) || 0,
      status: status || 'Active',
      defaultCommission: Number(defaultCommission) || 0,
      commissionType: commissionType || 'Percentage',
      defaultUnit: defaultUnit || unit,
      averageWeight: Number(averageWeight) || 0,
      minPrice: Number(minPrice) || 0,
      maxPrice: Number(maxPrice) || 0,
    });

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADD_PRODUCT',
      details: `Added new product ${name} (${unit}) in category ${category} with default commission.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product.' });
  }
}

export async function editProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, category, unit, currentQuantity, purchaseRate, saleRate, status,
      defaultCommission, commissionType, defaultUnit, averageWeight, minPrice, maxPrice
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (!assertTenantOwnership(req, product)) return res.status(404).json({ error: 'Product not found.' });

    const tenantId = getTenantId(req) || product.tenantId || 'tenant_default_001';

    const updated = await Product.findByIdAndUpdate(id, {
      name: name || product.name,
      category: category || product.category,
      unit: unit || product.unit,
      currentQuantity: currentQuantity !== undefined ? Number(currentQuantity) : product.currentQuantity,
      purchaseRate: purchaseRate !== undefined ? Number(purchaseRate) : product.purchaseRate,
      saleRate: saleRate !== undefined ? Number(saleRate) : product.saleRate,
      status: status || product.status,
      defaultCommission: defaultCommission !== undefined ? Number(defaultCommission) : product.defaultCommission,
      commissionType: commissionType || product.commissionType,
      defaultUnit: defaultUnit || product.defaultUnit || unit,
      averageWeight: averageWeight !== undefined ? Number(averageWeight) : product.averageWeight,
      minPrice: minPrice !== undefined ? Number(minPrice) : product.minPrice,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : product.maxPrice,
    });

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'EDIT_PRODUCT',
      details: `Updated product information for ${name || product.name}.`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product.' });
  }
}

export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (!assertTenantOwnership(req, product)) return res.status(404).json({ error: 'Product not found.' });

    const tenantId = getTenantId(req) || product.tenantId || 'tenant_default_001';

    await Product.findByIdAndDelete(id);

    await AuditLog.create({
      tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_PRODUCT',
      details: `Deleted product ${product.name}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
}
