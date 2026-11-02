import { CommissionRule } from '../models/settings.js';
import { Product } from '../models/index.js';

/**
 * Reusable Commission Brokerage Engine
 * Calculates the exact commission based on:
 * Customer/Supplier Rule → Product Rule → Global Rule → Product Default Catalog Settings
 */
export async function getCommissionCalculationDetails({
  productId,
  supplierId,
  customerId,
  quantity = 1,
  unit = 'Crate',
  weight = 0, // In kg
  saleRate = 0,
  customCommission,
  customCommissionType,
  tenantId = 'tenant_default_001'
}) {
  const qty = Number(quantity) || 0;
  const rate = Number(saleRate) || 0;
  const grossVal = qty * rate;

  if (qty <= 0) {
    return {
      commissionAmount: 0,
      commissionType: 'Percentage',
      commissionRateValue: 0,
      commissionBasis: 'Sale Amount',
      formattedRate: '0%'
    };
  }

  let finalType = 'Percentage';
  let finalValue = 0;
  let finalBasis = 'Sale Amount';

  if (customCommission !== undefined && customCommission !== null && customCommission !== '' && !isNaN(Number(customCommission))) {
    finalValue = Number(customCommission);
    if (customCommissionType === 'Per Unit' || customCommissionType === 'Fixed Amount') {
      finalType = 'Fixed Amount';
      finalBasis = 'Per Crate'; // calculates as finalValue * qty (Per Unit)
    } else {
      finalType = 'Percentage';
      finalBasis = 'Sale Amount';
    }
  } else {
    let matchedRule = null;
    let allRules = [];
    try {
      allRules = await CommissionRule.find({ status: 'Active', tenantId });

      if (customerId) {
        const cIdStr = String(customerId);
        matchedRule = allRules.find(r => r.scope === 'Customer Specific' && (r.customerId === cIdStr || r.customerId === customerId));
      }
      if (!matchedRule && supplierId) {
        const sIdStr = String(supplierId);
        matchedRule = allRules.find(r => r.scope === 'Supplier Specific' && (r.supplierId === sIdStr || r.supplierId === supplierId));
      }
      if (!matchedRule && productId) {
        const pIdStr = String(productId);
        matchedRule = allRules.find(r => r.scope === 'Product Specific' && (r.productId === pIdStr || r.productId === productId));
      }
    } catch (err) {
      console.error('Error fetching commission rules:', err);
    }

    if (matchedRule) {
      finalType = matchedRule.commissionType;
      finalValue = Number(matchedRule.value) || 0;
      finalBasis = matchedRule.chargeBasis || 'Sale Amount';
    } else {
      const globalRule = allRules.find(r => r.scope === 'Global Default');
      if (globalRule) {
        finalType = globalRule.commissionType;
        finalValue = Number(globalRule.value) || 0;
        finalBasis = globalRule.chargeBasis || 'Sale Amount';
      }
    }
  }

  let commissionAmount = 0;
  let formattedRate = '';

  if (finalType === 'Percentage') {
    commissionAmount = grossVal * (finalValue / 100);
    formattedRate = `${finalValue}%`;
  } else {
    // Fixed Amount
    switch (finalBasis) {
      case 'Per Kilogram':
        const totalKg = weight > 0 ? (weight * qty) : qty;
        commissionAmount = finalValue * totalKg;
        formattedRate = `Rs. ${finalValue} / Kg`;
        break;
      case 'Per Maund':
        const totalMaund = weight > 0 ? ((weight * qty) / 40) : (qty / 40);
        commissionAmount = finalValue * totalMaund;
        formattedRate = `Rs. ${finalValue} / Maund`;
        break;
      case 'Per Invoice':
        commissionAmount = finalValue;
        formattedRate = `Rs. ${finalValue} (Fixed)`;
        break;
      case 'Per Crate':
      case 'Per Box':
      case 'Per Basket':
      case 'Sale Amount':
      default:
        commissionAmount = finalValue * qty;
        formattedRate = `Rs. ${finalValue} / ${unit || 'Crate'}`;
        break;
    }
  }

  return {
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    commissionType: finalType,
    commissionRateValue: finalValue,
    commissionBasis: finalBasis,
    formattedRate: formattedRate || `${finalValue}%`
  };
}

export async function calculateCommission(params) {
  const details = await getCommissionCalculationDetails(params);
  return details.commissionAmount;
}
