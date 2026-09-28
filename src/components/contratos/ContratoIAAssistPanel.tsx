import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Send,
  Sparkles,
  Check,
  X,
  FileSignature,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  CONTRATO_IA_SUGESTOES_ETAPA_1,
  CONTRATO_IA_SUGESTOES_ETAPA_2,
  contarAlteracoesPendentes,
  temAlteracoesPendentes,
  type ContratoIAVariavelInput,
  type ContratoIAPendingPatch,
} from '@/lib/contrato-ia';
import { useComposeContratoIA } from '@/hooks/useContratoIA';
import {
  FLOATING_UI_ROOT_ATTR,
  floatingAiBackgroundClass,
} from '@/lib/overlay-z-index';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ContratoIAAssistPanelProps {
  etapa: 1 | 2;
  variaveis: ContratoIAVariavelInput[];
  valores: Record<string, string>;
  conteudoContrato: string;
  modeloConteudo: string;
  onApplyPatches: (patch: ContratoIAPendingPatch) => void;
  /** Desativa o botão flutuante (ex.: sem modelo/campos). */
  disabled?: boolean;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CHIP_LABELS: Record<string, string> = {
  'Preencher campos vazios com o que já dá para calcular (sem inventar)': 'Preencher vazios',
  'Gerar valores por extenso a partir do valor do serviço': 'Por extenso',
  'Corrigir ortografia dos campos de texto (sem mudar fatos)': 'Ortografia',
  'Corrigir ortografia do texto do contrato (sem mudar fatos nem valores)': 'Revisar texto',
  'Adaptar este contrato para pessoa jurídica (PJ) — só com dados já preenchidos': 'Adaptar PJ',
  'Revisar clareza das cláusulas sem inventar informações': 'Clareza',
};

export function ContratoIAAssistPanel({
  etapa,
  variaveis,
  valores,
  conteudoContrato,
  modeloConteudo,
  onApplyPatches,
  disabled = false,
}: ContratoIAAssistPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá — sou a assistente de contratos. Leio só o que já está nesta página. Peça: preencher vazios, valor por extenso, ortografia ou adaptar o texto. Não invento dados.',
    },
  ]);
  const [pendingPatch, setPendingPatch] = useState<ContratoIAPendingPatch | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const compose = useComposeContratoIA();

  const sugestoes = useMemo(
    () =>
      etapa === 1
        ? [...CONTRATO_IA_SUGESTOES_ETAPA_1]
        : [...CONTRATO_IA_SUGESTOES_ETAPA_1, ...CONTRATO_IA_SUGESTOES_ETAPA_2],
    [etapa],
  );

  const patchCount = contarAlteracoesPendentes(pendingPatch);
  const fieldLabels = useMemo(() => {
    const map = new Map(variaveis.map((v) => [v.nome, v.label]));
    return map;
  }, [variaveis]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pendingPatch, open, compose.isPending]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  const enviar = useCallback(
    async (texto: string) => {
      const message = texto.trim();
      if (!message || compose.isPending || disabled) return;

      setDraft('');
      setPendingPatch(null);
      setTurns((prev) => [...prev, { id: newId(), role: 'user', content: message }]);

      try {
        const result = await compose.mutateAsync({
          message,
          etapa,
          variaveis,
          valores,
          conteudoContrato: etapa === 2 ? conteudoContrato : null,
          modeloConteudo: modeloConteudo || null,
        });

        const n = contarAlteracoesPendentes(result);
        const extras: string[] = [];
        if (result.warnings.length) {
          extras.push(`Avisos: ${result.warnings.join(' · ')}`);
        }
        if (result.skipped.length) {
          extras.push(`Não preenchido: ${result.skipped.join(' · ')}`);
        }
        if (n > 0) {
          extras.push(
            `${n} alteração(ões) pronta(s). Revise abaixo e clique em Aplicar.`,
          );
        }

        const content = [result.reply, ...extras].filter(Boolean).join('\n\n');
        setTurns((prev) => [...prev, { id: newId(), role: 'assistant', content }]);
        if (temAlteracoesPendentes(result)) {
          setPendingPatch(result);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao falar com a IA';
        setTurns((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: `Não consegui processar: ${msg}`,
          },
        ]);
        toast.error('Assistente de contratos', { description: msg });
      }
    },
    [
      compose,
      etapa,
      variaveis,
      valores,
      conteudoContrato,
      modeloConteudo,
      disabled,
    ],
  );

  const aplicar = useCallback(() => {
    if (!pendingPatch || !temAlteracoesPendentes(pendingPatch)) return;
    onApplyPatches(pendingPatch);
    setTurns((prev) => [
      ...prev,
      {
        id: newId(),
        role: 'assistant',
        content:
          'Alterações aplicadas. Confira os campos (e o texto, se houver) antes de continuar.',
      },
    ]);
    setPendingPatch(null);
    toast.success('Sugestões da IA aplicadas');
  }, [pendingPatch, onApplyPatches]);

  const descartar = useCallback(() => {
    setPendingPatch(null);
    setTurns((prev) => [
      ...prev,
      {
        id: newId(),
        role: 'assistant',
        content: 'Sugestões descartadas. Pode pedir de novo quando quiser.',
      },
    ]);
  }, []);

  if (typeof document === 'undefined') return null;

  const floatingRootProps = {
    [FLOATING_UI_ROOT_ATTR]: '' as const,
  };

  return createPortal(
    <div
      {...floatingRootProps}
      className={cn(
        'pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6',
        floatingAiBackgroundClass,
      )}
    >
      {/* Painel flutuante */}
      {open && (
        <div
          className={cn(
            'pointer-events-auto flex w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden',
            'h-[min(560px,calc(100vh-7rem))]',
            'rounded-[1.35rem] border border-[#c9a227]/35',
            'bg-[linear-gradient(165deg,#1a120c_0%,#2a1c14_42%,#1f1610_100%)]',
            'shadow-[0_24px_64px_-18px_rgba(0,0,0,0.65),0_0_0_1px_rgba(212,168,40,0.12)]',
            'animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-300',
          )}
          role="dialog"
          aria-label="Assistente de contratos"
        >
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden border-b border-[#c9a227]/25 px-4 pb-3 pt-3.5">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse 80% 120% at 10% -20%, rgba(212,168,40,0.35), transparent 55%)',
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                    'bg-gradient-to-br from-[#f0d78c] via-[#d4a828] to-[#8a6a12]',
                    'text-[#1a120c] shadow-[0_8px_20px_-6px_rgba(212,168,40,0.55)]',
                  )}
                >
                  <FileSignature className="h-5 w-5" strokeWidth={1.75} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1a120c] text-[8px] font-bold tracking-tight text-[#f0d78c] ring-1 ring-[#c9a227]/50">
                    IA
                  </span>
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate text-[15px] font-semibold tracking-wide text-[#f7efd9]"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    Assistente de contratos
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#cbb892]/85">
                    Só usa dados desta página · não inventa
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-[#cbb892]/80 transition hover:bg-white/5 hover:text-[#f7efd9]"
                  aria-label="Minimizar assistente"
                  title="Minimizar"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-[#cbb892]/80 transition hover:bg-white/5 hover:text-[#f7efd9]"
                  aria-label="Fechar assistente"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mensagens */}
          <ScrollArea className="min-h-0 flex-1 px-3.5">
            <div className="space-y-3 py-3.5">
              {turns.map((turn) => {
                const isUser = turn.role === 'user';
                return (
                  <div
                    key={turn.id}
                    className={cn(
                      'flex animate-in fade-in slide-in-from-bottom-2 duration-300',
                      isUser ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {!isUser && (
                      <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f0d78c] to-[#b8860b] text-[9px] font-bold text-[#1a120c]">
                        IA
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[86%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[13px] leading-relaxed',
                        isUser
                          ? 'rounded-2xl rounded-tr-md bg-gradient-to-br from-[#d4a828]/90 to-[#a67c12] text-[#1a120c] shadow-sm'
                          : 'rounded-2xl rounded-tl-md border border-[#c9a227]/20 bg-[#2f2218]/90 text-[#f3e9d4]',
                      )}
                    >
                      {turn.content}
                    </div>
                  </div>
                );
              })}
              {compose.isPending && (
                <div className="flex items-center gap-2 pl-8 text-xs text-[#cbb892]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d4a828]" />
                  Analisando o contrato…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Patch preview */}
          {pendingPatch && patchCount > 0 && (
            <div className="shrink-0 space-y-2 border-t border-[#c9a227]/25 bg-[#d4a828]/10 px-3.5 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-[#f0d78c]">
                Pronto para aplicar · {patchCount}
              </p>
              <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-[#cbb892]">
                {Object.entries(pendingPatch.fieldPatches).map(([nome, valor]) => (
                  <li key={nome} className="truncate">
                    <span className="text-[#f7efd9]/90">
                      {fieldLabels.get(nome) ?? nome}:
                    </span>{' '}
                    {valor}
                  </li>
                ))}
                {pendingPatch.documentPatch ? (
                  <li>Texto completo do contrato será atualizado</li>
                ) : null}
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-gradient-to-r from-[#f0d78c] to-[#d4a828] font-semibold text-[#1a120c] hover:from-[#f5e0a8] hover:to-[#e0b530]"
                  onClick={aplicar}
                >
                  <Check className="h-3.5 w-3.5" />
                  Aplicar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-[#cbb892] hover:bg-white/5 hover:text-[#f7efd9]"
                  onClick={descartar}
                >
                  <X className="h-3.5 w-3.5" />
                  Descartar
                </Button>
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="shrink-0 space-y-2 border-t border-[#c9a227]/20 bg-[#140e0a]/55 px-3.5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={compose.isPending || disabled}
                  onClick={() => void enviar(s)}
                  className={cn(
                    'rounded-full border border-[#c9a227]/30 bg-[#2a1c14]/80 px-2.5 py-1',
                    'text-[10px] font-medium text-[#e8d5a3] transition',
                    'hover:border-[#d4a828]/55 hover:bg-[#d4a828]/15 hover:text-[#f7efd9]',
                    'disabled:pointer-events-none disabled:opacity-40',
                  )}
                >
                  {CHIP_LABELS[s] ?? (s.length > 28 ? `${s.slice(0, 26)}…` : s)}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="O que você quer que eu faça?"
                className={cn(
                  'min-h-[64px] max-h-28 resize-none rounded-xl border-[#c9a227]/25',
                  'bg-[#1a120c]/80 text-sm text-[#f7efd9] placeholder:text-[#cbb892]/55',
                  'focus-visible:ring-[#d4a828]/40',
                )}
                disabled={compose.isPending || disabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void enviar(draft);
                  }
                }}
              />
              <Button
                size="icon"
                className={cn(
                  'h-11 w-11 shrink-0 rounded-xl',
                  'bg-gradient-to-br from-[#f0d78c] to-[#d4a828] text-[#1a120c]',
                  'hover:from-[#f5e0a8] hover:to-[#e0b530]',
                  'disabled:opacity-40',
                )}
                disabled={compose.isPending || disabled || !draft.trim()}
                onClick={() => void enviar(draft)}
                aria-label="Enviar"
              >
                {compose.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAB flutuante */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar assistente de contratos' : 'Abrir assistente de contratos'}
        aria-expanded={open}
        title="Assistente IA de contratos"
        className={cn(
          'pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full',
          'border border-[#f0d78c]/50',
          'bg-gradient-to-br from-[#f5e0a8] via-[#d4a828] to-[#8a6a12]',
          'text-[#1a120c] shadow-[0_12px_32px_-8px_rgba(212,168,40,0.65),0_0_0_4px_rgba(212,168,40,0.12)]',
          'transition-all duration-300',
          'hover:scale-105 hover:shadow-[0_16px_40px_-8px_rgba(212,168,40,0.75)]',
          'active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0d78c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a120c]',
          'disabled:pointer-events-none disabled:opacity-40 disabled:grayscale',
          open && 'rotate-0 scale-95 ring-2 ring-[#f0d78c]/40',
        )}
      >
        {/* Halo suave */}
        <span
          className={cn(
            'pointer-events-none absolute inset-[-3px] rounded-full bg-[#d4a828]/25 blur-md transition-opacity',
            open ? 'opacity-0' : 'opacity-100 group-hover:opacity-100',
            patchCount > 0 && !open && 'animate-pulse',
          )}
          aria-hidden
        />
        {open ? (
          <X className="relative h-6 w-6" strokeWidth={2} />
        ) : (
          <Sparkles className="relative h-6 w-6" strokeWidth={1.75} />
        )}
        {patchCount > 0 && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1a120c] px-1 text-[10px] font-bold text-[#f0d78c] ring-2 ring-[#d4a828]">
            {patchCount}
          </span>
        )}
        {!open && !disabled && (
          <span className="pointer-events-none absolute -left-1 top-1/2 hidden -translate-x-full -translate-y-1/2 whitespace-nowrap rounded-full border border-[#c9a227]/35 bg-[#1a120c]/95 px-2.5 py-1 text-[11px] font-medium text-[#f0d78c] opacity-0 shadow-lg transition group-hover:opacity-100 sm:block">
            Assistente IA
          </span>
        )}
      </button>
    </div>,
    document.body,
  );
}
