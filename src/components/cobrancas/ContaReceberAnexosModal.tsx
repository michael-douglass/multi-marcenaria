import { useCallback, useEffect, useState } from 'react'
import { FileDown, Loader2, MessageSquare, Paperclip } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import {
  anexoEscopoLabel,
  deleteContaReceberAnexo,
  getCrAnexoPreviewSignedUrls,
  listAnexosDaContaReceber,
  resolveGrupoReceberId,
  uploadContaReceberAnexos,
  revokePendingCrAnexoUrls,
} from '@/lib/contas-receber-anexos'
import {
  imprimirResumoCobrancaPdf,
  statusParcelaConta,
  type CobrancaResumoAnexo,
  type CobrancaResumoParcela,
} from '@/lib/cobranca-resumo-pdf'
import { cobrancaTemParcelamento, parcelasRelacionadas } from '@/hooks/useContasReceber'
import type {
  ContaReceber,
  ContaReceberAnexo,
  ContaReceberAnexoScope,
  FormaPagamento,
  PendingContaReceberAnexo,
} from '@/types'
import { ContaReceberAnexosField } from './ContaReceberAnexosField'

const PM_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  boleto: 'Boleto',
  cartao: 'Cartão',
}

interface ContaReceberAnexosModalProps {
  open: boolean
  conta: ContaReceber | null
  todasContas: ContaReceber[]
  readOnly?: boolean
  onClose: () => void
}

interface AnexoView extends ContaReceberAnexo {
  previewUrl: string
  previewUrls: string[]
  kind: 'image' | 'pdf' | 'document'
}

