import { useEffect, useState } from 'react'
import { FileSignature } from 'lucide-react'
import { ReciboAssinaturaCanvas } from '@/components/funcionarios/ReciboAssinaturaCanvas'
import { RecibosPorMesAccordion } from '@/components/funcionarios/RecibosPorMesAccordion'
import { usePrestadorRecibos } from '@/hooks/usePrestadorRecibos'
import { useApp } from '@/context/AppContext'
import { imprimirReciboPrestador } from '@/lib/funcionario-recibo-print'
import { podeAssinarRecibo, reciboStatusExibicao } from '@/lib/funcionario-recibos'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { fmtCur, fmtDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { FuncionarioRecibo } from '@/types'

export function PrestadorRecibosTab() {
  const { userProfile } = useApp()
  const { data, pendentes, loading, error, reload, assinar, getAssinadoUrl } = usePrestadorRecibos()
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null)
  const [selected, setSelected] = useState<FuncionarioRecibo | null>(null)
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  useEffect(() => {
    if (!userProfile?.id) return
    void supabase
      .from('movelaria_funcionarios')
      .select('id')
      .eq('usuario_id', userProfile.id)
      .eq('ativo', true)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) setFuncionarioId(row.id)
      })
  }, [userProfile?.id])

  const confirmarAssinatura = async () => {
    if (!selected || !assinaturaUrl || !funcionarioId) return
    setSigning(true)
    setSignError(null)
    try {
      await assinar(selected, funcionarioId, assinaturaUrl)
      setSelected(null)
      setAssinaturaUrl(null)
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Erro ao assinar.')
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <div className="glass-card border border-amber-500/30 p-4">
          <p className="flex items-center gap-2 font-medium text-amber-300">
            <FileSignature size={18} />
            {pendentes.length} recibo{pendentes.length !== 1 ? 's' : ''} aguardando sua assinatura
          </p>
          <p className="mt-1 text-sm text-[#b8957f]">
            Toque em Assinar e desenhe com o dedo na área indicada.
          </p>
        </div>
      )}

      <div className="max-h-[28rem] overflow-y-auto pr-1">
        <RecibosPorMesAccordion
          recibos={data}
          renderRecibo={recibo => {
            const status = reciboStatusExibicao(recibo)
            return (
            <div className="glass-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#f2d892]">
                    {recibo.valor != null ? fmtCur(recibo.valor) : 'Recibo de pagamento'}
                  </p>
                  <p className="text-sm text-[#b8957f]">
                    {recibo.data_pagamento ? fmtDate(recibo.data_pagamento) : '—'}
                    {' · '}
                    {status.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => imprimirReciboPrestador(recibo)}>
                    Ver / Imprimir
                  </button>
                  {podeAssinarRecibo(recibo) && (
                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      onClick={() => {
                        setSelected(recibo)
                        setAssinaturaUrl(null)
                        setSignError(null)
                      }}
                    >
                      Assinar
                    </button>
                  )}
                  {recibo.status === 'assinado' && recibo.arquivo_assinado_path && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        void getAssinadoUrl(recibo.arquivo_assinado_path!).then(u => window.open(u, '_blank'))
                      }
                    >
                      Baixar assinado
                    </button>
                  )}
                </div>
              </div>
            </div>
            )
          }}
        />
      </div>

      {selected && (
        <div
          className="glass-overlay-mogno fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-dialog max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-1 font-display text-xl text-[#f2d892]">Assinar recibo</h3>
            <p className="mb-4 text-sm text-[#b8957f]">
              Leia o recibo abaixo e desenhe sua assinatura com o dedo.
            </p>
            <pre className="mb-4 max-h-36 overflow-y-auto whitespace-pre-wrap rounded border border-[rgba(212,168,83,0.15)] bg-[rgba(0,0,0,0.25)] p-3 text-xs text-[#edd9c4]">
              {selected.texto_recibo}
            </pre>
            <ReciboAssinaturaCanvas onExport={setAssinaturaUrl} height={220} />
            {signError && <p className="mt-2 text-sm text-red-400">{signError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-outline btn-md flex-1" onClick={() => setSelected(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-gold btn-md flex-1"
                disabled={!assinaturaUrl || signing || !funcionarioId}
                onClick={() => void confirmarAssinatura()}
              >
                {signing ? 'Confirmando…' : 'Confirmar assinatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
        Atualizar
      </button>
    </div>
  )
}
