import { useRef } from 'react'
import { Upload, X, FileText, Image } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { ObraMontadoresField } from '@/components/obras/ObraMontadoresField'
import { isAcceptedObraFile } from '@/lib/obra-arquivos'
import type { ObraFull, ObraInput, StatusKanbanObra } from '@/types'

const COLUNAS: { key: StatusKanbanObra; label: string }[] = [
  { key: 'datas_em_aberto', label: 'Datas em Aberto' },
  { key: 'datas_em_atraso', label: 'Datas em Atraso' },
  { key: 'datas_definidas', label: 'Datas Definidas' },
  { key: 'em_andamento',    label: 'Em Andamento' },
  { key: 'concluida',       label: 'Concluída' },
  { key: 'cancelada',       label: 'Cancelada' },
]

export interface PendingFile {
  file: File
  previewUrl: string | null
}

interface ObraFormModalProps {
  open: boolean
  obra: ObraFull | null
  form: ObraInput
  onChange: (k: keyof ObraInput, v: string | null | number | string[] | boolean) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  tipos: { id: string; nome: string }[]
  grupos: { id: string; nome: string }[]
  montadores: { id: string; nome?: string | null; email: string; perfil: string }[]
  canEditDates: boolean
  canEditMontador: boolean
  isAdmin: boolean
  // arquivos pendentes (só em criação)
  pendingFiles: PendingFile[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  // rascunho
  isDraftRestored?: boolean
  onClearDraft?: () => void
}

export function ObraFormModal({
  open, obra, form, onChange, onClose, onSave, saving,
  tipos, grupos, montadores, canEditDates, canEditMontador, isAdmin,
  pendingFiles, onAddFiles, onRemoveFile,
  isDraftRestored, onClearDraft,
}: ObraFormModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

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
    <Modal open={open} onClose={onClose} title={obra ? 'EDITAR OBRA' : 'NOVA OBRA'}>
      {isDraftRestored && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.07)] px-3 py-2">
          <span className="text-[0.72rem] text-[#d4a853]">Rascunho restaurado — continue de onde parou</span>
          <button
            type="button"
            onClick={onClearDraft}
            className="text-[0.68rem] text-[#8a6a55] hover:text-red-400 transition-colors ml-3 shrink-0"
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
            <input type="date" className="glass-input" value={form.data_prevista_inicio ?? ''} onChange={s('data_prevista_inicio')} />
          </Field>
          <Field label="Término Previsto">
            <input type="date" className="glass-input" value={form.data_prevista_fim ?? ''} onChange={s('data_prevista_fim')} />
          </Field>
          <Field label="Prazo Máximo (horas)">
            <input
              type="number" min={0} className="glass-input"
              value={form.tempo_maximo_horas ?? ''}
              onChange={e => onChange('tempo_maximo_horas', e.target.value ? Number(e.target.value) : null)}
              placeholder="Ex: 48"
            />
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

      <Field label="Pedido de Material">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#4ade80]"
            checked={form.pedido_material_feito ?? false}
            onChange={e => onChange('pedido_material_feito', e.target.checked)}
          />
          <span className="text-sm text-[#f4e4d6]">Confirmação de pedido de material feito</span>
        </label>
      </Field>

      {/* ── Fotos e Documentos (apenas na criação) ───────────── */}
      {!obra && (
        <Field label="Fotos e Documentos">
          {/* Zona de drop */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.04)] px-4 py-4 text-center cursor-pointer transition-colors hover:border-[rgba(212,168,83,0.55)] hover:bg-[rgba(212,168,83,0.08)]"
          >
            <Upload size={18} className="text-[#d4a853] opacity-70" />
            <p className="text-[0.75rem] text-[#8a6a55]">
              Arraste arquivos ou <span className="text-[#d4a853] font-semibold">clique para selecionar</span>
            </p>
            <p className="text-[0.65rem] text-[#6b5544]">JPG, PNG, WebP, PDF</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Lista de arquivos pendentes */}
          {pendingFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pendingFiles.map((pf, i) => (
                <div
                  key={i}
                  className="relative flex items-center gap-2 rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(0,0,0,0.25)] px-2 py-1.5 pr-7 max-w-[200px]"
                >
                  {pf.previewUrl ? (
                    <img
                      src={pf.previewUrl}
                      alt={pf.file.name}
                      className="w-8 h-8 rounded object-cover shrink-0"
                    />
                  ) : (
                    <FileText size={20} className="text-[#d4a853] shrink-0" />
                  )}
                  <span className="text-[0.7rem] text-[#c4a882] truncate leading-tight">
                    {pf.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onRemoveFile(i) }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8a6a55] hover:text-red-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Field>
      )}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={onSave}
        submitting={saving}
        submitLabel={obra ? 'Salvar' : (pendingFiles.length > 0 ? `Criar e enviar ${pendingFiles.length} arquivo${pendingFiles.length > 1 ? 's' : ''}` : 'Criar')}
      />
    </Modal>
  )
}
