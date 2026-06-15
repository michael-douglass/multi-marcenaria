/** Caminhos de preview de PDF no storage (página 1 mantém nomes legados). */
export function pdfPreviewPathAt(basePrefix: string, pageOneBased: number, naming: 'folder' | 'suffix'): string {
  if (naming === 'folder') {
    return pageOneBased === 1
      ? `${basePrefix}/preview.png`
      : `${basePrefix}/preview-${pageOneBased}.png`
  }
  return pageOneBased === 1
    ? `${basePrefix}_preview.png`
    : `${basePrefix}_preview-${pageOneBased}.png`
}

export function resolveStoredPreviewPaths(record: {
  preview_paths?: string[] | null
  preview_path?: string | null
}): string[] {
  if (record.preview_paths?.length) return record.preview_paths
  if (record.preview_path) return [record.preview_path]
  return []
}

export function collectPreviewStoragePaths(record: {
  storage_path: string
  preview_path?: string | null
  preview_paths?: string[] | null
}): string[] {
  const paths = new Set<string>()
  for (const p of resolveStoredPreviewPaths(record)) {
    if (p && p !== record.storage_path) paths.add(p)
  }
  if (record.preview_path && record.preview_path !== record.storage_path) {
    paths.add(record.preview_path)
  }
  return [...paths]
}
