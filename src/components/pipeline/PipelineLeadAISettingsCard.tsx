import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';

/**
 * IA do pipeline (Compor com IA do Markup e Contratos). A renderização de projetos do card do lead
 * NÃO é configurada aqui: motor, modelos, prompts e chave são da plataforma, definidos pelo master
 * (docs/ia-lead, ADR 0007). A chave da OpenAI desta empresa (usada no Markup e nos Contratos) fica
 * em Configurações IA.
 */
export function PipelineLeadAISettingsCard() {
  const { config, isLoading, error, refetch, saveConfig } = usePipelineLeadAIConfig({ admin: true });
  const [ativo, setAtivo] = useState(config.ativo);

  useEffect(() => {
    setAtivo(config.ativo);
  }, [config.ativo]);

  const handleSave = async () => {
    try {
      // O hook grava a configuração inteira: reenvia o que já está salvo e troca só o interruptor.
      await saveConfig.mutateAsync({ ...config, ativo });
    } catch {
      // Toast de erro já é exibido pelo hook.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          IA do pipeline
        </CardTitle>
        <CardDescription>
          Liga ou desliga o &quot;Compor com IA&quot; do Markup e dos Contratos. A chave da OpenAI fica em{' '}
          <Link to="/configuracoes-ia" className="font-medium text-primary underline-offset-4 hover:underline">
            Configurações IA
          </Link>
          . A renderização de projetos no card do lead é controlada pela plataforma. Somente administradores
          podem alterar.
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
                <Label htmlFor="lead-ai-ativo">IA do pipeline ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligada, o Compor com IA (Markup) e a IA dos Contratos ficam indisponíveis.
                </p>
              </div>
              <Switch id="lead-ai-ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <Button onClick={handleSave} disabled={saveConfig.isPending || ativo === config.ativo}>
              {saveConfig.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
