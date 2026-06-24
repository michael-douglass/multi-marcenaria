import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import type { BriefingModelo, BriefingPerguntaInput, BriefingPerguntaTipo } from '@/types'
import type { useBriefingModelos } from '@/hooks/useBriefingModelos'

const TIPOS: { value: BriefingPerguntaTipo; label: string }[] = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'desenho', label: 'Desenho' },
  { value: 'fotos', label: 'Fotos' },
  { value: 'videos', label: 'Vídeos' },
  { value: 'pdf', label: 'PDF' },
]

const BLANK_MODELO = { nome: '', descricao: '', ordem: 0, ativo: true }

const BLANK_PERGUNTA: BriefingPerguntaInput = {
  modelo_id: '',
  enunciado: '',
  tipo: 'texto',
  opcoes: null,
  obrigatoria: false,
  texto_ajuda: null,
  unidade_padrao: null,
  ordem: 0,
  ativo: true,
}

type PerguntaRow = NonNullable<BriefingModelo['perguntas']>[number]

interface BriefingModeloEditorProps {
  modelos: BriefingModelo[]
  hook: ReturnType<typeof useBriefingModelos>
  canEdit?: boolean
  canDelete: boolean
  loading?: boolean
  error?: string | null
}

interface PerguntaFormProps {
  title: string
  perguntaForm: BriefingPerguntaInput
  setPerguntaForm: React.Dispatch<React.SetStateAction<BriefingPerguntaInput>>
  opcoesText: string
  setOpcoesText: React.Dispatch<React.SetStateAction<string>>
  saving: boolean
  isEdit: boolean
  onSave: () => void
  onCancel?: () => void
}

