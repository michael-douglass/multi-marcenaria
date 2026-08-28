import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Plus, 
  Save,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Table2,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { 
  MktFonte, 
  MktSubFonte, 
  MktConfigColuna,
  useMarketingGastos 
} from '@/hooks/useMarketingGastos';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';
import { useSystemDataFetcher } from '@/hooks/useSystemDataFetcher';
import { CreateColunaDialog } from './CreateColunaDialog';
import { EditColunaDialog } from './EditColunaDialog';
import { SpreadsheetViewRow } from './SpreadsheetViewRow';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface SpreadsheetViewProps {
  subFonte: MktSubFonte;
  fonte: MktFonte;
  onBack: () => void;
}

export function SpreadsheetView({ subFonte, fonte, onBack }: SpreadsheetViewProps) {
  const { state: sidebarState, isMobile: isSidebarMobile } = useSidebar();
  const { 
    colunas, 
    lancamentos, 
    fetchColunas,
    fetchLancamentos, 
    batchUpsertLancamentos,
    deleteColuna 
  } = useMarketingGastos();
  const { calculateColumnValue, formatValue } = useFormulaEngine();
  const { 
    fetchSystemDataBatch, 
    getSystemDataValue, 
    fetchAllMonthlyTotals,
    getMonthlyTotalValue,
    setupRealtimeSubscription,
    loading: loadingSystemData 
  } = useSystemDataFetcher();

  const [createColunaOpen, setCreateColunaOpen] = useState(false);
  const [editColunaOpen, setEditColunaOpen] = useState(false);
  const [selectedColuna, setSelectedColuna] = useState<MktConfigColuna | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [colunaToDelete, setColunaToDelete] = useState<MktConfigColuna | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editedCells, setEditedCells] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [, forceUpdate] = useState(0);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollRef = useRef<HTMLDivElement | null>(null);
  const tableContentRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const [floatingScrollbarData, setFloatingScrollbarData] = useState({
    viewportWidth: 0,
    contentWidth: 0,
  });

  // Colunas desta sub-fonte
  const subFonteColunas = useMemo(() => 
    colunas.filter(c => c.sub_fonte_id === subFonte.id).sort((a, b) => a.ordem - b.ordem),
    [colunas, subFonte.id]
  );

  /** Mapa coluna_id|data → valor — evita .find em cada célula (O(n) por lookup). */
  const lancamentosByKey = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const l of lancamentos) {
      m.set(`${l.coluna_id}|${l.data}`, l.valor_numerico);
    }
    return m;
  }, [lancamentos]);

  // Dias do mês atual
  const daysOfMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Array de datas formatadas para o mês
  const dateStrings = useMemo(() => 
    daysOfMonth.map(day => format(day, 'yyyy-MM-dd')),
    [daysOfMonth]
  );

  // Carregar colunas e lançamentos
  useEffect(() => {
    const load = async () => {
      await fetchColunas(subFonte.id);
    };
    load();
  }, [subFonte.id, fetchColunas]);

  // Chave estável das colunas desta sub-fonte (evita refetch quando outras subfontes mudam)
  const subFonteColunasKey = useMemo(
    () => subFonteColunas.map(c => c.id).join(','),
    [subFonteColunas]
  );

  useEffect(() => {
    if (subFonteColunas.length > 0) {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      fetchLancamentos(
        subFonteColunas.map(c => c.id),
        startDate,
        endDate
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subFonteColunasKey, currentMonth]);

  // Carregar dados automáticos do sistema para colunas marcadas
  useEffect(() => {
    const systemColumns = subFonteColunas.filter(c => c.is_system_data);
    if (systemColumns.length > 0 && dateStrings.length > 0) {
      fetchSystemDataBatch(systemColumns, dateStrings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subFonteColunasKey, dateStrings]);

  // Carregar totais mensais e configurar real-time
  useEffect(() => {
    const systemColumns = subFonteColunas.filter(c => c.is_system_data);
    if (systemColumns.length > 0) {
      fetchAllMonthlyTotals(systemColumns, currentMonth);
      const cleanup = setupRealtimeSubscription(
        systemColumns,
        currentMonth,
        () => forceUpdate(n => n + 1)
      );
      return cleanup;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subFonteColunasKey, currentMonth]);

  // Obter valor numérico do total mensal de uma coluna (para usar em fórmulas)
  // Inclui colunas com fórmula: somar lançamentos daria 0; precisa avaliar a fórmula com totais mensais das referências.
  const getMonthlyTotalNumeric = useCallback((coluna: MktConfigColuna): number | null => {
    const visited = new Set<string>();

    const resolve = (c: MktConfigColuna): number | null => {
      if (visited.has(c.id)) return null;
      visited.add(c.id);
      try {
        if (c.formula) {
          const matches = c.formula.match(/\[([^\]]+)\]/g);
          if (!matches) return null;
          let expression = c.formula;
          for (const match of matches) {
            const varName = match.slice(1, -1).trim();
            const referencedColuna = subFonteColunas.find(
              x => x.nome.trim().toLowerCase() === varName.toLowerCase()
            );
            if (!referencedColuna) return null;
            const value = resolve(referencedColuna);
            if (value === null) return null;
            expression = expression.split(match).join(String(value));
          }
          const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
          // eslint-disable-next-line no-new-func
          const result = new Function(`return ${sanitized}`)();
          if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return null;
          return result;
        }

        if (c.is_system_data && c.system_data_type) {
          return getMonthlyTotalValue(c, currentMonth);
        }

        return lancamentos
          .filter(l => l.coluna_id === c.id)
          .reduce((sum, l) => sum + (l.valor_numerico || 0), 0);
      } finally {
        visited.delete(c.id);
      }
    };

    return resolve(coluna);
  }, [getMonthlyTotalValue, currentMonth, lancamentos, subFonteColunas]);

  // Obter total mensal de uma coluna (formatado para exibição)
  const getMonthlyTotal = useCallback((coluna: MktConfigColuna): string => {
    // Se tem fórmula, calcula usando os totais mensais das colunas referenciadas
    if (coluna.formula) {
      try {
        // Extrai variáveis da fórmula
        const matches = coluna.formula.match(/\[([^\]]+)\]/g);
        if (!matches) return '-';

        let expression = coluna.formula;
        
        for (const match of matches) {
          const varName = match.slice(1, -1).trim();
          const referencedColuna = subFonteColunas.find(
            c => c.nome.trim().toLowerCase() === varName.toLowerCase()
          );
          
          if (!referencedColuna) return '-';
          
          const value = getMonthlyTotalNumeric(referencedColuna);
          if (value === null || value === 0) {
            // Evita divisão por zero
            if (coluna.formula.includes(match) && coluna.formula.includes('/')) {
              const afterSlash = coluna.formula.split('/')[1];
              if (afterSlash && afterSlash.includes(match) && value === 0) {
                return '-';
              }
            }
          }
          
          expression = expression.split(match).join((value ?? 0).toString());
        }

        // Remove caracteres não permitidos e avalia
        const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${sanitized}`)();
        
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
          return '-';
        }
        
        return formatValue(result, coluna.tipo);
      } catch {
        return '-';
      }
    }

    if (coluna.is_system_data && coluna.system_data_type) {
      const value = getMonthlyTotalValue(coluna, currentMonth);
      if (value !== null) {
        return formatValue(value, coluna.tipo);
      }
      return loadingSystemData ? '...' : '-';
    }

    // Para colunas de lançamentos manuais, soma os valores do mês
    const total = lancamentos
      .filter(l => l.coluna_id === coluna.id)
      .reduce((sum, l) => sum + (l.valor_numerico || 0), 0);
    
    return formatValue(total, coluna.tipo);
  }, [getMonthlyTotalValue, getMonthlyTotalNumeric, currentMonth, formatValue, loadingSystemData, lancamentos, subFonteColunas]);

  /**
   * Texto das células só leitura por dia/coluna. Recalcula só quando lançamentos/cache mudam,
   * não a cada tecla no input (melhora muito a digitação).
   */
  const readOnlyCellDisplay = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const day of daysOfMonth) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const row: Record<string, string> = {};
      for (const coluna of subFonteColunas) {
        const isEditable = coluna.editavel && !coluna.formula && !coluna.is_system_data;
        if (isEditable) continue;

        if (coluna.is_system_data && coluna.system_data_type) {
          const value = getSystemDataValue(coluna, dateStr);
          row[coluna.id] =
            value !== null
              ? formatValue(value, coluna.tipo)
              : loadingSystemData
                ? '...'
                : '-';
        } else if (coluna.formula) {
          const value = calculateColumnValue(coluna, {
            colunas: subFonteColunas,
            lancamentos,
            data: dateStr,
            getSystemValue: getSystemDataValue,
          });
          row[coluna.id] = formatValue(value, coluna.tipo);
        } else {
          const v = lancamentosByKey.get(`${coluna.id}|${dateStr}`) ?? null;
          row[coluna.id] = formatValue(v, coluna.tipo);
        }
      }
      out[dateStr] = row;
    }
    return out;
  }, [
    daysOfMonth,
    subFonteColunas,
    lancamentos,
    lancamentosByKey,
    getSystemDataValue,
    loadingSystemData,
    calculateColumnValue,
    formatValue,
  ]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const dayRowMeta = useMemo(
    () =>
      daysOfMonth.map((day) => ({
        dateStr: format(day, 'yyyy-MM-dd'),
        dayOfMonth: format(day, 'd'),
        weekdayShort: format(day, 'EEE', { locale: ptBR }),
      })),
    [daysOfMonth]
  );

  const monthlyTotalCells = useMemo(
    () =>
      subFonteColunas.map((coluna) => ({
        coluna,
        text: getMonthlyTotal(coluna),
        isManualColumn: coluna.editavel && !coluna.formula && !coluna.is_system_data,
      })),
    [subFonteColunas, getMonthlyTotal]
  );

  // Handler para edição de célula
  const handleCellChange = useCallback((colunaId: string, date: string, value: string) => {
    setEditedCells((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [colunaId]: value,
      },
    }));
  }, []);

  // Salvar alterações
  const handleSave = async () => {
    setIsSaving(true);
    
    const items: Array<{ coluna_id: string; data: string; valor_numerico: number | null }> = [];
    
    Object.entries(editedCells).forEach(([date, columns]) => {
      Object.entries(columns).forEach(([colunaId, value]) => {
        const numValue = value === '' ? null : parseFloat(value.replace(',', '.'));
        items.push({
          coluna_id: colunaId,
          data: date,
          valor_numerico: isNaN(numValue as number) ? null : numValue,
        });
      });
    });

    if (items.length > 0) {
      await batchUpsertLancamentos(items);
      
      // Recarregar lançamentos
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      await fetchLancamentos(
        subFonteColunas.map(c => c.id),
        startDate,
        endDate
      );
    }
    
    setEditedCells({});
    setIsSaving(false);
  };

  // Navegação de mês
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setEditedCells({});
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setEditedCells({});
  };

  // Handlers para editar/excluir coluna
  const handleEditColuna = (coluna: MktConfigColuna) => {
    setSelectedColuna(coluna);
    setEditColunaOpen(true);
  };

  const handleDeleteColuna = (coluna: MktConfigColuna) => {
    setColunaToDelete(coluna);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteColuna = async () => {
    if (colunaToDelete) {
      await deleteColuna(colunaToDelete.id);
      setColunaToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const hasChanges = Object.keys(editedCells).length > 0;
  const shouldShowFloatingScrollbar =
    floatingScrollbarData.contentWidth > floatingScrollbarData.viewportWidth;

  /** Barra fixa na parte de baixo da tela visível, alinhada à área do conteúdo (não sobrepõe a sidebar). */
  const floatingBarViewportStyle = useMemo(() => {
    if (isSidebarMobile) {
      return { left: '1rem', right: '1rem' } as const;
    }
    const sidebarTrack =
      sidebarState === 'collapsed' ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)';
    return {
      left: `calc(${sidebarTrack} + 1rem)`,
      right: '1rem',
    } as const;
  }, [isSidebarMobile, sidebarState]);

  useEffect(() => {
    let raf = 0;
    const syncFloatingMeasurements = () => {
      const mainScrollElement = mainScrollRef.current;
      const tableContentElement = tableContentRef.current;
      if (!mainScrollElement || !tableContentElement) return;

      setFloatingScrollbarData({
        viewportWidth: mainScrollElement.clientWidth,
        contentWidth: tableContentElement.scrollWidth,
      });
    };

    const scheduleSync = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncFloatingMeasurements();
      });
    };

    syncFloatingMeasurements();

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    if (mainScrollRef.current) {
      resizeObserver.observe(mainScrollRef.current);
    }
    if (tableContentRef.current) {
      resizeObserver.observe(tableContentRef.current);
    }
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleSync);
    };
  }, [subFonteColunas.length, daysOfMonth.length, isSidebarMobile, sidebarState]);

  useEffect(() => {
    const mainScrollElement = mainScrollRef.current;
    const floatingScrollElement = floatingScrollRef.current;
    if (!mainScrollElement || !floatingScrollElement) return;

    const syncMainToFloating = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      floatingScrollElement.scrollLeft = mainScrollElement.scrollLeft;
      isSyncingScrollRef.current = false;
    };

    const syncFloatingToMain = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      mainScrollElement.scrollLeft = floatingScrollElement.scrollLeft;
      isSyncingScrollRef.current = false;
    };

    mainScrollElement.addEventListener('scroll', syncMainToFloating);
    floatingScrollElement.addEventListener('scroll', syncFloatingToMain);
    floatingScrollElement.scrollLeft = mainScrollElement.scrollLeft;

    return () => {
      mainScrollElement.removeEventListener('scroll', syncMainToFloating);
      floatingScrollElement.removeEventListener('scroll', syncFloatingToMain);
    };
  }, [shouldShowFloatingScrollbar, floatingBarViewportStyle]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div 
        className="px-6 py-4 border-b"
        style={{ 
          background: `linear-gradient(135deg, ${fonte.cor}10 0%, transparent 50%)` 
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{subFonte.nome}</h1>
                <Badge variant="outline" style={{ borderColor: fonte.cor, color: fonte.cor }}>
                  {fonte.nome}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Gerencie os dados e métricas desta sub-fonte
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateColunaOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Coluna
            </Button>
            {hasChanges && (
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={goToNextMonth}>
          Próximo
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 p-6 overflow-hidden">
        {subFonteColunas.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Table2 className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma coluna configurada</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Configure as colunas que deseja rastrear: Cliques, Custo, Conversões, CPC, etc.
              </p>
              <Button onClick={() => setCreateColunaOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeira Coluna
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full overflow-hidden">
            <div className="relative h-full">
              <div ref={mainScrollRef} className="h-full overflow-auto pb-14">
                <div ref={tableContentRef} className="min-w-max">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      <th className="border-b border-r px-4 py-3 text-left font-semibold text-sm min-w-[120px] bg-muted">
                        Data
                      </th>
                      {subFonteColunas.map(coluna => (
                        <th 
                          key={coluna.id} 
                          className="border-b border-r px-4 py-3 text-left font-semibold text-sm bg-muted"
                          style={{ minWidth: coluna.largura }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="truncate">{coluna.nome}</span>
                              {coluna.formula && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  fórmula
                                </Badge>
                              )}
                              {coluna.is_system_data && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  auto
                                </Badge>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditColuna(coluna)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteColuna(coluna)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="text-xs text-muted-foreground font-normal mt-0.5">
                            {coluna.tipo === 'currency' ? 'R$' : coluna.tipo === 'percent' ? '%' : '#'}
                            {coluna.formula && (
                              <span className="ml-2 text-amber-600" title={coluna.formula}>
                                = {coluna.formula}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Linha de Total do Mês - sempre no topo */}
                    <tr className="bg-primary/10 font-semibold sticky top-[52px] z-[5]">
                      <td className="border-b border-r px-4 py-3 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-primary text-primary-foreground">
                            Σ
                          </span>
                          <span className="text-primary">Total do Mês</span>
                        </div>
                      </td>
                      {monthlyTotalCells.map(({ coluna, text, isManualColumn }) => (
                        <td
                          key={`total-${coluna.id}`}
                          className={cn(
                            'border-b border-r px-4 py-3 text-right font-bold',
                            coluna.formula ? 'text-amber-600' : 'text-primary'
                          )}
                          title={
                            isManualColumn
                              ? 'Insira valores nas linhas abaixo para calcular o total'
                              : coluna.formula
                                ? `Fórmula: ${coluna.formula}`
                                : undefined
                          }
                        >
                          {text}
                        </td>
                      ))}
                    </tr>
                    
                    {dayRowMeta.map(({ dateStr, dayOfMonth, weekdayShort }) => (
                      <SpreadsheetViewRow
                        key={dateStr}
                        dateStr={dateStr}
                        dayOfMonth={dayOfMonth}
                        weekdayShort={weekdayShort}
                        isToday={dateStr === todayStr}
                        columns={subFonteColunas}
                        readOnlyByColId={readOnlyCellDisplay[dateStr] ?? {}}
                        rowDraft={editedCells[dateStr]}
                        lancamentosByKey={lancamentosByKey}
                        onCellChange={handleCellChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              </div>

              {shouldShowFloatingScrollbar && (
                <div
                  className="fixed bottom-4 z-40 max-w-full pointer-events-none"
                  style={floatingBarViewportStyle}
                >
                  <div className="pointer-events-auto w-full rounded-md border bg-background/95 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/90">
                    <div
                      ref={floatingScrollRef}
                      className="h-4 overflow-x-auto overflow-y-hidden"
                      aria-label="Barra de rolagem horizontal flutuante"
                    >
                      <div style={{ width: floatingScrollbarData.contentWidth, height: 1 }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <CreateColunaDialog
        subFonteId={subFonte.id}
        existingColumns={subFonteColunas.map(c => c.nome)}
        open={createColunaOpen}
        onOpenChange={setCreateColunaOpen}
      />

      <EditColunaDialog
        coluna={selectedColuna}
        existingColumns={subFonteColunas.map(c => c.nome)}
        open={editColunaOpen}
        onOpenChange={(open) => {
          setEditColunaOpen(open);
          if (!open) setSelectedColuna(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a coluna "{colunaToDelete?.nome}"? 
              Todos os dados associados a esta coluna serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setColunaToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteColuna} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
