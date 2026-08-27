import { garboBrandLogo } from '@/lib/garbo-brand'
import {
  enrichMarcacoesUrls,
  formatAtrasoMinutos,
  formatHoraPonto,
  googleMapsUrl,
  labelPontoTipo,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import type { PontoMarcacao } from '@/types'

const NOME_EMPRESA = 'GARBO MOVELARIA'

export interface PontoComprovanteInput {
  funcionarioNome: string
  marcacao: PontoMarcacao
  fotoUrl?: string
  assinaturaUrl?: string
  repCnpj?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDataHoraCompleta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PONTO_TIMEZONE,
  })
}

function buildPaginaComprovante(input: PontoComprovanteInput, logoUrl: string): string {
  const { marcacao: m, funcionarioNome, fotoUrl, assinaturaUrl, repCnpj } = input
  const nome = escapeHtml(funcionarioNome)
  const tipo = escapeHtml(labelPontoTipo(m.tipo))
  const cnpj = escapeHtml(repCnpj?.trim() || '—')
  const status =
    m.status === 'atraso' && m.atraso_minutos > 0
      ? `Atraso de ${formatAtrasoMinutos(m.atraso_minutos)}`
      : m.status === 'normal'
        ? 'No horário'
        : escapeHtml(m.status)

  const lat = m.latitude
  const lng = m.longitude
  const localHtml =
    lat != null && lng != null
      ? `<p class="local-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}${
          m.precisao_metros != null ? ` (±${Math.round(m.precisao_metros)} m)` : ''
        }</p>
         <p class="local-link"><a href="${googleMapsUrl(lat, lng)}">Abrir no Google Maps</a></p>`
      : '<p class="local-coords">Localização não registrada</p>'

  const fotoBlock = fotoUrl
    ? `<img src="${escapeHtml(fotoUrl)}" alt="Selfie do registro" class="midia-img" />`
    : '<div class="midia-vazio">Sem foto</div>'

  const assinaturaBlock = assinaturaUrl
    ? `<img src="${escapeHtml(assinaturaUrl)}" alt="Assinatura" class="midia-img assinatura" />`
    : '<div class="midia-vazio">Sem assinatura</div>'

  return `
    <section class="comprovante-page">
      <div class="doc-timbre">
        <div class="doc-timbre__faixa"></div>
        <div class="doc-header">
          <img src="${logoUrl}" alt="${NOME_EMPRESA}" />
          <div class="doc-empresa">
            <h1>${NOME_EMPRESA}</h1>
            <p>CNPJ ${cnpj}</p>
            <p class="doc-sub">Comprovante de Registro de Ponto — REP-P</p>
          </div>
        </div>
      </div>

      <h2 class="doc-titulo">Comprovante de batida</h2>

      <div class="prestador">
        <span class="label">Prestador / Funcionário</span>
        <strong>${nome}</strong>
      </div>

      <div class="meta-grid">
        <div><span>Tipo</span><strong>${tipo}</strong></div>
        <div><span>NSR</span><strong>${m.nsr}</strong></div>
        <div><span>Horário batido</span><strong>${escapeHtml(formatHoraPonto(m.registrado_em))}</strong></div>
        <div><span>Status</span><strong>${status}</strong></div>
      </div>

      <p class="data-completa">${escapeHtml(formatDataHoraCompleta(m.registrado_em))}</p>

      <div class="local-box">
        <h3>Localização do registro</h3>
        ${localHtml}
      </div>

      <div class="midia-grid">
        <div class="midia-card">
          <h3>Selfie no momento da batida</h3>
          ${fotoBlock}
        </div>
        <div class="midia-card">
          <h3>Assinatura do prestador</h3>
          ${assinaturaBlock}
        </div>
      </div>

      <footer class="doc-footer">
        <p>Documento gerado conforme Portaria MTP nº 671/2021 (REP-P).</p>
        <p class="hash">Hash SHA-256: <code>${escapeHtml(m.hash_sha256.slice(0, 48))}…</code></p>
      </footer>
    </section>
  `
}

