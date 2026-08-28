import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  juntarWhatsApp,
  parseChatBoot,
  parseEventosBoot,
  parseLeadIaBoot,
  parseN8nWhatsApp,
  parseNotificacoes,
  parseWhatsAppHistorico,
  type CrmChatContato,
  type CrmEvento,
  type CrmEventoPagina,
  type CrmLeadAnalise,
  type CrmLeadIaChat,
  type CrmLeadRender,
  type CrmNotificacao,
  type CrmWhatsAppMsg,
} from '@/lib/crm-comunicacao'

export function useCrmNotificacoes(enabled = true) {
  const { isReady } = useAuthReady()
  const [items, setItems] = useState<CrmNotificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !enabled) return
    if (!opts?.silent) setLoading(true)
    try {
      const { data, error } = await supabase.rpc('movelaria_crm_notificacoes', {
        p_limit: 40,
        p_offset: 0,
      })
      if (error) throw error
      const parsed = parseNotificacoes(data)
      setItems(parsed.items)
      setNaoLidas(parsed.naoLidas)
    } catch {
      if (!opts?.silent) {
        setItems([])
        setNaoLidas(0)
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load({ silent: true }) })

  const marcarLida = async (id: string | null, todas = false) => {
    const { error } = await supabase.rpc('movelaria_crm_notificacao_ler', {
      p_id: id,
      p_todas: todas,
    })
    if (error) throw new Error(error.message)
    await load({ silent: true })
  }

  return { items, naoLidas, loading, marcarLida, reload: load }
}

export function useCrmWhatsApp(telefone: string | null, enabled = true) {
  const { isReady } = useAuthReady()
  const [messages, setMessages] = useState<CrmWhatsAppMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !enabled || !telefone) return
    setLoading(true)
    setAviso(null)
    try {
      const { data, error } = await supabase.rpc('movelaria_crm_whatsapp_historico', {
        p_telefone: telefone,
      })
      if (error) throw error
      const local = parseWhatsAppHistorico(data)
      let n8n: CrmWhatsAppMsg[] = []
      try {
        const invoked = await supabase.functions.invoke('get-lead-whatsapp-history', {
          body: { telefone },
        })
        if (!invoked.error) n8n = parseN8nWhatsApp(invoked.data)
      } catch {
        setAviso('O histórico antigo do WhatsApp pode estar incompleto.')
      }
      setMessages(juntarWhatsApp(local, n8n))
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'Não foi possível abrir o WhatsApp.')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [isReady, enabled, telefone])

  useEffect(() => { void load() }, [load])

  const enviar = async (texto: string) => {
    if (!telefone) throw new Error('Informe o telefone do lead.')
    const { error: sendErr } = await supabase.functions.invoke('send-whatsapp-message', {
      body: { telefone, mensagem: texto, tipo: 'texto' },
    })
    if (sendErr) {
      const fallback = await supabase.functions.invoke('send-whatsapp', {
        body: { telefone, mensagem: texto },
      })
      if (fallback.error) {
        await supabase.rpc('movelaria_crm_whatsapp_registrar', {
          p_telefone: telefone,
          p_conteudo: texto,
        })
        throw new Error('A mensagem ficou registrada no CRM, mas o envio pelo WhatsApp falhou.')
      }
    }
    const { error } = await supabase.rpc('movelaria_crm_whatsapp_registrar', {
      p_telefone: telefone,
      p_conteudo: texto,
    })
    if (error) throw new Error(error.message)
    await load()
  }

  return { messages, loading, aviso, enviar, reload: load }
}

export function useCrmEventos() {
  const { isReady } = useAuthReady()
  const [eventos, setEventos] = useState<CrmEvento[]>([])
  const [paginas, setPaginas] = useState<CrmEventoPagina[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    setLoading(true)
    void supabase.rpc('movelaria_crm_eventos_boot').then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else {
        const parsed = parseEventosBoot(data)
        setEventos(parsed.eventos)
        setPaginas(parsed.paginas)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [isReady])

  return { eventos, paginas, loading, error }
}

export function useCrmChatInterno() {
  const { isReady } = useAuthReady()
  const [contatos, setContatos] = useState<CrmChatContato[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    void supabase.rpc('movelaria_crm_chat_boot').then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setContatos(parseChatBoot(data))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [isReady])

  return { contatos, loading, error }
}

export function useCrmLeadIa(leadId: number | null) {
  const { isReady } = useAuthReady()
  const [analises, setAnalises] = useState<CrmLeadAnalise[]>([])
  const [renders, setRenders] = useState<CrmLeadRender[]>([])
  const [chat, setChat] = useState<CrmLeadIaChat[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isReady || leadId == null) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('movelaria_crm_lead_ia_boot', { p_lead_id: leadId })
      if (error) throw error
      const parsed = parseLeadIaBoot(data)
      setAnalises(parsed.analises)
      setRenders(parsed.renders)
      setChat(parsed.chat)
    } catch {
      setAnalises([])
      setRenders([])
      setChat([])
    } finally {
      setLoading(false)
    }
  }, [isReady, leadId])

  useEffect(() => { void load() }, [load])

  const pedirAnalise = async (leadName: string, leadOrigin: string) => {
    if (leadId == null) throw new Error('Informe o lead')
    const { data, error } = await supabase.functions.invoke('analyze-lead-photos', {
      body: {
        leadId,
        empresaSchema: 'emp_garbo',
        leadName,
        leadOrigin,
        itens: [],
      },
    })
    if (error) throw new Error(error.message)
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error))
    }
    await load()
  }

  return { analises, renders, chat, loading, pedirAnalise, reload: load }
}
