import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Calculator, Columns3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useOrcamentoMetricas, type OrcamentoMetrica } from '@/hooks/useOrcamentoMetricas';
import {
  buildKanbanSomaVariableKey,
  buildMetricaSomaVariableKey,
  getOrcamentoVariableKeys,
  ORCAMENTO_CARD_VARIABLES,
  ORCAMENTO_COLUNA_VARIABLES,
  validateOrcamentoFormula,
  type KanbanSomaCampo,
  type OrcamentoMetricaFormato,
  type OrcamentoMetricaTipo,
} from '@/lib/orcamento-formula';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { toast } from 'sonner';

interface OrcamentoMetricasConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMATO_OPTIONS: { value: OrcamentoMetricaFormato; label: string }[] = [
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'number', label: 'Número' },
  { value: 'percent', label: 'Percentual' },
];

const KANBAN_CAMPO_OPTIONS: { value: KanbanSomaCampo; label: string }[] = [
  { value: 'orcamento', label: 'Soma dos orçamentos (R$)' },
  { value: 'negocio', label: 'Soma dos valores de negócio (R$)' },
  { value: 'quantidade', label: 'Quantidade de leads' },
];

const TIPO_OPTIONS: { value: OrcamentoMetricaTipo; label: string; hint: string }[] = [
  {
    value: 'card',
    label: 'Card no resumo',
    hint: 'Aparece ao expandir Orçamentos (ex.: valor total × 60%)',
  },
  {
    value: 'coluna',
    label: 'Coluna na tabela',
    hint: 'Nova coluna na lista completa, calculada por lead',
  },
];

