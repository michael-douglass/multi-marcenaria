import { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  Settings,
  Search,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  RotateCcw,
  GripVertical,
  ArrowDownAZ,
  Handshake,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  useMarkupProdutos,
  type MarkupProdutoComCategoria,
} from '@/hooks/useMarkupProdutos';
import { useMarkupConfig, useMarkupDespesaTemplates, useMarkupServicoTemplates } from '@/hooks/useMarkupConfig';
import { useMarkupCategorias } from '@/hooks/useMarkupProdutos';
import { correspondeBuscaFlexivel } from '@/lib/markup-busca';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import {
  calcularPisoNegociador,
  redistribuirSplits,
  type NegociadorSplitCampo,
  validarSplits,
} from '@/lib/negociador-calculo';
import type { MarkupDespesaTemplate, MarkupServicoTemplate, MarkupIAAgentPrompts, MarkupServicoUnidade } from '@/lib/markup-types';
import { toast } from 'sonner';
import { MARKUP_IA_DEFAULT_PROMPT } from '@/lib/markup-types';
import {
  MARKUP_IA_AGENT_PROMPTS_DEFAULT,
  MARKUP_IA_DEFAULT_AUDITOR_MODEL,
  resolverPromptsAgentes,
} from '@/lib/markup-ia-prompts';
import { MARKUP_IA_VERIFICACAO_PADRAO } from '@/lib/markup-ia-verificacao';
import type { MarkupIAVerificacaoCategoria } from '@/lib/markup-ia-verificacao';
import { buildMarkupIAPromptPreview } from '@/lib/markup-ia-prompt-preview';
import { MarkupIAFluxoVerificacao } from '@/components/markup/MarkupIAFluxoVerificacao';
import { MarkupIAAgentesPanel } from '@/components/markup/MarkupIAAgentesPanel';
import { MarkupIAVerificacaoChecklist } from '@/components/markup/MarkupIAVerificacaoChecklist';
import { MarkupRegrasConstrutivasEditor } from '@/components/markup/MarkupRegrasConstrutivasEditor';
import { PIPELINE_LEAD_AI_MODELS } from '@/lib/pipeline-lead-ai-config';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { normalizarUnidadeCobranca, rotuloUnidadeCobranca } from '@/lib/markup-servicos';

interface ProdutoForm {
  id?: string;
  categoria_id: string;
  nome: string;
  variacao: string;
  preco_unitario: string;
  unidade: string;
}

const UNIDADES = ['un', 'chapa', 'rolo', 'pct', 'm', 'kg'];

function compararProdutosAlfabetico(
  a: MarkupProdutoComCategoria,
  b: MarkupProdutoComCategoria,
): number {
  const cat = (a.categoria?.nome ?? '').localeCompare(b.categoria?.nome ?? '', 'pt-BR');
  if (cat !== 0) return cat;
  const sub = (a.categoria?.subcategoria ?? '').localeCompare(
    b.categoria?.subcategoria ?? '',
    'pt-BR',
  );
  if (sub !== 0) return sub;
  const nome = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  if (nome !== 0) return nome;
  return (a.variacao ?? '').localeCompare(b.variacao ?? '', 'pt-BR', { sensitivity: 'base' });
}

function compararProdutosPorOrdemNativa(
  a: MarkupProdutoComCategoria,
  b: MarkupProdutoComCategoria,
): number {
  const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
  if (ordemDiff !== 0) return ordemDiff;
  return compararProdutosAlfabetico(a, b);
}

interface SortableProdutoRowProps {
  produto: MarkupProdutoComCategoria;
  dragDisabled: boolean;
  onEdit: (p: MarkupProdutoComCategoria) => void;
  onRemove: (id: string) => void;
}

