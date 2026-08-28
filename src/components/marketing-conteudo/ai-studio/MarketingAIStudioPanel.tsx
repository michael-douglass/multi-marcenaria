import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Feather, Loader2 } from 'lucide-react';
import { useMarketingAIStudio } from '@/hooks/useMarketingAIStudio';
import { StudioMotionStyles } from './StudioMotionStyles';
import { AIConnectionsSection } from './AIConnectionsSection';
import { AIAgentsPipeline } from './AIAgentsPipeline';
import { AIPersonalitiesSection } from './AIPersonalitiesSection';

export function MarketingAIStudioPanel() {
  const { status, isLoadingStatus, setStudioActive } = useMarketingAIStudio();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-900/15 bg-gradient-to-br from-amber-50/80 via-background to-stone-100/60 p-4 dark:border-amber-100/10 dark:from-amber-950/20 dark:via-background dark:to-stone-950/40 sm:p-6">
      <StudioMotionStyles />

      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-stone-400/10 blur-3xl"
      />

      <div className="studio-reveal relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-900 text-amber-50 shadow-md dark:bg-amber-700">
            <Feather className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-900/70 dark:text-amber-200/70">
              Atelier
            </p>
            <h2 className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl">
              Studio de Copy
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Configure chaves, pesquisa e vozes. No card, o botão Gerar com IA
              preenche o Script de Copy automaticamente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-amber-900/10 bg-background/70 px-3 py-2 dark:border-amber-100/10">
          {isLoadingStatus ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Label htmlFor="studio-ativo" className="text-sm">
                Studio ativo
              </Label>
              <Switch
                id="studio-ativo"
                checked={status?.ativo ?? false}
                onCheckedChange={(checked) => setStudioActive.mutate(checked)}
                disabled={!status || setStudioActive.isPending}
              />
            </>
          )}
        </div>
      </div>

      <div className="relative space-y-4">
        <AIConnectionsSection />
        <AIAgentsPipeline />
        <AIPersonalitiesSection />
      </div>
    </div>
  );
}