function kindFromAnexo(row: ContaReceberAnexo): 'image' | 'pdf' | 'document' {
  const nome = row.nome_arquivo.toLowerCase()
  const mime = row.tipo_mime
  if (mime === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf'
  if (
    mime.includes('wordprocessingml')
    || nome.endsWith('.dotx')
    || nome.endsWith('.docx')
  ) {
    return 'document'
  }
  return 'image'
}

export function ContaReceberAnexosModal({
  open,
  conta,
  todasContas,
  readOnly,
  onClose,
}: ContaReceberAnexosModalProps) {
  const [anexos, setAnexos] = useState<AnexoView[]>([])
  const [novos, setNovos] = useState<PendingContaReceberAnexo[]>([])
  const [scope, setScope] = useState<ContaReceberAnexoScope>('single')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<AnexoView | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const temParcelamento = conta ? cobrancaTemParcelamento(conta, todasContas) : false

  const exportarPdf = useCallback(async () => {
    if (!conta) return
    setExportingPdf(true)
    try {
      const relacionadas = parcelasRelacionadas(conta, todasContas)
        .slice()
        .sort((a, b) => a.numero_parcela - b.numero_parcela)
      const serie = relacionadas.length ? relacionadas : [conta]
      const totalParcelas = Math.max(
        conta.total_parcelas,
        serie.length,
        ...serie.map(p => p.total_parcelas),
      )

      const parcelas: CobrancaResumoParcela[] = serie.map(p => ({
        numero: p.numero_parcela,
        totalParcelas,
        valor: p.valor_parcela,
        vencimento: p.data_vencimento,
        status: statusParcelaConta(p.status, p.data_vencimento),
        formaPagamento: PM_LABEL[p.forma_pagamento] ?? p.forma_pagamento,
      }))

      const anexosSalvos: CobrancaResumoAnexo[] = anexos.map(a => ({
        nome: a.nome_arquivo,
        escopo: anexoEscopoLabel(a),
        previewUrls: a.previewUrls?.length
          ? a.previewUrls
          : a.previewUrl
            ? [a.previewUrl]
            : [],
      }))
      const anexosNovos: CobrancaResumoAnexo[] = novos.map(a => ({
        nome: a.nome,
        escopo: 'ainda não salvo',
        previewUrls: a.previewUrls?.length
          ? a.previewUrls
          : a.previewUrl
            ? [a.previewUrl]
            : [],
      }))

      imprimirResumoCobrancaPdf({
        clienteNome: conta.cliente_nome,
        valorTotal: conta.valor_total,
        tipoRecebimento: conta.tipo_recebimento,
        formaPagamento: conta.forma_pagamento,
        observacao: conta.observacao,
        entrada: null,
        parcelas,
        anexos: [...anexosSalvos, ...anexosNovos],
        subtitulo: 'Anexos da cobrança',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.')
    } finally {
      setExportingPdf(false)
    }
  }, [conta, todasContas, anexos, novos])

  const load = useCallback(async () => {
    if (!conta) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listAnexosDaContaReceber(conta)
      const views: AnexoView[] = await Promise.all(
        rows.map(async row => {
          const kind = kindFromAnexo(row)
          const previewUrls = await getCrAnexoPreviewSignedUrls(row)
          return { ...row, previewUrl: previewUrls[0] ?? '', previewUrls, kind }
        }),
      )
      setAnexos(views)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar anexos.')
    } finally {
      setLoading(false)
    }
  }, [conta])

  useEffect(() => {
    if (open && conta) {
      void load()
      setScope(temParcelamento ? 'all' : 'single')
    }
    if (!open) {
      revokePendingCrAnexoUrls(novos)
      setAnexos([])
      setNovos([])
      setLightbox(null)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limpa só ao fechar
  }, [open, conta, load, temParcelamento])

  const handleDelete = async (anexo: AnexoView) => {
    const escopo = anexoEscopoLabel(anexo)
    if (!confirm(`Excluir o anexo "${anexo.nome_arquivo}" (${escopo})?`)) return
    setDeleting(true)
    try {
      await deleteContaReceberAnexo(anexo)
      setAnexos(prev => prev.filter(a => a.id !== anexo.id))
      setLightbox(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSalvarNovos = async () => {
    if (!conta || novos.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await uploadContaReceberAnexos({
        scope,
        contaReceberId: conta.id,
        grupoId: resolveGrupoReceberId(conta),
        anexos: novos,
      })
      revokePendingCrAnexoUrls(novos)
      setNovos([])
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar anexos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="ANEXOS DA COBRANÇA"
        headerActions={
          conta ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={exportingPdf}
              onClick={() => void exportarPdf()}
              title="Exportar resumo em PDF"
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Exportar PDF
            </button>
          ) : null
        }
      >
        {conta && (
          <p className="mb-3 text-sm text-[#edd9c4]">
            {conta.cliente_nome} — parcela {conta.numero_parcela}/{conta.total_parcelas}
          </p>
        )}

        {loading && (
          <p className="text-center text-sm text-[#edd9c4]">Carregando anexos...</p>
        )}
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {!loading && anexos.length === 0 && !error && (
          <p className="mb-3 text-center text-sm text-[#edd9c4]">Nenhum anexo nesta cobrança.</p>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          {anexos.map(a => (
            <div key={a.id} className="relative">
              <AnexoThumb
                previewUrl={a.previewUrl}
                nome={a.nome_arquivo}
                kind={a.kind}
                onOpenFullscreen={() => setLightbox(a)}
                onDelete={readOnly ? undefined : () => void handleDelete(a)}
              />
              <span className="mt-1 block text-center text-[0.6rem] uppercase tracking-wider text-[#b8957f]">
                {anexoEscopoLabel(a)}
              </span>
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="space-y-3 border-t border-[rgba(240,210,140,0.15)] pt-4">
            <ContaReceberAnexosField
              anexos={novos}
              onChange={setNovos}
              showScope
              temParcelamento={temParcelamento}
              scope={scope}
              onScopeChange={setScope}
            />
            {novos.length > 0 && (
              <button
                type="button"
                className="btn btn-gold btn-sm"
                disabled={saving}
                onClick={() => void handleSalvarNovos()}
              >
                {saving ? 'Salvando…' : `Salvar ${novos.length} anexo(s)`}
              </button>
            )}
          </div>
        )}
      </Modal>

      <AnexoLightbox
        open={!!lightbox}
        imageUrl={lightbox?.previewUrl ?? ''}
        pages={lightbox?.previewUrls}
        title={lightbox?.nome_arquivo ?? ''}
        kind={lightbox?.kind}
        onClose={() => setLightbox(null)}
        onDelete={
          lightbox && !readOnly ? () => void handleDelete(lightbox) : undefined
        }
        deleting={deleting}
      />
    </>
  )
}

export function ContaReceberAnexosButton({
  conta,
  todasContas,
  readOnly,
}: {
  conta: ContaReceber
  todasContas: ContaReceber[]
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm !px-2"
        title="Observação e anexos da cobrança"
        onClick={() => setOpen(true)}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {conta.observacao?.trim() ? (
          <MessageSquare className="ml-1 h-3 w-3 text-[#f2d892]" />
        ) : null}
      </button>
      <ContaReceberAnexosModal
        open={open}
        conta={conta}
        todasContas={todasContas}
        readOnly={readOnly}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
