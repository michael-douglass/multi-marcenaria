import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  Loader2,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { useApp } from '@/context/AppContext'
import { useReciboConfig } from '@/hooks/useReciboConfig'
import {
  buildPendingFuncionarioDoc,
  deleteFuncionarioDocumento,
  revokePendingFuncionarioDocUrls,
  uploadFuncionarioDocumento,
} from '@/lib/funcionario-documentos'
import {
  baixarDocsComoImagens,
  imprimirDocsTimbrados,
  resolverPaginasExportacao,
} from '@/lib/funcionario-docs-export'
import { isAdministrador } from '@/lib/role-access'
import { cn } from '@/lib/utils'
import type { FuncionarioAdmissaoDados, FuncionarioDocumento, PendingFuncionarioDocumento } from '@/types'

interface Props {
  funcionarioId: string
  funcionarioNome: string
  funcionarioCpf?: string | null
  funcionarioTelefone?: string | null
  funcionarioEmail?: string | null
  admissaoDados?: FuncionarioAdmissaoDados | null
  salarioFixoMensal?: number | null
  documentos: FuncionarioDocumento[]
  readOnly?: boolean
  onReload: () => void
}

type PastaView = 'raiz' | 'ponto'

const PASTA_PONTO_LABEL = 'Documentos de ponto'

