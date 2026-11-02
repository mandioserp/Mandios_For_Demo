// Helper utility for opening reports in dedicated standalone pages in a new browser tab

export function openReportInNewTab(reportType, params = {}) {
  const searchParams = new URLSearchParams({ report: reportType, ...params });
  const url = `/reports/${reportType}?${searchParams.toString()}`;
  window.open(url, '_blank');
}

export function exportToCSV(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(val => {
        const escaped = ('' + (val ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
