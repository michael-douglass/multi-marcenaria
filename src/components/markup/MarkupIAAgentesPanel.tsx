import { useMemo, useState } from 'react';
import {
  Bot,
  Cpu,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Ruler,
  Scale,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { MarkupIAAgentPrompts } from '@/lib/markup-types';
import type { MarkupIAVerificacaoCategoria } from '@/lib/markup-ia-verificacao';
import { ITENS_CRITICOS_CATEGORIAS } from '@/lib/markup-ia-verificacao';
import {
  MARKUP_IA_AGENTES_META,
  MARKUP_IA_AGENT_PROMPTS_DEFAULT,
  MARKUP_IA_ALLOWED_MODELS,
  type MarkupIAAgentId,
} from '@/lib/markup-ia-prompts';
import { buildAgentPromptPreview } from '@/lib/markup-ia-prompt-preview';
import { PIPELINE_LEAD_AI_MODELS } from '@/lib/pipeline-lead-ai-config';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const AGENT_ICONS: Record<MarkupIAAgentId, typeof Bot> = {
  projetista: Ruler,
  inventariante: PackageSearch,
  inventariante_retry: RefreshCw,
  auditor: Scale,
  auditor_projetista: ShieldAlert,
  precificador: Bot,
  precificador_retry: RefreshCw,
};

interface MarkupIAAgentesPanelProps {
  prompts: MarkupIAAgentPrompts;
  onChange: (prompts: MarkupIAAgentPrompts) => void;
  modeloPrincipal: string;
  modeloAuditor: string;
  onModeloAuditorChange: (model: string) => void;
  checklist: MarkupIAVerificacaoCategoria[];
  className?: string;
}

export function MarkupIAAgentesPanel({
  prompts,
  onChange,
  modeloPrincipal,
  modeloAuditor,
  onModeloAuditorChange,
  checklist,
  className,
}: MarkupIAAgentesPanelProps) {
  const [openAgent, setOpenAgent] = useState<string>('inventariante');

  const modeloPrincipalLabel = useMemo(
    () => PIPELINE_LEAD_AI_MODELS.find((m) => m.value === modeloPrincipal)?.label ?? modeloPrincipal,
    [modeloPrincipal],
  );

  const modeloAuditorLabel = useMemo(
    () => PIPELINE_LEAD_AI_MODELS.find((m) => m.value === modeloAuditor)?.label ?? modeloAuditor,
    [modeloAuditor],
  );

  const updatePrompt = (id: MarkupIAAgentId, value: string) => {
    onChange({ ...prompts, [id]: value });
  };

  const restorePrompt = (id: MarkupIAAgentId) => {
    onChange({ ...prompts, [id]: MARKUP_IA_AGENT_PROMPTS_DEFAULT[id] });
  };

  return (
    <div className={cn('space-y-5', className)}>
      {/* Hero — arquitetura multi-agente */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(251,191,36,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.6) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h3
              className="text-xl tracking-wide text-amber-400"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Arquitetura multi-agente
            </h3>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
              7 agentes · pipeline fixo
            </Badge>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">
            Fluxo sequencial: Projetista descreve o projeto → Inventariante quantifica materiais →
            Auditor valida → retry se faltar crítico → Precificador estima horas e despesas.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {MARKUP_IA_AGENTES_META.map((agent, i) => {
              const Icon = AGENT_ICONS[agent.id] ?? Bot;
              return (
                <div
                  key={agent.id}
                  className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10">
                    <Icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{agent.titulo}</p>
                    <p className="text-[10px] text-slate-500">Fase {agent.fase}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Camada determinística + itens críticos */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Cpu className="h-4 w-4 text-amber-500" />
            Camada determinística
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
              Materiais montados no sistema (mapearInventario + garantirInventario) — IA não inventa quantidades
            </li>
            <li className="flex items-start gap-1.5">
              <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
              Retry do inventariante (até 2×) quando o auditor detecta lacuna crítica
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
            <ShieldAlert className="h-4 w-4" />
            Itens críticos obrigatórios
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>≥1 chapa MDF na composição</li>
            <li>≥1 dobradiça ou corrediça com quantidade &gt; 0</li>
            <li>≥1 fita de borda na composição</li>
          </ul>
          <p className="text-[11px] text-red-800/80 dark:text-red-200/70 pt-1">
            Itens com <strong>prioridade alta</strong> disparam retry do inventariante antes da precificação.
            Categorias: {ITENS_CRITICOS_CATEGORIAS.join(', ')}.
          </p>
        </div>
      </div>

      {/* Modelo auditor */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <Label className="text-sm">Modelo do Agente Auditor</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Inventariante e Precificador usam o modelo principal ({modeloPrincipalLabel}). O Auditor
          pode usar um modelo mais leve para economizar.
        </p>
        <select
          className="w-full max-w-md h-10 rounded-md border bg-background px-3 text-base md:text-sm"
          value={modeloAuditor}
          onChange={(e) => onModeloAuditorChange(e.target.value)}
        >
          {PIPELINE_LEAD_AI_MODELS.filter((m) =>
            (MARKUP_IA_ALLOWED_MODELS as readonly string[]).includes(m.value),
          ).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Atual: {modeloAuditorLabel}
        </p>
      </div>

      {/* Editores por agente */}
      <Accordion
        type="single"
        collapsible
        value={openAgent}
        onValueChange={(v) => setOpenAgent(v ?? '')}
        className="space-y-2"
      >
        {MARKUP_IA_AGENTES_META.map((agent) => {
          const Icon = AGENT_ICONS[agent.id] ?? Bot;
          const promptAtual =
            prompts[agent.id]?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT[agent.id];
          const modeloUsado = agent.usaModeloPrincipal ? modeloPrincipalLabel : modeloAuditorLabel;
          return (
            <AccordionItem
              key={agent.id}
              value={agent.id}
              className="rounded-xl border border-amber-500/15 bg-slate-900/30 px-4 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex flex-1 items-start gap-3 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10">
                    <Icon className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-100">{agent.titulo}</span>
                      <Badge variant="secondary" className="text-[10px] h-5">
                        Fase {agent.fase}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 border-slate-600">
                        {modeloUsado}
                      </Badge>
                    </div>
                    <p className="text-xs text-amber-500/80 mt-0.5">{agent.subtitulo}</p>
                    <p className="text-xs text-muted-foreground mt-1">{agent.descricao}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {agent.placeholders.map((ph) => (
                    <code
                      key={ph}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-400/90"
                    >
                      {ph}
                    </code>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => restorePrompt(agent.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Restaurar padrão
                  </Button>
                </div>
                <Tabs defaultValue="editar" className="w-full">
                  <TabsList className="grid w-full max-w-xs grid-cols-2">
                    <TabsTrigger value="editar">Editar</TabsTrigger>
                    <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
                  </TabsList>
                  <TabsContent value="editar" className="mt-3">
                    <Textarea
                      value={promptAtual}
                      onChange={(e) => updatePrompt(agent.id, e.target.value)}
                      rows={12}
                      className="font-mono text-xs bg-slate-950/50 border-slate-700"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-3">
                    <Textarea
                      readOnly
                      value={buildAgentPromptPreview(promptAtual, agent.id, checklist)}
                      rows={12}
                      className="font-mono text-xs bg-muted/40"
                    />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
