export function sanitizeCustomerSale(sale) {
  const visibleFields = [
    'id', '_id', 'date', 'customerId', 'customerName', 'productId', 'productName',
    'quantity', 'totalAmount', 'stockEntryId', 'createdAt'
  ];
  return Object.fromEntries(visibleFields
    .filter(field => sale[field] !== undefined)
    .map(field => [field, sale[field]]));
}

export function sanitizeCustomerData(value, fieldName = '') {
  if (Array.isArray(value)) return value.map(item => sanitizeCustomerData(item, fieldName));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/commission|brokerage/i.test(key) && !/^(saleRate|purchaseRate|salePrice|sellingPrice|unitPrice|returnRate|minPrice|maxPrice|gross.*|.*Gross|net.*|.*Net|discount.*|.*Discount|.*Rate)$/i.test(key))
      .map(([key, child]) => [key, sanitizeCustomerData(child, key)]));
  }
  if (typeof value === 'string') {
    if (/commission/i.test(value)) {
      if (/description|memo|item|details/i.test(fieldName)) {
        return value.split(/commission/i)[0].replace(/\s*@\s*Rs\.?\s*[\d,.]+.*$/i, '').trim();
      }
      return value.split(/\r?\n/).filter(line => !/commission/i.test(line)).join(' ').trim();
    }
    if (/description|memo|item|details/i.test(fieldName)) {
      return value.replace(/\s*@\s*Rs\.?\s*[\d,.]+/gi, '').trim();
    }
  }
  return value;
}