function PerguntaForm({
  title,
  perguntaForm,
  setPerguntaForm,
  opcoesText,
  setOpcoesText,
  saving,
  isEdit,
  onSave,
  onCancel,
}: PerguntaFormProps) {
  return (
    <div className="space-y-2 rounded-lg border border-[rgba(242,216,146,0.25)] bg-[rgba(0,0,0,0.2)] p-3">
      <p className="flex items-center gap-1 text-[0.72rem] font-medium text-[#f2d892]">
        {isEdit ? <Pencil size={12} /> : <Plus size={12} />}
        {title}
      </p>
      <input
        className="glass-input"
        value={perguntaForm.enunciado}
        onChange={e => setPerguntaForm(p => ({ ...p, enunciado: e.target.value }))}
        placeholder="Enunciado da pergunta"
      />
      <select
        className="glass-input"
        value={perguntaForm.tipo}
        onChange={e => setPerguntaForm(p => ({ ...p, tipo: e.target.value as BriefingPerguntaTipo }))}
      >
        {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      {perguntaForm.tipo === 'multipla_escolha' && (
        <textarea
          className="glass-input min-h-[60px] resize-y"
          value={opcoesText}
          onChange={e => setOpcoesText(e.target.value)}
          placeholder="Uma opção por linha"
        />
      )}
      {perguntaForm.tipo === 'numero' && (
        <input
          className="glass-input"
          value={perguntaForm.unidade_padrao ?? ''}
          onChange={e => setPerguntaForm(p => ({ ...p, unidade_padrao: e.target.value || null }))}
          placeholder="Unidade padrão (cm, pol...)"
        />
      )}
      <input
        className="glass-input"
        value={perguntaForm.texto_ajuda ?? ''}
        onChange={e => setPerguntaForm(p => ({ ...p, texto_ajuda: e.target.value || null }))}
        placeholder="Texto de ajuda (opcional)"
      />
      <label className="flex items-center gap-2 text-[0.75rem] text-[#edd9c4]">
        <input
          type="checkbox"
          checked={perguntaForm.obrigatoria}
          onChange={e => setPerguntaForm(p => ({ ...p, obrigatoria: e.target.checked }))}
        />
        Obrigatória
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onSave} disabled={saving} className="btn btn-gold btn-sm">
          {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar'}
        </button>
        {isEdit && onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-outline btn-sm">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

export function BriefingModeloEditor({
  modelos,
  hook,
  canEdit = true,
  canDelete,
  loading,
  error,
}: BriefingModeloEditorProps) {
  const [modeloForm, setModeloForm] = useState(BLANK_MODELO)
  const [modeloEdit, setModeloEdit] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [perguntaForm, setPerguntaForm] = useState<BriefingPerguntaInput>(BLANK_PERGUNTA)
  const [perguntaEdit, setPerguntaEdit] = useState<string | null>(null)
  const [opcoesText, setOpcoesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const editPanelRef = useRef<HTMLDivElement | null>(null)

  const expanded = modelos.find(m => m.id === expandedId)

  useEffect(() => {
    if ((modeloEdit || perguntaEdit) && editPanelRef.current) {
      editPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [modeloEdit, perguntaEdit])

  const resetModeloForm = () => {
    setModeloForm(BLANK_MODELO)
    setModeloEdit(null)
  }

  const resetPerguntaForm = () => {
    setPerguntaForm(BLANK_PERGUNTA)
    setPerguntaEdit(null)
    setOpcoesText('')
  }

  const runAction = async (action: () => Promise<void>) => {
    setActionError(null)
    setSaving(true)
    try {
      await action()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar as alterações.'
      setActionError(message)
      console.error('[BriefingModeloEditor]', err)
    } finally {
      setSaving(false)
    }
  }

  const saveModelo = async (closeAfter = true) => {
    if (!canEdit || !modeloForm.nome.trim()) return
    await runAction(async () => {
      if (modeloEdit) await hook.update(modeloEdit, modeloForm)
      else await hook.create(modeloForm)
      if (closeAfter) resetModeloForm()
    })
  }

  const savePergunta = async () => {
    if (!canEdit || !expandedId || !perguntaForm.enunciado.trim()) return
    await runAction(async () => {
      const opcoes = perguntaForm.tipo === 'multipla_escolha'
        ? opcoesText.split('\n').filter(Boolean).map(label => ({
          id: label.toLowerCase().replace(/\s+/g, '_'),
          label: label.trim(),
        }))
        : null
      const payload = {
        ...perguntaForm,
        modelo_id: expandedId,
        opcoes,
        ordem: perguntaEdit
          ? perguntaForm.ordem
          : (expanded?.perguntas?.length ?? 0) + 1,
      }
      if (perguntaEdit) await hook.updatePergunta(perguntaEdit, payload)
      else await hook.createPergunta(payload)
      resetPerguntaForm()
    })
  }

  const startEditModelo = (m: BriefingModelo) => {
    resetPerguntaForm()
    setModeloEdit(m.id)
    setModeloForm({ nome: m.nome, descricao: m.descricao ?? '', ordem: m.ordem, ativo: m.ativo })
    setExpandedId(m.id)
  }

  const editPergunta = (p: PerguntaRow) => {
    resetModeloForm()
    setPerguntaEdit(p.id)
    setPerguntaForm({
      modelo_id: p.modelo_id,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opcoes: p.opcoes ?? null,
      obrigatoria: p.obrigatoria,
      texto_ajuda: p.texto_ajuda ?? null,
      unidade_padrao: p.unidade_padrao ?? null,
      ordem: p.ordem,
      ativo: p.ativo,
    })
    setOpcoesText((p.opcoes ?? []).map(o => o.label).join('\n'))
    setExpandedId(p.modelo_id)
  }

  const movePergunta = async (modeloId: string, perguntas: NonNullable<BriefingModelo['perguntas']>, idx: number, dir: -1 | 1) => {
    if (!canEdit) return
    const next = idx + dir
    if (next < 0 || next >= perguntas.length) return
    const ids = perguntas.map(p => p.id)
    ;[ids[idx], ids[next]] = [ids[next], ids[idx]]
    await runAction(async () => {
      await hook.reorderPerguntas(modeloId, ids)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.72rem] uppercase tracking-wider text-[#f2d892]">
          Ambientes pré-cadastrados ({modelos.length})
        </p>
        {loading && (
          <span className="text-[0.68rem] text-[#edd9c4]/70">Carregando ambientes...</span>
        )}
      </div>

      {canEdit && (
        <p className="text-[0.7rem] text-[#edd9c4]/80">
          Clique no lápis para editar o ambiente ou cada pergunta. Administrador e Administrador de Obras podem alterar os modelos padrão.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {actionError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {!loading && modelos.length === 0 && !error && (
          <p className="rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.12)] px-3 py-4 text-center text-[0.75rem] text-[#edd9c4]/80">
            Nenhum ambiente encontrado. Atualize a página ou aguarde a sincronização dos modelos padrão.
          </p>
        )}

        {modelos.map(m => (
          <div key={m.id} className="glass-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-2.5">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => {
                  if (expandedId === m.id) {
                    setExpandedId(null)
                    if (modeloEdit === m.id) resetModeloForm()
                    if (perguntaEdit && m.perguntas?.some(p => p.id === perguntaEdit)) resetPerguntaForm()
                  } else {
                    setExpandedId(m.id)
                  }
                }}
              >
                {expandedId === m.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-cream">{m.nome}</p>
                  <p className="text-[0.68rem] text-[#edd9c4]">
                    {(m.perguntas ?? []).length} perguntas · {m.ativo ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 gap-1">
                {canEdit && (
                  <>
                    <button
                      type="button"
                      title="Duplicar"
                      onClick={() => void runAction(async () => { await hook.duplicate(m) })}
                      className="p-1 text-[#edd9c4] hover:text-[#f2d892]"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      title="Editar ambiente"
                      onClick={() => startEditModelo(m)}
                      className={`p-1 hover:text-[#f2d892] ${modeloEdit === m.id ? 'text-[#f2d892]' : 'text-[#edd9c4]'}`}
                    >
                      <Pencil size={12} />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    type="button"
                    title="Excluir ambiente"
                    onClick={() => void runAction(async () => {
                      await hook.remove(m.id)
                      if (modeloEdit === m.id) resetModeloForm()
                      if (expandedId === m.id) setExpandedId(null)
                    })}
                    className="p-1 text-[#edd9c4] hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {expandedId === m.id && (
              <div className="border-t border-[rgba(240,210,140,0.1)] p-3 space-y-3">
                {canEdit && modeloEdit === m.id && (
                  <div
                    ref={editPanelRef}
                    className="space-y-2 rounded-lg border border-[rgba(242,216,146,0.25)] bg-[rgba(0,0,0,0.2)] p-3"
                  >
                    <p className="flex items-center gap-1 text-[0.72rem] font-medium text-[#f2d892]">
                      <Pencil size={12} />
                      Editar ambiente
                    </p>
                    <input
                      className="glass-input"
                      value={modeloForm.nome}
                      onChange={e => setModeloForm(p => ({ ...p, nome: e.target.value }))}
                      placeholder="Nome do ambiente"
                    />
                    <input
                      className="glass-input"
                      value={modeloForm.descricao ?? ''}
                      onChange={e => setModeloForm(p => ({ ...p, descricao: e.target.value || null }))}
                      placeholder="Descrição (opcional)"
                    />
                    <label className="flex items-center gap-2 text-[0.75rem] text-[#edd9c4]">
                      <input
                        type="checkbox"
                        checked={modeloForm.ativo}
                        onChange={e => setModeloForm(p => ({ ...p, ativo: e.target.checked }))}
                      />
                      Ambiente ativo (visível ao vincular em obras)
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void saveModelo()} disabled={saving} className="btn btn-gold btn-sm">
                        {saving ? 'Salvando...' : 'Salvar ambiente'}
                      </button>
                      <button type="button" onClick={resetModeloForm} className="btn btn-outline btn-sm">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {(m.perguntas ?? []).map((p, idx) => (
                  <div key={p.id} className="space-y-2">
                    <div
                      className={`flex items-start gap-2 rounded border p-2 text-sm ${
                        perguntaEdit === p.id
                          ? 'border-[rgba(242,216,146,0.35)] bg-[rgba(242,216,146,0.06)]'
                          : 'border-[rgba(255,255,255,0.06)]'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <button type="button" disabled={!canEdit || idx === 0} onClick={() => void movePergunta(m.id, m.perguntas!, idx, -1)} className="text-[#edd9c4] disabled:opacity-30">
                          <ChevronUp size={12} />
                        </button>
                        <button type="button" disabled={!canEdit || idx === (m.perguntas?.length ?? 0) - 1} onClick={() => void movePergunta(m.id, m.perguntas!, idx, 1)} className="text-[#edd9c4] disabled:opacity-30">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-cream">{p.enunciado}</p>
                        <p className="text-[0.65rem] text-[#edd9c4]">
                          {TIPOS.find(t => t.value === p.tipo)?.label}
                          {p.obrigatoria && ' · Obrigatória'}
                        </p>
                      </div>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            title="Editar pergunta"
                            onClick={() => editPergunta(p)}
                            className={`p-1 hover:text-[#f2d892] ${perguntaEdit === p.id ? 'text-[#f2d892]' : 'text-[#edd9c4]'}`}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            title="Excluir pergunta"
                            onClick={() => void runAction(async () => {
                              await hook.removePergunta(p.id)
                              if (perguntaEdit === p.id) resetPerguntaForm()
                            })}
                            className="p-1 text-[#edd9c4] hover:text-red-400"
                          >
                            <X size={12} />
                          </button>
                        </>
                      )}
                    </div>

                    {canEdit && perguntaEdit === p.id && (
                      <div ref={editPanelRef}>
                        <PerguntaForm
                          title={`Editar: ${p.enunciado}`}
                          perguntaForm={perguntaForm}
                          setPerguntaForm={setPerguntaForm}
                          opcoesText={opcoesText}
                          setOpcoesText={setOpcoesText}
                          saving={saving}
                          isEdit
                          onSave={() => void savePergunta()}
                          onCancel={resetPerguntaForm}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {canEdit && !perguntaEdit && (
                  <PerguntaForm
                    title="Nova pergunta"
                    perguntaForm={perguntaForm}
                    setPerguntaForm={setPerguntaForm}
                    opcoesText={opcoesText}
                    setOpcoesText={setOpcoesText}
                    saving={saving}
                    isEdit={false}
                    onSave={() => void savePergunta()}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && !modeloEdit && (
        <div className="space-y-3 rounded-lg border border-[rgba(240,210,140,0.12)] p-3">
          <p className="text-[0.72rem] uppercase tracking-wider text-[#edd9c4]">Novo modelo de ambiente</p>
          <Field label="Nome do ambiente *">
            <input
              className="glass-input"
              value={modeloForm.nome}
              onChange={e => setModeloForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Cozinha"
            />
          </Field>
          <Field label="Descrição">
            <input
              className="glass-input"
              value={modeloForm.descricao ?? ''}
              onChange={e => setModeloForm(p => ({ ...p, descricao: e.target.value || null }))}
              placeholder="Opcional"
            />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={() => void saveModelo()} disabled={saving} className="btn btn-gold btn-md">
              {saving ? 'Salvando...' : 'Adicionar modelo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
