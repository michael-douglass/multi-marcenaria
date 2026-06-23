import { useState } from 'react'
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

interface BriefingModeloEditorProps {
  modelos: BriefingModelo[]
  hook: ReturnType<typeof useBriefingModelos>
  canDelete: boolean
  loading?: boolean
  error?: string | null
}

export function BriefingModeloEditor({ modelos, hook, canDelete, loading, error }: BriefingModeloEditorProps) {
  const [modeloForm, setModeloForm] = useState(BLANK_MODELO)
  const [modeloEdit, setModeloEdit] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [perguntaForm, setPerguntaForm] = useState<BriefingPerguntaInput>(BLANK_PERGUNTA)
  const [perguntaEdit, setPerguntaEdit] = useState<string | null>(null)
  const [opcoesText, setOpcoesText] = useState('')
  const [saving, setSaving] = useState(false)

  const expanded = modelos.find(m => m.id === expandedId)

  const saveModelo = async () => {
    if (!modeloForm.nome.trim()) return
    setSaving(true)
    try {
      if (modeloEdit) await hook.update(modeloEdit, modeloForm)
      else await hook.create(modeloForm)
      setModeloForm(BLANK_MODELO)
      setModeloEdit(null)
    } finally {
      setSaving(false)
    }
  }

  const savePergunta = async () => {
    if (!expandedId || !perguntaForm.enunciado.trim()) return
    setSaving(true)
    try {
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
      setPerguntaForm(BLANK_PERGUNTA)
      setPerguntaEdit(null)
      setOpcoesText('')
    } finally {
      setSaving(false)
    }
  }

  const editPergunta = (p: NonNullable<BriefingModelo['perguntas']>[number]) => {
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
  }

  const movePergunta = async (modeloId: string, perguntas: NonNullable<BriefingModelo['perguntas']>, idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= perguntas.length) return
    const ids = perguntas.map(p => p.id)
    ;[ids[idx], ids[next]] = [ids[next], ids[idx]]
    await hook.reorderPerguntas(modeloId, ids)
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

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
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
                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
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
                <button
                  type="button"
                  title="Duplicar"
                  onClick={() => void hook.duplicate(m)}
                  className="p-1 text-[#edd9c4] hover:text-[#f2d892]"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModeloEdit(m.id)
                    setModeloForm({ nome: m.nome, descricao: m.descricao ?? '', ordem: m.ordem, ativo: m.ativo })
                    setExpandedId(m.id)
                  }}
                  className="p-1 text-[#edd9c4] hover:text-[#f2d892]"
                >
                  <Pencil size={12} />
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void hook.remove(m.id)}
                    className="p-1 text-[#edd9c4] hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {expandedId === m.id && (
              <div className="border-t border-[rgba(240,210,140,0.1)] p-3 space-y-3">
                {(m.perguntas ?? []).map((p, idx) => (
                  <div key={p.id} className="flex items-start gap-2 rounded border border-[rgba(255,255,255,0.06)] p-2 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <button type="button" disabled={idx === 0} onClick={() => void movePergunta(m.id, m.perguntas!, idx, -1)} className="text-[#edd9c4] disabled:opacity-30">
                        <ChevronUp size={12} />
                      </button>
                      <button type="button" disabled={idx === (m.perguntas?.length ?? 0) - 1} onClick={() => void movePergunta(m.id, m.perguntas!, idx, 1)} className="text-[#edd9c4] disabled:opacity-30">
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
                    <button type="button" onClick={() => editPergunta(p)} className="p-1 text-[#edd9c4] hover:text-[#f2d892]">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => void hook.removePergunta(p.id)} className="p-1 text-[#edd9c4] hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <div className="space-y-2 rounded-lg bg-[rgba(0,0,0,0.15)] p-3">
                  <p className="flex items-center gap-1 text-[0.72rem] text-[#f2d892]">
                    <Plus size={12} />
                    {perguntaEdit ? 'Editar pergunta' : 'Nova pergunta'}
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
                    <button onClick={() => void savePergunta()} disabled={saving} className="btn btn-gold btn-sm">
                      {perguntaEdit ? 'Atualizar' : 'Adicionar'}
                    </button>
                    {perguntaEdit && (
                      <button
                        onClick={() => { setPerguntaForm(BLANK_PERGUNTA); setPerguntaEdit(null); setOpcoesText('') }}
                        className="btn btn-outline btn-sm"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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
          <button onClick={() => void saveModelo()} disabled={saving} className="btn btn-gold btn-md">
            {saving ? 'Salvando...' : modeloEdit ? 'Atualizar modelo' : 'Adicionar modelo'}
          </button>
          {modeloEdit && (
            <button
              onClick={() => { setModeloForm(BLANK_MODELO); setModeloEdit(null) }}
              className="btn btn-outline btn-md"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
