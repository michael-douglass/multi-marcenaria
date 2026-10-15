/** Smoke Épico 2 — merge de budgeted_pages. */
function mergeBudgetedPages(current, pageRanges) {
  const set = new Set()
  for (const n of current || []) {
    if (Number.isInteger(n) && n > 0) set.add(n)
  }
  for (const n of pageRanges || []) {
    if (Number.isInteger(n) && n > 0) set.add(n)
  }
  return [...set].sort((a, b) => a - b)
}

const a = [1, 2, 3, 4, 5]
const b = [6, 7, 8, 9, 10]
const merged = mergeBudgetedPages(a, b)
const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
if (JSON.stringify(merged) !== JSON.stringify(expected)) {
  console.error('FAIL', merged)
  process.exit(1)
}
const overlap = mergeBudgetedPages([1, 2, 3], [3, 4])
if (JSON.stringify(overlap) !== JSON.stringify([1, 2, 3, 4])) {
  console.error('FAIL overlap', overlap)
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, merged, count: merged.length }, null, 2))
console.log('OK smoke-budgeted-pages')
