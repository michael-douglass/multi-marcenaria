import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2, Save, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import { useLeadOrigins } from '@/hooks/useLeadOrigins';
import { useRegioes } from '@/hooks/useRegioes';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PIPELINE_STAGES } from '@/types/kanban-config';
import { encodeKanbanFiltroLista, decodeKanbanFiltroLista } from '@/lib/kanban-filter-encoding';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SourceDraft {
  tipoFonte: 'status' | 'column';
  valorFonte: string;
  /** Vazio = todas as origens */
  filtroOrigens: string[];
  /** Vazio = todas as regiões */
  filtroRegioes: string[];
  ativo: boolean;
}

interface MultiFiltroPopoverProps {
  opcoes: { value: string; label: string }[];
  valores: string[];
  onChange: (next: string[]) => void;
  labelTodas: string;
  tituloLista: string;
}

function MultiFiltroPopover({ opcoes, valores, onChange, labelTodas, tituloLista }: MultiFiltroPopoverProps) {
  const [open, setOpen] = useState(false);
  const temFiltro = valores.length > 0;
  const resumo = !temFiltro
    ? labelTodas
    : valores.length <= 2
      ? valores.join(', ')
      : `${valores.length} selecionadas`;

  const alternar = (value: string) => {
    if (valores.includes(value)) {
      onChange(valores.filter((v) => v !== value));
    } else {
      onChange([...valores, value]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn('justify-between gap-1 font-normal min-h-9 w-full min-w-0')}>
          <span className="truncate text-left">{resumo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <p className="text-xs text-muted-foreground px-3 pt-3 pb-1">{tituloLista}</p>
        <div className="max-h-56 overflow-y-auto px-2 pb-2 space-y-0.5">
          {opcoes.map((op) => (
            <button
              key={op.value}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => alternar(op.value)}
            >
              <Checkbox checked={valores.includes(op.value)} className="pointer-events-none" />
              <span className="truncate">{op.label}</span>
            </button>
          ))}
        </div>
        {temFiltro ? (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full h-8" onClick={() => onChange([])}>
              Limpar filtro ({labelTodas})
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function PipelineKanbanSettings() {
  const { user } = useAuth();
  const {
    pages,
    createPage,
    updatePage,
    deletePage,
    reorderPages,
    createColumn,
    updateColumn,
    deleteColumn,
    replaceColumnSources,
    upsertColumnOverride,
  } = useKanbanConfig();
  const { origins } = useLeadOrigins();
  const { regioesDisponiveis } = useRegioes();
  const { activeStages: pipelineStages } = usePipelineCustomStages();
  // Lista de status disponíveis = colunas do Pipeline (defaults + customizadas), na ordem configurada.
  const statusOpcoes = useMemo<string[]>(
    () => (pipelineStages.length > 0 ? pipelineStages.map((s) => s.nome) : [...DEFAULT_PIPELINE_STAGES]),
    [pipelineStages],
  );

  const [newPageName, setNewPageName] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [newColumnName, setNewColumnName] = useState('');
  const [overrideLeadId, setOverrideLeadId] = useState('');
  const [overrideAction, setOverrideAction] = useState<'include' | 'exclude'>('include');
  const [overrideColumnId, setOverrideColumnId] = useState('');
  const [sourceDrafts, setSourceDrafts] = useState<Record<string, SourceDraft[]>>({});
  /** Rascunho local do nome da coluna (evita salvar a cada tecla e “comer” letras por corrida de requisições). */
  const [columnNomeDraft, setColumnNomeDraft] = useState<Record<string, string>>({});
  const [columnNomeSalvandoId, setColumnNomeSalvandoId] = useState<string | null>(null);
  /** Rascunho do nome da página selecionada (salva no blur, como nas colunas). */
  const [paginaNomeDraft, setPaginaNomeDraft] = useState<string | null>(null);
  const [paginaNomeSalvando, setPaginaNomeSalvando] = useState(false);

  const selectedPage = useMemo(() => pages.find((page) => page.id === selectedPageId) ?? null, [pages, selectedPageId]);

  useEffect(() => {
    setColumnNomeDraft({});
    setPaginaNomeDraft(null);
  }, [selectedPageId]);

  const loadDrafts = (pageId: string) => {
    const page = pages.find((entry) => entry.id === pageId);
    if (!page) return;
    const nextDrafts: Record<string, SourceDraft[]> = {};
    page.columns.forEach((column) => {
      nextDrafts[column.id] = column.sources.map((source) => ({
        tipoFonte: source.tipoFonte,
        valorFonte: source.valorFonte,
        filtroOrigens: decodeKanbanFiltroLista(source.filtroOrigem) ?? [],
        filtroRegioes: decodeKanbanFiltroLista(source.filtroRegiao) ?? [],
        ativo: source.ativo,
      }));
    });
    setSourceDrafts(nextDrafts);
  };

  const handleCreatePage = async () => {
    if (!newPageName.trim()) return;
    const slug = (newPageSlug.trim() || slugify(newPageName)) || `kanban-${Date.now()}`;
    await createPage.mutateAsync({ nome: newPageName.trim(), slug });
    setNewPageName('');
    setNewPageSlug('');
  };

  const handleCreateColumn = async () => {
    if (!selectedPage || !newColumnName.trim()) return;
    await createColumn.mutateAsync({ paginaId: selectedPage.id, nome: newColumnName.trim() });
    setNewColumnName('');
  };

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.ordem - b.ordem),
    [pages],
  );

  const handleMovePage = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= sortedPages.length) return;

    const orderedIds = sortedPages.map((page) => page.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];

    await reorderPages.mutateAsync(orderedIds);
  };

  const handleMoveColumn = async (index: number, direction: 'up' | 'down') => {
    if (!selectedPage) return;
    const cols = [...selectedPage.columns];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= cols.length) return;
    const a = cols[index];
    const b = cols[target];
    // Troca as ordens das duas colunas afetadas.
    await Promise.all([
      updateColumn.mutateAsync({ id: a.id, updates: { ordem: b.ordem } }),
      updateColumn.mutateAsync({ id: b.id, updates: { ordem: a.ordem } }),
    ]);
  };

  const columnNomeExibido = (columnId: string, nomeServidor: string) => columnNomeDraft[columnId] ?? nomeServidor;


  const handlePaginaNomeBlur = async () => {
    if (!selectedPage) return;
    if (paginaNomeDraft === null) return;
    const trimmed = paginaNomeDraft.trim();
    if (trimmed === '' || trimmed === selectedPage.nome) {
      setPaginaNomeDraft(null);
      return;
    }
    setPaginaNomeSalvando(true);
    try {
      await updatePage.mutateAsync({ id: selectedPage.id, updates: { nome: trimmed } });
      setPaginaNomeDraft(null);
    } catch {
      /* mantém o rascunho */
    } finally {
      setPaginaNomeSalvando(false);
    }
  };

  const handleColumnNomeBlur = async (columnId: string, nomeServidor: string) => {
    const draft = columnNomeDraft[columnId];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === nomeServidor) {
      setColumnNomeDraft((prev) => {
        const next = { ...prev };
        delete next[columnId];
        return next;
      });
      return;
    }
    setColumnNomeSalvandoId(columnId);
    try {
      await updateColumn.mutateAsync({ id: columnId, updates: { nome: trimmed } });
      setColumnNomeDraft((prev) => {
        const next = { ...prev };
        delete next[columnId];
        return next;
      });
    } catch {
      /* mantém o rascunho para o usuário corrigir */
    } finally {
      setColumnNomeSalvandoId(null);
    }
  };

  const handleSaveSources = async (columnId: string) => {
    const drafts = sourceDrafts[columnId] ?? [];
    await replaceColumnSources.mutateAsync({
      colunaId: columnId,
      sources: drafts.map((draft) => ({
        tipoFonte: draft.tipoFonte,
        valorFonte: draft.valorFonte,
        filtroOrigem: encodeKanbanFiltroLista(draft.filtroOrigens),
        filtroRegiao: encodeKanbanFiltroLista(draft.filtroRegioes),
        filtroVendedorId: null,
        filtroDataDe: null,
        filtroDataAte: null,
        ativo: draft.ativo,
      })),
    });
  };

  const addSourceDraft = (columnId: string) => {
    setSourceDrafts((prev) => ({
      ...prev,
      [columnId]: [
        ...(prev[columnId] ?? []),
        {
          tipoFonte: 'status',
          valorFonte: DEFAULT_PIPELINE_STAGES[0],
          filtroOrigens: [],
          filtroRegioes: [],
          ativo: true,
        },
      ],
    }));
  };

  const updateSourceDraft = (columnId: string, index: number, updates: Partial<SourceDraft>) => {
    setSourceDrafts((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] ?? []).map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...updates } : draft)),
    }));
  };

  const removeSourceDraft = (columnId: string, index: number) => {
    setSourceDrafts((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] ?? []).filter((_, draftIndex) => draftIndex !== index),
    }));
  };

  const handleCreateOverride = async () => {
    if (!overrideColumnId || !overrideLeadId.trim() || !user?.id) return;
    const parsedLeadId = Number(overrideLeadId);
    if (!Number.isFinite(parsedLeadId)) return;

    await upsertColumnOverride.mutateAsync({
      colunaId: overrideColumnId,
      leadId: parsedLeadId,
      acao: overrideAction,
      criadoPor: user.id,
    });
    setOverrideLeadId('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Páginas Kanban Personalizadas</CardTitle>
          <CardDescription>
            Crie páginas com rota própria. Use as setas para definir a ordem no menu Pipeline e na navegação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Nome da Página</Label>
              <Input value={newPageName} onChange={(event) => setNewPageName(event.target.value)} placeholder="Ex: Pré-vendas" />
            </div>
            <div className="space-y-1">
              <Label>Slug da rota</Label>
              <Input value={newPageSlug} onChange={(event) => setNewPageSlug(event.target.value)} placeholder="Ex: pre-vendas" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreatePage} disabled={createPage.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar Página
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {sortedPages.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma página configurada ainda.</p>
            )}
            {sortedPages.map((page, pageIndex) => (
              <div
                key={page.id}
                className="border rounded-md p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <GripVertical className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{page.nome}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {pageIndex + 1}º no menu
                      </Badge>
                      {!page.ativo && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Inativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">/pipeline/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleMovePage(pageIndex, 'up')}
                    disabled={pageIndex === 0 || reorderPages.isPending}
                    aria-label={`Mover "${page.nome}" para cima`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleMovePage(pageIndex, 'down')}
                    disabled={pageIndex === sortedPages.length - 1 || reorderPages.isPending}
                    aria-label={`Mover "${page.nome}" para baixo`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updatePage.mutate({ id: page.id, updates: { ativo: !page.ativo } })}
                  >
                    {page.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedPageId(page.id);
                      loadDrafts(page.id);
                    }}
                  >
                    Configurar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deletePage.mutate(page.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedPage && (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
              <CardTitle className="text-2xl shrink-0">Colunas e Fontes</CardTitle>
              <span className="hidden sm:inline text-muted-foreground select-none" aria-hidden>
                —
              </span>
              <Input
                className="text-2xl font-semibold leading-none tracking-tight h-10 sm:min-w-[12rem] sm:flex-1 max-w-full"
                value={paginaNomeDraft ?? selectedPage.nome}
                onChange={(event) => setPaginaNomeDraft(event.target.value)}
                onBlur={() => void handlePaginaNomeBlur()}
                disabled={paginaNomeSalvando}
                aria-label="Nome da página Kanban"
              />
            </div>
            <CardDescription>Defina as colunas e de onde cada uma puxa os cards.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-2">
              <Input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Nome da nova coluna" />
              <Button onClick={handleCreateColumn} disabled={createColumn.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {selectedPage.columns.map((column, columnIndex) => (
              <div key={column.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Input
                      value={columnNomeExibido(column.id, column.nome)}
                      onChange={(event) =>
                        setColumnNomeDraft((prev) => ({
                          ...prev,
                          [column.id]: event.target.value,
                        }))
                      }
                      onBlur={() => void handleColumnNomeBlur(column.id, column.nome)}
                      disabled={columnNomeSalvandoId === column.id}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleMoveColumn(columnIndex, 'up')}
                      disabled={columnIndex === 0 || updateColumn.isPending}
                      aria-label="Mover coluna para cima"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleMoveColumn(columnIndex, 'down')}
                      disabled={columnIndex === selectedPage.columns.length - 1 || updateColumn.isPending}
                      aria-label="Mover coluna para baixo"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteColumn.mutate(column.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Fontes de origem da coluna</Label>
                    <Button size="sm" variant="outline" onClick={() => addSourceDraft(column.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Nova Fonte
                    </Button>
                  </div>

                  {(sourceDrafts[column.id] ?? []).map((draft, index) => (
                    <div
                      key={`${column.id}-${index}`}
                      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch border rounded-md p-2"
                    >
                      <div className="w-full sm:w-[150px] shrink-0">
                        <Select value={draft.tipoFonte} onValueChange={(value) => updateSourceDraft(column.id, index, { tipoFonte: value as 'status' | 'column' })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="status">Coluna/Status</SelectItem>
                            <SelectItem value="column">Coluna configurada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:min-w-[200px] sm:flex-1">
                        <Select value={draft.valorFonte} onValueChange={(value) => updateSourceDraft(column.id, index, { valorFonte: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOpcoes.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:min-w-[160px] sm:flex-1">
                        <MultiFiltroPopover
                          tituloLista="Origens (pode marcar várias)"
                          labelTodas="Todas origens"
                          opcoes={origins.map((origin) => ({ value: origin.nome, label: origin.nome }))}
                          valores={draft.filtroOrigens}
                          onChange={(next) => updateSourceDraft(column.id, index, { filtroOrigens: next })}
                        />
                      </div>
                      <div className="w-full sm:min-w-[160px] sm:flex-1">
                        <MultiFiltroPopover
                          tituloLista="Regiões (pode marcar várias)"
                          labelTodas="Todas regiões"
                          opcoes={regioesDisponiveis.map((regiao) => ({ value: regiao, label: regiao }))}
                          valores={draft.filtroRegioes}
                          onChange={(next) => updateSourceDraft(column.id, index, { filtroRegioes: next })}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0 self-end sm:self-center" onClick={() => removeSourceDraft(column.id, index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => handleSaveSources(column.id)} disabled={replaceColumnSources.isPending}>
                      <Save className="h-4 w-4 mr-1" />
                      Salvar fontes
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Overrides manuais (incluir/excluir lead por ID)</Label>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Input placeholder="ID do Lead" value={overrideColumnId === column.id ? overrideLeadId : ''} onChange={(event) => {
                      setOverrideColumnId(column.id);
                      setOverrideLeadId(event.target.value);
                    }} />
                    <Select value={overrideColumnId === column.id ? overrideAction : 'include'} onValueChange={(value) => {
                      setOverrideColumnId(column.id);
                      setOverrideAction(value as 'include' | 'exclude');
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="include">Incluir</SelectItem>
                        <SelectItem value="exclude">Excluir</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleCreateOverride} disabled={upsertColumnOverride.isPending}>
                      Salvar ajuste manual
                    </Button>
                    <div className="flex flex-wrap gap-1 items-center">
                      <Badge variant="secondary">{column.overrides.length} override(s)</Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
