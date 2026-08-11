import { useRef, useState, useMemo } from 'react'
import { Upload, Loader2, Pencil, Play, CheckCircle, FileText, Camera, Trash2, Calendar, Banknote, Clock, MessageSquareText } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { AnexoThumb, AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { useObraArquivos, type ObraArquivo } from '@/hooks/useObraArquivos'
import { useObraEvolucao } from '@/hooks/useObraEvolucao'
import { useLeadMidiasPorObras } from '@/hooks/useLeadMidiasPorObras'
import { getObraLeadMidias } from '@/lib/obra-lead-midias'
import { isAcceptedObraFile, obraArquivoLightboxPages } from '@/lib/obra-arquivos'
import { groupEvolucaoPorDia, evolucaoLightboxPages } from '@/lib/obra-evolucao'
import { ObraEvolucaoRegistrarModal } from '@/components/obras/ObraEvolucaoRegistrarModal'
import { EvolucaoObservacao } from '@/components/obras/EvolucaoObservacao'
import { ObraMontadoresConclusao } from '@/components/obras/ObraMontadoresConclusao'
import { ObraMontadoresAjudantesField } from '@/components/obras/ObraMontadoresAjudantesField'
import { ObraLousa } from '@/components/obras/lousa/ObraLousa'
import { getMontadorResponsavelDisplay } from '@/lib/obra-montador'
import { getObraMontadorIds, montadorConcluiuObra, montadorIniciouObra } from '@/lib/obra-montadores'
import { getObraComissaoItensVisiveis, sumObraComissao } from '@/lib/obra-comissao'
import {
  formatObraHorarioRange,
  getObraDiasTrabalhoLongLabels,
  hasObraDiasHorarios,
} from '@/lib/obra-dias-trabalho'
import { fmtCur } from '@/lib/utils'
import type { EvolucaoItemComUrl } from '@/lib/obra-evolucao'
import type { LeadMidia, MarkupCustosFiltro, MarkupOrcamentoCustos, ObraFull, StatusKanbanObra } from '@/types'
import { ObraDataEntregaInput } from '@/components/obras/ObraDataEntregaInput'
import { ObraNumeroPedidoCortClaudInput } from '@/components/obras/ObraNumeroPedidoCortClaudInput'
import { ObraMarkupCustosBlock } from '@/components/obras/ObraMarkupCustosBlock'
import { ObraLeadMidiasStrip } from '@/components/obras/ObraLeadMidiasStrip'
import { ObraBriefingSection } from '@/components/obras/briefing/ObraBriefingSection'
import { fmtDate } from '@/lib/utils'
import { useApp } from '@/context/AppContext'
import { canViewMontadoresConclusaoObra, obraPendenteConclusao, podeAdminForcarConclusaoObra } from '@/lib/obra-permissions'

const STATUS_COR: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#6b7280',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#3b82f6',
  em_andamento:    '#f59e0b',
  concluida:       '#10b981',
  cancelada:       '#9ca3af',
}

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Datas em Aberto',
  datas_em_atraso: 'Datas em Atraso',
  datas_definidas: 'Datas Definidas',
  em_andamento:    'Em Andamento',
  concluida:       'Concluída',
  cancelada:       'Cancelada',
}

interface Props {
  open: boolean
  obra: ObraFull | null
  canEdit: boolean
  canUpload: boolean
  isMontador: boolean
  montadorUserId?: string | null
  actioning: string | null
  onClose: () => void
  onEdit: (obra: ObraFull) => void
  onIniciar: (id: string) => void
  onConcluir: (id: string) => void
  canDelete?: boolean
  onExcluir?: (obra: ObraFull) => void
  canAplicarComissao?: boolean
  applyingComissao?: boolean
  onAplicarComissao?: (obraId: string) => void
  prestadorId?: string | null
  showAllComissao?: boolean
  onUpdateDataEntrega?: (obra: ObraFull, date: string | null) => void
  updatingDataEntrega?: boolean
  onUpdateNumeroPedidoCortClaud?: (obra: ObraFull, numero: string | null) => void
  updatingNumeroPedidoCortClaud?: boolean
  canViewBriefing?: boolean
  canEditBriefing?: boolean
  showMarkupCustos?: boolean
  markupCustos?: MarkupOrcamentoCustos | null
  markupCustosFiltro?: MarkupCustosFiltro
  onMarkupCustosFiltroChange?: (filtro: MarkupCustosFiltro) => void
  montadores?: { id: string; nome?: string | null; email: string; perfil: string }[]
  canEditMontador?: boolean
  onUpdateMontadores?: (obra: ObraFull, montadorIds: string[]) => void
  onUpdateMontadorAdmin?: (obra: ObraFull, montadorAdminId: string | null) => void
  updatingMontadores?: boolean
  leadMidias?: LeadMidia[]
  loadingLeadMidias?: boolean
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">{label}</p>
      <p className="text-sm text-cream mt-0.5">{value}</p>
    </div>
  )
}

