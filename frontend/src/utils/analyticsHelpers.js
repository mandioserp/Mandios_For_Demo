// Helper functions for time series aggregation and charting

export function formatCurrency(num) {
  const val = Number(num) || 0;
  return `Rs. ${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatCompactNumber(num) {
  const val = Number(num) || 0;
  if (Math.abs(val) >= 1_000_000) {
    return (val / 1_000_000).toFixed(1) + 'M';
  }
  if (Math.abs(val) >= 1_000) {
    return (val / 1_000).toFixed(1) + 'K';
  }
  return val.toLocaleString();
}

/**
 * Group records by Day, Week, or Month
 * records: array of items
 * dateField: property name containing date string
 * valueExtractors: object mapping output key to value extraction function e.g. { amount: r => r.totalAmount }
 * grouping: 'daily' | 'weekly' | 'monthly'
 */
export function groupRecordsByTime(records = [], dateField = 'date', valueExtractors = {}, grouping = 'daily') {
  if (!Array.isArray(records) || records.length === 0) return [];

  const buckets = {};

  records.forEach(item => {
    const rawDateStr = item[dateField] || item.createdAt;
    if (!rawDateStr) return;

    const d = new Date(rawDateStr);
    if (isNaN(d.getTime())) return;

    let bucketKey = '';
    let label = '';

    if (grouping === 'monthly') {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      bucketKey = `${year}-${month}`;
      label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (grouping === 'weekly') {
      // Calculate start of week (Sunday)
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - d.getDay());
      const year = sunday.getFullYear();
      const month = String(sunday.getMonth() + 1).padStart(2, '0');
      const day = String(sunday.getDate()).padStart(2, '0');
      bucketKey = `${year}-${month}-${day}`;
      label = `Wk of ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      // daily
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      bucketKey = `${year}-${month}-${day}`;
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = {
        key: bucketKey,
        label,
        timestamp: d.getTime(),
        count: 0
      };
      Object.keys(valueExtractors).forEach(k => {
        buckets[bucketKey][k] = 0;
      });
    }

    buckets[bucketKey].count += 1;
    Object.entries(valueExtractors).forEach(([k, extractor]) => {
      const val = Number(extractor(item)) || 0;
      buckets[bucketKey][k] += val;
    });
  });

  const sortedKeys = Object.keys(buckets).sort((a, b) => a.localeCompare(b));
  return sortedKeys.map(k => {
    const obj = { ...buckets[k] };
    Object.keys(valueExtractors).forEach(vk => {
      obj[vk] = Math.round(obj[vk] * 100) / 100;
    });
    return obj;
  });
}
