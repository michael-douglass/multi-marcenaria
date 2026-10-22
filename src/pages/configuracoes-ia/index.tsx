import { BrainCircuit, FileText, Sparkles } from 'lucide-react'
import { AiApiKeyCard, AiApiKeyField } from '@/components/configuracoes-ia/AiApiKeyCard'
import { useOrcamentosIaAiSecrets } from '@/hooks/useOrcamentosIaAiSecrets'
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'

export default function ConfiguracoesIaPage() {
  const { userRole, isSuperAdmin } = useAuth()
  const isAdmin = userRole === 'admin' || isSuperAdmin
  const { empresa } = useEmpresa()
  const {
    config,
    isLoading: leadLoading,
    saveLeadApiKey,
    clearLeadApiKey,
    saveContratoApiKey,
    clearContratoApiKey,
  } = usePipelineLeadAIConfig({ admin: true })
  const {
    status: orcStatus,
    isLoading: orcLoading,
    saveOpenAiKey,
    clearOpenAiKey,
    saveAnthropicKey,
    clearAnthropicKey,
  } = useOrcamentosIaAiSecrets()

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações IA</h1>
        <p className="mt-2 text-muted-foreground">
          Apenas administradores podem gerenciar as chaves de API.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações IA</h1>
        <p className="text-sm text-muted-foreground">
          Cada módulo tem sua própria chave. Sem chave salva, a função fica desligada até você colar
          uma nova. Empresa: <span className="font-medium text-foreground">{empresa?.nome ?? '—'}</span>
        </p>
      </header>

      <AiApiKeyCard
        title="Orçamentos IA"
        description="Usada no pipeline de corte, chat e memória (embeddings). OpenAI é obrigatória; Anthropic só se você usar modelos Claude."
        footerHint={
          <span className="inline-flex items-center gap-1.5">
            <BrainCircuit className="h-3.5 w-3.5" />
            Página: Orçamentos IA
          </span>
        }
      >
        {orcLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <AiApiKeyField
              id="orcamentos-openai"
              label="OpenAI"
              configured={orcStatus.openaiConfigured}
              saving={saveOpenAiKey.isPending}
              clearing={clearOpenAiKey.isPending}
              onSave={async (v) => {
                await saveOpenAiKey.mutateAsync(v)
              }}
              onClear={async () => {
                await clearOpenAiKey.mutateAsync()
              }}
            />
            <AiApiKeyField
              id="orcamentos-anthropic"
              label="Anthropic (Claude)"
              configured={orcStatus.anthropicConfigured}
              placeholder="sk-ant-..."
              saving={saveAnthropicKey.isPending}
              clearing={clearAnthropicKey.isPending}
              onSave={async (v) => {
                await saveAnthropicKey.mutateAsync(v)
              }}
              onClear={async () => {
                await clearAnthropicKey.mutateAsync()
              }}
            />
          </>
        )}
      </AiApiKeyCard>

      <AiApiKeyCard
        title="Lead — análise visual e render"
        description="Usada nas abas Análise visual e Renderização de projetos do card do lead (e funções ligadas, como Íris)."
        footerHint={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Prompts e modelos continuam em Pipeline → Configurações → IA
          </span>
        }
      >
        {leadLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <AiApiKeyField
            id="lead-openai"
            label="OpenAI"
            configured={config.apiKeyConfigured}
            saving={saveLeadApiKey.isPending}
            clearing={clearLeadApiKey.isPending}
            onSave={async (v) => {
              await saveLeadApiKey.mutateAsync(v)
            }}
            onClear={async () => {
              await clearLeadApiKey.mutateAsync()
            }}
          />
        )}
      </AiApiKeyCard>

      <AiApiKeyCard
        title="Contratos — assistente IA"
        description="Usada só pelo botão flutuante de assistente na tela de contratos. Independente da chave do Lead."
        footerHint={
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Página: Contratos
          </span>
        }
      >
        {leadLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <AiApiKeyField
            id="contrato-openai"
            label="OpenAI"
            configured={config.contratoApiKeyConfigured}
            saving={saveContratoApiKey.isPending}
            clearing={clearContratoApiKey.isPending}
            onSave={async (v) => {
              await saveContratoApiKey.mutateAsync(v)
            }}
            onClear={async () => {
              await clearContratoApiKey.mutateAsync()
            }}
          />
        )}
      </AiApiKeyCard>
    </div>
  )
}
