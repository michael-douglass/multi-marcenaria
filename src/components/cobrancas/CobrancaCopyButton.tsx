import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { processarTemplate } from '@/lib/processarTemplate'
import { showToast } from '@/lib/toast'
import { TIPOS_CHAVE_PIX } from '@/hooks/usePixConfig'
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
        <div
          className="absolute z-[300] right-0 mt-1 rounded-lg"
          style={{
            background: '#1a0f0a',
            border: '1px solid rgba(240,210,140,.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,.65)',
            minWidth: 230,
            maxWidth: 280,
          }}
        >
          {/* Cabeçalho */}
          <div
            className="px-3 py-2 section-label"
            style={{
              borderBottom: '1px solid rgba(240,210,140,.12)',
              fontSize: '.68rem',
              color: '#f2d892',
            }}
          >
            COPIAR COBRANÇA
          </div>

          {/* Seleção de template */}
          <div className="px-3 pt-2.5 pb-1">
            <p className="section-label mb-1.5" style={{ fontSize: '.65rem' }}>Template</p>
            <div className="flex flex-col gap-1">
              {templates.map(t => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 transition-colors"
                  style={{
                    background: selectedId === t.id
                      ? 'rgba(240,210,140,.12)'
                      : 'transparent',
                    border: selectedId === t.id
                      ? '1px solid rgba(240,210,140,.3)'
                      : '1px solid transparent',
                  }}
                >
                  <input
                    type="radio"
                    name={`template-${conta.id}`}
                    value={t.id}
                    checked={selectedId === t.id}
                    onChange={() => setSelectedId(t.id)}
                    style={{ accentColor: '#f2d892' }}
                  />
                  <span style={{ color: '#fffaf4', fontSize: '.8rem', fontFamily: 'Raleway, sans-serif' }}>
                    {t.nome}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Info PIX */}
          <div
            className="mx-3 mb-2.5 mt-2 rounded px-2.5 py-2"
            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(240,210,140,.1)' }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <p className="section-label" style={{ fontSize: '.63rem' }}>Chave PIX</p>
              {pixConfig && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm !px-1.5 !py-0.5"
                  style={{ fontSize: '.65rem', height: 'auto' }}
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
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar chave
                </button>
              )}
            </div>
            {pixConfig ? (
              <>
                <p style={{ color: '#fffaf4', fontSize: '.78rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {pixConfig.chave_pix}
                </p>
                <p style={{ color: '#edd9c4', fontSize: '.68rem', marginTop: '.1rem' }}>
                  {tipoLabel}
                  {pixConfig.nome_beneficiario ? ` · ${pixConfig.nome_beneficiario}` : ''}
                </p>
              </>
            ) : (
              <p style={{ color: '#f87171', fontSize: '.75rem' }}>
                Não configurado — configure em ⚙️
              </p>
            )}
          </div>

          {/* Botão copiar */}
          <div
            className="px-3 pb-3"
            style={{ borderTop: '1px solid rgba(240,210,140,.1)', paddingTop: '.6rem' }}
          >
            <button
              type="button"
              className="btn btn-gold btn-sm w-full"
              onClick={() => void handleCopiar()}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar mensagem
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
