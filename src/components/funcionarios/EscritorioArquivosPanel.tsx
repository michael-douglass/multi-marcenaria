import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/EmptyState'
import {
  buildPendingEscritorioArquivo,
  createEscritorioPasta,
  deleteEscritorioArquivo,
  deleteEscritorioPasta,
  getEscritorioPreviewUrls,
  listEscritorioArquivos,
  listEscritorioPastas,
  revokePendingEscritorioUrls,
  uploadEscritorioArquivo,
} from '@/lib/escritorio-arquivos'
import { showToast } from '@/lib/toast'
import type { EscritorioArquivo, EscritorioPasta, PendingEscritorioArquivo } from '@/types'

interface Props {
  readOnly?: boolean
}

interface ArquivoView extends EscritorioArquivo {
  previewUrl: string
  previewUrls: string[]
}

export function EscritorioArquivosPanel({ readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pastas, setPastas] = useState<EscritorioPasta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pastaAberta, setPastaAberta] = useState<EscritorioPasta | null>(null)
  const [arquivos, setArquivos] = useState<ArquivoView[]>([])
  const [loadingArquivos, setLoadingArquivos] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState('Enviar arquivo')
  const [lightbox, setLightbox] = useState<ArquivoView | null>(null)
  const [novaPastaOpen, setNovaPastaOpen] = useState(false)
  const [novaPastaNome, setNovaPastaNome] = useState('')
  const [novaPastaDesc, setNovaPastaDesc] = useState('')
  const [savingPasta, setSavingPasta] = useState(false)

  const carregarPastas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPastas(await listEscritorioPastas())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as pastas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregarPastas()
  }, [carregarPastas])

  const carregarArquivos = useCallback(async (pastaId: string) => {
    setLoadingArquivos(true)
    setError(null)
    try {
      const rows = await listEscritorioArquivos(pastaId)
      const views: ArquivoView[] = await Promise.all(
        rows.map(async row => {
          const previewUrls = await getEscritorioPreviewUrls(row)
          return {
            ...row,
            previewUrl: previewUrls[0] ?? '',
            previewUrls,
          }
        }),
      )
      setArquivos(views)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os arquivos.')
      setArquivos([])
    } finally {
      setLoadingArquivos(false)
    }
  }, [])

  const abrirPasta = (pasta: EscritorioPasta) => {
    setPastaAberta(pasta)
    setLightbox(null)
    void carregarArquivos(pasta.id)
  }

  const voltarPastas = () => {
    setPastaAberta(null)
    setArquivos([])
    setLightbox(null)
    void carregarPastas()
  }

  const criarPasta = async () => {
    if (!novaPastaNome.trim()) {
      showToast('Informe o nome da pasta.', 'error')
      return
    }
    setSavingPasta(true)
    try {
      const pasta = await createEscritorioPasta(novaPastaNome, novaPastaDesc)
      setPastas(prev => [...prev, pasta].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')))
      setNovaPastaOpen(false)
      setNovaPastaNome('')
      setNovaPastaDesc('')
      showToast(`Pasta "${pasta.nome}" criada.`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível criar a pasta.', 'error')
    } finally {
      setSavingPasta(false)
    }
  }

  const excluirPasta = async (pasta: EscritorioPasta) => {
    if (readOnly) return
    const qtd = pasta.qtd_arquivos ?? 0
    const msg =
      qtd > 0
        ? `Excluir a pasta "${pasta.nome}" e os ${qtd} arquivo${qtd === 1 ? '' : 's'} de dentro?`
        : `Excluir a pasta "${pasta.nome}"?`
    if (!confirm(msg)) return
    try {
      await deleteEscritorioPasta(pasta)
      if (pastaAberta?.id === pasta.id) voltarPastas()
      else setPastas(prev => prev.filter(p => p.id !== pasta.id))
      showToast('Pasta excluída.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível excluir a pasta.', 'error')
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !pastaAberta || readOnly) return
    setUploading(true)
    setUploadLabel('Preparando…')
    setError(null)
    const pending: PendingEscritorioArquivo[] = []
    try {
      for (const file of Array.from(files)) {
        pending.push(await buildPendingEscritorioArquivo(file))
      }
      for (let i = 0; i < pending.length; i++) {
        setUploadLabel(pending.length > 1 ? `Enviando ${i + 1}/${pending.length}…` : 'Enviando…')
        await uploadEscritorioArquivo(pastaAberta.id, pending[i])
      }
      showToast(
        pending.length === 1 ? 'Arquivo salvo.' : `${pending.length} arquivos salvos.`,
        'success',
      )
      await carregarArquivos(pastaAberta.id)
      setPastas(prev =>
        prev.map(p =>
          p.id === pastaAberta.id
            ? { ...p, qtd_arquivos: (p.qtd_arquivos ?? 0) + pending.length }
            : p,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo.')
      showToast(err instanceof Error ? err.message : 'Erro ao enviar arquivo.', 'error')
    } finally {
      revokePendingEscritorioUrls(pending)
      setUploading(false)
      setUploadLabel('Enviar arquivo')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDeleteArquivo = async (arquivo: ArquivoView) => {
    if (readOnly) return
    if (!confirm(`Excluir "${arquivo.nome_arquivo}"?`)) return
    try {
      await deleteEscritorioArquivo(arquivo)
      setArquivos(prev => prev.filter(a => a.id !== arquivo.id))
      if (lightbox?.id === arquivo.id) setLightbox(null)
      setPastas(prev =>
        prev.map(p =>
          p.id === arquivo.pasta_id
            ? { ...p, qtd_arquivos: Math.max(0, (p.qtd_arquivos ?? 1) - 1) }
            : p,
        ),
      )
      showToast('Arquivo excluído.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error && !pastaAberta && pastas.length === 0) return <ErrorState message={error} />

  if (pastaAberta) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={voltarPastas}
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(26,16,12,0.16)] bg-[#fffaf4] px-3 py-2 text-sm text-[#4a3428] transition hover:border-[rgba(107,63,18,0.4)] hover:text-[#6b3f12]"
          >
            <ArrowLeft size={16} />
            Voltar às pastas
          </button>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b3f12]">Pasta</p>
            <h2 className="font-display text-xl tracking-wide text-[#1a100c] sm:text-2xl">
              {pastaAberta.nome}
            </h2>
          </div>
        </div>

        {!readOnly && (
          <div className="glass-card flex flex-wrap items-center justify-between gap-3 border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] p-4">
            <div>
              <p className="font-medium text-[#1a100c]">Arquivos desta pasta</p>
              <p className="text-sm text-[#4a3428]">
                PDF ou imagens (JPG, PNG, WebP, GIF). Até 80 MB por arquivo.
              </p>
            </div>
            <div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => void handleFiles(e.target.files)}
              />
              <button
                type="button"
                className="btn btn-gold btn-sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={14} />
                {uploading ? uploadLabel : 'Enviar arquivo'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loadingArquivos && <LoadingState />}
        {!loadingArquivos && arquivos.length === 0 && (
          <EmptyState message="Esta pasta ainda está vazia. Envie um PDF ou uma imagem." />
        )}

        {!loadingArquivos && arquivos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {arquivos.map(arq => (
              <AnexoThumb
                key={arq.id}
                previewUrl={arq.previewUrl}
                nome={arq.nome_arquivo}
                kind={arq.kind}
                onOpenFullscreen={() => setLightbox(arq)}
                onDelete={readOnly ? undefined : () => void handleDeleteArquivo(arq)}
              />
            ))}
          </div>
        )}

        <AnexoLightbox
          open={!!lightbox}
          imageUrl={lightbox?.previewUrl ?? ''}
          pages={lightbox?.previewUrls}
          title={lightbox?.nome_arquivo ?? ''}
          kind={lightbox?.kind}
          onClose={() => setLightbox(null)}
          onDelete={
            lightbox && !readOnly ? () => void handleDeleteArquivo(lightbox) : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="glass-card flex flex-wrap items-start justify-between gap-3 border border-emerald-800/20 bg-emerald-50 p-4">
        <div>
          <p className="font-medium text-emerald-950">Arquivo do escritório</p>
          <p className="mt-1 text-sm text-[#1a100c]">
            Guarde aqui PDFs e imagens de contabilidade e documentos administrativos.
            Abra uma pasta para enviar ou visualizar.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-gold btn-sm shrink-0"
            onClick={() => {
              setNovaPastaNome('')
              setNovaPastaDesc('')
              setNovaPastaOpen(true)
            }}
          >
            <Plus size={14} />
            Nova pasta
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {pastas.length === 0 ? (
        <EmptyState message="Nenhuma pasta ainda. Crie a primeira para começar a guardar arquivos." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pastas.map(pasta => {
            const qtd = pasta.qtd_arquivos ?? 0
            return (
              <div
                key={pasta.id}
                className="group relative overflow-hidden rounded-xl border border-[rgba(26,16,12,0.14)] bg-[#fffaf4] shadow-[0_12px_28px_rgba(42,24,18,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(107,63,18,0.42)] hover:shadow-[0_18px_36px_rgba(42,24,18,0.12)]"
              >
                <span
                  className="absolute inset-x-0 top-0 h-2.5 bg-gradient-to-r from-[#146c38] via-[#c9a045] to-[#146c38]"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => abrirPasta(pasta)}
                  className="relative block w-full p-5 pt-7 text-left"
                  aria-label={`Abrir pasta ${pasta.nome}`}
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[rgba(26,16,12,0.12)] bg-[rgba(20,108,56,0.10)]">
                    <FolderOpen size={20} className="text-[#146c38]" />
                  </div>
                  <h3 className="font-display text-lg tracking-wide text-[#1a100c]">{pasta.nome}</h3>
                  {pasta.descricao && (
                    <p className="mt-1 line-clamp-2 text-sm text-[#4a3428]">{pasta.descricao}</p>
                  )}
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-[#6b5244]">
                    <FileText size={12} />
                    {qtd === 0
                      ? 'Vazia'
                      : `${qtd} arquivo${qtd === 1 ? '' : 's'}`}
                  </p>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => void excluirPasta(pasta)}
                    className="absolute right-3 top-5 rounded-md p-1.5 text-[#6b5244] opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                    aria-label={`Excluir pasta ${pasta.nome}`}
                    title="Excluir pasta"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={novaPastaOpen} onClose={() => setNovaPastaOpen(false)} title="NOVA PASTA">
        <Field label="Nome da pasta *">
          <input
            className="glass-input"
            value={novaPastaNome}
            onChange={e => setNovaPastaNome(e.target.value)}
            placeholder="Ex.: Impostos 2026"
            maxLength={120}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <input
            className="glass-input"
            value={novaPastaDesc}
            onChange={e => setNovaPastaDesc(e.target.value)}
            placeholder="Para que serve esta pasta"
          />
        </Field>
        <ModalFormFooter
          onCancel={() => setNovaPastaOpen(false)}
          onSubmit={() => void criarPasta()}
          submitting={savingPasta}
          submitLabel="Criar pasta"
          submittingLabel="Criando..."
          submitDisabled={!novaPastaNome.trim()}
        />
      </Modal>
    </div>
  )
}
