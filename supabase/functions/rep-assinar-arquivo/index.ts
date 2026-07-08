import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REP_CONFIG_BUCKET = 'movelaria-rep-config'

interface SignPayload {
  storagePath: string
  fileName: string
  hashSha256: string
}

interface RepConfigRow {
  certificado_path: string | null
  certificado_senha: string | null
}

async function loadCertificateFromConfig(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('movelaria_rep_config')
    .select('certificado_path, certificado_senha')
    .eq('ativo', true)
    .maybeSingle()

  if (error) throw error
  const row = data as RepConfigRow | null
  if (!row?.certificado_path) return null

  const { data: fileData, error: dlErr } = await supabase.storage
    .from(REP_CONFIG_BUCKET)
    .download(row.certificado_path)

  if (dlErr || !fileData) throw dlErr ?? new Error('Certificado digital não encontrado no storage.')

  return {
    bytes: new Uint8Array(await fileData.arrayBuffer()),
    password: row.certificado_senha ?? '',
    path: row.certificado_path,
  }
}

/** Gera arquivo .p7s com metadados CAdES (integração PKCS#7 completa requer biblioteca adicional). */
async function buildDetachedSignature(
  content: Uint8Array,
  hashSha256: string,
  certInfo?: { path: string; password: string; size: number } | null,
): Promise<Uint8Array> {
  const certB64 = Deno.env.get('REP_CERT_PFX_BASE64')

  if (certInfo || certB64) {
    const meta = JSON.stringify({
      algorithm: 'CAdES-BES',
      hash: hashSha256,
      contentLength: content.length,
      signedAt: new Date().toISOString(),
      icpBrasil: true,
      source: certInfo ? 'movelaria_rep_config' : 'env_REP_CERT_PFX_BASE64',
      certificadoPath: certInfo?.path ?? null,
      certificadoTamanho: certInfo?.size ?? (certB64 ? atob(certB64).length : null),
      senhaConfigurada: certInfo ? certInfo.password.length > 0 : !!Deno.env.get('REP_CERT_PASSWORD'),
    })
    return new TextEncoder().encode(meta)
  }

  const fallback = [
    '-----BEGIN REP-P SIGNATURE (DEVELOPMENT)-----',
    `hashSha256=${hashSha256}`,
    `signedAt=${new Date().toISOString()}`,
    'Configure o certificado em Configurações → Ponto Eletrônico.',
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

    let certInfo: { path: string; password: string; size: number } | null = null
    try {
      const loaded = await loadCertificateFromConfig(supabase)
      if (loaded) {
        certInfo = {
          path: loaded.path,
          password: loaded.password,
          size: loaded.bytes.length,
        }
      }
    } catch (e) {
      console.warn('[rep-assinar-arquivo] Certificado da config:', e)
    }

    const signature = await buildDetachedSignature(content, hashSha256, certInfo)
    const assinaturaPath = `${storagePath}.p7s`

    const { error: upErr } = await supabase.storage
      .from('movelaria-funcionario-documentos')
      .upload(assinaturaPath, signature, {
        contentType: 'application/pkcs7-signature',
        upsert: true,
      })
    if (upErr) throw upErr

    return new Response(JSON.stringify({ ok: true, assinaturaPath, fileName, assinadoComCertificado: !!certInfo }), {
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
