export function normalizeTruckBeoparis(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Add at least one beopari with a product before saving this truck entry.');
  }

  const seenSuppliers = new Set();
  return input.map((beopari, beopariIndex) => {
    const supplierId = String(beopari?.supplierId || '').trim();
    if (!supplierId) throw new Error(`Select a beopari for section ${beopariIndex + 1}.`);
    if (seenSuppliers.has(supplierId)) {
      throw new Error('Each beopari should appear once; add more products inside that beopari section.');
    }
    seenSuppliers.add(supplierId);

    if (!Array.isArray(beopari.products) || beopari.products.length === 0) {
      throw new Error(`Add at least one product for beopari section ${beopariIndex + 1}.`);
    }

    const products = beopari.products.map((product, productIndex) => {
      const productName = String(product?.productName || '').trim();
      const unit = String(product?.unit || '').trim();
      const quantity = Number(product?.quantity);
      if (!productName) throw new Error(`Enter a product name in beopari section ${beopariIndex + 1}, row ${productIndex + 1}.`);
      if (String(product?.quantity ?? '').trim() === '' || !Number.isFinite(quantity) || quantity < 0) {
        throw new Error(`Enter a valid quantity of zero or more in beopari section ${beopariIndex + 1}, row ${productIndex + 1}.`);
      }
      if (!unit) throw new Error(`Select a unit in beopari section ${beopariIndex + 1}, row ${productIndex + 1}.`);
      return {
        productId: String(product?.productId || '').trim(),
        productName,
        quantity,
        unit,
        description: String(product?.description || '').trim(),
      };
    });

    return {
      supplierId,
      supplierName: '',
      products,
    };
  });
}

export function getTruckBeoparis(truck = {}) {
  if (Array.isArray(truck.beoparis) && truck.beoparis.length > 0) return truck.beoparis;
  if (!truck.supplierId && !truck.supplierName && !truck.description && !truck.notes && !truck.quantityLoaded) return [];
  return [{
    supplierId: truck.supplierId || '',
    supplierName: truck.supplierName || '',
    products: [{
      productId: '',
      productName: truck.description || truck.notes || 'Cargo',
      quantity: Number(truck.quantityLoaded) || 0,
      unit: truck.unit || 'Crates',
      description: truck.notes && truck.notes !== truck.description ? truck.notes : '',
    }],
  }];
}

export function truckHasSupplier(truck, supplierId, supplierName = '') {
  const targetId = String(supplierId || '');
  const targetName = String(supplierName || '').trim().toLowerCase();
  return getTruckBeoparis(truck).some((beopari) =>
    (targetId && String(beopari.supplierId || '') === targetId) ||
    (targetName && String(beopari.supplierName || '').trim().toLowerCase() === targetName)
  );
}

export function getTruckSupplierNames(truck) {
  return [...new Set(getTruckBeoparis(truck).map(beopari => beopari.supplierName).filter(Boolean))];
}

function toTruckObject(truck) {
  return typeof truck?.toObject === 'function' ? truck.toObject() : { ...truck };
}

export function filterTruckToSupplier(truck, supplierId, supplierName = '') {
  const beoparis = getTruckBeoparis(truck).filter(entry =>
    (supplierId && String(entry.supplierId || '') === String(supplierId)) ||
    (supplierName && String(entry.supplierName || '').trim().toLowerCase() === String(supplierName).trim().toLowerCase())
  );
  if (!beoparis.length) return null;
  const first = beoparis[0];
  const description = beoparis.map(entry => `${entry.supplierName}: ${entry.products.map(product => `${product.productName} (${product.quantity} ${product.unit})`).join(', ')}`).join('; ');
  return { ...toTruckObject(truck), beoparis, supplierId: first.supplierId, supplierName: first.supplierName, description, notes: description };
}

export function normalizeTruckForResponse(truck) {
  return {
    ...toTruckObject(truck),
    vehicleType: truck.vehicleType || 'Truck',
    beoparis: getTruckBeoparis(truck),
  };
}