export function OrcamentoMetricasConfigDialog({
  open,
  onOpenChange,
}: OrcamentoMetricasConfigDialogProps) {
  const { metricas, colunaMetricas, addMetrica, updateMetrica, deleteMetrica } =
    useOrcamentoMetricas();
  const { pages: kanbanPages, isLoading: isLoadingKanban } = useKanbanConfig();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrcamentoMetrica | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [formula, setFormula] = useState('');
  const [tipo, setTipo] = useState<OrcamentoMetricaTipo>('card');
  const [formato, setFormato] = useState<OrcamentoMetricaFormato>('currency');
  const [kanbanPageId, setKanbanPageId] = useState('');
  const [kanbanColumnId, setKanbanColumnId] = useState('');
  const [kanbanCampo, setKanbanCampo] = useState<KanbanSomaCampo>('orcamento');
  const [somaMetricaId, setSomaMetricaId] = useState('');

  const kanbanPagesAtivas = useMemo(
    () => kanbanPages.filter((p) => p.ativo),
    [kanbanPages],
  );

  const kanbanColunasDaPagina = useMemo(() => {
    const page = kanbanPagesAtivas.find((p) => p.id === kanbanPageId);
    return (page?.columns ?? []).filter((c) => c.ativo);
  }, [kanbanPagesAtivas, kanbanPageId]);

  const colunasMetricaDisponiveis = useMemo(
    () => colunaMetricas.filter((m) => m.id !== editing?.id),
    [colunaMetricas, editing?.id],
  );

  const resetForm = () => {
    setNome('');
    setFormula('');
    setTipo('card');
    setFormato('currency');
    setEditing(null);
    setKanbanPageId('');
    setKanbanColumnId('');
    setKanbanCampo('orcamento');
    setSomaMetricaId('');
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (m: OrcamentoMetrica) => {
    setEditing(m);
    setNome(m.nome);
    setFormula(m.formula);
    setTipo(m.tipo);
    setFormato(m.formato);
    setFormOpen(true);
  };

  const insertVariable = (varKey: string) => {
    setFormula((prev) => `${prev}[${varKey}]`);
  };

  const insertKanbanSoma = () => {
    if (!kanbanColumnId) {
      toast.error('Selecione a página e a coluna do Kanban');
      return;
    }
    insertVariable(buildKanbanSomaVariableKey(kanbanColumnId, kanbanCampo));
    toast.success('Soma da coluna inserida na fórmula');
  };

  const insertMetricaSoma = () => {
    if (!somaMetricaId) {
      toast.error('Selecione a coluna calculada para somar');
      return;
    }
    insertVariable(buildMetricaSomaVariableKey(somaMetricaId));
    toast.success('Soma da coluna inserida na fórmula');
  };

  const handleSave = async () => {
    const validation = validateOrcamentoFormula(formula, tipo);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    if (!nome.trim()) {
      toast.error('Informe o nome do card/coluna');
      return;
    }

    try {
      if (editing) {
        await updateMetrica.mutateAsync({
          id: editing.id,
          updates: { nome: nome.trim(), formula: formula.trim(), tipo, formato },
        });
        toast.success('Métrica atualizada');
      } else {
        await addMetrica.mutateAsync({
          nome: nome.trim(),
          formula: formula.trim(),
          tipo,
          formato,
        });
        toast.success('Métrica criada');
      }
      setFormOpen(false);
      resetForm();
    } catch (err) {
      toast.error('Não foi possível salvar', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMetrica.mutateAsync(deleteId);
      toast.success('Métrica removida');
      setDeleteId(null);
    } catch (err) {
      toast.error('Não foi possível remover', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const variables = tipo === 'card' ? ORCAMENTO_CARD_VARIABLES : ORCAMENTO_COLUNA_VARIABLES;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Métricas de Orçamentos
            </DialogTitle>
            <DialogDescription>
              Crie cards no resumo ou colunas na lista usando fórmulas. Você pode somar orçamentos de
              uma coluna de página Kanban (ex.: &quot;Fechamentos a curto prazo&quot; em &quot;Orçamentos
              internos&quot;) ou combinar com percentuais como{' '}
              <code className="text-xs bg-muted px-1 rounded">[valor_total] * 0.6</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {metricas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma métrica customizada. Clique em adicionar para criar.
              </p>
            ) : (
              metricas.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-2 p-3 rounded-lg border bg-muted/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{m.nome}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {m.tipo === 'card' ? 'Card' : 'Coluna'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                      {m.formula}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(m.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar métrica
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar métrica' : 'Nova métrica'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metrica-nome">Nome exibido</Label>
              <Input
                id="metrica-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Projeção 60%"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as OrcamentoMetricaTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TIPO_OPTIONS.find((o) => o.value === tipo)?.hint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metrica-formula">Fórmula</Label>
              <Input
                id="metrica-formula"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="[valor_total] * 0.6"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <Button
                    key={v.key}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => insertVariable(v.key)}
                  >
                    {v.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFormula((prev) => `${prev} * 0.6`)}
                >
                  × 60%
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Variáveis básicas: {getOrcamentoVariableKeys(tipo).join(', ')}. Use também somas de
                colunas Kanban ou de outras colunas calculadas abaixo.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Columns3 className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-medium">Soma de coluna (página Kanban)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Some todos os leads de uma coluna em uma página Kanban — por exemplo, orçamentos da
                coluna &quot;Fechamentos a curto prazo&quot; na página &quot;Orçamentos internos&quot;.
              </p>
              {isLoadingKanban ? (
                <p className="text-xs text-muted-foreground">Carregando páginas Kanban…</p>
              ) : kanbanPagesAtivas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma página Kanban configurada. Crie em Configurações do Pipeline → Páginas
                  Kanban.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Página</Label>
                      <Select
                        value={kanbanPageId}
                        onValueChange={(v) => {
                          setKanbanPageId(v);
                          setKanbanColumnId('');
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Ex.: Orçamentos internos" />
                        </SelectTrigger>
                        <SelectContent>
                          {kanbanPagesAtivas.map((page) => (
                            <SelectItem key={page.id} value={page.id}>
                              {page.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Coluna</Label>
                      <Select
                        value={kanbanColumnId}
                        onValueChange={setKanbanColumnId}
                        disabled={!kanbanPageId || kanbanColunasDaPagina.length === 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              kanbanPageId
                                ? 'Ex.: Fechamentos a curto prazo'
                                : 'Escolha a página primeiro'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {kanbanColunasDaPagina.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">O que somar</Label>
                    <Select
                      value={kanbanCampo}
                      onValueChange={(v) => setKanbanCampo(v as KanbanSomaCampo)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KANBAN_CAMPO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={insertKanbanSoma}
                    disabled={!kanbanColumnId}
                  >
                    Inserir soma desta coluna na fórmula
                  </Button>
                </>
              )}
            </div>

            {colunasMetricaDisponiveis.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <p className="text-sm font-medium">Soma de outra coluna calculada</p>
                <p className="text-xs text-muted-foreground">
                  Some os valores de uma coluna customizada já criada na lista de orçamentos.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={somaMetricaId} onValueChange={setSomaMetricaId}>
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="Escolha a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {colunasMetricaDisponiveis.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={insertMetricaSoma}
                    disabled={!somaMetricaId}
                  >
                    Inserir soma
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Formato do resultado</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v as OrcamentoMetricaFormato)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={addMetrica.isPending || updateMetrica.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover métrica?</AlertDialogTitle>
            <AlertDialogDescription>
              Cards e colunas que usam esta fórmula deixarão de aparecer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