export function buildPontoComprovanteHtml(inputs: PontoComprovanteInput[]): string {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const pages = inputs.map(i => buildPaginaComprovante(i, logoUrl)).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovantes de ponto — ${escapeHtml(inputs[0]?.funcionarioNome ?? '')}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1a1208; background: #fff; }
    .comprovante-page {
      max-width: 190mm;
      margin: 0 auto 12mm;
      padding: 10mm 12mm;
      border: 2px solid #8b6914;
      page-break-after: always;
    }
    .comprovante-page:last-child { page-break-after: auto; }
    .doc-timbre { margin-bottom: 6mm; }
    .doc-timbre__faixa {
      height: 4px;
      background: linear-gradient(90deg, #8b6914, #d4a853, #8b6914);
      margin-bottom: 4mm;
    }
    .doc-header { display: flex; align-items: center; gap: 14px; }
    .doc-header img { max-height: 52px; width: auto; }
    .doc-empresa h1 { margin: 0; font-size: 14pt; letter-spacing: 0.14em; color: #8b6914; }
    .doc-empresa p { margin: 2px 0 0; font-size: 9pt; color: #555; }
    .doc-sub { font-style: italic; }
    .doc-titulo {
      text-align: center;
      font-size: 12pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 6mm 0;
      color: #2a1812;
    }
    .prestador {
      text-align: center;
      padding: 5mm;
      border: 1px solid #d4a853;
      background: #faf8f5;
      margin-bottom: 5mm;
    }
    .prestador .label {
      display: block;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #8b6914;
      margin-bottom: 2mm;
    }
    .prestador strong { font-size: 14pt; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm;
      margin-bottom: 4mm;
    }
    .meta-grid div {
      border: 1px solid #e0d5c8;
      padding: 3mm;
      font-size: 9pt;
    }
    .meta-grid span { display: block; color: #777; font-size: 8pt; text-transform: uppercase; }
    .meta-grid strong { font-size: 11pt; }
    .data-completa { text-align: center; font-size: 10pt; color: #444; margin-bottom: 5mm; }
    .local-box {
      border: 1px solid #b8d4e8;
      background: #f0f8ff;
      padding: 4mm;
      margin-bottom: 5mm;
      font-size: 9pt;
    }
    .local-box h3 { margin: 0 0 2mm; font-size: 9pt; text-transform: uppercase; color: #2563eb; }
    .local-coords { margin: 0; font-family: monospace; }
    .local-link { margin: 2mm 0 0; }
    .local-link a { color: #2563eb; }
    .midia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .midia-card { border: 1px solid #ccc; padding: 3mm; }
    .midia-card h3 { margin: 0 0 2mm; font-size: 8pt; text-transform: uppercase; color: #666; }
    .midia-img { width: 100%; max-height: 55mm; object-fit: cover; display: block; }
    .midia-img.assinatura { object-fit: contain; background: #faf8f5; }
    .midia-vazio {
      height: 45mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      color: #999;
      font-size: 9pt;
    }
    .doc-footer {
      margin-top: 6mm;
      padding-top: 3mm;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
    .hash code { font-size: 7pt; word-break: break-all; }
  </style>
</head>
<body>${pages}</body>
</html>`
}

export function imprimirPontoComprovantes(inputs: PontoComprovanteInput[]): void {
  if (!inputs.length) return
  const html = buildPontoComprovanteHtml(inputs)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.print()
    setTimeout(() => win.close(), 500)
  }
}

export async function prepararComprovantesPonto(
  funcionarioNome: string,
  marcacoes: PontoMarcacao[],
  repCnpj?: string | null,
): Promise<PontoComprovanteInput[]> {
  const enriched = await enrichMarcacoesUrls(marcacoes)
  return enriched
    .sort((a, b) => a.registrado_em.localeCompare(b.registrado_em))
    .map(m => ({
      funcionarioNome,
      marcacao: m,
      fotoUrl: m.fotoUrl,
      assinaturaUrl: m.assinaturaUrl,
      repCnpj,
    }))
}

export function marcacaoIdFromComprovantePath(path: string): string | null {
  const match = path.match(/\/ponto\/([^/]+)\/comprovante\.pdf$/i)
  return match?.[1] ?? null
}
