import { garboBrandLogo } from '@/lib/garbo-brand'
import { formatarCnpj, somenteDigitos } from '@/lib/rep/rep-validation'

const NOME_EMPRESA_PADRAO = 'GARBO MOVELARIA'
const CIDADE_PADRAO = 'Contagem/MG'

export interface AdvertenciaDisciplinarInput {
  funcionarioNome: string
  funcionarioCargo: string
  funcionarioCpf?: string | null
  motivo: string
  /** Data do documento (YYYY-MM-DD). */
  dataDocumento: string
  empresaNome?: string | null
  empresaCnpj?: string | null
  cidadeUf?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatarCpf(valor?: string | null): string {
  const d = somenteDigitos(valor ?? '').slice(0, 11)
  if (d.length !== 11) return valor?.trim() || '—'
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Ex.: 2026-08-06 → "6 de agosto de 2026" */
export function formatDataExtensoPt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  const dia = d.getDate()
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' })
  const ano = d.getFullYear()
  return `${dia} de ${mes} de ${ano}`
}

/** Ex.: 2026-07-06 → "06/07/2026" */
export function formatDataCurtaBr(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Monta o motivo padrão a partir das datas de falta.
 * Ex.: "FALTADO AO SERVIÇO EM 06/07/2026, 07/07/2026 E 08/07/2026 SEM NENHUMA JUSTIFICATIVA"
 */
export function montarMotivoFaltas(datasIso: string[]): string {
  const datas = [...datasIso]
    .filter(Boolean)
    .sort()
    .map(formatDataCurtaBr)
  if (datas.length === 0) {
    return 'FALTADO AO SERVIÇO SEM NENHUMA JUSTIFICATIVA'
  }
  let lista: string
  if (datas.length === 1) {
    lista = datas[0]
  } else if (datas.length === 2) {
    lista = `${datas[0]} e ${datas[1]}`
  } else {
    lista = `${datas.slice(0, -1).join(', ')} e ${datas[datas.length - 1]}`
  }
  return `FALTADO AO SERVIÇO EM ${lista} SEM NENHUMA JUSTIFICATIVA`
}

export function buildAdvertenciaDisciplinarHtml(input: AdvertenciaDisciplinarInput): string {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const empresa = escapeHtml((input.empresaNome?.trim() || NOME_EMPRESA_PADRAO).toUpperCase())
  const cnpjRaw = input.empresaCnpj?.trim() || ''
  const cnpj = escapeHtml(cnpjRaw ? formatarCnpj(cnpjRaw) : '—')
  const cidade = escapeHtml(input.cidadeUf?.trim() || CIDADE_PADRAO)
  const nome = escapeHtml(input.funcionarioNome.trim().toUpperCase())
  const cargo = escapeHtml(input.funcionarioCargo.trim().toUpperCase())
  const cpf = escapeHtml(formatarCpf(input.funcionarioCpf))
  const motivo = escapeHtml(input.motivo.trim())
  const dataExtenso = escapeHtml(formatDataExtensoPt(input.dataDocumento))

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Advertência Disciplinar — ${nome}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Times New Roman", Times, Georgia, serif;
      color: #111;
      background: #fff;
      font-size: 12pt;
      line-height: 1.55;
    }
    .pagina {
      max-width: 180mm;
      margin: 0 auto;
      min-height: 250mm;
      display: flex;
      flex-direction: column;
    }
    .timbre {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2px solid #1a1208;
      padding-bottom: 8mm;
      margin-bottom: 8mm;
    }
    .timbre img {
      max-height: 58px;
      width: auto;
    }
    .timbre-empresa h1 {
      margin: 0;
      font-size: 13pt;
      letter-spacing: 0.16em;
      color: #1a1208;
    }
    .timbre-empresa p {
      margin: 2px 0 0;
      font-size: 9pt;
      color: #444;
    }
    .titulo {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      text-decoration: underline;
      letter-spacing: 0.04em;
      margin: 0 0 10mm;
    }
    .destinatario {
      margin-bottom: 7mm;
    }
    .destinatario .saudacao {
      margin: 0 0 2mm;
    }
    .destinatario .nome,
    .destinatario .cargo,
    .destinatario .cpf {
      margin: 0;
      font-weight: 700;
      text-transform: uppercase;
    }
    .corpo p {
      text-align: justify;
      margin: 0 0 5mm;
      text-indent: 1.2cm;
    }
    .corpo strong.destaque {
      text-transform: uppercase;
      text-decoration: underline;
    }
    .local-data {
      text-align: center;
      margin: 10mm 0 14mm;
    }
    .assinatura-empresa {
      text-align: center;
      margin-top: auto;
      padding-top: 8mm;
    }
    .linha-assinatura {
      width: 70%;
      margin: 0 auto 2mm;
      border-bottom: 1px solid #111;
      height: 18mm;
    }
    .assinatura-empresa .empresa {
      margin: 0;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11pt;
    }
    .assinatura-empresa .cnpj {
      margin: 1mm 0 0;
      font-size: 10pt;
    }
    .ciente {
      margin-top: 16mm;
      page-break-inside: avoid;
    }
    .ciente p {
      margin: 0 0 2mm;
    }
    .ciente .linha {
      border-bottom: 1px solid #111;
      height: 14mm;
      margin-top: 2mm;
    }
  </style>
</head>
<body>
  <section class="pagina">
    <header class="timbre">
      <img src="${logoUrl}" alt="${empresa}" />
      <div class="timbre-empresa">
        <h1>${empresa}</h1>
        <p>CNPJ ${cnpj}</p>
      </div>
    </header>

    <h2 class="titulo">Advertência Disciplinar — Faltas</h2>

    <div class="destinatario">
      <p class="saudacao">Prezado(a) Sr(a)</p>
      <p class="nome">${nome}</p>
      <p class="cargo">${cargo}</p>
      <p class="cpf">CPF: ${cpf}</p>
    </div>

    <div class="corpo">
      <p>
        Vimos, pela presente, aplicar-lhe <strong>ADVERTÊNCIA DISCIPLINAR</strong>
        pelo fato de você ter <strong class="destaque">${motivo}</strong>,
        agindo assim com desídia no desempenho de suas funções, na forma do
        art. 482, letra “e”, da Consolidação das Leis do Trabalho (CLT).
      </p>
      <p>
        Solicitamos adequar seu comportamento às normas e costumes desta empresa
        e manter a disciplina necessária para o bom desempenho do seu trabalho.
      </p>
      <p>
        Esclarecemos e solicitamos que evite a reincidência desse ato, o qual
        poderá ensejar uma suspensão disciplinar ou até mesmo extinção do
        contrato de trabalho por justa causa, medidas cabíveis de acordo com a
        legislação em vigor.
      </p>
    </div>

    <p class="local-data">${cidade}, ${dataExtenso}</p>

    <div class="assinatura-empresa">
      <div class="linha-assinatura" aria-hidden="true"></div>
      <p class="empresa">${empresa}</p>
      <p class="cnpj">CNPJ: ${cnpj}</p>
    </div>

    <div class="ciente">
      <p>Empregado ciente em ____/____/________</p>
      <div class="linha" aria-hidden="true"></div>
    </div>
  </section>
</body>
</html>`
}

export function imprimirAdvertenciaDisciplinarPdf(input: AdvertenciaDisciplinarInput): void {
  const motivo = input.motivo.trim()
  if (!motivo) {
    throw new Error('Informe o motivo da advertência.')
  }
  if (!input.funcionarioNome.trim()) {
    throw new Error('Nome do funcionário não encontrado na pasta.')
  }

  const html = buildAdvertenciaDisciplinarHtml(input)
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Permita pop-ups para exportar o PDF.')
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.print()
    setTimeout(() => win.close(), 500)
  }
}