function SortableProdutoRow({
  produto,
  dragDisabled,
  onEdit,
  onRemove,
}: SortableProdutoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: produto.id,
    disabled: dragDisabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        !produto.ativo && 'opacity-50',
        isDragging && 'relative z-10 bg-primary/5 shadow-md ring-1 ring-primary/25',
      )}
    >
      <TableCell className="w-10 px-2">
        <button
          type="button"
          className={cn(
            'touch-none rounded-md p-1.5 text-muted-foreground/50 transition-colors',
            'hover:bg-muted hover:text-foreground',
            'cursor-grab active:cursor-grabbing',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dragDisabled && 'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-muted-foreground/50',
          )}
          aria-label={`Arrastar ${produto.nome} para mudar a ordem`}
          disabled={dragDisabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {produto.categoria?.nome}
        {produto.categoria?.subcategoria ? ` (${produto.categoria.subcategoria})` : ''}
      </TableCell>
      <TableCell className="font-medium">{produto.nome}</TableCell>
      <TableCell>{produto.variacao ?? '—'}</TableCell>
      <TableCell className="text-right tabular-nums">
        {produto.preco_unitario != null
          ? formatarMoedaMarkup(produto.preco_unitario)
          : 'Pendente'}
      </TableCell>
      <TableCell>{produto.unidade}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onEdit(produto)}
            aria-label={`Editar ${produto.nome}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {produto.ativo && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => onRemove(produto.id)}
              aria-label={`Remover ${produto.nome}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

interface DespesaTemplateEditorProps {
  template: MarkupDespesaTemplate;
  onSave: (input: { id: string; nome: string; valor_padrao: number; silent?: boolean }) => void;
  onRemove: (id: string) => void;
  isSaving: boolean;
}

function DespesaTemplateEditor({
  template,
  onSave,
  onRemove,
  isSaving,
}: DespesaTemplateEditorProps) {
  const [nome, setNome] = useState(template.nome);
  const [valor, setValor] = useState(String(template.valor_padrao ?? 0));

  useEffect(() => {
    setNome(template.nome);
    setValor(String(template.valor_padrao ?? 0));
  }, [template.id, template.nome, template.valor_padrao]);

  const persistir = (silent = true) => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;

    const valorNum = Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    if (nomeLimpo === template.nome && valorNum === template.valor_padrao) return;

    onSave({
      id: template.id,
      nome: nomeLimpo,
      valor_padrao: valorNum,
      silent,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => persistir()}
        placeholder="Nome da despesa"
        className="flex-1"
        disabled={isSaving}
      />
      <div className="relative w-full sm:w-36 shrink-0">
        <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">R$</span>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => persistir()}
          className="pl-9 text-right"
          disabled={isSaving}
        />
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive shrink-0 self-end sm:self-center"
        onClick={() => onRemove(template.id)}
        disabled={isSaving}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ServicoTemplateEditorProps {
  template: MarkupServicoTemplate;
  onSave: (input: {
    id: string;
    nome: string;
    valor_hora_padrao: number;
    unidade_cobranca: MarkupServicoUnidade;
    silent?: boolean;
  }) => void;
  onRemove: (id: string) => void;
  isSaving: boolean;
  isReordering?: boolean;
}

function ServicoTemplateEditor({
  template,
  onSave,
  onRemove,
  isSaving,
  isReordering = false,
}: ServicoTemplateEditorProps) {
  const [nome, setNome] = useState(template.nome);
  const [valorUnitario, setValorUnitario] = useState(String(template.valor_hora_padrao ?? 0));
  const [unidade, setUnidade] = useState<MarkupServicoUnidade>(
    normalizarUnidadeCobranca(template.unidade_cobranca),
  );
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
    disabled: isSaving || isReordering,
  });
  const rotulos = rotuloUnidadeCobranca(unidade);

  useEffect(() => {
    setNome(template.nome);
    setValorUnitario(String(template.valor_hora_padrao ?? 0));
    setUnidade(normalizarUnidadeCobranca(template.unidade_cobranca));
  }, [template.id, template.nome, template.valor_hora_padrao, template.unidade_cobranca]);

  const persistir = (silent = true, overrides?: {
    nome?: string;
    valor?: string;
    unidade?: MarkupServicoUnidade;
  }) => {
    const nomeLimpo = (overrides?.nome ?? nome).trim();
    if (!nomeLimpo) return;

    const unidadeFinal = overrides?.unidade ?? unidade;
    const valorNum = Math.max(
      0,
      parseFloat((overrides?.valor ?? valorUnitario).replace(',', '.')) || 0,
    );
    const unidadeAtual = normalizarUnidadeCobranca(template.unidade_cobranca);
    if (
      nomeLimpo === template.nome &&
      valorNum === template.valor_hora_padrao &&
      unidadeFinal === unidadeAtual
    ) {
      return;
    }

    onSave({
      id: template.id,
      nome: nomeLimpo,
      valor_hora_padrao: valorNum,
      unidade_cobranca: unidadeFinal,
      silent,
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg bg-background',
        isDragging && 'z-10 opacity-90 shadow-lg ring-2 ring-primary/20',
      )}
    >
      <button
        type="button"
        className="touch-none self-start sm:self-center shrink-0 rounded p-1 text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={`Arrastar campo ${template.nome || 'de mão de obra'}`}
        disabled={isSaving || isReordering}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => persistir()}
        placeholder="Nome do serviço"
        className="flex-1"
        disabled={isSaving || isReordering}
      />
      <select
        className="h-10 w-full sm:w-28 shrink-0 rounded-md border bg-background px-2 text-sm"
        value={unidade}
        disabled={isSaving || isReordering}
        onChange={(e) => {
          const next = normalizarUnidadeCobranca(e.target.value);
          setUnidade(next);
          persistir(true, { unidade: next });
        }}
        aria-label="Cobrado por"
      >
        <option value="hora">Por hora</option>
        <option value="dia">Por dia</option>
      </select>
      <div className="relative w-full sm:w-36 shrink-0">
        <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">R$</span>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={valorUnitario}
          onChange={(e) => setValorUnitario(e.target.value)}
          onBlur={() => persistir()}
          className="pl-9 text-right"
          disabled={isSaving || isReordering}
        />
        <span className="absolute -top-5 right-0 text-[10px] text-muted-foreground">
          {rotulos.valor.toLowerCase()}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive shrink-0 self-end sm:self-center"
        onClick={() => onRemove(template.id)}
        disabled={isSaving || isReordering}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function MarkupConfigPage() {
  const { userRole } = useAuth();
  const { config, salvarConfig, uploadTimbrado, isLoading: loadingConfig } = useMarkupConfig();
  const { config: pipelineAiConfig } = usePipelineLeadAIConfig();
  const { data: categorias = [] } = useMarkupCategorias();
  const {
    data: produtos = [],
    isLoading: loadingProdutos,
    criarProduto,
    atualizarProduto,
    removerProduto,
    reordenarProdutos,
  } = useMarkupProdutos(true);
  const { data: despesaTemplates = [], salvarTemplate, removerTemplate } = useMarkupDespesaTemplates();
  const {
    data: servicoTemplates = [],
    salvarTemplate: salvarServicoTemplate,
    removerTemplate: removerServicoTemplate,
    reordenarTemplates: reordenarServicoTemplates,
  } = useMarkupServicoTemplates();

  const listSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleReordenarServicos = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = servicoTemplates.findIndex((s) => s.id === active.id);
    const newIndex = servicoTemplates.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordenados = arrayMove(servicoTemplates, oldIndex, newIndex).map((s, index) => ({
      id: s.id,
      ordem: index + 1,
    }));
    reordenarServicoTemplates.mutate(reordenados);
  };

  const [busca, setBusca] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProdutoForm>({
    categoria_id: '',
    nome: '',
    variacao: '',
    preco_unitario: '',
    unidade: 'un',
  });
  const [servicoDialogOpen, setServicoDialogOpen] = useState(false);
  const [novoServico, setNovoServico] = useState({
    nome: '',
    valor_hora: '0',
    unidade_cobranca: 'hora' as MarkupServicoUnidade,
  });
  const [despesaDialogOpen, setDespesaDialogOpen] = useState(false);
  const [novaDespesa, setNovaDespesa] = useState({ nome: '', valor: '0' });

  const [configLocal, setConfigLocal] = useState({
    valor_hora_marcenaria: '80',
    valor_dia_marcenaria: '640',
    fator_sobras: '5',
    margem_lucro: '30',
    percentual_imposto: '0',
    taxas_financeiras: '0',
    custo_frete_padrao: '0',
    rodape_observacoes_padrao: '',
    markup_ia_prompt: MARKUP_IA_DEFAULT_PROMPT,
    markup_ia_model: 'gpt-4o',
    markup_ia_auditor_model: MARKUP_IA_DEFAULT_AUDITOR_MODEL,
    markup_ia_ativo: true,
    markup_ia_verificacao: MARKUP_IA_VERIFICACAO_PADRAO as MarkupIAVerificacaoCategoria[],
    markup_ia_agent_prompts: { ...MARKUP_IA_AGENT_PROMPTS_DEFAULT } as MarkupIAAgentPrompts,
    negociador_margem_minima_percent: '100',
    negociador_pct_material: '33.34',
    negociador_pct_mao_obra: '33.33',
    negociador_pct_lucro: '33.33',
  });

  useEffect(() => {
    if (!loadingConfig) {
      setConfigLocal({
        valor_hora_marcenaria: String(config.valor_hora_marcenaria),
        valor_dia_marcenaria: String(config.valor_dia_marcenaria),
        fator_sobras: String(config.fator_sobras),
        margem_lucro: String(config.margem_lucro),
        percentual_imposto: String(config.percentual_imposto),
        taxas_financeiras: String(config.taxas_financeiras),
        custo_frete_padrao: String(config.custo_frete_padrao),
        rodape_observacoes_padrao: config.rodape_observacoes_padrao,
        markup_ia_prompt: config.markup_ia_prompt || MARKUP_IA_DEFAULT_PROMPT,
        markup_ia_model: config.markup_ia_model || 'gpt-4o',
        markup_ia_auditor_model: config.markup_ia_auditor_model || MARKUP_IA_DEFAULT_AUDITOR_MODEL,
        markup_ia_ativo: config.markup_ia_ativo,
        markup_ia_verificacao: config.markup_ia_verificacao ?? MARKUP_IA_VERIFICACAO_PADRAO,
        markup_ia_agent_prompts: resolverPromptsAgentes(config.markup_ia_agent_prompts),
        negociador_margem_minima_percent: String(config.negociador_margem_minima_percent ?? 100),
        negociador_pct_material: String(config.negociador_pct_material ?? 33.34),
        negociador_pct_mao_obra: String(config.negociador_pct_mao_obra ?? 33.33),
        negociador_pct_lucro: String(config.negociador_pct_lucro ?? 33.33),
      });
    }
  }, [loadingConfig, config]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim();
    const lista = !termo
      ? produtos
      : produtos.filter((p) => {
          const texto = [p.nome, p.variacao, p.categoria?.nome].filter(Boolean).join(' ');
          return correspondeBuscaFlexivel(texto, termo);
        });

    return [...lista].sort(compararProdutosPorOrdemNativa);
  }, [produtos, busca]);

  const buscaAtiva = busca.trim().length > 0;
  const dragProdutosDesabilitado = buscaAtiva || reordenarProdutos.isPending;

  const promptPreview = useMemo(
    () =>
      buildMarkupIAPromptPreview(
        configLocal.markup_ia_prompt || MARKUP_IA_DEFAULT_PROMPT,
        configLocal.markup_ia_verificacao,
      ),
    [configLocal.markup_ia_prompt, configLocal.markup_ia_verificacao],
  );

  if (userRole !== 'admin' && userRole !== 'vendedor') {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito.
      </div>
    );
  }

  const handleReordenarProdutos = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || buscaAtiva) return;

    const oldIndex = produtosFiltrados.findIndex((p) => p.id === active.id);
    const newIndex = produtosFiltrados.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordenados = arrayMove(produtosFiltrados, oldIndex, newIndex).map((p, index) => ({
      id: p.id,
      ordem: index + 1,
    }));
    reordenarProdutos.mutate(reordenados);
  };

  const restaurarOrdemAlfabetica = () => {
    const ordenados = [...produtos]
      .sort(compararProdutosAlfabetico)
      .map((p, index) => ({ id: p.id, ordem: index + 1 }));
    reordenarProdutos.mutate(ordenados);
  };

  const abrirNovo = () => {
    setForm({
      categoria_id: categorias[0]?.id ?? '',
      nome: '',
      variacao: '',
      preco_unitario: '',
      unidade: 'un',
    });
    setDialogOpen(true);
  };

  const abrirEditar = (p: typeof produtos[0]) => {
    setForm({
      id: p.id,
      categoria_id: p.categoria_id,
      nome: p.nome,
      variacao: p.variacao ?? '',
      preco_unitario: p.preco_unitario != null ? String(p.preco_unitario) : '',
      unidade: p.unidade,
    });
    setDialogOpen(true);
  };

  const salvarProduto = async () => {
    const payloadBase = {
      categoria_id: form.categoria_id,
      nome: form.nome.trim(),
      variacao: form.variacao.trim() || null,
      preco_unitario: form.preco_unitario ? parseFloat(form.preco_unitario) : null,
      unidade: form.unidade,
      quantidade_padrao: 0,
      ativo: true,
    };
    if (form.id) {
      await atualizarProduto.mutateAsync({ id: form.id, ...payloadBase });
    } else {
      const maxOrdem = produtos.reduce((acc, p) => Math.max(acc, p.ordem ?? 0), 0);
      await criarProduto.mutateAsync({ ...payloadBase, ordem: maxOrdem + 1 });
    }
    setDialogOpen(false);
  };

  const salvarParametros = async () => {
    await salvarConfig.mutateAsync({
      valor_hora_marcenaria: parseFloat(configLocal.valor_hora_marcenaria) || 0,
      valor_dia_marcenaria: parseFloat(configLocal.valor_dia_marcenaria) || 0,
      fator_sobras: parseFloat(configLocal.fator_sobras) || 0,
      margem_lucro: parseFloat(configLocal.margem_lucro) || 0,
      percentual_imposto: parseFloat(configLocal.percentual_imposto) || 0,
      taxas_financeiras: parseFloat(configLocal.taxas_financeiras) || 0,
      custo_frete_padrao: parseFloat(configLocal.custo_frete_padrao) || 0,
      rodape_observacoes_padrao: configLocal.rodape_observacoes_padrao,
    });
  };

  const salvarNegociador = async () => {
    const margem = parseFloat(configLocal.negociador_margem_minima_percent);
    const splits = {
      material: parseFloat(configLocal.negociador_pct_material) || 0,
      maoObra: parseFloat(configLocal.negociador_pct_mao_obra) || 0,
      lucro: parseFloat(configLocal.negociador_pct_lucro) || 0,
    };
    if (!Number.isFinite(margem) || margem < 0) {
      toast.error('Margem mínima inválida', {
        description: 'Informe um percentual maior ou igual a zero.',
      });
      return;
    }
    if (!validarSplits(splits)) {
      toast.error('Os percentuais precisam somar 100%', {
        description: `Soma atual: ${(splits.material + splits.maoObra + splits.lucro).toFixed(2)}%`,
      });
      return;
    }
    await salvarConfig.mutateAsync({
      negociador_margem_minima_percent: margem,
      negociador_pct_material: splits.material,
      negociador_pct_mao_obra: splits.maoObra,
      negociador_pct_lucro: splits.lucro,
    });
  };

  const negociadorPreviewPiso = calcularPisoNegociador(
    10,
    parseFloat(configLocal.negociador_margem_minima_percent) || 0,
  );

  const salvarConfigIA = async () => {
    await salvarConfig.mutateAsync({
      markup_ia_prompt: configLocal.markup_ia_prompt,
      markup_ia_model: configLocal.markup_ia_model,
      markup_ia_auditor_model: configLocal.markup_ia_auditor_model,
      markup_ia_ativo: configLocal.markup_ia_ativo,
      markup_ia_verificacao: configLocal.markup_ia_verificacao,
      markup_ia_agent_prompts: configLocal.markup_ia_agent_prompts,
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Configurações de Markup
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catálogo de materiais e parâmetros de cálculo
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/markup">
            <Settings className="h-4 w-4 mr-1" />
            Ver markups
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="negociador">Negociador</TabsTrigger>
          <TabsTrigger value="despesas">Despesas padrão</TabsTrigger>
          <TabsTrigger value="ia">IA</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4 mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={restaurarOrdemAlfabetica}
                disabled={produtos.length === 0 || reordenarProdutos.isPending}
                title="Redefine a ordem salva para A→Z (categoria, nome e variação)"
              >
                {reordenarProdutos.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ArrowDownAZ className="h-4 w-4 mr-1" />
                )}
                Ordem alfabética
              </Button>
              <Button onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-1" />
                Novo produto
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <GripVertical className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" aria-hidden />
            <span>
              Arraste pelo ícone para mudar a posição nativa do catálogo. A nova ordem fica salva
              como padrão (também na calculadora).
              {buscaAtiva ? ' Limpe a busca para reordenar.' : ''}
            </span>
          </p>

          <Card className="overflow-hidden border-border/60">
            <CardContent className="p-0">
              {loadingProdutos ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              ) : (
                <DndContext
                  sensors={listSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleReordenarProdutos}
                >
                  <div className="relative w-full overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 px-2" />
                          <TableHead>Categoria</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Var.</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead>Un.</TableHead>
                          <TableHead className="w-20" />
                        </TableRow>
                      </TableHeader>
                      <SortableContext
                        items={produtosFiltrados.map((p) => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <TableBody>
                          {produtosFiltrados.map((p) => (
                            <SortableProdutoRow
                              key={p.id}
                              produto={p}
                              dragDisabled={dragProdutosDesabilitado}
                              onEdit={abrirEditar}
                              onRemove={(id) => removerProduto.mutate(id)}
                            />
                          ))}
                        </TableBody>
                      </SortableContext>
                    </Table>
                  </div>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parametros" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parâmetros de cálculo</CardTitle>
              <CardDescription>
                Valores padrão da calculadora: preço da hora/dia, margem, impostos, taxas e frete.
                Cada campo de mão de obra abaixo escolhe se cobra por hora ou por dia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <h3 className="text-sm font-medium">Precificação de tempo</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Defina quanto vale <strong>1 hora</strong> e quanto vale <strong>1 dia</strong>{' '}
                    de mão de obra. Esses valores servem de referência ao criar campos novos.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="config-valor-hora">Valor da hora (R$)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">R$</span>
                      <Input
                        id="config-valor-hora"
                        type="number"
                        min={0}
                        step={0.01}
                        className="pl-9"
                        value={configLocal.valor_hora_marcenaria}
                        onChange={(e) =>
                          setConfigLocal((prev) => ({
                            ...prev,
                            valor_hora_marcenaria: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="config-valor-dia">Valor do dia (R$)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">R$</span>
                      <Input
                        id="config-valor-dia"
                        type="number"
                        min={0}
                        step={0.01}
                        className="pl-9"
                        value={configLocal.valor_dia_marcenaria}
                        onChange={(e) =>
                          setConfigLocal((prev) => ({
                            ...prev,
                            valor_dia_marcenaria: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['fator_sobras', 'Fator sobras (%)', { step: '0.5' }],
                  ['margem_lucro', 'Margem lucro (%)', { step: '0.5' }],
                  ['percentual_imposto', 'Impostos (%)', { step: '0.5' }],
                  ['taxas_financeiras', 'Taxas financeiras (%)', { step: '0.5' }],
                  ['custo_frete_padrao', 'Frete padrão (R$)', { step: '1' }],
                ] as const
              ).map(([key, label, opts]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={opts.step}
                    value={configLocal[key]}
                    onChange={(e) =>
                      setConfigLocal((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div>
                  <h3 className="text-sm font-medium">Mão de obra — campos da calculadora</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estes campos aparecem na aba Serviços da calculadora. Escolha se cada um cobra{' '}
                    <strong>por hora</strong> ou <strong>por dia</strong> e informe o valor
                    unitário. Arraste pelo ícone{' '}
                    <GripVertical className="inline h-3 w-3 align-text-bottom" /> para mudar a
                    posição.
                  </p>
                </div>
                <DndContext
                  sensors={listSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleReordenarServicos}
                >
                  <SortableContext
                    items={servicoTemplates.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {servicoTemplates.map((s) => (
                        <ServicoTemplateEditor
                          key={s.id}
                          template={s}
                          isSaving={salvarServicoTemplate.isPending}
                          isReordering={reordenarServicoTemplates.isPending}
                          onSave={(input) => salvarServicoTemplate.mutate(input)}
                          onRemove={(id) => removerServicoTemplate.mutate(id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {servicoTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum campo de mão de obra cadastrado.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setNovoServico({
                      nome: '',
                      valor_hora: configLocal.valor_hora_marcenaria || '0',
                      unidade_cobranca: 'hora',
                    });
                    setServicoDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar campo de mão de obra
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t pt-4">
                <Label>Observações padrão (rodapé PDF)</Label>
                <Textarea
                  value={configLocal.rodape_observacoes_padrao}
                  onChange={(e) =>
                    setConfigLocal((prev) => ({
                      ...prev,
                      rodape_observacoes_padrao: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
              <div className="col-span-2">
                <Label>Papel timbrado (imagem)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadTimbrado(file);
                    await salvarConfig.mutateAsync({ timbrado_url: url });
                  }}
                />
                {config.timbrado_url && (
                  <img
                    src={config.timbrado_url}
                    alt="Timbrado"
                    className="mt-2 max-h-20 object-contain border rounded"
                  />
                )}
              </div>
              <div className="col-span-2">
                <Button onClick={salvarParametros} disabled={salvarConfig.isPending}>
                  {salvarConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Salvar parâmetros
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negociador" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Handshake className="h-4 w-4 text-amber-700" aria-hidden />
                Negociador com o cliente
              </CardTitle>
              <CardDescription>
                Defina até onde o vendedor pode baixar o preço (margem mínima sobre o custo de
                material) e como o valor negociado se divide entre Material, Mão de obra e Lucro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="negociador-margem-minima">
                    Margem mínima aceitável (% sobre o custo)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Exemplo: material R$ 10 e mínimo 100% → o preço não pode descer abaixo de{' '}
                    <strong>{formatarMoedaMarkup(negociadorPreviewPiso)}</strong>.
                  </p>
                  <Input
                    id="negociador-margem-minima"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={configLocal.negociador_margem_minima_percent}
                    onChange={(e) => {
                      const raw = e.target.value.replace(',', '.');
                      let out = '';
                      let seenDot = false;
                      for (const ch of raw) {
                        if (ch >= '0' && ch <= '9') out += ch;
                        else if (ch === '.' && !seenDot) {
                          out += '.';
                          seenDot = true;
                        }
                      }
                      setConfigLocal((prev) => ({
                        ...prev,
                        negociador_margem_minima_percent: out,
                      }));
                    }}
                  />
                </div>
                <div className="rounded-md border border-amber-700/20 bg-amber-50/60 px-3 py-2 text-sm text-[#2a1812]">
                  Se o material for <strong>R$ 10</strong> e o mínimo{' '}
                  <strong>{configLocal.negociador_margem_minima_percent || '0'}%</strong>, o piso é{' '}
                  <strong>{formatarMoedaMarkup(negociadorPreviewPiso)}</strong>.
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Divisão do valor negociado</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Digite um percentual: os outros dois se ajustam sozinhos para somar{' '}
                    <strong>100%</strong>.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(
                    [
                      ['negociador_pct_material', 'Material (%)', 'material'],
                      ['negociador_pct_mao_obra', 'Mão de obra (%)', 'maoObra'],
                      ['negociador_pct_lucro', 'Lucro (%)', 'lucro'],
                    ] as const
                  ).map(([key, label, campo]) => (
                    <div key={key}>
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="mt-1"
                        value={configLocal[key]}
                        onChange={(e) => {
                          const raw = e.target.value.replace(',', '.');
                          let out = '';
                          let seenDot = false;
                          for (const ch of raw) {
                            if (ch >= '0' && ch <= '9') out += ch;
                            else if (ch === '.' && !seenDot) {
                              out += '.';
                              seenDot = true;
                            }
                          }
                          setConfigLocal((prev) => ({ ...prev, [key]: out }));
                        }}
                        onBlur={(e) => {
                          const n = Number(e.target.value.replace(',', '.'));
                          if (!Number.isFinite(n)) return;
                          const next = redistribuirSplits(
                            campo as NegociadorSplitCampo,
                            n,
                            {
                              material: parseFloat(configLocal.negociador_pct_material) || 0,
                              maoObra: parseFloat(configLocal.negociador_pct_mao_obra) || 0,
                              lucro: parseFloat(configLocal.negociador_pct_lucro) || 0,
                            },
                          );
                          setConfigLocal((prev) => ({
                            ...prev,
                            negociador_pct_material: String(next.material),
                            negociador_pct_mao_obra: String(next.maoObra),
                            negociador_pct_lucro: String(next.lucro),
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o % e saia do campo (ou Enter): os outros dois se ajustam para somar 100%.
                </p>
              </div>

              <Button onClick={salvarNegociador} disabled={salvarConfig.isPending}>
                {salvarConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar Negociador
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Despesas padrão do markup</CardTitle>
              <CardDescription>
                Valores sugeridos ao abrir a calculadora em um lead. Na calculadora, cada despesa
                pode ser ligada/desligada e o valor alterado sem mudar estes padrões.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {despesaTemplates.map((d) => (
                <DespesaTemplateEditor
                  key={d.id}
                  template={d}
                  isSaving={salvarTemplate.isPending}
                  onSave={(input) => salvarTemplate.mutate(input)}
                  onRemove={(id) => removerTemplate.mutate(id)}
                />
              ))}
              {despesaTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma despesa padrão cadastrada.
                </p>
              )}
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setNovaDespesa({ nome: '', valor: '0' });
                  setDespesaDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar despesa padrão
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ia" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Configuração IA — Compor com IA
              </CardTitle>
              <CardDescription>
                Instrua a Íris a ler anexos do lead e montar o orçamento completo (materiais,
                mão de obra e despesas) com os catálogos do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium">Chave OpenAI:</span>{' '}
                  {pipelineAiConfig?.apiKeyConfigured ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Configurada</span>
                  ) : (
                    <span className="text-destructive">Não configurada</span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  A chave é a mesma do Pipeline. Configure em{' '}
                  <Link to="/pipeline/configuracoes" className="text-primary underline">
                    Pipeline → Configurações → IA do Lead
                  </Link>
                  .
                </p>
              </div>

              <MarkupIAFluxoVerificacao />
              <p className="text-xs text-muted-foreground -mt-2">
                O fluxo acima espelha o que acontece ao clicar em &quot;Compor com IA&quot; no
                Pipeline. Os agentes abaixo executam cada etapa.
              </p>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Composição com IA ativa</Label>
                  <p className="text-xs text-muted-foreground">
                    Desative para ocultar o botão na calculadora de markup.
                  </p>
                </div>
                <Switch
                  checked={configLocal.markup_ia_ativo}
                  onCheckedChange={(checked) =>
                    setConfigLocal((prev) => ({ ...prev, markup_ia_ativo: checked }))
                  }
                />
              </div>

              <div>
                <Label>Modelo principal (Inventariante + Precificador)</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-base mt-1 md:text-sm"
                  value={configLocal.markup_ia_model}
                  onChange={(e) =>
                    setConfigLocal((prev) => ({ ...prev, markup_ia_model: e.target.value }))
                  }
                >
                  {PIPELINE_LEAD_AI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <MarkupRegrasConstrutivasEditor className="rounded-lg border p-3" />
              <p className="text-xs text-muted-foreground -mt-2">
                Estas regras ensinam a <strong>conta</strong> (quantas dobradiças, chapas, fita).
                O editor abaixo ensina o <strong>texto</strong> que a IA lê — os dois trabalham
                juntos, não são a mesma coisa.
              </p>

              <MarkupIAAgentesPanel
                prompts={configLocal.markup_ia_agent_prompts}
                onChange={(markup_ia_agent_prompts) =>
                  setConfigLocal((prev) => ({ ...prev, markup_ia_agent_prompts }))
                }
                modeloPrincipal={configLocal.markup_ia_model}
                modeloAuditor={configLocal.markup_ia_auditor_model}
                onModeloAuditorChange={(markup_ia_auditor_model) =>
                  setConfigLocal((prev) => ({ ...prev, markup_ia_auditor_model }))
                }
                checklist={configLocal.markup_ia_verificacao}
              />

              <MarkupIAVerificacaoChecklist
                value={configLocal.markup_ia_verificacao}
                onChange={(markup_ia_verificacao) =>
                  setConfigLocal((prev) => ({ ...prev, markup_ia_verificacao }))
                }
              />
              <p className="text-xs text-muted-foreground -mt-4">
                Itens com <strong>prioridade alta</strong> são obrigatórios no gate de retry
                automático (dobradiças, corrediças, fitas).
              </p>

              <Accordion type="single" collapsible className="rounded-xl border">
                <AccordionItem value="legado" className="border-0 px-4">
                  <AccordionTrigger className="text-sm hover:no-underline">
                    Prompt legado — modo fotos (sem planilha Cortecloud)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    <p className="text-xs text-muted-foreground">
                      Usado apenas quando não há inventário Cortecloud (composição em uma única
                      chamada). O fluxo multi-agente acima é o padrão para planilhas.
                    </p>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfigLocal((prev) => ({
                            ...prev,
                            markup_ia_prompt: MARKUP_IA_DEFAULT_PROMPT,
                          }))
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restaurar padrão
                      </Button>
                    </div>
                    <Tabs defaultValue="editar" className="w-full">
                      <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="editar">Editar</TabsTrigger>
                        <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
                      </TabsList>
                      <TabsContent value="editar" className="space-y-2 mt-3">
                        <p className="text-xs text-muted-foreground">
                          Placeholders: {'{{nome_lead}}'}, {'{{catalogo}}'}, {'{{catalogo_lookup}}'},{' '}
                          {'{{checklist_verificacao}}'}, {'{{servicos_catalogo}}'}, {'{{despesas_catalogo}}'},{' '}
                          {'{{parametros}}'}, {'{{analise}}'}, {'{{conhecimento}}'}
                        </p>
                        <Textarea
                          value={configLocal.markup_ia_prompt}
                          onChange={(e) =>
                            setConfigLocal((prev) => ({ ...prev, markup_ia_prompt: e.target.value }))
                          }
                          rows={10}
                          className="font-mono text-xs"
                        />
                      </TabsContent>
                      <TabsContent value="preview" className="space-y-2 mt-3">
                        <Textarea
                          readOnly
                          value={promptPreview}
                          rows={10}
                          className="font-mono text-xs bg-muted/40"
                        />
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button onClick={salvarConfigIA} disabled={salvarConfig.isPending}>
                {salvarConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar configuração IA
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar produto' : 'Novo produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-base md:text-sm"
                value={form.categoria_id}
                onChange={(e) => setForm((f) => ({ ...f, categoria_id: e.target.value }))}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.subcategoria ? ` (${c.subcategoria})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Variação</Label>
              <Input
                value={form.variacao}
                onChange={(e) => setForm((f) => ({ ...f, variacao: e.target.value }))}
                placeholder="Ex: 15, RETA, 22..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço unitário</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.preco_unitario}
                  onChange={(e) => setForm((f) => ({ ...f, preco_unitario: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-base md:text-sm"
                  value={form.unidade}
                  onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarProduto} disabled={!form.nome.trim() || !form.categoria_id}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={servicoDialogOpen} onOpenChange={setServicoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo campo de mão de obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="novo-servico-nome">Nome</Label>
              <Input
                id="novo-servico-nome"
                value={novoServico.nome}
                onChange={(e) => setNovoServico((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex.: Horas projeto/design"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="novo-servico-unidade">Cobrado por</Label>
              <select
                id="novo-servico-unidade"
                className="w-full h-10 rounded-md border bg-background px-3 text-base md:text-sm"
                value={novoServico.unidade_cobranca}
                onChange={(e) => {
                  const unidade = normalizarUnidadeCobranca(e.target.value);
                  const sugestao =
                    unidade === 'dia'
                      ? configLocal.valor_dia_marcenaria
                      : configLocal.valor_hora_marcenaria;
                  setNovoServico((prev) => ({
                    ...prev,
                    unidade_cobranca: unidade,
                    valor_hora: sugestao || prev.valor_hora,
                  }));
                }}
              >
                <option value="hora">Hora</option>
                <option value="dia">Dia</option>
              </select>
            </div>
            <div>
              <Label htmlFor="novo-servico-valor">
                {novoServico.unidade_cobranca === 'dia'
                  ? 'Valor/dia padrão (R$)'
                  : 'Valor/hora padrão (R$)'}
              </Label>
              <Input
                id="novo-servico-valor"
                type="number"
                min={0}
                step={0.01}
                value={novoServico.valor_hora}
                onChange={(e) =>
                  setNovoServico((prev) => ({ ...prev, valor_hora: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!novoServico.nome.trim() || salvarServicoTemplate.isPending}
              onClick={() => {
                const nome = novoServico.nome.trim();
                if (!nome) return;
                const valor = Math.max(
                  0,
                  parseFloat(novoServico.valor_hora.replace(',', '.')) || 0,
                );
                salvarServicoTemplate.mutate(
                  {
                    nome,
                    valor_hora_padrao: valor,
                    unidade_cobranca: novoServico.unidade_cobranca,
                    ordem: servicoTemplates.length + 1,
                  },
                  {
                    onSuccess: () => {
                      setServicoDialogOpen(false);
                      setNovoServico({
                        nome: '',
                        valor_hora: '0',
                        unidade_cobranca: 'hora',
                      });
                    },
                  },
                );
              }}
            >
              {salvarServicoTemplate.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={despesaDialogOpen} onOpenChange={setDespesaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova despesa padrão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nova-despesa-nome">Nome</Label>
              <Input
                id="nova-despesa-nome"
                value={novaDespesa.nome}
                onChange={(e) => setNovaDespesa((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex.: Transporte"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="nova-despesa-valor">Valor padrão (R$)</Label>
              <Input
                id="nova-despesa-valor"
                type="number"
                min={0}
                step={0.01}
                value={novaDespesa.valor}
                onChange={(e) => setNovaDespesa((prev) => ({ ...prev, valor: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDespesaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!novaDespesa.nome.trim() || salvarTemplate.isPending}
              onClick={() => {
                const nome = novaDespesa.nome.trim();
                if (!nome) return;
                const valor = Math.max(
                  0,
                  parseFloat(novaDespesa.valor.replace(',', '.')) || 0,
                );
                salvarTemplate.mutate(
                  {
                    nome,
                    valor_padrao: valor,
                    ordem: despesaTemplates.length + 1,
                  },
                  {
                    onSuccess: () => {
                      setDespesaDialogOpen(false);
                      setNovaDespesa({ nome: '', valor: '0' });
                    },
                  },
                );
              }}
            >
              {salvarTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
