import { garboBrandLogo } from '@/lib/garbo-brand'
import { ADMISSAO_DOC_TIPOS } from '@/lib/funcionario-constants'
import { getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import {
  DIAS_SEMANA_ADMISSAO,
  resolveDiasAtivos,
} from '@/lib/funcionario-horarios'
import { resolveStoredPreviewPaths } from '@/lib/pdf-preview-storage'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { FuncionarioAdmissaoDados, FuncionarioDocumento } from '@/types'

const NOME_EMPRESA = 'GARBO MOVELARIA'

export interface DocExportPage {
  docId: string
  titulo: string
  imageUrl: string
  pagina?: number
  totalPaginas?: number
  /** true = páginas 2+ do mesmo PDF (cabeçalho compacto, sem ficha completa). */
  isContinuacao?: boolean
}

/** Dados de admissão exibidos no cabeçalho do PDF timbrado. */
export interface DocExportAdmissaoMeta {
  nome: string
  cpf?: string | null
  telefone?: string | null
  email?: string | null
  admissaoDados?: FuncionarioAdmissaoDados | null
  /** Fallback quando `admissao_dados.salario` ainda estiver vazio. */
  salarioFixoMensal?: number | null
}

interface MetaField {
  label: string
  value: string
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

function escolaridadeLabel(value: string | undefined): string {
  if (value === '1o_grau') return '1º Grau'
  if (value === '2o_grau') return '2º Grau'
  if (value === 'superior') return 'Superior'
  return value?.trim() || ''
}

function resolveSalario(
  dados: FuncionarioAdmissaoDados | null | undefined,
  salarioFixoMensal?: number | null,
): string {
  const salvo = dados?.salario?.trim()
  if (salvo) return salvo
  if (salarioFixoMensal != null && salarioFixoMensal > 0) return fmtCur(salarioFixoMensal)
  return ''
}

function strField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Campos gerais da admissão (sem horários — horários vão em tabela própria). */
export function buildAdmissaoMetaFields(
  meta: DocExportAdmissaoMeta,
  arquivoTitulo: string,
): MetaField[] {
  const d = meta.admissaoDados ?? {}
  const fields: MetaField[] = [
    { label: 'Colaborador', value: meta.nome },
    { label: 'Arquivo', value: arquivoTitulo },
  ]

  const cpf = strField(meta.cpf) || strField(d.cpf)
  if (cpf) fields.push({ label: 'CPF', value: cpf })

  const pis = strField(d.pis)
  if (pis) fields.push({ label: 'PIS', value: pis })

  if (d.data_admissao) {
    fields.push({ label: 'Data de admissão', value: fmtDate(d.data_admissao) })
  }

  const salario = resolveSalario(d, meta.salarioFixoMensal)
  if (salario) fields.push({ label: 'Salário', value: salario })

  const funcao = strField(d.funcao)
  if (funcao) fields.push({ label: 'Função', value: funcao })

  const telefoneEmpresa = strField(d.telefone_empresa)
  const telefonePessoal = strField(d.telefone) || strField(meta.telefone)
  if (telefoneEmpresa) fields.push({ label: 'Telefone (empresa)', value: telefoneEmpresa })
  if (telefonePessoal && telefonePessoal !== telefoneEmpresa) {
    fields.push({ label: 'Telefone', value: telefonePessoal })
  } else if (!telefoneEmpresa && telefonePessoal) {
    fields.push({ label: 'Telefone', value: telefonePessoal })
  }

  const email =
    strField(d.email_pessoal) || strField(d.email) || strField(meta.email)
  if (email) fields.push({ label: 'E-mail', value: email })

  const endereco = strField(d.endereco)
  if (endereco) fields.push({ label: 'Endereço', value: endereco })

  const esc = escolaridadeLabel(d.escolaridade)
  if (esc) fields.push({ label: 'Escolaridade', value: esc })

  if (d.tem_filhos) {
    fields.push({ label: 'Filhos menores', value: 'Sim' })
    const filhosInfo = strField(d.filhos_info)
    if (filhosInfo) fields.push({ label: 'Info. filhos', value: filhosInfo })
  } else if (d.tem_filhos === false) {
    fields.push({ label: 'Filhos menores', value: 'Não' })
  }

  if (d.usa_vale_transporte) {
    fields.push({ label: 'Usa vale-transporte', value: 'Sim' })
    if (strField(d.vt_quantidade_dia)) {
      fields.push({ label: 'VT — qtd. por dia', value: strField(d.vt_quantidade_dia) })
    }
    if (strField(d.vt_valor_unitario)) {
      fields.push({ label: 'VT — valor unitário', value: `R$ ${strField(d.vt_valor_unitario)}` })
    }
    if (strField(d.vt_valor_diario)) {
      fields.push({ label: 'VT — total do dia', value: `R$ ${strField(d.vt_valor_diario)}` })
    }
  } else if (d.usa_vale_transporte === false) {
    fields.push({ label: 'Usa vale-transporte', value: 'Não' })
  }

  // Compatibilidade com dados antigos (texto único de horário)
  if (!d.horarios_semana) {
    if (strField(d.horario_seg_sex)) {
      fields.push({ label: 'Horário Seg–Sex', value: strField(d.horario_seg_sex) })
    }
    if (strField(d.horario_seg_sab)) {
      fields.push({ label: 'Horário Seg–Sáb', value: strField(d.horario_seg_sab) })
    }
  }

  return fields
}

function buildHorariosTableHtml(dados: FuncionarioAdmissaoDados | null | undefined): string {
  const d = dados ?? {}
  const horarios = d.horarios_semana
  if (!horarios) return ''

  const ativos = resolveDiasAtivos(d.horarios_dias_ativos, horarios)
  const linhas = DIAS_SEMANA_ADMISSAO.filter(({ id }) => ativos.includes(id))
    .map(({ id, label }) => {
      const dia = horarios[id]
      if (!dia && !ativos.includes(id)) return ''
      const temAlgo = !!(
        dia?.chegada
        || dia?.saida_almoco
        || dia?.retorno_almoco
        || dia?.saida_servico
      )
      if (!temAlgo) return ''
      return `
        <tr>
          <td class="doc-h-dia">${escapeHtml(label)}</td>
          <td>${escapeHtml(dia?.chegada || '—')}</td>
          <td>${escapeHtml(dia?.saida_almoco || '—')}</td>
          <td>${escapeHtml(dia?.retorno_almoco || '—')}</td>
          <td>${escapeHtml(dia?.saida_servico || '—')}</td>
        </tr>`
    })
    .filter(Boolean)

  if (!linhas.length) return ''

  return `
    <div class="doc-horarios">
      <p class="doc-horarios__titulo">Horários de trabalho</p>
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Chegada</th>
            <th>Saída almoço</th>
            <th>Retorno almoço</th>
            <th>Saída serviço</th>
          </tr>
        </thead>
        <tbody>
          ${linhas.join('')}
        </tbody>
      </table>
    </div>
  `
}

function buildMetaHtml(fields: MetaField[]): string {
  if (!fields.length) return ''
  return `
    <div class="doc-meta">
      ${fields
        .map(
          f => `
        <div>
          <span>${escapeHtml(f.label)}</span>
          <strong>${escapeHtml(f.value)}</strong>
        </div>`,
        )
        .join('')}
    </div>
  `
}

/** Ordena documentos na ordem do formulário de admissão (CTPS, PIS, foto…). */
const TIPO_DOC_ORDEM = new Map(
  ADMISSAO_DOC_TIPOS.map((t, i) => [t.id, i]),
)

function sortDocsParaExportacao(docs: FuncionarioDocumento[]): FuncionarioDocumento[] {
  return [...docs].sort((a, b) => {
    const oa = TIPO_DOC_ORDEM.get(a.tipo_documento as never) ?? 999
    const ob = TIPO_DOC_ORDEM.get(b.tipo_documento as never) ?? 999
    if (oa !== ob) return oa - ob
    const porNome = a.nome_arquivo.localeCompare(b.nome_arquivo, 'pt-BR')
    if (porNome !== 0) return porNome
    return (a.criado_em ?? '').localeCompare(b.criado_em ?? '')
  })
}

/** Resolve URLs de imagem (preview) de cada documento selecionado — todas as páginas, em ordem. */
export async function resolverPaginasExportacao(
  docs: FuncionarioDocumento[],
): Promise<DocExportPage[]> {
  const pages: DocExportPage[] = []
  const ordenados = sortDocsParaExportacao(docs)

  for (const doc of ordenados) {
    const rawPaths = resolveStoredPreviewPaths(doc)
    const previewPaths =
      rawPaths.length > 0
        ? rawPaths
        : doc.kind === 'image'
          ? [doc.storage_path]
          : []

    if (previewPaths.length === 0) {
      throw new Error(`Não foi possível gerar preview de "${doc.nome_arquivo}".`)
    }

    for (let i = 0; i < previewPaths.length; i++) {
      const path = previewPaths[i]
      let imageUrl = doc.previewSignedUrls?.[i]

      if (!imageUrl) {
        if (
          i === 0
          && doc.previewSignedUrl
          && (doc.preview_path === path || doc.storage_path === path)
        ) {
          imageUrl = doc.previewSignedUrl
        } else {
          imageUrl = await getFuncionarioDocSignedUrl(path)
        }
      }

      pages.push({
        docId: doc.id,
        titulo: doc.nome_arquivo,
        imageUrl,
        pagina: previewPaths.length > 1 ? i + 1 : undefined,
        totalPaginas: previewPaths.length > 1 ? previewPaths.length : undefined,
        isContinuacao: i > 0,
      })
    }
  }

  return pages
}

function buildPaginaTimbrada(
  page: DocExportPage,
  logoUrl: string,
  meta: DocExportAdmissaoMeta,
  cnpj: string,
): string {
  const titulo = escapeHtml(page.titulo)
  const cnpjSafe = escapeHtml(cnpj || '—')
  const paginaLabel =
    page.pagina != null && page.totalPaginas != null
      ? `<p class="doc-pagina">Página ${page.pagina} de ${page.totalPaginas}</p>`
      : ''

  // Páginas 2+ do mesmo PDF: timbre enxuto + imagem grande (organizado, sem repetir ficha).
  if (page.isContinuacao) {
    return `
    <section class="doc-page doc-page--continuacao">
      <div class="doc-timbre doc-timbre--compacto">
        <div class="doc-timbre__faixa"></div>
        <div class="doc-header doc-header--compacto">
          <img src="${logoUrl}" alt="${NOME_EMPRESA}" />
          <div class="doc-empresa">
            <h1>${NOME_EMPRESA}</h1>
            <p>${titulo}</p>
          </div>
        </div>
      </div>
      ${paginaLabel}
      <div class="doc-midia doc-midia--ampla">
        <img src="${escapeHtml(page.imageUrl)}" alt="${titulo}" />
      </div>
      <footer class="doc-footer">
        Documento exportado pelo sistema financeiro GARBO Movelaria.
      </footer>
    </section>
  `
  }

  const metaFields = buildAdmissaoMetaFields(meta, page.titulo)
  const horariosHtml = buildHorariosTableHtml(meta.admissaoDados)

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

      ${buildMetaHtml(metaFields)}
      ${horariosHtml}
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
  meta: DocExportAdmissaoMeta,
  cnpj?: string | null,
): string {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const cnpjSafe = cnpj?.trim() || '—'
  const body = pages
    .map(p => buildPaginaTimbrada(p, logoUrl, meta, cnpjSafe))
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Documentos — ${escapeHtml(meta.nome)}</title>
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
      page-break-inside: avoid;
    }
    .doc-page:last-child { page-break-after: auto; }
    .doc-timbre { margin-bottom: 5mm; }
    .doc-timbre--compacto { margin-bottom: 3mm; }
    .doc-timbre__faixa {
      height: 4px;
      background: linear-gradient(90deg, #8b6914, #d4a853, #8b6914);
      margin-bottom: 4mm;
    }
    .doc-header { display: flex; align-items: center; gap: 14px; }
    .doc-header--compacto img { max-height: 36px; }
    .doc-header img { max-height: 52px; width: auto; }
    .doc-empresa h1 {
      margin: 0;
      font-size: 13pt;
      letter-spacing: 0.12em;
      color: #8b6914;
    }
    .doc-header--compacto .doc-empresa h1 { font-size: 11pt; }
    .doc-empresa p { margin: 2px 0 0; font-size: 9pt; color: #555; }
    .doc-sub { font-style: italic; }
    .doc-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      margin-bottom: 3mm;
    }
    .doc-meta div {
      border: 1px solid #e0d5c8;
      padding: 2mm 2.5mm;
      font-size: 8pt;
    }
    .doc-meta span {
      display: block;
      color: #777;
      font-size: 6.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.8mm;
    }
    .doc-meta strong { font-size: 9pt; word-break: break-word; }
    .doc-horarios {
      margin-bottom: 3mm;
      border: 1px solid #e0d5c8;
      padding: 2mm;
    }
    .doc-horarios__titulo {
      margin: 0 0 2mm;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #777;
    }
    .doc-horarios table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .doc-horarios th,
    .doc-horarios td {
      border: 1px solid #e8dfd2;
      padding: 1.5mm 2mm;
      text-align: left;
    }
    .doc-horarios th {
      background: #f7f1e8;
      font-size: 6.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #666;
      font-weight: 600;
    }
    .doc-h-dia { font-weight: 600; white-space: nowrap; }
    .doc-pagina {
      margin: 0 0 2mm;
      font-size: 8pt;
      color: #666;
      text-align: right;
    }
    .doc-midia {
      border: 1px solid #ddd;
      background: #faf8f5;
      min-height: 80mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3mm;
    }
    .doc-midia img {
      max-width: 100%;
      max-height: 140mm;
      object-fit: contain;
      display: block;
    }
    .doc-midia--ampla {
      min-height: 160mm;
    }
    .doc-midia--ampla img {
      max-height: 220mm;
    }
    .doc-footer {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
    @media print {
      .doc-page { border-color: #8b6914; margin: 0; max-width: none; }
    }
  </style>
</head>
<body>${body}</body>
</html>`
}

/** Abre impressão / “Salvar como PDF” com páginas timbradas. */
export function imprimirDocsTimbrados(
  pages: DocExportPage[],
  meta: DocExportAdmissaoMeta,
  cnpj?: string | null,
): void {
  if (!pages.length) return
  const html = buildDocsTimbradoHtml(pages, meta, cnpj)
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Permita pop-ups para gerar o PDF.')
  }
  win.document.write(html)
  win.document.close()

  const dispararImpressao = () => {
    win.focus()
    win.print()
  }

  // Espera as imagens carregarem para o PDF sair completo e na ordem.
  const imgs = Array.from(win.document.images)
  if (imgs.length === 0) {
    win.onload = dispararImpressao
    return
  }

  let restantes = imgs.length
  const done = () => {
    restantes -= 1
    if (restantes <= 0) dispararImpressao()
  }
  for (const img of imgs) {
    if (img.complete) {
      done()
    } else {
      img.addEventListener('load', done, { once: true })
      img.addEventListener('error', done, { once: true })
    }
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
