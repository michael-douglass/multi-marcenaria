import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { processarTemplate } from '@/lib/processarTemplate'
import { showToast } from '@/lib/toast'
import { TIPOS_CHAVE_PIX } from '@/hooks/usePixConfig'
import type { ContaReceber } from '@/types'
import type { TemplateCobranca } from '@/lib/processarTemplate'
import type { PixConfig } from '@/hooks/usePixConfig'
import { cn } from '@/lib/utils'

interface Props {
  conta: ContaReceber
  templates: TemplateCobranca[]
  pixConfig: PixConfig | null
}

async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const el = document.createElement('textarea')
    el.value = texto
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

export function CobrancaCopyButton({ conta, templates, pixConfig }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  const ref = useRef<HTMLDivElement>(null)

  // Seleciona o primeiro template por padrão ao abrir
  useEffect(() => {
    if (open && templates.length > 0) {
      setSelectedId(prev => prev || templates[0].id)
    }
  }, [open, templates])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const tipoLabel = TIPOS_CHAVE_PIX.find(t => t.value === pixConfig?.tipo_chave)?.label ?? pixConfig?.tipo_chave ?? ''

  const handleCopiar = async () => {
    const template = templates.find(t => t.id === selectedId) ?? templates[0]
    if (!template) return
    const msg = processarTemplate(conta, template, pixConfig)
    await copiarTexto(msg)
    showToast('Informações copiadas!')
    setOpen(false)
  }

  if (templates.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-outline btn-sm !px-2"
        title="Copiar mensagem de cobrança"
        onClick={() => setOpen(p => !p)}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="cobrancas-copy-popover absolute z-[300] right-0 mt-1 min-w-[230px] max-w-[280px] overflow-hidden rounded-xl">
          <div className="cobrancas-copy-popover__header">
            Copiar cobrança
          </div>

          <div className="px-3 pt-2.5 pb-1">
            <p className="cobrancas-copy-popover__label mb-1.5">Template</p>
            <div className="flex flex-col gap-1">
              {templates.map(t => {
                const selected = selectedId === t.id
                return (
                  <label
                    key={t.id}
                    className={cn(
                      'cobrancas-copy-popover__option flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                      selected && 'cobrancas-copy-popover__option--active',
                    )}
                  >
                    <input
                      type="radio"
                      name={`template-${conta.id}`}
                      value={t.id}
                      checked={selected}
                      onChange={() => setSelectedId(t.id)}
                      className="cobrancas-copy-popover__radio"
                    />
                    <span className="cobrancas-copy-popover__option-name">{t.nome}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="cobrancas-copy-popover__pix mx-3 mb-2.5 mt-2 rounded-lg px-2.5 py-2">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <p className="cobrancas-copy-popover__label">Chave PIX</p>
              {pixConfig && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm !h-auto !px-1.5 !py-0.5 text-[0.65rem]"
                  title="Copiar chave PIX"
                  onClick={async () => {
                    const linhas = [
                      `Chave PIX: ${pixConfig.chave_pix}`,
                      pixConfig.nome_beneficiario ? `Beneficiário: ${pixConfig.nome_beneficiario}` : '',
                    ].filter(Boolean).join('\n')
                    await copiarTexto(linhas)
                    showToast('PIX copiado!')
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copiar chave
                </button>
              )}
            </div>
            {pixConfig ? (
              <>
                <p className="cobrancas-copy-popover__pix-key">{pixConfig.chave_pix}</p>
                <p className="cobrancas-copy-popover__pix-meta">
                  {tipoLabel}
                  {pixConfig.nome_beneficiario ? ` · ${pixConfig.nome_beneficiario}` : ''}
                </p>
              </>
            ) : (
              <p className="cobrancas-copy-popover__pix-warn">
                Não configurado — configure em ⚙️
              </p>
            )}
          </div>

          <div className="cobrancas-copy-popover__footer px-3 pb-3 pt-2">
            <button
              type="button"
              className="btn btn-gold btn-sm w-full"
              onClick={() => void handleCopiar()}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copiar mensagem
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
