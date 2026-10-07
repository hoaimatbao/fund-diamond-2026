/**
 * Formats a number to Vietnamese Dong currency format (e.g. 53.104.581 đ)
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  const num = Math.round(Number(amount));
  return num.toLocaleString('vi-VN') + ' đ';
}

/**
 * Format date string to VN standard
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr;
}

/**
 * Export table data to CSV/Excel format compatible with MS Excel
 */
export function exportToCSV(transactions, filename = 'Bang_Quy_Team_Diamond_2026.csv') {
  const headers = ['STT', 'Ngày', 'Lý do / Diễn giải', 'Phân loại', 'Thu (VNĐ)', 'Chi (VNĐ)', 'Số dư lũy kế (VNĐ)', 'Ghi chú'];
  
  const rows = transactions.map(t => [
    t.id,
    `"${t.date}"`,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    `"${t.category || ''}"`,
    t.type === 'THU' ? t.amount : 0,
    t.type === 'CHI' ? t.amount : 0,
    t.runningBalance || 0,
    `"${(t.note || '').replace(/"/g, '""')}"`
  ]);

  const BOM = '\uFEFF'; // UTF-8 BOM so Excel opens Vietnamese characters correctly
  const csvContent = BOM + [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