export function FuncionarioDocumentosPanel({
  funcionarioId,
  funcionarioNome,
  funcionarioCpf,
  funcionarioTelefone,
  funcionarioEmail,
  admissaoDados,
  salarioFixoMensal,
  documentos,
  readOnly,
  onReload,
}: Props) {
  const { roles } = useApp()
  const { config: reciboConfig } = useReciboConfig()
  const canDeleteDocuments = isAdministrador(roles)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<FuncionarioDocumento | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pasta, setPasta] = useState<PastaView>('raiz')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportando, setExportando] = useState<'pdf' | 'imagem' | null>(null)

  const { docsRh, docsPonto } = useMemo(() => {
    const rh: FuncionarioDocumento[] = []
    const ponto: FuncionarioDocumento[] = []
    for (const doc of documentos) {
      if (doc.categoria === 'ponto') ponto.push(doc)
      else rh.push(doc)
    }
    return { docsRh: rh, docsPonto: ponto }
  }, [documentos])

  const docsVisiveis = pasta === 'ponto' ? docsPonto : docsRh

  useEffect(() => {
    setSelectedIds(new Set())
  }, [pasta])

  const todosSelecionados =
    docsVisiveis.length > 0 && docsVisiveis.every(d => selectedIds.has(d.id))
  const qtdSelecionados = docsVisiveis.filter(d => selectedIds.has(d.id)).length

  const toggleDoc = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selecionarTodos = () => {
    if (todosSelecionados) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(docsVisiveis.map(d => d.id)))
  }

  const docsSelecionados = useMemo(
    () => docsVisiveis.filter(d => selectedIds.has(d.id)),
    [docsVisiveis, selectedIds],
  )

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || readOnly || pasta !== 'raiz') return
    setUploading(true)
    setError(null)
    const pending: PendingFuncionarioDocumento[] = []
    try {
      for (const file of Array.from(files)) {
        pending.push(await buildPendingFuncionarioDoc(file, 'outros', 'rh'))
      }
      for (const p of pending) {
        await uploadFuncionarioDocumento(funcionarioId, p, 'admin')
      }
      onReload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar documento.')
    } finally {
      revokePendingFuncionarioDocUrls(pending)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (doc: FuncionarioDocumento) => {
    if (readOnly || !canDeleteDocuments) return
    if (!confirm(`Excluir "${doc.nome_arquivo}"?`)) return
    try {
      await deleteFuncionarioDocumento(doc)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(doc.id)
        return next
      })
      onReload()
      if (lightbox?.id === doc.id) setLightbox(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.')
    }
  }

  const exportar = async (modo: 'pdf' | 'imagem') => {
    if (!docsSelecionados.length || exportando) return
    setExportando(modo)
    setError(null)
    try {
      const pages = await resolverPaginasExportacao(docsSelecionados)
      if (modo === 'pdf') {
        imprimirDocsTimbrados(
          pages,
          {
            nome: funcionarioNome,
            cpf: funcionarioCpf,
            telefone: funcionarioTelefone,
            email: funcionarioEmail,
            admissaoDados,
            salarioFixoMensal,
          },
          reciboConfig?.cnpj,
        )
      } else {
        await baixarDocsComoImagens(pages)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar documentos.')
    } finally {
      setExportando(null)
    }
  }

  return (
    <div className="space-y-4">
      {pasta === 'raiz' && !readOnly && (
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium text-[#f2d892]">Documentos RH</p>
            <p className="text-sm text-[#b8957f]">Imagens ou PDFs — CTPS, contratos, etc.</p>
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
              {uploading ? 'Enviando…' : 'Enviar arquivo'}
            </button>
          </div>
        </div>
      )}

      {pasta === 'ponto' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPasta('raiz')}
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.45)] px-3 py-2 text-sm text-[#b8957f] transition hover:border-[rgba(212,168,83,0.4)] hover:text-[#f2d892]"
          >
            <ArrowLeft size={16} />
            Voltar aos documentos
          </button>
          <div className="text-right">
            <p className="section-label">Pasta</p>
            <h2 className="font-display text-xl tracking-wide text-[#f2d892]">{PASTA_PONTO_LABEL}</h2>
          </div>
        </div>
      )}

      {docsVisiveis.length > 0 && (
        <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selecionarTodos}
              className="inline-flex items-center gap-2 rounded-lg border border-[rgba(212,168,83,0.25)] px-3 py-2 text-sm text-[#edd9c4] transition hover:border-[rgba(212,168,83,0.45)] hover:text-[#f2d892]"
            >
              {todosSelecionados ? <CheckSquare size={16} /> : <Square size={16} />}
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span className="text-xs text-[#b8957f]">
              {qtdSelecionados > 0
                ? `${qtdSelecionados} selecionado${qtdSelecionados === 1 ? '' : 's'}`
                : 'Nenhum selecionado'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={qtdSelecionados === 0 || !!exportando}
              title="Gera PDF timbrado com a logo da empresa (Salvar como PDF na impressão)"
              onClick={() => void exportar('pdf')}
            >
              {exportando === 'pdf' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              Baixar PDF
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={qtdSelecionados === 0 || !!exportando}
              onClick={() => void exportar('imagem')}
            >
              {exportando === 'imagem' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileImage size={14} />
              )}
              Baixar imagens
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {pasta === 'raiz' && (
        <button
          type="button"
          onClick={() => setPasta('ponto')}
          className="group relative block w-full overflow-hidden rounded-xl border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.72)] text-left shadow-mogno transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(212,168,83,0.45)] hover:shadow-mogno-lg"
          aria-label={`Abrir pasta ${PASTA_PONTO_LABEL}`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse at 12% 0%, rgba(242,216,146,0.18), transparent 55%), linear-gradient(135deg, rgba(68,46,34,0.5), transparent 60%)',
            }}
          />
          <div className="absolute left-0 right-0 top-0 h-2.5 rounded-t-xl bg-gradient-to-r from-[#c9a045] via-[#f2d892] to-[#c9a045]" />
          <div className="relative flex items-center gap-4 p-5 pt-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,168,83,0.3)] bg-[rgba(96,165,250,0.18)]">
              <Clock size={22} className="text-sky-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <FolderOpen
                  size={16}
                  className="shrink-0 text-[#b8957f] transition group-hover:text-[#f2d892]"
                />
                <h3 className="font-display text-lg tracking-wide text-[#f2d892] sm:text-xl">
                  {PASTA_PONTO_LABEL}
                </h3>
              </div>
              <p className="mt-1 text-sm text-[#b8957f]">
                Fotos e comprovantes gerados ao bater o ponto
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-sky-200">
              {docsPonto.length} {docsPonto.length === 1 ? 'arquivo' : 'arquivos'}
            </span>
          </div>
        </button>
      )}

      {docsVisiveis.length === 0 ? (
        <div className="glass-card p-8 text-center text-[#b8957f]">
          {pasta === 'ponto'
            ? 'Nenhum comprovante de ponto nesta pasta ainda.'
            : 'Nenhum documento RH na pasta.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {docsVisiveis.map((doc, index) => {
            const selected = selectedIds.has(doc.id)
            return (
              <div
                key={doc.id}
                className="group relative animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: 'both' }}
              >
                <button
                  type="button"
                  aria-label={selected ? 'Desmarcar documento' : 'Selecionar documento'}
                  onClick={e => {
                    e.stopPropagation()
                    toggleDoc(doc.id)
                  }}
                  className={cn(
                    'absolute left-1 top-1 z-10 rounded border p-1 transition',
                    selected
                      ? 'border-[#f2d892]/60 bg-[rgba(242,216,146,0.2)] text-[#f2d892]'
                      : 'border-white/20 bg-black/50 text-[#edd9c4] opacity-80 group-hover:opacity-100',
                  )}
                >
                  {selected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>

                <button
                  type="button"
                  className={cn(
                    'w-full overflow-hidden rounded-lg border bg-[rgba(36,16,8,0.5)] transition',
                    selected
                      ? 'border-[#f2d892]/55 ring-1 ring-[#f2d892]/35'
                      : 'border-[rgba(212,168,83,0.2)] hover:border-[rgba(212,168,83,0.4)]',
                  )}
                  onClick={() => setLightbox(doc)}
                >
                  <AnexoThumb
                    kind={doc.kind}
                    previewUrl={doc.previewSignedUrl ?? ''}
                    nome={doc.nome_arquivo}
                    pageCount={doc.previewSignedUrls?.length ?? (doc.preview_paths?.length || undefined)}
                    onOpenFullscreen={() => setLightbox(doc)}
                  />
                </button>
                {canDeleteDocuments && !readOnly && (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-red-900/80 p-1 opacity-0 transition group-hover:opacity-100"
                    onClick={() => void handleDelete(doc)}
                  >
                    <Trash2 size={12} className="text-red-200" />
                  </button>
                )}
                <p className="mt-1 truncate text-xs text-[#b8957f]">{doc.nome_arquivo}</p>
                {(doc.previewSignedUrls?.length ?? 0) > 1 && (
                  <p className="text-[10px] text-[#edd9c4]/80">
                    {doc.previewSignedUrls!.length} páginas
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lightbox && (
        <AnexoLightbox
          open
          imageUrl={lightbox.previewSignedUrl ?? ''}
          pages={
            lightbox.previewSignedUrls?.length
              ? lightbox.previewSignedUrls
              : undefined
          }
          title={lightbox.nome_arquivo}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
          onDelete={canDeleteDocuments && !readOnly ? () => void handleDelete(lightbox) : undefined}
        />
      )}

      {exportando && (
        <p className="flex items-center gap-2 text-xs text-[#b8957f]">
          <Download size={12} />
          {exportando === 'pdf'
            ? 'Preparando PDF timbrado… Na janela de impressão, escolha “Salvar como PDF”.'
            : 'Baixando imagens selecionadas…'}
        </p>
      )}
    </div>
  )
}
