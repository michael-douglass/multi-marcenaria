import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { isMissingDbRelationError, isPostgrestColumnError } from '@/lib/supabase-missing-relation'
import { toast } from 'sonner'

export interface OrcamentosIaAiSecretsStatus {
  id: string | null
  companyId: string
  openaiConfigured: boolean
  anthropicConfigured: boolean
  atualizadoEm: string | null
}

const PUBLIC_TABLE = 'orcamentos_ia_ai_secrets_public'
const ADMIN_TABLE = 'orcamentos_ia_ai_secrets'

function emptyStatus(companyId: string): OrcamentosIaAiSecretsStatus {
  return {
    id: null,
    companyId,
    openaiConfigured: false,
    anthropicConfigured: false,
    atualizadoEm: null,
  }
}

export function useOrcamentosIaAiSecrets() {
  const { empresa } = useEmpresa()
  const companyId = empresa?.id ?? ''
  const queryClient = useQueryClient()
  const queryKey = ['orcamentos-ia-ai-secrets', companyId] as const

  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey,
    enabled: Boolean(companyId),
    staleTime: 30_000,
    queryFn: async (): Promise<OrcamentosIaAiSecretsStatus> => {
      if (!companyId) return emptyStatus('')

      const { data, error: fetchError } = await supabase
        .from(PUBLIC_TABLE)
        .select('id, company_id, atualizado_em, openai_configured, anthropic_configured')
        .eq('company_id', companyId)
        .maybeSingle()

      if (fetchError) {
        if (isMissingDbRelationError(fetchError) || isPostgrestColumnError(fetchError)) {
          return emptyStatus(companyId)
        }
        throw fetchError
      }

      if (!data) return emptyStatus(companyId)

      return {
        id: String(data.id),
        companyId,
        openaiConfigured: Boolean(data.openai_configured),
        anthropicConfigured: Boolean(data.anthropic_configured),
        atualizadoEm: data.atualizado_em ?? null,
      }
    },
    retry: (failureCount, err) => !isMissingDbRelationError(err) && failureCount < 2,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orcamentos-ia-ai-secrets', companyId] })
  }

  const saveOpenAiKey = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!companyId) throw new Error('Empresa não selecionada')
      const trimmed = apiKey.trim()
      if (!trimmed) throw new Error('Informe a chave da OpenAI')
      if (!trimmed.startsWith('sk-')) {
        throw new Error('A chave da OpenAI deve começar com sk-')
      }
      const { error: upsertError } = await supabase.from(ADMIN_TABLE).upsert(
        {
          company_id: companyId,
          openai_api_key: trimmed,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      )
      if (upsertError) throw upsertError
    },
    onSuccess: () => {
      invalidate()
      toast.success('Chave OpenAI do Orçamentos IA salva')
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar a chave OpenAI', { description: err.message })
    },
  })

  const clearOpenAiKey = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não selecionada')
      const { error: upsertError } = await supabase.from(ADMIN_TABLE).upsert(
        {
          company_id: companyId,
          openai_api_key: null,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      )
      if (upsertError) throw upsertError
    },
    onSuccess: () => {
      invalidate()
      toast.success('Chave OpenAI do Orçamentos IA removida')
    },
    onError: (err: Error) => {
      toast.error('Não foi possível remover a chave OpenAI', { description: err.message })
    },
  })

  const saveAnthropicKey = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!companyId) throw new Error('Empresa não selecionada')
      const trimmed = apiKey.trim()
      if (!trimmed) throw new Error('Informe a chave da Anthropic')
      if (!trimmed.startsWith('sk-ant-') && !trimmed.startsWith('sk-')) {
        throw new Error('A chave da Anthropic deve começar com sk-ant- ou sk-')
      }
      const { error: upsertError } = await supabase.from(ADMIN_TABLE).upsert(
        {
          company_id: companyId,
          anthropic_api_key: trimmed,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      )
      if (upsertError) throw upsertError
    },
    onSuccess: () => {
      invalidate()
      toast.success('Chave Anthropic do Orçamentos IA salva')
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar a chave Anthropic', { description: err.message })
    },
  })

  const clearAnthropicKey = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não selecionada')
      const { error: upsertError } = await supabase.from(ADMIN_TABLE).upsert(
        {
          company_id: companyId,
          anthropic_api_key: null,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      )
      if (upsertError) throw upsertError
    },
    onSuccess: () => {
      invalidate()
      toast.success('Chave Anthropic do Orçamentos IA removida')
    },
    onError: (err: Error) => {
      toast.error('Não foi possível remover a chave Anthropic', { description: err.message })
    },
  })

  return {
    status: status ?? emptyStatus(companyId),
    isLoading,
    error,
    refetch,
    saveOpenAiKey,
    clearOpenAiKey,
    saveAnthropicKey,
    clearAnthropicKey,
  }
}
