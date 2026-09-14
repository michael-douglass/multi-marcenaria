import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/utils'
import type { ObraDatasHistoricoItem, ObraFull } from '@/types'

function fmtRange(inicio?: string | null, fim?: string | null): string {
  const a = inicio ? fmtDate(inicio) : '?'
  const b = fim ? fmtDate(fim) : '?'
  return `${a} → ${b}`
}

function fmtQuando(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface ObraDatasHistoricoBlockProps {
  obra: Pick<
    ObraFull,
    | 'id'
    | 'data_prevista_inicio_original'
    | 'data_prevista_fim_original'
    | 'data_prevista_inicio'
    | 'data_prevista_fim'
    | 'atraso_permanente'
  > | null
  /** Se false, só mostra original (sem buscar lista). */
  loadHistorico?: boolean
  compact?: boolean
}

export function ObraDatasHistoricoBlock({
  obra,
  loadHistorico = true,
  compact = false,
}: ObraDatasHistoricoBlockProps) {
  const [itens, setItens] = useState<ObraDatasHistoricoItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!obra?.id || !loadHistorico) {
      setItens([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from('movelaria_obras_datas_historico')
        .select(
          'id, obra_id, data_inicio_anterior, data_fim_anterior, data_inicio_nova, data_fim_nova, alterado_em, alterado_por',
        )
        .eq('obra_id', obra.id)
        .order('alterado_em', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('[ObraDatasHistorico]', error.message)
        setItens([])
      } else {
        setItens((data ?? []) as ObraDatasHistoricoItem[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [obra?.id, loadHistorico])

  if (!obra) return null

  const hasOriginal =
    Boolean(obra.data_prevista_inicio_original) || Boolean(obra.data_prevista_fim_original)

  if (!hasOriginal && itens.length === 0 && !obra.atraso_permanente) return null

  return (
    <div
      className={
        compact
          ? 'rounded-md border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] px-2.5 py-2 space-y-1.5'
          : 'rounded-lg border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.07)] px-3 py-2.5 space-y-2'
      }
    >
      {obra.atraso_permanente && (
        <p className="m-0 text-[0.72rem] font-semibold text-red-500">
          Atraso permanente — a primeira data não foi cumprida
        </p>
      )}

      {hasOriginal && (
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Data original
          </p>
          <p className="m-0 text-[0.82rem] font-semibold tabular-nums text-[var(--color-text-secondary)]">
            {fmtRange(obra.data_prevista_inicio_original, obra.data_prevista_fim_original)}
          </p>
        </div>
      )}

      {(obra.data_prevista_inicio || obra.data_prevista_fim) && hasOriginal && (
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Data atual
          </p>
          <p className="m-0 text-[0.82rem] font-medium tabular-nums text-[var(--color-text-secondary)]">
            {fmtRange(obra.data_prevista_inicio, obra.data_prevista_fim)}
          </p>
        </div>
      )}

      {loadHistorico && (
        <div>
          <p className="m-0 mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Histórico de reajustes
          </p>
          {loading && (
            <p className="m-0 text-[0.72rem] text-[var(--color-text-muted)]">Carregando…</p>
          )}
          {!loading && itens.length === 0 && (
            <p className="m-0 text-[0.72rem] text-[var(--color-text-muted)]">
              Nenhuma alteração registrada ainda
            </p>
          )}
          {!loading && itens.length > 0 && (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {itens.map(item => (
                <li
                  key={item.id}
                  className="rounded border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.12)] px-2 py-1.5"
                >
                  <p className="m-0 text-[0.72rem] tabular-nums text-[var(--color-text-secondary)]">
                    {fmtRange(item.data_inicio_anterior, item.data_fim_anterior)}
                    {' → '}
                    {fmtRange(item.data_inicio_nova, item.data_fim_nova)}
                  </p>
                  <p className="m-0 text-[0.62rem] text-[var(--color-text-muted)]">
                    {fmtQuando(item.alterado_em)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
