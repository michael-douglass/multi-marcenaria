import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { DrawingCanvas } from '@/components/obras/briefing/DrawingCanvas'
import {
  buildPendingBriefingAnexo,
  briefingAnexoLightboxPages,
  isAcceptedBriefingFile,
  revokePendingBriefingAnexo,
  type PendingBriefingAnexo,
} from '@/lib/briefing-storage'
import type { BriefingPergunta, ObraBriefingAnexo, ObraBriefingResposta } from '@/types'

interface BriefingQuestionRendererProps {
  pergunta: BriefingPergunta
  resposta?: ObraBriefingResposta
  readOnly?: boolean
  onTextChange?: (value: string) => void
  onNumberChange?: (value: number | null, unidade?: string | null) => void
  onOpcoesChange?: (opcoes: string[]) => void
  onUploadFiles?: (files: File[]) => Promise<void>
  onUploadDrawing?: (blob: Blob) => Promise<void>
  onRemoveAnexo?: (anexo: ObraBriefingAnexo) => Promise<void>
}

export function BriefingQuestionRenderer({
  pergunta,
  resposta,
  readOnly = false,
  onTextChange,
  onNumberChange,
  onOpcoesChange,
  onUploadFiles,
  onUploadDrawing,
  onRemoveAnexo,
}: BriefingQuestionRendererProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ url: string; title: string; pages?: string[]; kind?: 'image' | 'pdf' | 'video' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<PendingBriefingAnexo[]>([])

  const selectedOpcoes = new Set(resposta?.valor_opcoes ?? [])
  const opcoes = pergunta.opcoes ?? []

  const handleFiles = async (files: File[]) => {
    if (readOnly || !onUploadFiles) return
    setUploading(true)
    try {
      const built = await Promise.all(files.filter(isAcceptedBriefingFile).map(buildPendingBriefingAnexo))
      setPending(prev => [...prev, ...built])
      await onUploadFiles(files.filter(isAcceptedBriefingFile))
      built.forEach(revokePendingBriefingAnexo)
      setPending([])
    } finally {
      setUploading(false)
    }
  }

  const renderMedia = () => {
    const anexos = resposta?.anexos ?? []
    const allItems = [...pending, ...anexos.map(a => ({ type: 'saved' as const, anexo: a }))]

    return (
      <div className="space-y-2">
        {!readOnly && (
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(240,210,140,0.25)] bg-[rgba(0,0,0,0.15)] p-4 transition-colors hover:border-[#f2d892]/50"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              void handleFiles(Array.from(e.dataTransfer.files))
            }}
          >
            <Upload size={20} className="text-[#edd9c4]" />
            <span className="text-[0.72rem] text-[#edd9c4]">
              {uploading ? 'Enviando...' : 'Clique ou arraste arquivos'}
            </span>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,video/*"
              className="hidden"
              onChange={e => {
                void handleFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </div>
        )}
        {allItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.map(p => (
              <AnexoThumb
                key={p.localId}
                url={p.previewUrl}
                kind={p.kind === 'video' ? 'video' : p.kind === 'pdf' ? 'pdf' : 'image'}
                label={p.nome}
                onClick={() => setPreview({
                  url: p.previewUrl,
                  title: p.nome,
                  pages: p.previewUrls,
                  kind: p.kind === 'video' ? 'video' : p.kind === 'pdf' ? 'pdf' : 'image',
                })}
              />
            ))}
            {anexos.map(anexo => (
              <div key={anexo.id} className="relative">
                <AnexoThumb
                  url={anexo.previewSignedUrl ?? anexo.signedUrl ?? ''}
                  kind={anexo.kind === 'video' ? 'video' : anexo.kind === 'pdf' ? 'pdf' : 'image'}
                  label={anexo.nome_arquivo}
                  onClick={() => setPreview({
                    url: briefingAnexoLightboxPages(anexo)[0] ?? '',
                    title: anexo.nome_arquivo,
                    pages: briefingAnexoLightboxPages(anexo),
                    kind: anexo.kind === 'video' ? 'video' : anexo.kind === 'pdf' ? 'pdf' : 'image',
                  })}
                />
                {!readOnly && onRemoveAnexo && (
                  <button
                    type="button"
                    onClick={() => void onRemoveAnexo(anexo)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <AnexoLightbox
          open={!!preview}
          imageUrl={preview?.url ?? ''}
          pages={preview?.pages}
          title={preview?.title ?? ''}
          kind={preview?.kind}
          onClose={() => setPreview(null)}
        />
      </div>
    )
  }

  if (pergunta.tipo === 'texto') {
    return (
      <textarea
        className="glass-input min-h-[80px] resize-y"
        value={resposta?.valor_texto ?? ''}
        onChange={e => onTextChange?.(e.target.value)}
        placeholder="Digite sua resposta..."
        disabled={readOnly}
        readOnly={readOnly}
      />
    )
  }

  if (pergunta.tipo === 'numero') {
    return (
      <div className="flex gap-2">
        <input
          type="number"
          className="glass-input flex-1"
          value={resposta?.valor_numero ?? ''}
          onChange={e => onNumberChange?.(e.target.value ? Number(e.target.value) : null, resposta?.unidade ?? pergunta.unidade_padrao)}
          disabled={readOnly}
          readOnly={readOnly}
        />
        {(pergunta.unidade_padrao || resposta?.unidade) && (
          <span className="flex items-center text-sm text-[#edd9c4]">
            {resposta?.unidade ?? pergunta.unidade_padrao}
          </span>
        )}
      </div>
    )
  }

  if (pergunta.tipo === 'multipla_escolha') {
    return (
      <div className="flex flex-wrap gap-2">
        {opcoes.map(op => {
          const active = selectedOpcoes.has(op.id)
          return (
            <button
              key={op.id}
              type="button"
              disabled={readOnly}
              onClick={() => {
                if (readOnly) return
                const next = new Set(selectedOpcoes)
                if (next.has(op.id)) next.delete(op.id)
                else next.add(op.id)
                onOpcoesChange?.([...next])
              }}
              className={`rounded-full border px-3 py-1.5 text-[0.75rem] transition-all ${
                active
                  ? 'border-[#f2d892] bg-[rgba(240,210,140,0.15)] text-[#f2d892]'
                  : 'border-[rgba(240,210,140,0.2)] text-[#edd9c4] hover:border-[#f2d892]/40'
              }`}
            >
              {op.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (pergunta.tipo === 'desenho') {
    const firstAnexo = resposta?.anexos?.[0]
    return (
      <div className="space-y-2">
        <DrawingCanvas
          readOnly={readOnly}
          initialDataUrl={firstAnexo?.previewSignedUrl ?? firstAnexo?.signedUrl ?? null}
          onExport={readOnly ? undefined : blob => {
            if (onUploadDrawing) void onUploadDrawing(blob)
          }}
        />
        {!readOnly && onUploadDrawing && (
          <p className="text-[0.68rem] text-[#edd9c4]/70">
            O desenho é salvo automaticamente ao terminar cada traço.
          </p>
        )}
      </div>
    )
  }

  if (pergunta.tipo === 'fotos') {
    return renderMedia()
  }

  if (pergunta.tipo === 'videos' || pergunta.tipo === 'pdf') {
    return renderMedia()
  }

  return null
}