export function ObraDetalheModal({
  open, obra, canEdit, canUpload, isMontador, montadorUserId, actioning,
  onClose, onEdit, onIniciar, onConcluir, canDelete = false, onExcluir,
  canAplicarComissao = false, applyingComissao = false, onAplicarComissao,
  prestadorId, showAllComissao = false,
  onUpdateDataEntrega, updatingDataEntrega = false,
  onUpdateNumeroPedidoCortClaud, updatingNumeroPedidoCortClaud = false,
  canViewBriefing = false, canEditBriefing = false,
  showMarkupCustos = false,
  markupCustos = null,
  markupCustosFiltro,
  onMarkupCustosFiltroChange,
  montadores = [],
  canEditMontador = false,
  onUpdateMontadores,
  onUpdateMontadorAdmin,
  updatingMontadores = false,
  leadMidias: leadMidiasProp,
  loadingLeadMidias: loadingLeadMidiasProp,
}: Props) {
  const { roles } = useApp()
  const canViewMontadoresConclusao = canViewMontadoresConclusaoObra(roles)
  const arqHook = useObraArquivos(open && obra ? obra.id : null)
  const evolHook = useObraEvolucao(open && obra ? obra.id : null)
  const precisaBuscarMidias = leadMidiasProp === undefined
  const { midiasByLead, loading: loadingMidiasFetch } = useLeadMidiasPorObras(
    open && obra ? [obra] : [],
    precisaBuscarMidias && open && !!obra,
  )
  const leadMidias = leadMidiasProp ?? (obra ? getObraLeadMidias(obra, midiasByLead) : [])
  const loadingLeadMidias = loadingLeadMidiasProp ?? (precisaBuscarMidias && loadingMidiasFetch)
  const fileRef = useRef<HTMLInputElement>(null)

  const [lightbox, setLightbox]         = useState<{ url: string; pages?: string[]; nome: string; kind: 'image' | 'pdf' | 'video'; arquivoId?: string } | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [uploadErr, setUploadErr]       = useState<string | null>(null)
  const [evolUploadErr, setEvolUploadErr] = useState<string | null>(null)
  const [evolModalOpen, setEvolModalOpen] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadErr(null)
    for (const file of files) {
      if (!isAcceptedObraFile(file)) {
        setUploadErr('Apenas imagens (JPG, PNG, WebP), PDFs e vídeos são aceitos.')
        break
      }
      try {
        await arqHook.upload(file)
      } catch (err) {
        setUploadErr(err instanceof Error ? err.message : 'Erro no upload.')
        break
      }
    }
    e.target.value = ''
  }

  const handleDelete = async (arq: ObraArquivo) => {
    setDeletingId(arq.id)
    try { await arqHook.remove(arq) } finally { setDeletingId(null) }
  }

  const handleEvolSubmit = async (files: File[], observacao: string) => {
    setEvolUploadErr(null)
    try {
      await evolHook.uploadMany(files, observacao || null)
    } catch (err) {
      setEvolUploadErr(err instanceof Error ? err.message : 'Erro no upload.')
      throw err
    }
  }

  const handleEvolDelete = async (item: EvolucaoItemComUrl) => {
    try { await evolHook.remove(item) } catch { /* silencioso */ }
  }

  const diasEvolucao = useMemo(() => {
    if (!obra) return []
    return groupEvolucaoPorDia(
      evolHook.data,
      obra.iniciado_em?.slice(0, 10) ?? obra.data_prevista_inicio,
    )
  }, [evolHook.data, obra])

  if (!obra) return null

  const cor = STATUS_COR[obra.status_kanban]
  const isActioning = actioning === obra.id
  const podeConcluir = obraPendenteConclusao(obra)

  const euSouMontadorNaObra = !!montadorUserId && getObraMontadorIds(obra).includes(montadorUserId)
  const marcacaoIndividual = isMontador || euSouMontadorNaObra
  const adminForcaConclusao = podeAdminForcarConclusaoObra(roles)

  const euIniciei = marcacaoIndividual ? montadorIniciouObra(obra, montadorUserId) : !!obra.iniciado_em
  const euConclui = marcacaoIndividual ? montadorConcluiuObra(obra, montadorUserId) : !!obra.finalizado_em
  const mostrarIniciar = podeConcluir && !euIniciei && (marcacaoIndividual || canEdit) && !adminForcaConclusao
  const mostrarConcluir = podeConcluir && (
    adminForcaConclusao ||
    (!euConclui && (marcacaoIndividual ? euIniciei : true))
  )

  const comissaoItens = getObraComissaoItensVisiveis(obra, {
    prestadorId,
    showAll: showAllComissao,
  })
  const comissaoTotal = sumObraComissao(comissaoItens)
  const podeGerarComissao =
    canAplicarComissao
    && obra.comissao_habilitada
    && !obra.comissao_gerada
    && comissaoTotal > 0

  const diasTrabalhoLabels = getObraDiasTrabalhoLongLabels(obra.dias_trabalho)
  const horarioTrabalho = formatObraHorarioRange(obra.horario_inicio, obra.horario_fim)

  const duracaoHoras = () => {
    if (!obra.iniciado_em || !obra.finalizado_em) return null
    const h = (new Date(obra.finalizado_em).getTime() - new Date(obra.iniciado_em).getTime()) / 3_600_000
    return `${h.toFixed(1)}h`
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="DETALHES DA OBRA" wide>
        {/* Cabeçalho: cliente + status + botão editar */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#f2d892] font-display leading-tight">
              {obra.cliente_nome}
            </h2>
            <span
              className="inline-block mt-1 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide"
              style={{ backgroundColor: `${cor}22`, color: cor, border: `1px solid ${cor}44` }}
            >
              {STATUS_LABEL[obra.status_kanban]}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(obra)}
              className="btn btn-outline btn-sm flex items-center gap-1.5 shrink-0"
            >
              <Pencil size={12} /> Editar
            </button>
          )}
          {canDelete && onExcluir && (
            <button
              type="button"
              disabled={isActioning}
              onClick={() => onExcluir(obra)}
              className="btn btn-outline btn-sm flex items-center gap-1.5 shrink-0 text-red-400 border-red-400/30 hover:bg-red-400/10 disabled:opacity-50"
            >
              {isActioning ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Excluir
            </button>
          )}
          </div>
        </div>

        {/* ── DESCRIÇÃO DO PROJETO ───────────────────────────── */}
        {obra.descricao && (
          <div
            className="mb-5 rounded-lg p-4"
            style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={13} className="text-emerald-400" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-emerald-400">
                Descrição do Projeto
              </p>
            </div>
            <p className="text-sm text-cream leading-relaxed whitespace-pre-wrap">{obra.descricao}</p>
          </div>
        )}

        {canViewBriefing && (
          <div className="mb-5">
            <ObraBriefingSection obraId={obra.id} canEdit={canEditBriefing} />
          </div>
        )}

        {/* ── DIAS E HORÁRIOS DE TRABALHO ───────────────────── */}
        {hasObraDiasHorarios(obra) && (
          <div
            className="mb-5 rounded-lg p-4"
            style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar size={13} className="text-sky-400" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-sky-400">
                Dias e Horários de Trabalho
              </p>
            </div>

            {diasTrabalhoLabels.length > 0 && (
              <div className="mb-3">
                <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4] mb-2">Dias</p>
                <div className="flex flex-wrap gap-1.5">
                  {diasTrabalhoLabels.map(dia => (
                    <span
                      key={dia}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-400/30"
                      style={{ backgroundColor: 'rgba(59,130,246,0.12)' }}
                    >
                      {dia}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {horarioTrabalho && (
              <div className="flex items-center gap-2 flex-wrap">
                <Clock size={13} className="text-sky-400 shrink-0" />
                <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">Horário</p>
                <p className="text-sm text-cream font-medium">{horarioTrabalho}</p>
              </div>
            )}
          </div>
        )}

        {/* ── FOTOS / DOCS DO LEAD (CRM) ─────────────────────── */}
        {(loadingLeadMidias || leadMidias.length > 0) && (
          <div className="mb-5">
            <ObraLeadMidiasStrip
              midias={leadMidias}
              loading={loadingLeadMidias}
              variant="detail"
            />
          </div>
        )}

        {/* ── LOUSA (fotos + anotações) — começa minimizada ── */}
        <div className="mb-5">
          {obra.lousa?.trim() && (
            <div
              className="mb-3 rounded-md p-3"
              style={{ backgroundColor: 'rgba(240,210,140,0.07)', border: '1px solid rgba(240,210,140,0.18)' }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText size={12} className="text-[#edd9c4]" />
                <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
                  Observação do CRM
                </p>
              </div>
              <p className="text-sm text-cream leading-relaxed whitespace-pre-wrap">{obra.lousa}</p>
            </div>
          )}

          <ObraLousa
            obraId={obra.id}
            open={open}
            canEdit={canUpload || isMontador}
            embedded
            onExported={() => { void arqHook.reload() }}
          />
        </div>

        {/* ── CUSTOS MARKUP (Administrador) ───────────────────── */}
        {showMarkupCustos && markupCustos && (
          <div className="mb-5">
            <ObraMarkupCustosBlock
              custos={markupCustos}
              filtro={markupCustosFiltro}
              onFiltroChange={onMarkupCustosFiltroChange}
              variant="default"
            />
          </div>
        )}

        {/* ── CHEGADA DO MATERIAL ────────────────────────────── */}
        {obra.pedido_material_feito && (
          <div className="mb-5 flex flex-col gap-2">
            <ObraDataEntregaInput
              obra={obra}
              canEdit={canEdit}
              loading={updatingDataEntrega}
              onChange={date => onUpdateDataEntrega?.(obra, date)}
            />
            <ObraNumeroPedidoCortClaudInput
              obra={obra}
              canEdit={canEdit}
              loading={updatingNumeroPedidoCortClaud}
              onChange={numero => onUpdateNumeroPedidoCortClaud?.(obra, numero)}
            />
          </div>
        )}

        {/* ── DETALHES ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
          <Campo label="Tipo de Obra"    value={obra.tipo_obra_nome} />
          <Campo label="Grupo de Obra"   value={obra.grupo_obra_nome} />
          <Campo label="Endereço"        value={obra.endereco_obra} />
          {montadores.length > 0 ? (
            <div className="col-span-2">
              <ObraMontadoresAjudantesField
                obra={obra}
                montadores={montadores}
                canEdit={canEditMontador && !!onUpdateMontadores}
                loading={updatingMontadores}
                onChange={ids => onUpdateMontadores?.(obra, ids)}
                onChangeAdmin={
                  onUpdateMontadorAdmin
                    ? adminId => onUpdateMontadorAdmin(obra, adminId)
                    : undefined
                }
              />
            </div>
          ) : (
            <>
              <Campo label="Montadores" value={getMontadorResponsavelDisplay(obra)} />
              <Campo label="Montador Admin" value={obra.montador_admin_nome} />
            </>
          )}
          {obra.tempo_maximo_horas != null && (
            <Campo label="Prazo Máximo"  value={`${Number(obra.tempo_maximo_horas)}h`} />
          )}
          {(obra.data_prevista_inicio || obra.data_prevista_fim) && (
            <div className="col-span-2">
              <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">Período Previsto</p>
              <p className="text-sm text-cream mt-0.5">
                {obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'}
                {' → '}
                {obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'}
              </p>
            </div>
          )}
          {obra.iniciado_em && (
            <Campo label="Iniciada em" value={fmtDate(obra.iniciado_em.slice(0, 10))} />
          )}
          {obra.finalizado_em && (
            <Campo label="Finalizada em" value={fmtDate(obra.finalizado_em.slice(0, 10))} />
          )}
          {duracaoHoras() && (
            <Campo label="Duração Real" value={duracaoHoras()!} />
          )}
          {obra.concluido_em_atraso && (
            <div className="col-span-2">
              <p className="text-sm font-semibold text-red-400">Concluída em atraso</p>
            </div>
          )}
        </div>

        <div className="mb-5">
          <ObraMontadoresConclusao obra={obra} visible={canViewMontadoresConclusao} />
        </div>

        {obra.comissao_habilitada && comissaoItens.length > 0 && (
          <div
            className="mb-5 rounded-lg p-4"
            style={{ backgroundColor: 'rgba(240,210,140,0.06)', border: '1px solid rgba(240,210,140,0.2)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Banknote size={13} className="text-[#f2d892]" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892]">
                Comissão
                {obra.comissao_gerada && (
                  <span className="ml-2 text-emerald-400 normal-case">· Pagamentos gerados</span>
                )}
              </p>
            </div>
            <ul className="space-y-1 mb-2">
              {comissaoItens.map(item => (
                <li key={item.prestador_id} className="flex justify-between text-sm text-cream gap-3">
                  <span className="truncate">{item.prestador_nome ?? 'Montador'}</span>
                  <span className="font-mono text-[#f2d892] shrink-0">{fmtCur(item.valor)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold text-[#f2d892]">
              Total: {fmtCur(comissaoTotal)}
            </p>
            {podeGerarComissao && onAplicarComissao && (
              <button
                type="button"
                disabled={applyingComissao}
                onClick={() => {
                  if (!confirm('Gerar pagamentos de comissão em Contas a Pagar para os prestadores?')) return
                  onAplicarComissao(obra.id)
                }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-[#f2d892]/15 text-[#f2d892] hover:bg-[#f2d892]/25 transition-colors disabled:opacity-50"
              >
                {applyingComissao
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Banknote size={14} />
                }
                Gerar pagamentos de comissão
              </button>
            )}
          </div>
        )}

        {/* ── AÇÕES INICIAR/CONCLUIR ─────────────────────────── */}
        {(marcacaoIndividual || canEdit) && (mostrarIniciar || mostrarConcluir) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {mostrarIniciar && (
              <button
                disabled={isActioning}
                onClick={() => onIniciar(obra.id)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
              >
                {isActioning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Iniciar Obra
              </button>
            )}
            {mostrarConcluir && (
              <button
                disabled={isActioning}
                onClick={() => onConcluir(obra.id)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-50"
              >
                {isActioning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Marcar como Concluída
              </button>
            )}
          </div>
        )}

        {/* ── EVOLUÇÃO DA OBRA (DIÁRIO) ───────────────────────── */}
        <div className="border-t border-[rgba(240,210,140,0.12)] pt-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-[#f2d892]" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892]">
                Evolução da Obra (Diário)
                {evolHook.data.length > 0 && (
                  <span className="ml-2 text-[#edd9c4] normal-case font-normal">
                    ({evolHook.data.length})
                  </span>
                )}
              </p>
            </div>
            {(isMontador || canUpload) && (
              <button
                onClick={() => setEvolModalOpen(true)}
                disabled={evolHook.uploading}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
              >
                {evolHook.uploading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Camera size={12} />
                }
                {evolHook.uploading ? 'Enviando...' : 'Registrar Progresso'}
              </button>
            )}
          </div>

          {evolUploadErr && (
            <p className="text-xs text-red-400 mb-2">{evolUploadErr}</p>
          )}

          {evolHook.loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[#edd9c4]">
              <Loader2 size={14} className="animate-spin" /> Carregando evolução...
            </div>
          ) : evolHook.data.length === 0 ? (
            <p className="text-xs text-[#d4bc9f] py-4 bg-black/20 rounded-lg text-center border border-dashed border-[rgba(240,210,140,0.1)]">
              {isMontador || canUpload ? 'Nenhum progresso registrado. Use o botão acima para enviar fotos, vídeos ou observações do que foi feito.' : 'Nenhum progresso registrado.'}
            </p>
          ) : (
            <div className="space-y-5">
              {diasEvolucao.map(dia => (
                <div
                  key={dia.data}
                  className="relative pl-5 border-l border-[rgba(240,210,140,0.22)]"
                >
                  <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-[#f2d892] shadow-[0_0_8px_rgba(240,210,140,0.45)]" />

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-sm font-bold text-[#f2d892] font-display tracking-wide">
                      Dia {String(dia.diaNumero).padStart(2, '0')}
                    </span>
                    <span className="flex items-center gap-1 text-[0.68rem] text-[#edd9c4]">
                      <Calendar size={11} />
                      {fmtDate(dia.data)}
                    </span>
                    <span className="text-[0.62rem] text-[#d4bc9f]">
                      · {dia.fotos.length} registro{dia.fotos.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {dia.fotos.map(item => (
                      item.kind === 'text' ? (
                        <div
                          key={item.id}
                          className="relative min-w-[min(100%,16rem)] max-w-full flex-1 rounded-lg border border-[rgba(240,210,140,0.18)] bg-black/25 p-3"
                        >
                          <div className="mb-2 flex items-center gap-1.5 text-[#f2d892]">
                            <MessageSquareText size={13} />
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Observação</span>
                          </div>
                          {item.observacao?.trim() && (
                            <EvolucaoObservacao
                              texto={item.observacao.trim()}
                              className="text-[0.75rem] text-[#c4a882]"
                            />
                          )}
                          {(isMontador || canUpload) && (
                            <button
                              type="button"
                              onClick={() => handleEvolDelete(item)}
                              className="absolute right-2 top-2 rounded p-1 text-[#edd9c4] hover:bg-red-500/10 hover:text-red-400"
                              aria-label="Excluir observação"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ) : (
                      <div key={item.id} className="flex max-w-[140px] flex-col gap-1.5">
                        <AnexoThumb
                          previewUrl={item.previewSignedUrl ?? item.signedUrl ?? ''}
                          nome={item.nome_arquivo}
                          kind={item.kind}
                          onOpenFullscreen={() => {
                            const pages = evolucaoLightboxPages(item)
                            if (!pages.length) return
                            setLightbox({ url: pages[0], pages, nome: item.nome_arquivo, kind: item.kind })
                          }}
                          onDelete={(isMontador || canUpload) ? () => handleEvolDelete(item) : undefined}
                        />
                        {item.observacao?.trim() && (
                          <EvolucaoObservacao
                            texto={item.observacao.trim()}
                            className="text-[0.62rem] text-[#c4a882]"
                          />
                        )}
                      </div>
                      )
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FOTOS E DOCUMENTOS ─────────────────────────────── */}
        <div className="border-t border-[rgba(240,210,140,0.12)] pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892]">
              Fotos e Documentos
              {arqHook.data.length > 0 && (
                <span className="ml-2 text-[#edd9c4] normal-case font-normal">
                  ({arqHook.data.length})
                </span>
              )}
            </p>
            {canUpload && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={arqHook.uploading}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[rgba(240,210,140,0.12)] text-[#f2d892] hover:bg-[rgba(240,210,140,0.22)] transition-colors disabled:opacity-50"
                >
                  {arqHook.uploading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Upload size={12} />
                  }
                  {arqHook.uploading ? 'Enviando...' : 'Adicionar'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>

          {uploadErr && (
            <p className="text-xs text-red-400 mb-2">{uploadErr}</p>
          )}

          {arqHook.loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[#edd9c4]">
              <Loader2 size={14} className="animate-spin" /> Carregando arquivos...
            </div>
          ) : arqHook.data.length === 0 ? (
            <p className="text-xs text-[#d4bc9f] py-4">
              {canUpload ? 'Nenhum arquivo. Clique em "Adicionar" para enviar fotos, PDFs ou vídeos.' : 'Nenhum arquivo enviado.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {arqHook.data.map(arq => (
                <AnexoThumb
                  key={arq.id}
                  previewUrl={arq.previewSignedUrl ?? arq.signedUrl ?? ''}
                  nome={arq.nome_arquivo}
                  kind={arq.kind}
                  onOpenFullscreen={() => {
                    const pages = obraArquivoLightboxPages(arq)
                    if (!pages.length) return
                    setLightbox({ url: pages[0], pages, nome: arq.nome_arquivo, kind: arq.kind, arquivoId: arq.id })
                  }}
                  onDelete={canUpload ? () => handleDelete(arq) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ObraEvolucaoRegistrarModal
        open={evolModalOpen}
        uploading={evolHook.uploading}
        onClose={() => setEvolModalOpen(false)}
        onSubmit={handleEvolSubmit}
      />

      {lightbox && (
        <AnexoLightbox
          open
          imageUrl={lightbox.url}
          pages={lightbox.pages}
          title={lightbox.nome}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
          onDelete={canUpload && lightbox.arquivoId
            ? () => {
                const arq = arqHook.data.find(a => a.id === lightbox.arquivoId)
                if (!arq) return
                setLightbox(null)
                void handleDelete(arq)
              }
            : undefined
          }
          deleting={!!deletingId}
        />
      )}
    </>
  )
}
