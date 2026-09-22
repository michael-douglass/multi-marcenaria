import { useState } from 'react'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { askMaxChat } from '@/lib/orcamentos-ia/memory'

interface AuditChatWidgetProps {
  companyId: string
  analysisId: string
  selectionSummary?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export function AuditChatWidget({
  companyId,
  analysisId,
  selectionSummary,
}: AuditChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Olá — sou o Max. Pergunte sobre este orçamento (ex.: “faltou a mesa?” ou “por que essa dobradiça?”).',
    },
  ])

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setBusy(true)
    const { answer, error } = await askMaxChat({
      companyId,
      analysisId,
      question: q,
      selectionSummary,
    })
    setBusy(false)
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: error || answer || 'Sem resposta.',
      },
    ])
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open && (
        <div className="pointer-events-auto flex h-[min(420px,70vh)] w-[min(360px,92vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#0d2847] px-3 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#6ea8ff]" />
              <span
                className="text-sm tracking-wide"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Pergunte ao Max
              </span>
            </div>
            <button
              type="button"
              className="rounded p-1 hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-3 py-2">
            <div className="space-y-2 pb-2">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={cn(
                    'max-w-[90%] rounded-xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'ml-auto bg-[#0066FF] text-white'
                      : 'mr-auto bg-slate-100 text-slate-800',
                  )}
                >
                  {m.text}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Max pensando…
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 border-t border-slate-200 p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Sua pergunta…"
              className="border-slate-300 bg-white text-slate-900"
              disabled={busy}
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0 bg-[#0066FF] text-white hover:bg-[#0052cc]"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!open && (
        <Button
          type="button"
          className="pointer-events-auto gap-2 rounded-full bg-[#0066FF] px-4 py-6 text-white shadow-lg hover:bg-[#0052cc]"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-5 w-5" />
          Pergunte ao Max
        </Button>
      )}
    </div>
  )
}
