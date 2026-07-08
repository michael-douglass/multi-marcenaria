import { useState } from 'react'
import { Download, Eye, FileSignature } from 'lucide-react'
import { RecibosPorMesAccordion } from '@/components/funcionarios/RecibosPorMesAccordion'
import { getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import { imprimirReciboPrestador } from '@/lib/funcionario-recibo-print'
import { reciboPendenteAssinatura, reciboStatusExibicao } from '@/lib/funcionario-recibos'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { FuncionarioRecibo } from '@/types'

interface Props {
  recibos: FuncionarioRecibo[]
  readOnly?: boolean
  onReload: () => void
}


export function FuncionarioRecibosPanel({ recibos, onReload }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<FuncionarioRecibo | null>(null)

  const pendentes = recibos.filter(reciboPendenteAssinatura)

  const baixarAssinado = async (recibo: FuncionarioRecibo) => {
    if (!recibo.arquivo_assinado_path) return
    setLoadingId(recibo.id)
    try {
      const url = await getFuncionarioDocSignedUrl(recibo.arquivo_assinado_path)
      window.open(url, '_blank')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <p className="flex items-center gap-2 text-sm text-[#edd9c4]">
          <FileSignature size={16} className="text-[#f2d892]" />
          Cada pagamento concluído gera um recibo. O prestador assina manualmente em Meu Financeiro ou Meu Perfil.
        </p>
        {pendentes.length > 0 && (
          <p className="mt-2 text-sm text-amber-300">
            {pendentes.length} recibo{pendentes.length !== 1 ? 's' : ''} aguardando assinatura do prestador.
          </p>
        )}
        <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => onReload()}>
          Atualizar lista
        </button>
      </div>

      <div className="max-h-[28rem] overflow-y-auto pr-1">
        <RecibosPorMesAccordion
          recibos={recibos}
          renderRecibo={recibo => {
            const status = reciboStatusExibicao(recibo)
            return (
            <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#f2d892]">
                    {recibo.valor != null ? fmtCur(recibo.valor) : 'Recibo'}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider ${status.colorClass}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#b8957f]">
                  {recibo.data_pagamento ? fmtDate(recibo.data_pagamento) : '—'}
                  {recibo.assinado_em && ` · Assinado em ${fmtDate(recibo.assinado_em.split('T')[0])}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreview(recibo)}>
                  <Eye size={14} />
                  Ver
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => imprimirReciboPrestador(recibo)}>
                  Imprimir
                </button>
                {recibo.status === 'assinado' && recibo.arquivo_assinado_path && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={loadingId === recibo.id}
                    onClick={() => void baixarAssinado(recibo)}
                  >
                    <Download size={14} />
                    Baixar assinado
                  </button>
                )}
              </div>
            </div>
            )
          }}
        />
      </div>

      {preview && (
        <div className="glass-overlay-mogno fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="glass-dialog max-h-[85vh] w-full max-w-lg overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 font-display text-xl text-[#f2d892]">Recibo de pagamento</h3>
            <pre className="whitespace-pre-wrap rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(0,0,0,0.3)] p-4 text-sm text-[#f0e0d2]">
              {preview.texto_recibo}
            </pre>
            <button type="button" className="btn btn-outline btn-md mt-4 w-full" onClick={() => setPreview(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
