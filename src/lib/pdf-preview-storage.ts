/** Caminhos de preview (PDF→PNG ou Word→JPG) no storage (página 1 mantém nomes legados). */
export function pdfPreviewPathAt(
  basePrefix: string,
  pageOneBased: number,
  naming: 'folder' | 'suffix',
  ext: 'png' | 'jpg' = 'png',
): string {
  if (naming === 'folder') {
    return pageOneBased === 1
      ? `${basePrefix}/preview.${ext}`
      : `${basePrefix}/preview-${pageOneBased}.${ext}`
  }
  return pageOneBased === 1
    ? `${basePrefix}_preview.${ext}`
    : `${basePrefix}_preview-${pageOneBased}.${ext}`
}

/** Extrai número da página do caminho (preview.png → 1, preview-3.png → 3). */
export function pageNumberFromPreviewPath(path: string): number {
  const match = path.match(/preview(?:-(\d+))?\.(?:png|jpe?g|webp)$/i)
  if (!match) return 999
  return match[1] ? Number(match[1]) : 1
}

function normalizePreviewPathsList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === 'string' && p.length > 0)
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === 'string' && p.length > 0)
      }
    } catch {
      /* ignore */
    }
  }
  return []
}

export function resolveStoredPreviewPaths(record: {
  preview_paths?: string[] | null
  preview_path?: string | null
}): string[] {
  const fromList = normalizePreviewPathsList(record.preview_paths)
  if (fromList.length > 0) {
    return [...fromList].sort((a, b) => pageNumberFromPreviewPath(a) - pageNumberFromPreviewPath(b))
  }
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
