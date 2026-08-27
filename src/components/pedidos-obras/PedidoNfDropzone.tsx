import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import {
  buildPendingAnexo,
  isAcceptedAnexoFile,
} from '@/lib/pedidos-obras-anexos'
import type { PedidoAnexo, PendingContaPagarAnexo } from '@/types'

interface PedidoNfDropzoneProps {
  pending: PendingContaPagarAnexo[]
  saved?: PedidoAnexo[]
  savedPreviewUrls?: Record<string, string>
  disabled?: boolean
  onPendingChange: (next: PendingContaPagarAnexo[]) => void
  onRemoveSaved?: (anexo: PedidoAnexo) => void
  onOpenSaved?: (anexo: PedidoAnexo) => void
}

export function PedidoNfDropzone({
  pending,
  saved = [],
  savedPreviewUrls = {},
  disabled,
  onPendingChange,
  onRemoveSaved,
  onOpenSaved,
}: PedidoNfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const addFiles = async (files: FileList | File[]) => {
    if (disabled) return
    setBusy(true)
    try {
      const next = [...pending]
      for (const file of Array.from(files)) {
        if (!isAcceptedAnexoFile(file)) continue
        next.push(await buildPendingAnexo(file))
      }
      onPendingChange(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files)
        }}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[0.72rem] font-semibold transition-colors"
        style={{
          borderColor: dragOver ? 'rgba(74,222,128,0.7)' : 'rgba(240,210,140,0.28)',
          background: dragOver ? 'rgba(34,197,94,0.12)' : 'rgba(240,210,140,0.05)',
          color: '#f2d892',
        }}
      >
        <Upload size={14} />
        {busy ? 'Lendo arquivo…' : 'Soltar nota fiscal (PDF ou foto)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files) void addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {(saved.length > 0 || pending.length > 0) && (
        <ul className="flex flex-col gap-1.5 min-w-0">
          {saved.map(anexo => (
            <li
              key={anexo.id}
              className="flex items-center gap-2 rounded-md border border-[rgba(240,210,140,0.18)] bg-[rgba(20,10,6,0.35)] px-2 py-1.5 min-w-0"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onOpenSaved?.(anexo)}
              >
                {anexo.tipo_mime.startsWith('image/') || savedPreviewUrls[anexo.id] ? (
                  <ImageIcon size={14} className="shrink-0 text-[#4ade80]" />
                ) : (
                  <FileText size={14} className="shrink-0 text-[#fbbf24]" />
                )}
                <span className="truncate text-[0.68rem] text-[#edd9c4]">{anexo.nome_arquivo}</span>
              </button>
              {onRemoveSaved && !disabled && (
                <button
                  type="button"
                  aria-label="Remover nota"
                  className="shrink-0 text-[#f87171] hover:text-[#fca5a5]"
                  onClick={() => onRemoveSaved(anexo)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
          {pending.map(anexo => (
            <li
              key={anexo.localId}
              className="flex items-center gap-2 rounded-md border border-[rgba(96,165,250,0.28)] bg-[rgba(37,99,235,0.12)] px-2 py-1.5 min-w-0"
            >
              {anexo.previewUrl ? (
                <img src={anexo.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <FileText size={14} className="shrink-0 text-[#93c5fd]" />
              )}
              <span className="min-w-0 flex-1 truncate text-[0.68rem] text-[#dbeafe]">{anexo.nome}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label="Remover arquivo"
                  className="shrink-0 text-[#f87171]"
                  onClick={() => onPendingChange(pending.filter(a => a.localId !== anexo.localId))}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
