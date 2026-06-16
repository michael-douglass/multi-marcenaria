import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { OrcamentoPublicoSlides } from '@/components/orcamento-publico/OrcamentoPublicoSlides'
import { fetchOrcamentoPublico, isValidOrcamentoSchema } from '@/lib/orcamento-publico-api'
import type { OrcamentoPublicoPayload } from '@/types/orcamento-publico'

export function OrcamentoPublico() {
  const { schema, id } = useParams<{ schema: string; id: string }>()
  const [payload, setPayload] = useState<OrcamentoPublicoPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!schema || !id || !isValidOrcamentoSchema(schema)) {
      setError('Link de orçamento inválido.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchOrcamentoPublico(schema, id)
      .then(data => {
        if (!cancelled) setPayload(data)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar o orçamento.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schema, id])

  useEffect(() => {
    if (!payload) return
    document.title = `Orçamento — ${payload.slide.cliente_nome}`
    return () => {
      document.title = 'GARBO Movelaria — Sistema Financeiro'
    }
  }, [payload])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5e8d8] font-raleway text-[#3d2b1f]">
        Carregando orçamento...
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5e8d8] px-6 font-raleway text-[#3d2b1f]">
        <div className="max-w-md text-center">
          <p className="text-5xl">📄</p>
          <h1 className="mt-4 text-2xl font-semibold">Orçamento não encontrado</h1>
          <p className="mt-3 text-sm text-[#3d2b1f]/70">
            {error ?? 'Verifique se o link foi copiado corretamente.'}
          </p>
        </div>
      </div>
    )
  }

  const style = {
    '--orc-cor-primaria': payload.template.cor_primaria || '#3D2B1F',
    '--orc-cor-secundaria': payload.template.cor_secundaria || '#C9956C',
    '--orc-cor-texto': payload.template.cor_texto || '#3D2B1F',
    '--orc-cor-fundo': payload.template.cor_fundo || '#F5E8D8',
  } as React.CSSProperties

  return (
    <div
      className="min-h-screen bg-[var(--orc-cor-fundo)] font-raleway text-[var(--orc-cor-texto)]"
      style={style}
    >
      {payload.template.logo_url && (
        <div className="fixed left-4 top-4 z-50 rounded-2xl bg-white/80 p-2 shadow-lg backdrop-blur-sm md:left-8 md:top-8">
          <img
            src={payload.template.logo_url}
            alt="Logo"
            className="h-10 w-auto object-contain md:h-12"
          />
        </div>
      )}
      <OrcamentoPublicoSlides payload={payload} />
    </div>
  )
}
