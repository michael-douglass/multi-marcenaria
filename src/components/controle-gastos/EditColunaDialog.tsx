import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MktConfigColuna, useMarketingGastos, ColunaType, SystemDataType } from '@/hooks/useMarketingGastos';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';
import { Pencil, Calculator, Database, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const COLUMN_TYPES: Array<{ value: ColunaType; label: string; description: string }> = [
  { value: 'number', label: 'Número', description: 'Valores inteiros ou decimais' },
  { value: 'currency', label: 'Monetário', description: 'Valores em reais (R$)' },
  { value: 'percent', label: 'Porcentagem', description: 'Valores percentuais (%)' },
];

const SYSTEM_DATA_TYPES: Array<{ value: SystemDataType; label: string; description: string }> = [
  { value: 'leads_total', label: 'Total de Leads', description: 'Quantidade total de leads' },
  { value: 'leads_origem', label: 'Leads por Origem', description: 'Leads filtrados por origem' },
  { value: 'reunioes_total', label: 'Total de Reuniões', description: 'Quantidade total de reuniões' },
  { value: 'reunioes_concluidas', label: 'Reuniões Concluídas', description: 'Reuniões com status concluído' },
  { value: 'vendas_total', label: 'Total de Vendas', description: 'Quantidade de vendas realizadas' },
  { value: 'vendas_valor', label: 'Valor de Vendas', description: 'Soma dos valores de venda' },
];

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  tipo: z.enum(['number', 'percent', 'currency']),
  usaFormula: z.boolean().default(false),
  formula: z.string().optional(),
  isSystemData: z.boolean().default(false),
  systemDataType: z.string().optional(),
  systemDataFilter: z.string().optional(),
  largura: z.number().min(60).max(400).default(120),
});

type FormData = z.infer<typeof formSchema>;

interface EditColunaDialogProps {
  coluna: MktConfigColuna | null;
  existingColumns: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditColunaDialog({ 
  coluna,
  existingColumns,
  open, 
  onOpenChange 
}: EditColunaDialogProps) {
  const { updateColuna } = useMarketingGastos();
  const { validateFormula } = useFormulaEngine();
  const [isLoading, setIsLoading] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);

  // Filtrar colunas disponíveis (excluir a coluna sendo editada)
  const availableColumns = existingColumns.filter(c => 
    coluna ? c.toLowerCase() !== coluna.nome.toLowerCase() : true
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      tipo: 'number',
      usaFormula: false,
      formula: '',
      isSystemData: false,
      systemDataType: '',
      systemDataFilter: '',
      largura: 120,
    },
  });

  // Atualizar form quando a coluna muda
  useEffect(() => {
    if (coluna) {
      form.reset({
        nome: coluna.nome,
        tipo: coluna.tipo,
        usaFormula: !!coluna.formula,
        formula: coluna.formula || '',
        isSystemData: coluna.is_system_data || false,
        systemDataType: coluna.system_data_type || '',
        systemDataFilter: coluna.system_data_filter || '',
        largura: coluna.largura || 120,
      });
      setFormulaError(null);
    }
  }, [coluna, form]);

  const usaFormula = form.watch('usaFormula');
  const isSystemData = form.watch('isSystemData');
  const formula = form.watch('formula');

  // Validar fórmula ao digitar
  const handleFormulaChange = (value: string) => {
    form.setValue('formula', value);
    if (value) {
      const validation = validateFormula(value, availableColumns);
      setFormulaError(validation.valid ? null : validation.error || null);
    } else {
      setFormulaError(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!coluna) return;

    // Validar fórmula se estiver usando
    if (data.usaFormula && data.formula) {
      const validation = validateFormula(data.formula, availableColumns);
      if (!validation.valid) {
        setFormulaError(validation.error || 'Fórmula inválida');
        return;
      }
    }

    setIsLoading(true);
    const result = await updateColuna(coluna.id, {
      nome: data.nome,
      tipo: data.tipo,
      formula: data.usaFormula ? data.formula : null,
      is_system_data: data.isSystemData,
      system_data_type: data.isSystemData ? (data.systemDataType as SystemDataType) : null,
      system_data_filter: data.isSystemData ? data.systemDataFilter : null,
      largura: data.largura,
      editavel: !data.usaFormula && !data.isSystemData,
    });
    setIsLoading(false);
    
    if (result) {
      setFormulaError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex h-full max-h-[90vh] flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              Editar Coluna
            </DialogTitle>
            <DialogDescription>
              Altere as configurações da coluna "{coluna?.nome}"
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Coluna</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Cliques, Custo, CPC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Dado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLUMN_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div>{type.label}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="largura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Largura (px)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={60} 
                        max={400}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 120)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Toggle: Usar Fórmula */}
            <FormField
              control={form.control}
              name="usaFormula"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Usar Fórmula
                    </FormLabel>
                    <FormDescription>
                      Calcular valor baseado em outras colunas
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) form.setValue('isSystemData', false);
                      }}
                      disabled={isSystemData}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {usaFormula && (
              <FormField
                control={form.control}
                name="formula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fórmula</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: [custo] / [cliques]"
                        className="font-mono text-sm resize-none"
                        rows={2}
                        value={field.value}
                        onChange={(e) => handleFormulaChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Use [nome_coluna] para referenciar outras colunas. Operadores: + - * / ( )
                    </FormDescription>
                    {formulaError && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{formulaError}</AlertDescription>
                      </Alert>
                    )}
                    {availableColumns.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">Colunas disponíveis:</span>
                        {availableColumns.map(col => (
                          <button
                            key={col}
                            type="button"
                            className="text-xs bg-muted px-2 py-0.5 rounded hover:bg-primary/20"
                            onClick={() => handleFormulaChange((formula || '') + `[${col}]`)}
                          >
                            [{col}]
                          </button>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Toggle: Dados do Sistema */}
            <FormField
              control={form.control}
              name="isSystemData"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Dados Automáticos
                    </FormLabel>
                    <FormDescription>
                      Buscar dados do sistema (leads, reuniões, vendas)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) form.setValue('usaFormula', false);
                      }}
                      disabled={usaFormula}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {isSystemData && (
              <>
                <FormField
                  control={form.control}
                  name="systemDataType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Dado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo de dado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SYSTEM_DATA_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <div>{type.label}</div>
                                <div className="text-xs text-muted-foreground">{type.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemDataFilter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filtro (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Google, Facebook (para filtrar por origem)" {...field} />
                      </FormControl>
                      <FormDescription>
                        Deixe vazio para trazer todos os dados ou especifique um filtro
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
              </div>

              <DialogFooter className="shrink-0 border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || !!formulaError}>
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
