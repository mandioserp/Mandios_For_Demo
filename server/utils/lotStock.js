// Only good Own Trading returns re-enter saleable inventory.
export function calculateLotRemaining(quantity, sales = [], returns = [], isOwnTrading = false) {
  const sold = sales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);
  const restocked = returns.filter(ret => !isOwnTrading || (ret.produceCondition || 'Good') === 'Good')
    .reduce((sum, ret) => sum + (Number(ret.produceReturnedQty) || 0), 0);
  return Math.max(0, Math.round((Number(quantity) - sold + restocked) * 1e8) / 1e8);
}
