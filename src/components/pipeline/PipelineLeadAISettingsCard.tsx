import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Loader2, KeyRound, Eye, EyeOff, ImageIcon, MessageCircle, Database, Sofa } from 'lucide-react';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import {
  PIPELINE_LEAD_AI_MODELS,
  PIPELINE_LEAD_AI_IMAGE_MODELS,
  PIPELINE_LEAD_AI_EMBEDDING_MODELS,
  PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH,
  type PipelineLeadAIModel,
  type PipelineLeadAIImageModel,
  type PipelineLeadAIEmbeddingModel,
} from '@/lib/pipeline-lead-ai-config';

export function PipelineLeadAISettingsCard() {
  const { config, isLoading, error, refetch, saveConfig } = usePipelineLeadAIConfig({ admin: true });
  const [model, setModel] = useState<PipelineLeadAIModel>(config.model);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [briefingPrompt, setBriefingPrompt] = useState(config.briefingPrompt);
  const [ativo, setAtivo] = useState(config.ativo);
  const [renderAtivo, setRenderAtivo] = useState(config.renderAtivo);
  const [renderVisionModel, setRenderVisionModel] = useState<PipelineLeadAIModel>(config.renderVisionModel);
  const [renderImageModel, setRenderImageModel] = useState<PipelineLeadAIImageModel>(config.renderImageModel);
  const [renderAnalysisPrompt, setRenderAnalysisPrompt] = useState(config.renderAnalysisPrompt);
  const [renderPrompt, setRenderPrompt] = useState(config.renderPrompt);
  const [renderAmbienteAtivo, setRenderAmbienteAtivo] = useState(config.renderAmbienteAtivo);
  const [renderAmbienteAnalysisPrompt, setRenderAmbienteAnalysisPrompt] = useState(
    config.renderAmbienteAnalysisPrompt,
  );
  const [renderAmbientePrompt, setRenderAmbientePrompt] = useState(config.renderAmbientePrompt);
  const [irisSkyAtivo, setIrisSkyAtivo] = useState(config.irisSkyAtivo);
  const [irisSkyModel, setIrisSkyModel] = useState<PipelineLeadAIModel>(config.irisSkyModel);
  const [irisSkyKnowledgeAtivo, setIrisSkyKnowledgeAtivo] = useState(config.irisSkyKnowledgeAtivo);
  const [irisSkyEmbeddingModel, setIrisSkyEmbeddingModel] = useState<PipelineLeadAIEmbeddingModel>(
    config.irisSkyEmbeddingModel,
  );
  const [irisSkyIncludeMediaVision, setIrisSkyIncludeMediaVision] = useState(
    config.irisSkyIncludeMediaVision,
  );
  const [irisSkyIncludeWhatsapp, setIrisSkyIncludeWhatsapp] = useState(config.irisSkyIncludeWhatsapp);
  const [irisSkyMatchCount, setIrisSkyMatchCount] = useState(config.irisSkyMatchCount);
  const [irisSkyChatPrompt, setIrisSkyChatPrompt] = useState(config.irisSkyChatPrompt);
  const [irisSkySpotPrompt, setIrisSkySpotPrompt] = useState(config.irisSkySpotPrompt);
  const [irisSkyKnowledgeMaxItems, setIrisSkyKnowledgeMaxItems] = useState(
    config.irisSkyKnowledgeMaxItems,
  );
  const [irisSkyKnowledgeMaxPages, setIrisSkyKnowledgeMaxPages] = useState(
    config.irisSkyKnowledgeMaxPages,
  );
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setModel(config.model);
    setSystemPrompt(config.systemPrompt);
    setBriefingPrompt(config.briefingPrompt);
    setAtivo(config.ativo);
    setRenderAtivo(config.renderAtivo);
    setRenderVisionModel(config.renderVisionModel);
    setRenderImageModel(config.renderImageModel);
    setRenderAnalysisPrompt(config.renderAnalysisPrompt);
    setRenderPrompt(config.renderPrompt);
    setRenderAmbienteAtivo(config.renderAmbienteAtivo);
    setRenderAmbienteAnalysisPrompt(config.renderAmbienteAnalysisPrompt);
    setRenderAmbientePrompt(config.renderAmbientePrompt);
    setIrisSkyAtivo(config.irisSkyAtivo);
    setIrisSkyModel(config.irisSkyModel);
    setIrisSkyKnowledgeAtivo(config.irisSkyKnowledgeAtivo);
    setIrisSkyEmbeddingModel(config.irisSkyEmbeddingModel);
    setIrisSkyIncludeMediaVision(config.irisSkyIncludeMediaVision);
    setIrisSkyIncludeWhatsapp(config.irisSkyIncludeWhatsapp);
    setIrisSkyMatchCount(config.irisSkyMatchCount);
    setIrisSkyChatPrompt(config.irisSkyChatPrompt);
    setIrisSkySpotPrompt(config.irisSkySpotPrompt);
    setIrisSkyKnowledgeMaxItems(config.irisSkyKnowledgeMaxItems);
    setIrisSkyKnowledgeMaxPages(config.irisSkyKnowledgeMaxPages);
  }, [
    config.model,
    config.systemPrompt,
    config.briefingPrompt,
    config.ativo,
    config.renderAtivo,
    config.renderVisionModel,
    config.renderImageModel,
    config.renderAnalysisPrompt,
    config.renderPrompt,
    config.renderAmbienteAtivo,
    config.renderAmbienteAnalysisPrompt,
    config.renderAmbientePrompt,
    config.irisSkyAtivo,
    config.irisSkyModel,
    config.irisSkyKnowledgeAtivo,
    config.irisSkyEmbeddingModel,
    config.irisSkyIncludeMediaVision,
    config.irisSkyIncludeWhatsapp,
    config.irisSkyMatchCount,
    config.irisSkyChatPrompt,
    config.irisSkySpotPrompt,
    config.irisSkyKnowledgeMaxItems,
    config.irisSkyKnowledgeMaxPages,
  ]);

  const selectedModelInfo = PIPELINE_LEAD_AI_MODELS.find((m) => m.value === model);

  const selectedRenderImageInfo = PIPELINE_LEAD_AI_IMAGE_MODELS.find((m) => m.value === renderImageModel);

  const handleSave = async () => {
    try {
      await saveConfig.mutateAsync({
        model,
        systemPrompt,
        briefingPrompt,
        ativo,
        renderAtivo,
        renderVisionModel,
        renderImageModel,
        renderAnalysisPrompt,
        renderPrompt,
        renderAmbienteAtivo,
        renderAmbienteAnalysisPrompt,
        renderAmbientePrompt,
        irisSkyAtivo,
        irisSkyModel,
        irisSkyKnowledgeAtivo,
        irisSkyEmbeddingModel,
        irisSkyIncludeMediaVision,
        irisSkyIncludeWhatsapp,
        irisSkyMatchCount,
        irisSkyChatPrompt,
        irisSkySpotPrompt,
        irisSkyAutoIndexAtivo: false,
        irisSkyKnowledgeMaxItems,
        irisSkyKnowledgeMaxPages,
        apiKey: apiKey.trim() || undefined,
      });
      setApiKey('');
      setShowApiKey(false);
    } catch {
      // Toast de erro já é exibido pelo hook.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Configuração de IA — Card do Lead
        </CardTitle>
        <CardDescription>
          Define a chave da OpenAI, o modelo e o prompt usados na aba &quot;Análise IA&quot; de cada
          lead. Somente administradores podem alterar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-3">
            <p className="text-sm text-destructive">
              Não foi possível carregar a configuração de IA do servidor.
            </p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Erro desconhecido'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="lead-ai-ativo">Análise de IA ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligada, vendedores não conseguem disparar análises.
                </p>
              </div>
              <Switch id="lead-ai-ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-ai-api-key" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Chave API OpenAI
              </Label>
              <div className="relative">
                <Input
                  id="lead-ai-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    config.apiKeyConfigured
                      ? 'Chave já configurada — digite uma nova para substituir'
                      : 'sk-...'
                  }
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.apiKeyConfigured ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Chave salva no servidor. Deixe em branco para manter a atual.
                  </span>
                ) : (
                  'Obtenha sua chave em platform.openai.com → API keys. Ela fica armazenada de forma segura e não aparece para vendedores.'
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-ai-model">Modelo da IA</Label>
              <Select value={model} onValueChange={(v) => setModel(v as PipelineLeadAIModel)}>
                <SelectTrigger id="lead-ai-model">
                  <SelectValue placeholder="Escolha o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_LEAD_AI_MODELS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModelInfo && (
                <p className="text-xs text-muted-foreground">{selectedModelInfo.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="lead-ai-prompt">Prompt da IA</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {systemPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="lead-ai-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={12}
                maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                placeholder="Instruções para a IA ao analisar fotos do lead…"
                className="font-mono text-sm resize-y min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders:{' '}
                <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                <code className="text-[11px]">{'{{origem}}'}</code>
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="lead-ai-briefing-prompt">Prompt de perguntas para briefing</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {briefingPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="lead-ai-briefing-prompt"
                value={briefingPrompt}
                onChange={(e) => setBriefingPrompt(e.target.value)}
                rows={10}
                maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                placeholder="Instruções para gerar perguntas de briefing com base no relatório e no orçamento…"
                className="font-mono text-sm resize-y min-h-[160px]"
              />
              <p className="text-xs text-muted-foreground">
                Gerado junto com o relatório ao clicar em &quot;Analisar com IA&quot;. Placeholders:{' '}
                <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                <code className="text-[11px]">{'{{origem}}'}</code>,{' '}
                <code className="text-[11px]">{'{{relatorio}}'}</code>,{' '}
                <code className="text-[11px]">{'{{orcamento}}'}</code>
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-5">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Renderização de projetos</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Transforma esboços (lousa ou anexos) em render fotorrealista do móvel, preservando
                layout e proporções do desenho. Usa a mesma chave OpenAI acima. GPT Image 1.5 com
                alta fidelidade tem custo maior que análises de texto.
              </p>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="lead-ai-render-ativo">Renderização ativa</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desligada, vendedores não conseguem renderizar projetos.
                  </p>
                </div>
                <Switch id="lead-ai-render-ativo" checked={renderAtivo} onCheckedChange={setRenderAtivo} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lead-ai-render-vision-model">Modelo de análise do esboço</Label>
                  <Select
                    value={renderVisionModel}
                    onValueChange={(v) => setRenderVisionModel(v as PipelineLeadAIModel)}
                  >
                    <SelectTrigger id="lead-ai-render-vision-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_LEAD_AI_MODELS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-ai-render-image-model">Modelo de geração de imagem</Label>
                  <Select
                    value={renderImageModel}
                    onValueChange={(v) => setRenderImageModel(v as PipelineLeadAIImageModel)}
                  >
                    <SelectTrigger id="lead-ai-render-image-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_LEAD_AI_IMAGE_MODELS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRenderImageInfo && (
                    <p className="text-xs text-muted-foreground">{selectedRenderImageInfo.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-ai-render-analysis-prompt">Prompt de análise do esboço</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {renderAnalysisPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="lead-ai-render-analysis-prompt"
                  value={renderAnalysisPrompt}
                  onChange={(e) => setRenderAnalysisPrompt(e.target.value)}
                  rows={8}
                  maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  className="font-mono text-sm resize-y min-h-[140px]"
                />
                <p className="text-xs text-muted-foreground">
                  Etapa 1: classifica a imagem (esboço, móvel ou ambiente) e retorna inventário em YAML.
                  Placeholders: <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{origem}}'}</code>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-ai-render-prompt">Prompt de renderização fotorrealista</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {renderPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="lead-ai-render-prompt"
                  value={renderPrompt}
                  onChange={(e) => setRenderPrompt(e.target.value)}
                  rows={10}
                  maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  className="font-mono text-sm resize-y min-h-[160px]"
                />
                <p className="text-xs text-muted-foreground">
                  Etapa 2: gera a imagem realista. Placeholders:{' '}
                  <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{origem}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{analise}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{caracteristicas}}'}</code> (preenchido quando o
                  vendedor informa cor/material na hora da renderização)
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-5">
              <div className="flex items-center gap-2">
                <Sofa className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Renderização com ambiente</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Compõe uma cena de interiores a partir de um texto, de uma foto do cômodo e dos
                objetos que o vendedor posiciona. Usa a mesma chave OpenAI e os mesmos modelos da
                renderização de projetos acima. O prompt de estúdio continua valendo só para o
                móvel isolado.
              </p>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="lead-ai-render-ambiente-ativo">Renderização com ambiente ativa</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desligada, vendedores não conseguem montar nem renderizar ambientes.
                  </p>
                </div>
                <Switch
                  id="lead-ai-render-ambiente-ativo"
                  checked={renderAmbienteAtivo}
                  onCheckedChange={setRenderAmbienteAtivo}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-ai-render-ambiente-analysis-prompt">
                    Prompt de análise do ambiente
                  </Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {renderAmbienteAnalysisPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="lead-ai-render-ambiente-analysis-prompt"
                  value={renderAmbienteAnalysisPrompt}
                  onChange={(e) => setRenderAmbienteAnalysisPrompt(e.target.value)}
                  rows={8}
                  maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  className="font-mono text-sm resize-y min-h-[140px]"
                />
                <p className="text-xs text-muted-foreground">
                  Etapa 1: desmembra o texto e/ou a foto em YAML (cômodo, paleta, objetos sugeridos).
                  Placeholders: <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{origem}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{descricao}}'}</code>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-ai-render-ambiente-prompt">
                    Prompt de renderização do ambiente
                  </Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {renderAmbientePrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="lead-ai-render-ambiente-prompt"
                  value={renderAmbientePrompt}
                  onChange={(e) => setRenderAmbientePrompt(e.target.value)}
                  rows={10}
                  maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  className="font-mono text-sm resize-y min-h-[160px]"
                />
                <p className="text-xs text-muted-foreground">
                  Etapa 2: gera a cena fotorrealista a partir da montagem. Placeholders:{' '}
                  <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{origem}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{analise}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{descricao}}'}</code>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-5">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Íris Sky — chat e base de conhecimento</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Consultora privada no card do lead. Indexa cadastro, anexos, análises, orçamentos,
                formulários e WhatsApp em vetores para responder perguntas com contexto completo.
              </p>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="lead-ai-iris-ativo">Chat Íris Sky ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desligada, vendedores não conseguem conversar com a Íris Sky.
                  </p>
                </div>
                <Switch id="lead-ai-iris-ativo" checked={irisSkyAtivo} onCheckedChange={setIrisSkyAtivo} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lead-ai-iris-model">Modelo do chat</Label>
                  <Select
                    value={irisSkyModel}
                    onValueChange={(v) => setIrisSkyModel(v as PipelineLeadAIModel)}
                  >
                    <SelectTrigger id="lead-ai-iris-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_LEAD_AI_MODELS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-ai-iris-match-count">Trechos recuperados por pergunta</Label>
                  <Input
                    id="lead-ai-iris-match-count"
                    type="number"
                    min={4}
                    max={20}
                    value={irisSkyMatchCount}
                    onChange={(e) =>
                      setIrisSkyMatchCount(
                        Math.min(20, Math.max(4, Number(e.target.value) || 12)),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">Entre 4 e 20 trechos da base vetorial.</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="lead-ai-iris-knowledge-ativo">Base de conhecimento (vetores)</Label>
                  <p className="text-xs text-muted-foreground">
                    Indexa documentos e dados do lead para busca semântica nas respostas.
                  </p>
                </div>
                <Switch
                  id="lead-ai-iris-knowledge-ativo"
                  checked={irisSkyKnowledgeAtivo}
                  onCheckedChange={setIrisSkyKnowledgeAtivo}
                />
              </div>

              {irisSkyKnowledgeAtivo && (
                <div className="space-y-4 rounded-lg border border-dashed border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">Indexação automática</p>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Ao abrir o card do lead ou anexar arquivos, o sistema transforma dados e
                    documentos em vetores para a Íris Sky consultar no chat.
                  </p>

                  <p className="rounded-lg border border-border/60 bg-background/50 px-4 py-3 text-xs text-muted-foreground">
                    A indexação automática é controlada <strong className="font-medium text-foreground">lead a lead</strong>, no card
                    &quot;Memória da Íris&quot;. Por padrão vem desligada — ligue a chave só nos leads em que
                    quiser atualizar a memória ao abrir o card ou ao anexar arquivos.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lead-ai-iris-max-items">Máx. arquivos por indexação</Label>
                      <Input
                        id="lead-ai-iris-max-items"
                        type="number"
                        min={5}
                        max={50}
                        value={irisSkyKnowledgeMaxItems}
                        onChange={(e) =>
                          setIrisSkyKnowledgeMaxItems(
                            Math.min(50, Math.max(5, Number(e.target.value) || 25)),
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">Entre 5 e 50 anexos/imagens.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lead-ai-iris-max-pages">Máx. páginas de PDF por vez</Label>
                      <Input
                        id="lead-ai-iris-max-pages"
                        type="number"
                        min={10}
                        max={100}
                        value={irisSkyKnowledgeMaxPages}
                        onChange={(e) =>
                          setIrisSkyKnowledgeMaxPages(
                            Math.min(100, Math.max(10, Number(e.target.value) || 40)),
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Cada página de PDF conta como uma leitura com IA.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lead-ai-iris-embedding-model">Modelo de embeddings</Label>
                    <Select
                      value={irisSkyEmbeddingModel}
                      onValueChange={(v) =>
                        setIrisSkyEmbeddingModel(v as PipelineLeadAIEmbeddingModel)
                      }
                    >
                      <SelectTrigger id="lead-ai-iris-embedding-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_LEAD_AI_EMBEDDING_MODELS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="lead-ai-iris-media-vision">Ler texto de anexos e lousa</Label>
                      <p className="text-xs text-muted-foreground">
                        Usa visão da IA para extrair conteúdo de PDFs e imagens (custo adicional).
                      </p>
                    </div>
                    <Switch
                      id="lead-ai-iris-media-vision"
                      checked={irisSkyIncludeMediaVision}
                      onCheckedChange={setIrisSkyIncludeMediaVision}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="lead-ai-iris-whatsapp">Incluir histórico WhatsApp</Label>
                      <p className="text-xs text-muted-foreground">
                        Indexa mensagens pelo telefone cadastrado no lead.
                      </p>
                    </div>
                    <Switch
                      id="lead-ai-iris-whatsapp"
                      checked={irisSkyIncludeWhatsapp}
                      onCheckedChange={setIrisSkyIncludeWhatsapp}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-ai-iris-spot-prompt">Prompt de análise por clique (Íris Sky)</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {irisSkySpotPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="lead-ai-iris-spot-prompt"
                  value={irisSkySpotPrompt}
                  onChange={(e) => setIrisSkySpotPrompt(e.target.value)}
                  rows={12}
                  maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  className="font-mono text-sm resize-y min-h-[180px]"
                />
                <p className="text-xs text-muted-foreground">
                  Usado quando o vendedor clica em um ponto da imagem no chat Íris Sky. Saída esperada:
                  YAML do elemento tocado. Placeholders:{' '}
                  <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{origem}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{relatorio}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{analise}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{media_label}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{coordenadas}}'}</code>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-ai-iris-chat-prompt">Prompt do chat Íris Sky</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {irisSkyChatPrompt.length}/{PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="lead-ai-iris-chat-prompt"
                  value={irisSkyChatPrompt}
                  onChange={(e) => setIrisSkyChatPrompt(e.target.value)}
                  rows={12}
                  maxLength={PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH}
                  className="font-mono text-sm resize-y min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Placeholders:{' '}
                  <code className="text-[11px]">{'{{nome_lead}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{origem}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{relatorio}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{briefing}}'}</code>,{' '}
                  <code className="text-[11px]">{'{{conhecimento}}'}</code>
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saveConfig.isPending}>
              {saveConfig.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar configuração de IA'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
