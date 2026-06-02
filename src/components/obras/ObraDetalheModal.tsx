import { useRef, useState, useMemo } from 'react'
import { Upload, Loader2, Pencil, Play, CheckCircle, FileText, Camera, Trash2, Calendar } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { AnexoThumb, AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { useObraArquivos, type ObraArquivo } from '@/hooks/useObraArquivos'
import { useObraEvolucao } from '@/hooks/useObraEvolucao'
import { isAcceptedObraFile } from '@/lib/obra-arquivos'
import { isAcceptedEvolucaoFile, groupEvolucaoPorDia } from '@/lib/obra-evolucao'
import { getMontadorResponsavelDisplay } from '@/lib/obra-montador'
import type { EvolucaoItemComUrl } from '@/lib/obra-evolucao'
import type { ObraFull, StatusKanbanObra } from '@/types'
import { fmtDate } from '@/lib/utils'

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
  actioning: string | null
  onClose: () => void
  onEdit: (obra: ObraFull) => void
  onIniciar: (id: string) => void
  onConcluir: (id: string) => void
  canDelete?: boolean
  onExcluir?: (obra: ObraFull) => void
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wider text-[#8a6a55]">{label}</p>
      <p className="text-sm text-cream mt-0.5">{value}</p>
    </div>
  )
}

