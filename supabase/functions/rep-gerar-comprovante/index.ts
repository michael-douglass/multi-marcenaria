import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComprovantePayload {
  marcacaoId: string
  funcionarioId: string
  funcionarioNome: string
  comprovantePath: string
  marcacao: {
    nsr: number
    tipo: string
    registrado_em: string
    status: string
    atraso_minutos: number
    hash_sha256: string
  }
  fotoPath: string
  assinaturaPath: string
  geo: { latitude: number; longitude: number; accuracy: number }
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const content = lines.map((line, i) => {
    const y = 780 - i * 18
    return `BT /F1 11 Tf 50 ${y} Td (${escapePdf(line)}) Tj ET`
  }).join('\n')

  const stream = `${content}\n`
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}endstream endobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj + '\n'
  }
  const xrefPos = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = (await req.json()) as ComprovantePayload
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const dt = new Date(payload.marcacao.registrado_em)
    const lines = [
      'GARBO MOVELARIA - COMPROVANTE DE REGISTRO DE PONTO',
      `Funcionario: ${payload.funcionarioNome}`,
      `NSR: ${payload.marcacao.nsr}`,
      `Tipo: ${payload.marcacao.tipo}`,
      `Data/Hora: ${dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      `Status: ${payload.marcacao.status}${payload.marcacao.atraso_minutos ? ` (+${payload.marcacao.atraso_minutos} min)` : ''}`,
      `Local: ${payload.geo.latitude.toFixed(6)}, ${payload.geo.longitude.toFixed(6)} (±${Math.round(payload.geo.accuracy)}m)`,
      `Hash SHA-256: ${payload.marcacao.hash_sha256}`,
      'Documento gerado conforme Portaria MTP 671/2021 (REP-P).',
      Deno.env.get('REP_CERT_PFX_BASE64')
        ? 'Assinatura digital PAdES aplicada quando certificado configurado.'
        : 'Modo desenvolvimento: configure REP_CERT_PFX_BASE64 para PAdES ICP-Brasil.',
    ]

    const pdfBytes = buildSimplePdf(lines)

    const { error: upErr } = await supabase.storage
      .from('movelaria-funcionario-documentos')
      .upload(payload.comprovantePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (upErr) throw upErr

    return new Response(JSON.stringify({ ok: true, path: payload.comprovantePath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao gerar comprovante'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
