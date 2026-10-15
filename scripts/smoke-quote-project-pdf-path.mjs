/** Smoke Épico 1 — path permanente do PDF da pasta. */
function buildQuoteProjectPdfPath(companyId, projectId) {
  return `${companyId}/quote-projects/${projectId}/source.pdf`
}

const company = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const project = 'e3817670-9a69-438e-9615-c4834ffd439a'
const path = buildQuoteProjectPdfPath(company, project)
const expected = `${company}/quote-projects/${project}/source.pdf`
if (path !== expected) {
  console.error('FAIL', { path, expected })
  process.exit(1)
}
function isQuoteProjectSharedStoragePath(p) {
  return /\/quote-projects\/[^/]+\//.test(p || '')
}
if (!isQuoteProjectSharedStoragePath(path)) {
  console.error('FAIL shared path detect')
  process.exit(1)
}
if (isQuoteProjectSharedStoragePath(`${company}/abc/file.pdf`)) {
  console.error('FAIL false positive shared path')
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, path, sharedProtected: true }, null, 2))
console.log('OK smoke-quote-project-pdf-path')
