import { Webhook, ExternalLink } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useNegativacaoWebhookConfig } from '@/hooks/useNegativacaoWebhookConfig';
import { useWebhooks } from '@/hooks/useWebhooks';

export function NegativacaoWebhookConfig() {
  const { config, isLoading: isLoadingConfig, updateConfig } = useNegativacaoWebhookConfig();
  const { webhooks, isLoading: isLoadingWebhooks } = useWebhooks();

  const isLoading = isLoadingConfig || isLoadingWebhooks;

  const handleWebhookChange = (webhookId: string) => {
    const value = webhookId === 'none' ? null : webhookId;
    updateConfig.mutate({ webhook_id: value });
  };

  const handleAtivoChange = (ativo: boolean) => {
    updateConfig.mutate({ ativo });
  };

  // Filtrar apenas webhooks ativos
  const webhooksAtivos = webhooks.filter((w) => w.ativo !== false);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Disparo de Webhook</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="webhook-ativo" className="text-sm text-muted-foreground">
            {config?.ativo ? 'Ativo' : 'Inativo'}
          </Label>
          <Switch
            id="webhook-ativo"
            checked={config?.ativo ?? false}
            onCheckedChange={handleAtivoChange}
            disabled={updateConfig.isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook-select" className="text-sm">
          Webhook a disparar
        </Label>
        <Select
          value={config?.webhook_id || 'none'}
          onValueChange={handleWebhookChange}
          disabled={updateConfig.isPending || !config?.ativo}
        >
          <SelectTrigger id="webhook-select" className="w-full">
            <SelectValue placeholder="Selecione um webhook..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum webhook selecionado</SelectItem>
            {webhooksAtivos.map((webhook) => (
              <SelectItem key={webhook.id} value={webhook.id}>
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-3 w-3" />
                  {webhook.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          O webhook será disparado automaticamente após negativar um número.
          {webhooksAtivos.length === 0 && (
            <span className="text-yellow-600 dark:text-yellow-400 ml-1">
              Nenhum webhook ativo encontrado. Configure em Webhooks.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
