export function exportToCSV(filename: string, headers: string[], data: any[][]) {
  // Add UTF-8 BOM so Excel opens it correctly with Hebrew characters
  const BOM = '\uFEFF';
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return '';
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell).replace(/"/g, '""');
        return `"${cellStr}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
