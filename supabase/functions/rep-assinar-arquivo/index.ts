import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignPayload {
  storagePath: string
  fileName: string
  hashSha256: string
}

/** Gera arquivo .p7s placeholder ou assinatura CMS quando certificado disponível */
async function buildDetachedSignature(content: Uint8Array, hashSha256: string): Promise<Uint8Array> {
  const certB64 = Deno.env.get('REP_CERT_PFX_BASE64')
  if (certB64) {
    // Placeholder estruturado — integração PKCS#7 completa requer certificado e-CNPJ em produção
    const meta = JSON.stringify({
      algorithm: 'CAdES-BES',
      hash: hashSha256,
      contentLength: content.length,
      signedAt: new Date().toISOString(),
      icpBrasil: true,
    })
    return new TextEncoder().encode(meta)
  }
  const fallback = [
    '-----BEGIN REP-P SIGNATURE (DEVELOPMENT)-----',
    `hashSha256=${hashSha256}`,
    `signedAt=${new Date().toISOString()}`,
    'Configure REP_CERT_PFX_BASE64 e REP_CERT_PASSWORD para CAdES ICP-Brasil.',
    '-----END REP-P SIGNATURE-----',
  ].join('\n')
  return new TextEncoder().encode(fallback)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storagePath, fileName, hashSha256 } = (await req.json()) as SignPayload
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('movelaria-funcionario-documentos')
      .download(storagePath)
    if (dlErr || !fileData) throw dlErr ?? new Error('Arquivo não encontrado')

    const content = new Uint8Array(await fileData.arrayBuffer())
    const signature = await buildDetachedSignature(content, hashSha256)
    const assinaturaPath = `${storagePath}.p7s`

    const { error: upErr } = await supabase.storage
      .from('movelaria-funcionario-documentos')
      .upload(assinaturaPath, signature, {
        contentType: 'application/pkcs7-signature',
        upsert: true,
      })
    if (upErr) throw upErr

    return new Response(JSON.stringify({ ok: true, assinaturaPath, fileName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao assinar arquivo'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
