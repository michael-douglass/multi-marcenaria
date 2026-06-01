import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Field, FieldRow } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { showToast } from '@/lib/toast'
import { TEMPLATE_PADRAO } from '@/hooks/useTemplatesCobranca'
import { TIPOS_CHAVE_PIX } from '@/hooks/usePixConfig'
import type { useTemplatesCobranca } from '@/hooks/useTemplatesCobranca'
import type { usePixConfig } from '@/hooks/usePixConfig'
import type { TemplateCobranca } from '@/lib/processarTemplate'

type TemplatesHook = ReturnType<typeof useTemplatesCobranca>
type PixHook = ReturnType<typeof usePixConfig>

const VARIAVEIS: { label: string; chave: string }[] = [
  { label: 'Nome do cliente',     chave: 'nome_cliente' },
  { label: 'Valor da parcela',    chave: 'valor_fatura' },
  { label: 'Vencimento',         chave: 'data_vencimento' },
  { label: 'Mês',                chave: 'mes_referencia' },
  { label: 'Ano',                chave: 'ano_referencia' },
  { label: 'Nº parcela',         chave: 'numero_parcela' },
  { label: 'Total parcelas',     chave: 'total_parcelas' },
  { label: 'Descrição',          chave: 'descricao_cobranca' },
  { label: 'Telefone',           chave: 'telefone' },
  { label: 'PIX copia e cola',   chave: 'pix_copia_cola' },
]

// ── Button de entrada ─────────────────────────────────────────

interface ButtonProps {
  templatesHook: TemplatesHook
  pixHook: PixHook
}

export function TemplatesConfigButton({ templatesHook, pixHook }: ButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-md !px-2.5"
        onClick={() => setOpen(true)}
        title="Configurações de templates e PIX"
      >
        <Settings className="h-4 w-4" />
      </button>
      <TemplatesConfigModal
        open={open}
        onClose={() => setOpen(false)}
        templatesHook={templatesHook}
        pixHook={pixHook}
      />
    </>
  )
}

// ── Modal principal ───────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  templatesHook: TemplatesHook
  pixHook: PixHook
}

