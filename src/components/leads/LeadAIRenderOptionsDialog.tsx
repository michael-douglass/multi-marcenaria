import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LeadAIRenderThinkingState } from '@/components/leads/LeadAIRenderThinkingState';
import {
  formatLeadAIRenderCaracteristicas,
  hasLeadAIRenderCaracteristicas,
  type LeadAIRenderCaracteristicas,
} from '@/lib/lead-ai-render-caracteristicas';
import { cn } from '@/lib/utils';
import { Palette, Sparkles } from 'lucide-react';

interface LeadAIRenderOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sketchLabel?: string;
  isSubmitting?: boolean;
  onConfirm: (caracteristicasExtras?: string) => void;
}

const EMPTY: LeadAIRenderCaracteristicas = {
  cor: '',
  material: '',
  detalhes: '',
};

export function LeadAIRenderOptionsDialog({
  open,
  onOpenChange,
  sketchLabel,
  isSubmitting = false,
  onConfirm,
}: LeadAIRenderOptionsDialogProps) {
  const [addExtras, setAddExtras] = useState(false);
  const [form, setForm] = useState<LeadAIRenderCaracteristicas>(EMPTY);
  const [frozenForm, setFrozenForm] = useState<LeadAIRenderCaracteristicas | null>(null);

  useEffect(() => {
    if (!open) {
      setAddExtras(false);
      setForm(EMPTY);
      setFrozenForm(null);
    }
  }, [open]);

  const handleConfirm = () => {
    if (addExtras) {
      setFrozenForm({ ...form });
    } else {
      setFrozenForm(null);
    }
    const extras = addExtras ? formatLeadAIRenderCaracteristicas(form) : undefined;
    onConfirm(extras);
  };

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting && !next) return;
    onOpenChange(next);
  };

  const showThinking = isSubmitting;
  const thinkingCaracteristicas =
    frozenForm && hasLeadAIRenderCaracteristicas(frozenForm) ? frozenForm : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'border-gold-border-subtle/30 bg-mahogany-panel transition-all duration-500',
          showThinking
            ? 'max-w-md overflow-hidden border-gold/35 p-0 sm:max-w-xl [&>button.absolute]:hidden'
            : 'max-w-md p-6 sm:max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        {showThinking ? (
          <div className="animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
            <div className="border-b border-gold/20 bg-gradient-to-r from-mahogany-elevated via-mahogany-card to-mahogany-elevated px-5 py-4">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-center gap-2 text-gold">
                  <Sparkles className="h-4 w-4 animate-pulse" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                    Estúdio de renderização
                  </span>
                </div>
                <DialogTitle className="font-display text-lg uppercase tracking-wide text-primary">
                  Criando sua imagem
                </DialogTitle>
                <DialogDescription className="text-cream-muted">
                  A IA está transformando o esboço em render fotorrealista
                  {thinkingCaracteristicas ? ' com suas características' : ''}.
                </DialogDescription>
              </DialogHeader>
            </div>
            <LeadAIRenderThinkingState
              variant="dialog"
              sketchLabel={sketchLabel}
              caracteristicas={thinkingCaracteristicas}
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-gold">
                <Sparkles className="h-4 w-4" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Antes de renderizar
                </span>
              </div>
              <DialogTitle className="font-display text-lg uppercase tracking-wide text-primary">
                Personalizar o móvel?
              </DialogTitle>
              <DialogDescription className="text-left text-cream-muted">
                {sketchLabel ? (
                  <>
                    Você vai renderizar{' '}
                    <strong className="text-cream-secondary">{sketchLabel}</strong>. Deseja orientar
                    cor, material ou algum detalhe antes da IA gerar a imagem?
                  </>
                ) : (
                  'Deseja orientar cor, material ou algum detalhe antes da IA gerar a imagem?'
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-border-subtle/25 bg-mahogany-card/50 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="lead-render-add-extras" className="text-sm font-medium">
                    Adicionar características ao móvel
                  </Label>
                  <p className="text-xs text-cream-muted">
                    Cor, acabamento, puxadores, iluminação embutida etc.
                  </p>
                </div>
                <Switch
                  id="lead-render-add-extras"
                  checked={addExtras}
                  onCheckedChange={setAddExtras}
                />
              </div>

              {addExtras && (
                <div className="animate-in fade-in slide-in-from-top-2 space-y-3 rounded-xl border border-gold/25 bg-gold/5 p-4 duration-300">
                  <div className="flex items-center gap-2 text-gold">
                    <Palette className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Características desejadas
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-render-cor">Cor</Label>
                      <Input
                        id="lead-render-cor"
                        value={form.cor ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, cor: e.target.value }))}
                        placeholder="Ex: branco gelo, carvalho natural"
                        className="bg-mahogany-elevated/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-render-material">Material / acabamento</Label>
                      <Input
                        id="lead-render-material"
                        value={form.material ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, material: e.target.value }))}
                        placeholder="Ex: laca fosca, MDF madeirado"
                        className="bg-mahogany-elevated/80"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lead-render-detalhes">Outros detalhes</Label>
                    <Textarea
                      id="lead-render-detalhes"
                      value={form.detalhes ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, detalhes: e.target.value }))}
                      placeholder="Ex: puxadores cava, portas de vidro canelado, LED na prateleira superior..."
                      rows={3}
                      className="resize-y bg-mahogany-elevated/80 text-sm"
                    />
                  </div>

                  <p className="text-[11px] text-cream-faint">
                    A IA manterá o layout do esboço e aplicará essas orientações em cores e
                    acabamentos.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirm}>
                {addExtras && hasLeadAIRenderCaracteristicas(form)
                  ? 'Renderizar com características'
                  : 'Renderizar'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