export function ObraDetalheModal({
  open, obra, canEdit, canUpload, isMontador, actioning,
  onClose, onEdit, onIniciar, onConcluir, canDelete = false, onExcluir,
}: Props) {
  const arqHook = useObraArquivos(open && obra ? obra.id : null)
  const evolHook = useObraEvolucao(open && obra ? obra.id : null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const evolFileRef = useRef<HTMLInputElement>(null)

  const [lightbox, setLightbox]         = useState<{ url: string; nome: string; canDelete?: boolean; onDelete?: () => void } | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [uploadErr, setUploadErr]       = useState<string | null>(null)
  const [evolUploadErr, setEvolUploadErr] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadErr(null)
    for (const file of files) {
      if (!isAcceptedObraFile(file)) {
        setUploadErr('Apenas imagens (JPG, PNG, WebP) e PDFs são aceitos.')
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

  const handleEvolFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setEvolUploadErr(null)
    for (const file of files) {
      if (!isAcceptedEvolucaoFile(file)) {
        setEvolUploadErr('Apenas imagens (JPG, PNG, WebP) e PDFs são aceitos.')
        break
      }
      try {
        await evolHook.upload(file)
      } catch (err) {
        setEvolUploadErr(err instanceof Error ? err.message : 'Erro no upload.')
        break
      }
    }
    e.target.value = ''
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
  const podeConcluir =
    obra.status_kanban !== 'concluida' &&
    obra.status_kanban !== 'cancelada' &&
    !obra.finalizado_em

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
            <h2 className="text-xl font-bold text-[#d4a853] font-display leading-tight">
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
              onClick={() => { onClose(); setTimeout(() => onEdit(obra), 80) }}
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

        {/* ── LOUSA ──────────────────────────────────────────── */}
        {obra.lousa && (
          <div
            className="mb-5 rounded-lg p-4"
            style={{ backgroundColor: 'rgba(212,168,83,0.07)', border: '1px solid rgba(212,168,83,0.18)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={13} className="text-[#d4a853]" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#d4a853]">
                Lousa (CRM)
              </p>
            </div>
            <p className="text-sm text-cream leading-relaxed whitespace-pre-wrap">{obra.lousa}</p>
          </div>
        )}

        {/* ── DETALHES ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
          <Campo label="Tipo de Obra"    value={obra.tipo_obra_nome} />
          <Campo label="Grupo de Obra"   value={obra.grupo_obra_nome} />
          <Campo label="Endereço"        value={obra.endereco_obra} />
          <Campo label="Montador"        value={getMontadorResponsavelDisplay(obra)} />
          <Campo label="Montador Admin"  value={obra.montador_admin_nome} />
          {obra.tempo_maximo_horas != null && (
            <Campo label="Prazo Máximo"  value={`${Number(obra.tempo_maximo_horas)}h`} />
          )}
          {(obra.data_prevista_inicio || obra.data_prevista_fim) && (
            <div className="col-span-2">
              <p className="text-[0.65rem] uppercase tracking-wider text-[#8a6a55]">Período Previsto</p>
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

        {/* ── AÇÕES INICIAR/CONCLUIR ─────────────────────────── */}
        {(isMontador || canEdit) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {!obra.iniciado_em && podeConcluir && (
              <button
                disabled={isActioning}
                onClick={() => onIniciar(obra.id)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
              >
                {isActioning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Iniciar Obra
              </button>
            )}
            {podeConcluir && (
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
        <div className="border-t border-[rgba(212,168,83,0.12)] pt-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-[#d4a853]" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#d4a853]">
                Evolução da Obra (Diário)
                {evolHook.data.length > 0 && (
                  <span className="ml-2 text-[#8a6a55] normal-case font-normal">
                    ({evolHook.data.length})
                  </span>
                )}
              </p>
            </div>
            {(isMontador || canUpload) && (
              <>
                <button
                  onClick={() => evolFileRef.current?.click()}
                  disabled={evolHook.uploading}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
                >
                  {evolHook.uploading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Camera size={12} />
                  }
                  {evolHook.uploading ? 'Enviando...' : 'Registrar Progresso'}
                </button>
                <input
                  ref={evolFileRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
                  className="hidden"
                  onChange={handleEvolFileChange}
                />
              </>
            )}
          </div>

          {evolUploadErr && (
            <p className="text-xs text-red-400 mb-2">{evolUploadErr}</p>
          )}

          {evolHook.loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[#8a6a55]">
              <Loader2 size={14} className="animate-spin" /> Carregando evolução...
            </div>
          ) : evolHook.data.length === 0 ? (
            <p className="text-xs text-[#6b5544] py-4 bg-black/20 rounded-lg text-center border border-dashed border-[rgba(212,168,83,0.1)]">
              {isMontador || canUpload ? 'Nenhum progresso registrado. Use o botão acima para tirar fotos do que foi feito.' : 'Nenhum progresso registrado.'}
            </p>
          ) : (
            <div className="space-y-5">
              {diasEvolucao.map(dia => (
                <div
                  key={dia.data}
                  className="relative pl-5 border-l border-[rgba(212,168,83,0.22)]"
                >
                  <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-[#d4a853] shadow-[0_0_8px_rgba(212,168,83,0.45)]" />

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-sm font-bold text-[#d4a853] font-display tracking-wide">
                      Dia {String(dia.diaNumero).padStart(2, '0')}
                    </span>
                    <span className="flex items-center gap-1 text-[0.68rem] text-[#8a6a55]">
                      <Calendar size={11} />
                      {fmtDate(dia.data)}
                    </span>
                    <span className="text-[0.62rem] text-[#6b5544]">
                      · {dia.fotos.length} foto{dia.fotos.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {dia.fotos.map(item => (
                      <AnexoThumb
                        key={item.id}
                        previewUrl={item.previewSignedUrl ?? item.signedUrl ?? ''}
                        nome={item.nome_arquivo}
                        kind={item.kind}
                        onOpenFullscreen={() => {
                          if (item.signedUrl) setLightbox({ url: item.signedUrl, nome: item.nome_arquivo })
                        }}
                        onDelete={(isMontador || canUpload) ? () => handleEvolDelete(item) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FOTOS E DOCUMENTOS ─────────────────────────────── */}
        <div className="border-t border-[rgba(212,168,83,0.12)] pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#d4a853]">
              Fotos e Documentos
              {arqHook.data.length > 0 && (
                <span className="ml-2 text-[#8a6a55] normal-case font-normal">
                  ({arqHook.data.length})
                </span>
              )}
            </p>
            {canUpload && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={arqHook.uploading}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[rgba(212,168,83,0.12)] text-[#d4a853] hover:bg-[rgba(212,168,83,0.22)] transition-colors disabled:opacity-50"
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
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
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
            <div className="flex items-center gap-2 py-4 text-xs text-[#8a6a55]">
              <Loader2 size={14} className="animate-spin" /> Carregando arquivos...
            </div>
          ) : arqHook.data.length === 0 ? (
            <p className="text-xs text-[#6b5544] py-4">
              {canUpload ? 'Nenhum arquivo. Clique em "Adicionar" para enviar fotos ou PDFs.' : 'Nenhum arquivo enviado.'}
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
                    if (arq.signedUrl) setLightbox({ url: arq.signedUrl, nome: arq.nome_arquivo })
                  }}
                  onDelete={canUpload ? () => handleDelete(arq) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      {lightbox && (
        <AnexoLightbox
          open
          imageUrl={lightbox.url}
          title={lightbox.nome}
          onClose={() => setLightbox(null)}
          onDelete={canUpload && arqHook.data.find(a => a.signedUrl === lightbox.url)
            ? () => {
                const arq = arqHook.data.find(a => a.signedUrl === lightbox.url)!
                setLightbox(null)
                handleDelete(arq)
              }
            : undefined
          }
          deleting={!!deletingId}
        />
      )}
    </>
  )
}
