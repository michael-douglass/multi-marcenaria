import { garboBrandLogo } from '@/lib/garbo-brand'
import { getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import type { FuncionarioDocumento } from '@/types'

const NOME_EMPRESA = 'GARBO MOVELARIA'

export interface DocExportPage {
  docId: string
  titulo: string
  imageUrl: string
  pagina?: number
  totalPaginas?: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeFileBase(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'documento'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Resolve URLs de imagem (preview) de cada documento selecionado. */
export async function resolverPaginasExportacao(
  docs: FuncionarioDocumento[],
): Promise<DocExportPage[]> {
  const pages: DocExportPage[] = []

  for (const doc of docs) {
    const previewPaths =
      Array.isArray(doc.preview_paths) && doc.preview_paths.length > 0
        ? doc.preview_paths
        : doc.preview_path
          ? [doc.preview_path]
          : doc.kind === 'image'
            ? [doc.storage_path]
            : []

    if (previewPaths.length === 0) {
      throw new Error(`Não foi possível gerar preview de "${doc.nome_arquivo}".`)
    }

    for (let i = 0; i < previewPaths.length; i++) {
      const path = previewPaths[i]
      let imageUrl: string | undefined

      if (
        i === 0
        && doc.previewSignedUrl
        && (doc.preview_path === path || doc.storage_path === path)
      ) {
        imageUrl = doc.previewSignedUrl
      } else {
        imageUrl = await getFuncionarioDocSignedUrl(path)
      }

      pages.push({
        docId: doc.id,
        titulo: doc.nome_arquivo,
        imageUrl,
        pagina: previewPaths.length > 1 ? i + 1 : undefined,
        totalPaginas: previewPaths.length > 1 ? previewPaths.length : undefined,
      })
    }
  }

  return pages
}

function buildPaginaTimbrada(
  page: DocExportPage,
  logoUrl: string,
  funcionarioNome: string,
  cnpj: string,
): string {
  const titulo = escapeHtml(page.titulo)
  const nome = escapeHtml(funcionarioNome)
  const cnpjSafe = escapeHtml(cnpj || '—')
  const paginaLabel =
    page.pagina != null && page.totalPaginas != null
      ? `<p class="doc-pagina">Página ${page.pagina} de ${page.totalPaginas}</p>`
      : ''

  return `
    <section class="doc-page">
      <div class="doc-timbre">
        <div class="doc-timbre__faixa"></div>
        <div class="doc-header">
          <img src="${logoUrl}" alt="${NOME_EMPRESA}" />
          <div class="doc-empresa">
            <h1>${NOME_EMPRESA}</h1>
            <p>CNPJ ${cnpjSafe}</p>
            <p class="doc-sub">Documentos do colaborador</p>
          </div>
        </div>
      </div>

      <div class="doc-meta">
        <div>
          <span>Colaborador</span>
          <strong>${nome}</strong>
        </div>
        <div>
          <span>Arquivo</span>
          <strong>${titulo}</strong>
        </div>
      </div>
      ${paginaLabel}

      <div class="doc-midia">
        <img src="${escapeHtml(page.imageUrl)}" alt="${titulo}" />
      </div>

      <footer class="doc-footer">
        Documento exportado pelo sistema financeiro GARBO Movelaria.
      </footer>
    </section>
  `
}

export function buildDocsTimbradoHtml(
  pages: DocExportPage[],
  funcionarioNome: string,
  cnpj?: string | null,
): string {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const cnpjSafe = cnpj?.trim() || '—'
  const body = pages
    .map(p => buildPaginaTimbrada(p, logoUrl, funcionarioNome, cnpjSafe))
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Documentos — ${escapeHtml(funcionarioNome)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1208;
      background: #fff;
    }
    .doc-page {
      max-width: 190mm;
      margin: 0 auto 10mm;
      padding: 8mm 10mm;
      border: 2px solid #8b6914;
      page-break-after: always;
    }
    .doc-page:last-child { page-break-after: auto; }
    .doc-timbre { margin-bottom: 5mm; }
    .doc-timbre__faixa {
      height: 4px;
      background: linear-gradient(90deg, #8b6914, #d4a853, #8b6914);
      margin-bottom: 4mm;
    }
    .doc-header { display: flex; align-items: center; gap: 14px; }
    .doc-header img { max-height: 52px; width: auto; }
    .doc-empresa h1 {
      margin: 0;
      font-size: 13pt;
      letter-spacing: 0.12em;
      color: #8b6914;
    }
    .doc-empresa p { margin: 2px 0 0; font-size: 9pt; color: #555; }
    .doc-sub { font-style: italic; }
    .doc-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm;
      margin-bottom: 4mm;
    }
    .doc-meta div {
      border: 1px solid #e0d5c8;
      padding: 3mm;
      font-size: 9pt;
    }
    .doc-meta span {
      display: block;
      color: #777;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1mm;
    }
    .doc-meta strong { font-size: 10pt; word-break: break-word; }
    .doc-pagina {
      margin: 0 0 3mm;
      font-size: 8pt;
      color: #666;
      text-align: right;
    }
    .doc-midia {
      border: 1px solid #ddd;
      background: #faf8f5;
      min-height: 120mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3mm;
    }
    .doc-midia img {
      max-width: 100%;
      max-height: 180mm;
      object-fit: contain;
      display: block;
    }
    .doc-footer {
      margin-top: 4mm;
      padding-top: 2mm;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>${body}</body>
</html>`
}

/** Abre impressão / “Salvar como PDF” com páginas timbradas. */
export function imprimirDocsTimbrados(
  pages: DocExportPage[],
  funcionarioNome: string,
  cnpj?: string | null,
): void {
  if (!pages.length) return
  const html = buildDocsTimbradoHtml(pages, funcionarioNome, cnpj)
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Permita pop-ups para gerar o PDF.')
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
  }
}

/** Baixa cada página/documento como arquivo de imagem. */
export async function baixarDocsComoImagens(pages: DocExportPage[]): Promise<void> {
  if (!pages.length) return

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const res = await fetch(page.imageUrl)
    if (!res.ok) {
      throw new Error(`Falha ao baixar imagem de "${page.titulo}".`)
    }
    const blob = await res.blob()
    const ext = blob.type.includes('png')
      ? 'png'
      : blob.type.includes('webp')
        ? 'webp'
        : 'jpg'
    const base = safeFileBase(page.titulo)
    const suffix =
      page.pagina != null ? `-p${page.pagina}` : pages.length > 1 ? `-${i + 1}` : ''
    downloadBlob(blob, `${base}${suffix}.${ext}`)
    if (i < pages.length - 1) await sleep(350)
  }
}