function TemplatesConfigModal({ open, onClose, templatesHook, pixHook }: ModalProps) {
  const { data: dbTemplates, loading, criar, editar, excluir } = templatesHook
  const { config: pixConfig, saving: pixSaving, salvar: salvarPix } = pixHook

  // ── estado view de templates
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editingTemplate, setEditingTemplate] = useState<TemplateCobranca | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formConteudo, setFormConteudo] = useState('')
  const [formOrdem, setFormOrdem] = useState('0')
  const [formErro, setFormErro] = useState<string | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── estado do formulário PIX
  const [pixFormOpen, setPixFormOpen] = useState(false)
  const [pixChave, setPixChave] = useState('')
  const [pixTipo, setPixTipo] = useState('aleatoria')
  const [pixNome, setPixNome] = useState('')
  const [pixErro, setPixErro] = useState<string | null>(null)

  // Reinicia ao abrir
  useEffect(() => {
    if (open) {
      setView('list')
      setEditingTemplate(null)
      setPixFormOpen(false)
      setPixErro(null)
    }
  }, [open])

  // Preenche form PIX com dados existentes ao abrir
  useEffect(() => {
    if (pixFormOpen && pixConfig) {
      setPixChave(pixConfig.chave_pix)
      setPixTipo(pixConfig.tipo_chave)
      setPixNome(pixConfig.nome_beneficiario ?? '')
    } else if (pixFormOpen && !pixConfig) {
      setPixChave('')
      setPixTipo('aleatoria')
      setPixNome('')
    }
    setPixErro(null)
  }, [pixFormOpen, pixConfig])

  const abrirForm = (template?: TemplateCobranca) => {
    if (template) {
      setEditingTemplate(template)
      setFormNome(template.nome)
      setFormConteudo(template.conteudo)
      setFormOrdem(String(template.ordem))
    } else {
      setEditingTemplate(null)
      setFormNome('')
      setFormConteudo(TEMPLATE_PADRAO.conteudo)
      setFormOrdem(String(dbTemplates.length))
    }
    setFormErro(null)
    setView('form')
  }

  const fecharForm = () => {
    setView('list')
    setEditingTemplate(null)
    setFormErro(null)
  }

  const inserirVariavel = (chave: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const tag = `{{${chave}}}`
    const next = formConteudo.slice(0, start) + tag + formConteudo.slice(end)
    setFormConteudo(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    }, 0)
  }

  const salvarTemplate = async () => {
    if (!formNome.trim()) { setFormErro('Informe um nome para o template.'); return }
    if (!formConteudo.trim()) { setFormErro('O conteúdo não pode estar vazio.'); return }
    setFormSaving(true)
    setFormErro(null)
    try {
      const payload = {
        nome: formNome.trim(),
        conteudo: formConteudo,
        ordem: parseInt(formOrdem) || 0,
      }
      if (editingTemplate && editingTemplate.id !== '__default__') {
        await editar(editingTemplate.id, payload)
      } else {
        await criar(payload)
      }
      showToast('Template salvo!')
      fecharForm()
    } catch (e) {
      setFormErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setFormSaving(false)
    }
  }

  const handleExcluir = async (t: TemplateCobranca) => {
    if (!confirm(`Excluir o template "${t.nome}"?`)) return
    try {
      await excluir(t.id)
      showToast('Template excluído.')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir.', 'error')
    }
  }

  const handleSalvarPix = async () => {
    if (!pixChave.trim()) { setPixErro('Informe a chave PIX.'); return }
    setPixErro(null)
    try {
      await salvarPix({
        chave_pix: pixChave.trim(),
        tipo_chave: pixTipo,
        nome_beneficiario: pixNome.trim() || undefined,
      })
      showToast('PIX configurado!')
      setPixFormOpen(false)
    } catch (e) {
      setPixErro(e instanceof Error ? e.message : 'Erro ao salvar PIX.')
    }
  }

  const tipoLabel = TIPOS_CHAVE_PIX.find(t => t.value === pixConfig?.tipo_chave)?.label ?? ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="CONFIGURAÇÕES — COBRANÇAS"
      wide
      closeOnBackdrop={false}
    >
      {/* ── Bloco A: Templates ─────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label" style={{ color: '#d4a853', fontWeight: 700, fontSize: '.78rem' }}>
            TEMPLATES DE MENSAGEM
          </p>
          {view === 'list' && (
            <button
              type="button"
              className="btn btn-gold btn-sm"
              onClick={() => abrirForm()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Template
            </button>
          )}
        </div>

        {view === 'list' ? (
          <>
            {loading ? (
              <p className="text-sm text-[#8a6a55]">Carregando...</p>
            ) : dbTemplates.length === 0 ? (
              <div
                className="rounded-lg px-3 py-3 text-sm"
                style={{ background: 'rgba(212,168,83,.04)', border: '1px solid rgba(212,168,83,.12)', color: '#8a6a55' }}
              >
                Nenhum template cadastrado — usando o template padrão. Crie um para personalizar.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {dbTemplates.map(t => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
                    style={{ border: '1px solid rgba(212,168,83,.18)', background: 'rgba(36,16,8,.5)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#f4e4d6]">{t.nome}</div>
                      <div
                        className="mt-0.5 truncate text-xs text-[#8a6a55]"
                        title={t.conteudo}
                      >
                        {t.conteudo.slice(0, 70)}{t.conteudo.length > 70 ? '…' : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 mt-0.5">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm !px-2"
                        onClick={() => abrirForm(t)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm !px-2"
                        onClick={() => void handleExcluir(t)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          /* ── Formulário de edição ── */
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(212,168,83,.03)', border: '1px solid rgba(212,168,83,.14)' }}
          >
            <FieldRow>
              <Field label="Nome do template" half={false}>
                <input
                  className="glass-input"
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Lembrete WhatsApp"
                />
              </Field>
            </FieldRow>

            <Field label="Conteúdo (use os botões abaixo para inserir variáveis)">
              <textarea
                ref={textareaRef}
                className="glass-input min-h-[160px]"
                value={formConteudo}
                onChange={e => setFormConteudo(e.target.value)}
                rows={7}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '.82rem' }}
              />
            </Field>

            {/* Painel de variáveis */}
            <div className="mb-3">
              <p className="section-label mb-1.5" style={{ fontSize: '.68rem' }}>
                Inserir variável no cursor:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIAVEIS.map(v => (
                  <button
                    key={v.chave}
                    type="button"
                    onClick={() => inserirVariavel(v.chave)}
                    style={{
                      padding: '.2rem .55rem',
                      borderRadius: '9999px',
                      fontSize: '.68rem',
                      fontWeight: 600,
                      border: '1px solid rgba(212,168,83,.3)',
                      background: 'rgba(212,168,83,.08)',
                      color: '#d4a853',
                      cursor: 'pointer',
                      fontFamily: 'Raleway, sans-serif',
                      transition: 'background .12s',
                    }}
                    title={`Inserir {{${v.chave}}}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {formErro && <p className="mb-2 text-sm text-red-400">{formErro}</p>}

            <ModalFormFooter
              onCancel={fecharForm}
              onSubmit={salvarTemplate}
              submitLabel="Salvar template"
              submittingLabel="Salvando..."
              submitting={formSaving}
            />
          </div>
        )}
      </div>

      {/* ── Bloco B: PIX ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label" style={{ color: '#d4a853', fontWeight: 700, fontSize: '.78rem' }}>
            CONFIGURAÇÃO PIX
          </p>
          {!pixFormOpen && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPixFormOpen(true)}
            >
              {pixConfig ? 'Alterar PIX' : 'Configurar PIX'}
            </button>
          )}
        </div>

        {/* Resumo da config atual */}
        {!pixFormOpen && (
          pixConfig ? (
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ border: '1px solid rgba(74,222,128,.18)', background: 'rgba(74,222,128,.04)' }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ PIX configurado</span>
                <span className="section-label" style={{ fontSize: '.7rem' }}>{tipoLabel}</span>
              </div>
              <div style={{ color: '#f4e4d6', fontFamily: 'monospace', fontSize: '.8rem' }}>
                {pixConfig.chave_pix}
              </div>
              {pixConfig.nome_beneficiario && (
                <div style={{ color: '#8a6a55', fontSize: '.78rem', marginTop: '.15rem' }}>
                  Beneficiário: {pixConfig.nome_beneficiario}
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ border: '1px solid rgba(248,113,113,.18)', background: 'rgba(248,113,113,.04)', color: '#f87171' }}
            >
              PIX não configurado — a variável {'{{pix_copia_cola}}'} nos templates ficará em branco.
            </div>
          )
        )}

        {/* Formulário PIX */}
        {pixFormOpen && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(212,168,83,.03)', border: '1px solid rgba(212,168,83,.14)' }}
          >
            <Field label="Tipo de chave">
              <select
                className="glass-input"
                value={pixTipo}
                onChange={e => setPixTipo(e.target.value)}
              >
                {TIPOS_CHAVE_PIX.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Chave PIX *">
              <input
                className="glass-input"
                value={pixChave}
                onChange={e => setPixChave(e.target.value)}
                placeholder={
                  TIPOS_CHAVE_PIX.find(t => t.value === pixTipo)?.placeholder ?? ''
                }
              />
            </Field>

            <Field label="Nome do beneficiário (opcional)">
              <input
                className="glass-input"
                value={pixNome}
                onChange={e => setPixNome(e.target.value)}
                placeholder="Ex: GARBO MOVELARIA"
                maxLength={25}
              />
            </Field>

            {pixErro && <p className="mb-2 text-sm text-red-400">{pixErro}</p>}

            <ModalFormFooter
              onCancel={() => setPixFormOpen(false)}
              onSubmit={handleSalvarPix}
              submitLabel="Salvar PIX"
              submittingLabel="Salvando..."
              submitting={pixSaving}
              submitDisabled={!pixChave.trim()}
            />
          </div>
        )}
      </div>

      {/* Rodapé */}
      {view === 'list' && !pixFormOpen && (
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
            Fechar
          </button>
        </div>
      )}
    </Modal>
  )
}
