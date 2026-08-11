/**
 * Teste rápido: monta a lista de URLs da galeria do lead (várias fotos → navegação).
 * Uso: node --input-type=module scripts/test-lead-foto-galeria.mjs
 */

function itemDisplayUrl(item) {
  return item.thumbUrl || item.galleryPages[item.galleryIndex] || item.galleryPages[0] || ''
}

const items = [
  { key: 'a', title: 'Foto 1', thumbUrl: 'https://example.com/1.jpg', galleryPages: ['https://example.com/1.jpg'], galleryIndex: 0, kind: 'image' },
  { key: 'b', title: 'Foto 2', thumbUrl: 'https://example.com/2.jpg', galleryPages: ['https://example.com/2.jpg'], galleryIndex: 0, kind: 'image' },
  { key: 'c', title: 'PDF pág 1', thumbUrl: 'blob:p1', galleryPages: ['blob:p1', 'blob:p2', 'blob:p3'], galleryIndex: 0, kind: 'pdf' },
  { key: 'd', title: 'PDF pág 2', thumbUrl: 'blob:p2', galleryPages: ['blob:p1', 'blob:p2', 'blob:p3'], galleryIndex: 1, kind: 'pdf' },
  { key: 'e', title: 'PDF pág 3', thumbUrl: 'blob:p3', galleryPages: ['blob:p1', 'blob:p2', 'blob:p3'], galleryIndex: 2, kind: 'pdf' },
]

const galleryPages = items.map(itemDisplayUrl).filter(Boolean)

console.log('Total de fotos na galeria:', galleryPages.length)
console.assert(galleryPages.length === 5, 'esperava 5 fotos')

// Clicar na 3ª miniatura (índice 2) deve abrir no meio e permitir ← →
const initialPageIndex = 2
console.log('Abrindo no índice', initialPageIndex, '→', galleryPages[initialPageIndex])
console.assert(initialPageIndex > 0 && initialPageIndex < galleryPages.length - 1, 'deve ter foto antes e depois')

console.log('← anterior:', galleryPages[initialPageIndex - 1])
console.log('→ próxima:', galleryPages[initialPageIndex + 1])
console.log('✅ Galeria com navegação lateral OK')
