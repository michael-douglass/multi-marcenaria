import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Loader2, Save, ShieldCheck } from 'lucide-react';
import { useMarketingAIStudio } from '@/hooks/useMarketingAIStudio';
import { StudioSection } from './StudioMotionStyles';

export function AIConnectionsSection() {
  const { status, isLoadingStatus, saveSecrets } = useMarketingAIStudio();
  const [openaiKey, setOpenaiKey] = useState('');
  const [serpKey, setSerpKey] = useState('');

  const handleSave = async () => {
    const body: { openai_api_key?: string; serp_api_key?: string } = {};
    if (openaiKey.trim()) body.openai_api_key = openaiKey.trim();
    if (serpKey.trim()) body.serp_api_key = serpKey.trim();
    if (!body.openai_api_key && !body.serp_api_key) return;
    await saveSecrets.mutateAsync(body);
    setOpenaiKey('');
    setSerpKey('');
  };

  return (
    <StudioSection
      title="Conexões"
      description="As chaves ficam só no servidor — o navegador nunca as lê de volta."
      delayMs={60}
      action={
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <span className="text-xs text-muted-foreground">Seguro</span>
        </div>
      }
    >
      {isLoadingStatus ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando status…
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge
            variant={status?.openai_configured ? 'default' : 'secondary'}
            className={
              status?.openai_configured
                ? 'bg-amber-800 hover:bg-amber-800'
                : undefined
            }
          >
            OpenAI{' '}
            {status?.openai_configured
              ? status.openai_key_hint || '••••'
              : 'não configurada'}
          </Badge>
          <Badge variant={status?.serp_configured ? 'outline' : 'secondary'}>
            SerpAPI{' '}
            {status?.serp_configured
              ? status.serp_key_hint || '••••'
              : 'opcional'}
          </Badge>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="studio-openai">Chave OpenAI</Label>
          <Input
            id="studio-openai"
            type="password"
            autoComplete="off"
            placeholder={
              status?.openai_configured
                ? 'Nova chave (deixe vazio para manter)'
                : 'sk-...'
            }
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="studio-serp">Chave SerpAPI (opcional)</Label>
          <Input
            id="studio-serp"
            type="password"
            autoComplete="off"
            placeholder={
              status?.serp_configured
                ? 'Nova chave (deixe vazio para manter)'
                : 'Para modo aleatório com web'
            }
            value={serpKey}
            onChange={(e) => setSerpKey(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <Button
          className="studio-cta gap-2 bg-amber-900 text-amber-50 hover:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-600"
          onClick={handleSave}
          disabled={
            saveSecrets.isPending || (!openaiKey.trim() && !serpKey.trim())
          }
        >
          {saveSecrets.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar chaves
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Só cole a chave quando for atualizar. O status mostra apenas o final
        mascarado (••••xxxx).
      </p>
    </StudioSection>
  );
}
