import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { processarTemplate } from '@/lib/processarTemplate'
import { showToast } from '@/lib/toast'
import type { ContaReceber } from '@/types'
import type { TemplateCobranca } from '@/lib/processarTemplate'
import type { PixConfig } from '@/hooks/usePixConfig'

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
  const [dropOpen, setDropOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const copiar = async (template: TemplateCobranca) => {
    const msg = processarTemplate(conta, template, pixConfig)
    await copiarTexto(msg)
    showToast('Informações copiadas!')
    setDropOpen(false)
  }

  if (templates.length === 0) return null

  if (templates.length === 1) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-sm !px-2"
        title={`Copiar: ${templates[0].nome}`}
        onClick={() => void copiar(templates[0])}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-outline btn-sm !px-2"
        title="Copiar mensagem de cobrança"
        onClick={() => setDropOpen(p => !p)}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>

      {dropOpen && (
        <div
          className="absolute z-[300] right-0 mt-1 rounded-lg overflow-hidden"
          style={{
            background: '#1a0f0a',
            border: '1px solid rgba(212,168,83,.22)',
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
            minWidth: 170,
          }}
        >
          <div
            className="px-3 py-1.5 section-label"
            style={{ borderBottom: '1px solid rgba(212,168,83,.1)', fontSize: '.68rem' }}
          >
            Escolha o template
          </div>
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-[rgba(212,168,83,.08)] transition-colors"
              style={{ color: '#f4e4d6', fontSize: '.82rem', fontFamily: 'Raleway, sans-serif' }}
              onClick={() => void copiar(t)}
            >
              {t.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
