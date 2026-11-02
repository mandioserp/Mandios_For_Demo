// Reusable utility for calculating supply / lot financial deductions and commission

export function calculateSupplyFinancials(item, products = []) {
  if (!item) {
    return {
      grossAmount: 0,
      commType: 'Percentage',
      commVal: 0,
      commissionAmount: 0,
      totalExpenses: 0,
      totalDeductions: 0,
      netPayable: 0
    };
  }

  const qty = Number(item.quantity) || 0;
  const rate = Number(item.purchaseRate) || 0;
  
  let grossAmount = 0;
  if (rate > 0) {
    grossAmount = qty * rate;
  } else if (item.totalAmount > 0) {
    grossAmount = Number(item.totalAmount);
  } else if (item.netPayable > 0) {
    grossAmount = Number(item.netPayable) + (Number(item.totalDeductions) || 0);
  }

  let commType = item.supplierCommissionType || 'Percentage';
  let commVal = item.supplierCommissionValue !== undefined && item.supplierCommissionValue !== null 
    ? Number(item.supplierCommissionValue) 
    : 0;

  // Only apply commission entered in lot sheet inspection. If no commission entered for this lot, it is 0.

  let commissionAmount = 0;
  if (commType === 'Percentage') {
    commissionAmount = grossAmount * (commVal / 100);
  } else if (commType === 'Per Unit') {
    commissionAmount = qty * commVal;
  } else if (commType === 'Fixed Amount') {
    commissionAmount = commVal;
  }
  commissionAmount = Math.round(commissionAmount * 100) / 100;

  let totalExpenses = 0;
  if (item.lotExpenses && typeof item.lotExpenses === 'object') {
    Object.values(item.lotExpenses).forEach(val => {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        totalExpenses += num;
      }
    });
  }

  let totalDeductions = Math.round((commissionAmount + totalExpenses) * 100) / 100;
  if (item.totalDeductions && Number(item.totalDeductions) > totalDeductions) {
    totalDeductions = Number(item.totalDeductions);
  }

  const netPayable = Math.round(Math.max(0, grossAmount - totalDeductions) * 100) / 100;

  return {
    grossAmount,
    commType,
    commVal,
    commissionAmount,
    totalExpenses,
    totalDeductions,
    netPayable
  };
}
