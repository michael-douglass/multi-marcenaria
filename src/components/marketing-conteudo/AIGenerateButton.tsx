import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Wand2,
  FileText,
  MessageSquare,
  Loader2,
  ArrowLeft,
  Feather,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  generateMarketingCopy,
  MarketingAIGenerationType,
  useMarketingAIStudio,
} from '@/hooks/useMarketingAIStudio';
import { StudioMotionStyles } from './ai-studio/StudioMotionStyles';
import { AIProductionLine } from './ai-studio/AIProductionLine';

interface AIGenerateButtonProps {
  cardId?: string;
  titulo: string;
  scriptCopy: string;
  columnId: string;
  isNewCard?: boolean;
  onGenerated?: (result: { conteudo: string; titulo?: string | null }) => void;
}

type WizardStep = 'voice' | 'mode' | 'suggestion' | 'loading';

export function AIGenerateButton({
  cardId,
  titulo,
  scriptCopy,
  columnId: _columnId,
  isNewCard: _isNewCard = false,
  onGenerated,
}: AIGenerateButtonProps) {
  const { status, isLoadingStatus, personalities } = useMarketingAIStudio();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('voice');
  const [personalityId, setPersonalityId] = useState<string | null>(null);
  const [mode, setMode] = useState<MarketingAIGenerationType | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lineCompleted, setLineCompleted] = useState(false);

  const activePersonalities = useMemo(
    () => personalities.filter((p) => p.ativo),
    [personalities],
  );

  const defaultPersonalityId = useMemo(() => {
    const def = activePersonalities.find((p) => p.is_default);
    return def?.id ?? activePersonalities[0]?.id ?? null;
  }, [activePersonalities]);

  const selectedPersonalityNome = useMemo(() => {
    const id = personalityId || defaultPersonalityId;
    return activePersonalities.find((p) => p.id === id)?.nome ?? null;
  }, [activePersonalities, personalityId, defaultPersonalityId]);

  const studioReady =
    Boolean(status?.ativo) && Boolean(status?.openai_configured);

  const resetWizard = () => {
    setStep('voice');
    setPersonalityId(defaultPersonalityId);
    setMode(null);
    setSuggestion('');
    setIsGenerating(false);
    setLineCompleted(false);
  };

  useEffect(() => {
    if (!open) setLineCompleted(false);
  }, [open]);

  const handleOpen = () => {
    if (isLoadingStatus) return;

    if (!status) {
      toast.error('Studio não configurado', {
        description: 'Abra Configurações e configure o Studio de Copy.',
      });
      return;
    }

    if (!status.ativo) {
      toast.error('Studio desativado', {
        description: 'Ative o Studio de Copy nas Configurações.',
      });
      return;
    }

    if (!status.openai_configured) {
      toast.error('OpenAI não configurada', {
        description: 'Cole a chave OpenAI no Studio de Copy.',
      });
      return;
    }

    if (activePersonalities.length === 0) {
      toast.error('Nenhuma voz ativa', {
        description: 'Ative ou crie uma personalidade no Studio.',
      });
      return;
    }

    resetWizard();
    setPersonalityId(defaultPersonalityId);
    setOpen(true);
  };

  const runGenerate = async (
    tipo: MarketingAIGenerationType,
    sugestao?: string,
  ) => {
    const voiceId = personalityId || defaultPersonalityId;
    if (!voiceId) {
      toast.error('Escolha uma voz');
      return;
    }

    if (
      tipo === 'Criar com Script' &&
      !scriptCopy.trim() &&
      !titulo.trim()
    ) {
      toast.error('Script vazio', {
        description: 'Escreva um rascunho ou título antes de usar “Com Script”.',
      });
      return;
    }

    if (tipo === 'Criar com sugestão' && !sugestao?.trim()) {
      toast.error('Digite uma sugestão');
      return;
    }

    if (
      (tipo === 'Criar aleatoriamente' || tipo === 'Criar com sugestão') &&
      status &&
      !status.serp_configured
    ) {
      toast.message('Sem SerpAPI', {
        description: 'Vamos gerar mesmo assim, sem pesquisa web.',
      });
    }

    setMode(tipo);
    setStep('loading');
    setIsGenerating(true);
    setLineCompleted(false);

    try {
      const result = await generateMarketingCopy({
        id: cardId,
        titulo,
        script_copy: scriptCopy || null,
        tipo_geracao: tipo,
        sugestao,
        personality_id: voiceId,
      });

      setLineCompleted(true);
      // Breve pausa para o usuário ver a linha completa
      await new Promise((r) => setTimeout(r, 650));

      onGenerated?.({
        conteudo: result.conteudo,
        titulo: result.titulo,
      });

      if (result.warning) {
        toast.warning('Script preenchido pela IA', {
          description: [
            result.personality_nome
              ? `Voz usada: ${result.personality_nome}`
              : null,
            result.warning,
          ]
            .filter(Boolean)
            .join(' — '),
        });
      } else {
        toast.success('Script preenchido pela IA', {
          description: result.personality_nome
            ? `Voz usada: ${result.personality_nome}`
            : 'Revise o Script de Copy e salve o card.',
        });
      }

      setOpen(false);
      resetWizard();
    } catch (error) {
      toast.error('Erro ao gerar', {
        description:
          error instanceof Error ? error.message : 'Erro desconhecido',
      });
      setStep(tipo === 'Criar com sugestão' ? 'suggestion' : 'mode');
      setLineCompleted(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModeSelect = (tipo: MarketingAIGenerationType) => {
    setMode(tipo);
    if (tipo === 'Criar com sugestão') {
      setStep('suggestion');
      return;
    }
    void runGenerate(tipo);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'studio-cta gap-2 border-amber-800/30 text-amber-900 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-200 dark:hover:bg-amber-950/40',
        )}
        disabled={isGenerating}
        onClick={handleOpen}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Gerar com IA
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isGenerating) return;
          setOpen(next);
          if (!next) resetWizard();
        }}
      >
        <DialogContent
          className={cn(
            'overflow-hidden border-amber-900/15',
            step === 'loading' ? 'sm:max-w-lg' : 'sm:max-w-md',
          )}
        >
          <StudioMotionStyles />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/15 blur-2xl"
          />

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl">
              <Feather className="h-5 w-5 text-amber-800 dark:text-amber-300" />
              Atelier de Copy
            </DialogTitle>
          </DialogHeader>

          {step === 'voice' && (
            <div className="studio-reveal space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Escolha a voz do roteiro
              </p>
              <div className="grid gap-2">
                {activePersonalities.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-selected={personalityId === p.id}
                    className={cn(
                      'studio-voice-card rounded-lg border px-3 py-2.5 text-left',
                      personalityId === p.id
                        ? 'border-amber-800/50 bg-amber-50/80 dark:border-amber-400/40 dark:bg-amber-950/40'
                        : 'border-border bg-background/80',
                    )}
                    onClick={() => setPersonalityId(p.id)}
                  >
                    <p className="font-medium">{p.nome}</p>
                    {p.descricao ? (
                      <p className="text-xs text-muted-foreground">
                        {p.descricao}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button
                  className="studio-cta w-full bg-amber-900 hover:bg-amber-800 sm:w-auto"
                  disabled={!personalityId || !studioReady}
                  onClick={() => setStep('mode')}
                >
                  Continuar
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'mode' && (
            <div className="studio-reveal space-y-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 px-0"
                onClick={() => setStep('voice')}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
              <p className="text-sm text-muted-foreground">Como gerar?</p>
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="studio-cta h-auto justify-start gap-3 py-3"
                  onClick={() => handleModeSelect('Criar aleatoriamente')}
                >
                  <Wand2 className="h-4 w-4 text-amber-800" />
                  <span className="text-left">
                    <span className="block font-medium">Aleatoriamente</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Sorteia pilar → pesquisa → briefing → copy
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="studio-cta h-auto justify-start gap-3 py-3"
                  onClick={() => handleModeSelect('Criar com Script')}
                >
                  <FileText className="h-4 w-4 text-amber-800" />
                  <span className="text-left">
                    <span className="block font-medium">Com Script</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Reescreve o rascunho atual
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="studio-cta h-auto justify-start gap-3 py-3"
                  onClick={() => handleModeSelect('Criar com sugestão')}
                >
                  <MessageSquare className="h-4 w-4 text-amber-800" />
                  <span className="text-left">
                    <span className="block font-medium">Com sugestão</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Tema → pesquisa → briefing → copy
                    </span>
                  </span>
                </Button>
              </div>
            </div>
          )}

          {step === 'suggestion' && (
            <div className="studio-reveal space-y-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 px-0"
                onClick={() => setStep('mode')}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
              <div className="space-y-2">
                <Label htmlFor="atelier-sugestao">Tema ou sugestão</Label>
                <Input
                  id="atelier-sugestao"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="Ex: hábitos de estudo para o ENEM"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void runGenerate('Criar com sugestão', suggestion);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  A IA pesquisa o tema, monta um briefing e só então escreve com
                  a voz escolhida.
                </p>
              </div>
              <DialogFooter>
                <Button
                  className="studio-cta gap-2 bg-amber-900 hover:bg-amber-800"
                  disabled={!suggestion.trim()}
                  onClick={() =>
                    void runGenerate('Criar com sugestão', suggestion)
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'loading' && (
            <div className="space-y-3">
              <AIProductionLine
                mode={mode}
                personalityNome={selectedPersonalityNome}
                completed={lineCompleted}
              />
              {!lineCompleted ? (
                <div className="flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-800" />
                  Isso pode levar alguns segundos…
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
