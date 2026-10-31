// Keep API amounts as strings in forms. Convert only for human-readable display.
export const amount = value => new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0))
export const day = value => value ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '—'
export const title = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
export const short = value => value?.replace(/^(SUB|INV)-/, '$1 · ').slice(0, 18) || '—'
export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
