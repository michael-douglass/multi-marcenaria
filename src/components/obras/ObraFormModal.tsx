import { useRef, useState, type ReactNode } from 'react'
import { Upload, Clock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { DateInput } from '@/components/ui/DateInput'
import { TimeInput } from '@/components/ui/TimeInput'
import { ObraMontadoresField } from '@/components/obras/ObraMontadoresField'
import { ObraComissaoField } from '@/components/obras/ObraComissaoField'
import { ObraLousa } from '@/components/obras/lousa/ObraLousa'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { isAcceptedObraFile, type PendingObraArquivo } from '@/lib/obra-arquivos'
import type { ObraComissaoItem, ObraFull, ObraInput, StatusKanbanObra } from '@/types'

const WEEKDAYS_FORM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const COLUNAS: { key: StatusKanbanObra; label: string }[] = [
  { key: 'datas_em_aberto', label: 'Datas em Aberto' },
  { key: 'datas_em_atraso', label: 'Datas em Atraso' },
  { key: 'datas_definidas', label: 'Datas Definidas' },
  { key: 'em_andamento',    label: 'Em Andamento' },
  { key: 'concluida',       label: 'Concluída' },
  { key: 'cancelada',       label: 'Cancelada' },
]

export interface PendingFile extends PendingObraArquivo {}

interface ObraFormModalProps {
  open: boolean
  obra: ObraFull | null
  form: ObraInput
  onChange: (k: keyof ObraInput, v: string | null | number | string[] | boolean | ObraComissaoItem[]) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  tipos: { id: string; nome: string }[]
  grupos: { id: string; nome: string }[]
  montadores: { id: string; nome?: string | null; email: string; perfil: string }[]
  canEditDates: boolean
  canEditMontador: boolean
  isAdmin: boolean
  canEditComissao?: boolean
  // arquivos pendentes (só em criação)
  pendingFiles: PendingObraArquivo[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (localId: string) => void
  // rascunho
  isDraftRestored?: boolean
  onClearDraft?: () => void
  obraBriefingSection?: ReactNode
  /** Permite anexar/riscar na Lousa ao editar uma obra existente */
  canEditLousa?: boolean
}

export function ObraFormModal({
  open, obra, form, onChange, onClose, onSave, saving,
  tipos, grupos, montadores, canEditDates, canEditMontador, isAdmin, canEditComissao = false,
  pendingFiles, onAddFiles, onRemoveFile,
  isDraftRestored, onClearDraft,
  obraBriefingSection,
  canEditLousa = true,
}: ObraFormModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewFile, setPreviewFile] = useState<PendingObraArquivo | null>(null)

  const s = (k: keyof ObraInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange(k, e.target.value || null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(isAcceptedObraFile)
    if (files.length) onAddFiles(files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(isAcceptedObraFile)
    if (files.length) onAddFiles(files)
  }

  return (
    <Modal open={open} onClose={onClose} title={obra ? 'EDITAR OBRA' : 'NOVA OBRA'} wide={!!obra}>
      {isDraftRestored && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(240,210,140,0.07)] px-3 py-2">
          <span className="text-[0.72rem] text-[#f2d892]">Rascunho restaurado — continue de onde parou</span>
          <button
            type="button"
            onClick={onClearDraft}
            className="text-[0.68rem] text-[#edd9c4] hover:text-red-400 transition-colors ml-3 shrink-0"
          >
            Limpar
          </button>
        </div>
      )}
      <Field label="Cliente *">
        <input className="glass-input" value={form.cliente_nome} onChange={s('cliente_nome')} placeholder="Nome do cliente" />
      </Field>
      <Field label="Endereço da Obra">
        <input className="glass-input" value={form.endereco_obra ?? ''} onChange={s('endereco_obra')} placeholder="Rua, número, bairro..." />
      </Field>

      {/* Descrição do Projeto — visível para montadores */}
      <Field label="Descrição do Projeto">
        <textarea
          className="glass-input resize-none"
          rows={3}
          value={form.descricao ?? ''}
          onChange={s('descricao')}
          placeholder="Descreva detalhes do projeto, materiais, observações importantes para os montadores..."
        />
      </Field>

      {obraBriefingSection}

      {/* Lousa — só ao editar obra já criada (precisa do id); começa minimizada */}
      {obra && (
        <div className="mb-4">
          <ObraLousa
            obraId={obra.id}
            open={open}
            canEdit={canEditLousa}
            embedded
          />
        </div>
      )}

      {isAdmin && (
        <>
          <Field label="Tipo de Obra">
            <select className="glass-input" value={form.tipo_obra_id ?? ''} onChange={s('tipo_obra_id')}>
              <option value="">— Selecione —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Grupo de Obra">
            <select className="glass-input" value={form.grupo_obra_id ?? ''} onChange={s('grupo_obra_id')}>
              <option value="">— Selecione —</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </Field>
        </>
      )}

      {canEditMontador && (
        <>
          <Field label="Montadores Responsáveis">
            <ObraMontadoresField
              montadores={montadores}
              selectedIds={form.montador_ids ?? []}
              onChange={ids => onChange('montador_ids', ids)}
            />
          </Field>
          <Field label="Montador Admin">
            <select className="glass-input" value={form.montador_admin_id ?? ''} onChange={s('montador_admin_id')}>
              <option value="">— Nenhum —</option>
              {montadores.filter(m => m.perfil === 'montador_admin').map(m => (
                <option key={m.id} value={m.id}>{m.nome ?? m.email}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      {canEditDates && (
        <>
          <Field label="Início Previsto">
            <DateInput
              className="glass-input"
              value={form.data_prevista_inicio}
              onChange={v => onChange('data_prevista_inicio', v)}
            />
          </Field>
          <Field label="Término Previsto">
            <DateInput
              className="glass-input"
              value={form.data_prevista_fim}
              onChange={v => onChange('data_prevista_fim', v)}
            />
          </Field>
          <Field label="Prazo Máximo (horas)">
            <input
              type="number" min={0} className="glass-input"
              value={form.tempo_maximo_horas ?? ''}
              onChange={e => onChange('tempo_maximo_horas', e.target.value ? Number(e.target.value) : null)}
              placeholder="Ex: 48"
            />
          </Field>

          {/* ── Dias e Horários de Trabalho ─────────────────── */}
          <Field label="Dias de Trabalho">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS_FORM.map((wd, idx) => {
                  const dias  = form.dias_trabalho ?? []
                  const ativo = dias.includes(idx)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const next = ativo
                          ? dias.filter(d => d !== idx)
                          : [...dias, idx].sort((a, b) => a - b)
                        onChange('dias_trabalho', next.length > 0 ? next : null)
                      }}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-bold transition-all',
                        ativo
                          ? 'bg-[#f2d892]/20 text-[#f2d892] border border-[#f2d892]/50'
                          : 'bg-[rgba(240,210,140,0.04)] text-[#d4bc9f] border border-[rgba(240,210,140,0.1)]',
                      ].join(' ')}
                    >
                      {wd}
                    </button>
                  )
                })}
              </div>

              {(form.dias_trabalho ?? []).length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Clock size={13} className="text-[#f2d892] shrink-0" />
                  <span className="text-[0.72rem] text-[#edd9c4] shrink-0">Horário:</span>
                  <TimeInput
                    className="glass-input !py-1 !px-2 w-[100px] text-xs"
                    value={form.horario_inicio}
                    onChange={v => onChange('horario_inicio', v)}
                  />
                  <span className="text-[#edd9c4] text-xs">→</span>
                  <TimeInput
                    className="glass-input !py-1 !px-2 w-[100px] text-xs"
                    value={form.horario_fim}
                    onChange={v => onChange('horario_fim', v)}
                  />
                </div>
              )}
            </div>
          </Field>
        </>
      )}

      {isAdmin && (
        <Field label="Status">
          <select className="glass-input" value={form.status_kanban ?? 'datas_em_aberto'} onChange={s('status_kanban')}>
            {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
      )}

      {canEditComissao && (
        <ObraComissaoField
          obra={obra}
          habilitada={form.comissao_habilitada ?? false}
          itens={form.comissao_itens ?? []}
          montadorIds={form.montador_ids ?? []}
          montadores={montadores}
          locked={!!obra?.comissao_gerada}
          onHabilitadaChange={v => onChange('comissao_habilitada', v)}
          onItensChange={itens => onChange('comissao_itens', itens)}
        />
      )}

      <Field label="Pedido de Material">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#4ade80]"
            checked={form.pedido_material_feito ?? false}
            onChange={e => onChange('pedido_material_feito', e.target.checked)}
          />
          <span className="text-sm text-[#fffaf4]">Confirmação de pedido de material feito</span>
        </label>
      </Field>

      {form.pedido_material_feito && (
        <>
          <Field label="Chegada Material">
            <DateInput
              className="glass-input"
              value={form.data_entrega_pedido}
              onChange={v => onChange('data_entrega_pedido', v)}
              disabled={!canEditDates}
            />
          </Field>
          <Field label="Nº Pedido Cort Claud">
            <input
              type="text"
              className="glass-input"
              value={form.numero_pedido_cort_claud ?? ''}
              onChange={s('numero_pedido_cort_claud')}
              disabled={!canEditDates}
              placeholder="Ex: 12345"
            />
          </Field>
        </>
      )}

      {/* ── Fotos e Documentos (apenas na criação) ───────────── */}
      {!obra && (
        <Field label="Fotos e Documentos">
          {/* Zona de drop */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(240,210,140,0.3)] bg-[rgba(240,210,140,0.04)] px-4 py-4 text-center cursor-pointer transition-colors hover:border-[rgba(240,210,140,0.55)] hover:bg-[rgba(240,210,140,0.08)]"
          >
            <Upload size={18} className="text-[#f2d892] opacity-70" />
            <p className="text-[0.75rem] text-[#edd9c4]">
              Arraste arquivos ou <span className="text-[#f2d892] font-semibold">clique para selecionar</span>
            </p>
            <p className="text-[0.65rem] text-[#d4bc9f]">JPG, PNG, WebP, PDF, Vídeos · PDFs: todas as páginas viram imagem</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Lista de arquivos pendentes */}
          {pendingFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {pendingFiles.map(pf => (
                <AnexoThumb
                  key={pf.localId}
                  previewUrl={pf.previewUrl}
                  nome={pf.nome}
                  kind={pf.kind}
                  onOpenFullscreen={() => {
                    if (pf.previewUrl || pf.kind === 'video') setPreviewFile(pf)
                  }}
                  onDelete={() => onRemoveFile(pf.localId)}
                />
              ))}
            </div>
          )}
        </Field>
      )}

      <AnexoLightbox
        open={!!previewFile && !!(previewFile.previewUrl || previewFile.kind === 'video')}
        imageUrl={previewFile?.previewUrl ?? ''}
        pages={previewFile?.previewUrls}
        title={previewFile?.nome ?? ''}
        kind={previewFile?.kind ?? 'image'}
        onClose={() => setPreviewFile(null)}
      />

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={onSave}
        submitting={saving}
        submitLabel={obra ? 'Salvar' : (pendingFiles.length > 0 ? `Criar e enviar ${pendingFiles.length} arquivo${pendingFiles.length > 1 ? 's' : ''}` : 'Criar')}
      />
    </Modal>
  )
}
