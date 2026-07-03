export function downloadCsv(fileName, rows) {
  if (!rows.length)
    return false

  const headers = Object.keys(rows[0])
  const content = [
    headers.join(','),
    ...rows.map(row => headers.map(header => formatCsvValue(row[header])).join(',')),
  ].join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
  return true
}

function formatCsvValue(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text))
    return `"${text.replace(/"/g, '""')}"`
  return text
}
