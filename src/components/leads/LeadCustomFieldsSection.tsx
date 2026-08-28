import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, X, Trophy, Users, Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
  useLeadCustomFieldDefs,
  useLeadCustomFieldValues,
  type CustomFieldType,
  type LeadCustomFieldDefinition,
  type PontuaGarboConfig,
} from '@/hooks/useLeadCustomFields';
import { useUsers } from '@/hooks/useUsers';
import {
  buildLeadPontuaGarboSaleInfo,
  getPontuaPercentualPadraoFromField,
  isPontuaGarboCampoDefinitivo,
  isPontuaGarboComissaoAtivaNoLead,
  isPontuaGarboFieldActive,
  parsePontuaPercentualInput,
  PONTUA_GARBO_PERCENTUAL_PADRAO,
  resolvePontuaPercentual,
  type LeadPontuaGarboSaleInfo,
} from '@/lib/pontua-garbo';
import { useLeadPrestadorPermissoes } from '@/hooks/useLeadPrestadorPermissoes';
import { useLeadPDFs, type LeadPDF } from '@/hooks/useLeadPDFs';
import { useOrcamentosPorLead } from '@/hooks/useOrcamentoSlides';
import { anexoTipo, syncPodeVerAnexos, anexoEstaMarcado, orcamentoEstaMarcado, anexosVisiveisAoLigarCategoria, orcamentosVisiveisAoLigar, toggleAnexoId, toggleOrcamentoId } from '@/lib/prestador-visibilidade';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Presentation, Loader2 } from 'lucide-react';

interface LeadCustomFieldsSectionProps {
  leadId: number | null | undefined;
  isEditable: boolean;
  /** Admin da empresa ou usuário master (super admin) */
  isAdmin: boolean;
  /** Admin, master e vendedor: controlam o que o prestador vê neste lead */
  canManagePrestadorVisibilidade?: boolean;
  /** Valor do orçamento do lead — usado para calcular comissão Pontua Garbo */
  budgetValue?: number;
  /** Atualiza o modal de venda com o estado atual do card (antes de salvar no banco). */
  onPontuaGarboSaleInfoChange?: (info: LeadPontuaGarboSaleInfo | null) => void;
}

const TIPO_LABELS: Record<CustomFieldType, string> = {
  texto: 'Texto',
  numero: 'Número',
  data: 'Data',
  select: 'Lista de opções',
  usuario_sistema: 'Usuário do Sistema',
};

// ── Helper: formata moeda BR ──────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Comissão Pontua Garbo no card do lead (percentual por lead) ────────────────
interface PontuaGarboLeadPanelProps {
  percentualInput: string;
  onPercentualChange: (raw: string) => void;
  onPercentualCommit: () => void;
  budgetValue: number;
  userName: string;
  isEditable: boolean;
}

function PontuaGarboLeadPanel({
  percentualInput,
  onPercentualChange,
  onPercentualCommit,
  budgetValue,
  userName,
  isEditable,
}: PontuaGarboLeadPanelProps) {
  const percentual = parsePontuaPercentualInput(percentualInput);
  const comissao = (budgetValue * percentual) / 100;

  return (
    <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-amber-700">
        <Trophy className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-semibold">Programa Pontua Garbo</span>
      </div>
      <div className="text-xs text-amber-800 space-y-1.5 pl-5">
        <p>
          Prestador: <strong>{userName}</strong>
        </p>
        <p className="text-[10px] text-amber-700/90">
          Comissão exclusiva deste lead — não altera outros cards.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-amber-800 shrink-0">Comissão deste lead:</Label>
          {isEditable ? (
            <>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={percentualInput}
                onChange={(e) => onPercentualChange(e.target.value)}
                onBlur={onPercentualCommit}
                className="h-7 w-20 text-sm bg-white"
              />
              <span>%</span>
            </>
          ) : (
            <strong>{percentual}%</strong>
          )}
        </div>
        {budgetValue > 0 ? (
          <p>
            Orçamento: <strong>{formatCurrency(budgetValue)}</strong>
            {' · '}
            Comissão: <strong className="text-amber-900">{formatCurrency(comissao)}</strong>
          </p>
        ) : (
          <p className="text-amber-700/80">Informe o valor do orçamento no card para calcular a comissão.</p>
        )}
      </div>
    </div>
  );
}

// ── Controle de visibilidade do lead para o prestador ─────────────────────────
function PrestadorVisibilidadePanel({
  leadId,
  prestadorId,
  prestadorNome,
  isEditable,
}: {
  leadId: number;
  prestadorId: string;
  prestadorNome: string;
  isEditable: boolean;
}) {
  const { getPermissao, upsertPermissao } = useLeadPrestadorPermissoes(leadId);
  const { pdfs: anexos, isLoading: anexosLoading } = useLeadPDFs(leadId);
  const { data: orcamentos = [], isLoading: orcamentosLoading } = useOrcamentosPorLead(leadId);
  const perm = getPermissao(prestadorId);

  const fotos = anexos.filter((a) => {
    const t = anexoTipo(a);
    return t === 'imagem' || t === 'video';
  });
  const pdfs = anexos.filter((a) => anexoTipo(a) === 'pdf');

  const salvar = (patch: Partial<typeof perm>) => {
    const next = { ...perm, ...patch };
    upsertPermissao.mutate({
      lead_id: leadId,
      prestador_id: prestadorId,
      pode_ver_detalhes: next.pode_ver_detalhes,
      pode_ver_lousa: next.pode_ver_lousa,
      pode_ver_anotacoes: next.pode_ver_anotacoes,
      pode_ver_fotos: next.pode_ver_fotos,
      pode_ver_pdfs: next.pode_ver_pdfs,
      anexos_visiveis: next.anexos_visiveis,
      pode_ver_orcamento: next.pode_ver_orcamento,
      orcamentos_visiveis: next.orcamentos_visiveis,
      pode_ver_anexos: syncPodeVerAnexos(next),
    });
  };

  const toggle = (field: 'pode_ver_detalhes' | 'pode_ver_lousa' | 'pode_ver_anotacoes') => {
    salvar({ [field]: !perm[field] });
  };

  const toggleFotos = (ligado: boolean) => {
    salvar({
      pode_ver_fotos: ligado,
      anexos_visiveis: anexosVisiveisAoLigarCategoria(anexos, perm, 'imagem', ligado),
    });
  };

  const togglePdfs = (ligado: boolean) => {
    salvar({
      pode_ver_pdfs: ligado,
      anexos_visiveis: anexosVisiveisAoLigarCategoria(anexos, perm, 'pdf', ligado),
    });
  };

  const toggleOrcamento = (ligado: boolean) => {
    const ids = orcamentos.map((o) => o.id);
    salvar({
      pode_ver_orcamento: ligado,
      orcamentos_visiveis: orcamentosVisiveisAoLigar(ids, perm, ligado),
    });
  };

  const rows: { key: 'pode_ver_detalhes' | 'pode_ver_lousa' | 'pode_ver_anotacoes'; label: string }[] = [
    { key: 'pode_ver_detalhes', label: 'Detalhes do lead' },
    { key: 'pode_ver_lousa', label: 'Lousa' },
    { key: 'pode_ver_anotacoes', label: 'Observações' },
  ];

  return (
    <div className="mt-1.5 rounded-lg border border-gold-border-subtle bg-mahogany-muted/40 p-2.5 space-y-3">
      <div className="flex items-center gap-1.5 text-gold">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-semibold">Visibilidade para o Prestador</span>
      </div>
      <p className="text-xs text-cream-muted pl-5">
        O que <strong className="text-cream-secondary">{prestadorNome}</strong> pode ver neste lead:
      </p>

      <div className="pl-5 space-y-1.5">
        {rows.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <Label className="text-xs text-cream-secondary cursor-pointer" htmlFor={`perm-${leadId}-${prestadorId}-${key}`}>
              {label}
            </Label>
            <Switch
              id={`perm-${leadId}-${prestadorId}-${key}`}
              checked={perm[key]}
              onCheckedChange={() => toggle(key)}
              disabled={!isEditable || upsertPermissao.isPending}
              className="data-[state=checked]:bg-gold scale-[0.8]"
            />
          </div>
        ))}
      </div>

      {/* Fotos do serviço */}
      <div className="pl-5 space-y-2 border-t border-gold-border-subtle/60 pt-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-cream-secondary flex items-center gap-1.5 cursor-pointer" htmlFor={`perm-fotos-${leadId}-${prestadorId}`}>
            <Image className="h-3.5 w-3.5 text-gold-soft" />
            Fotos do serviço
          </Label>
          <Switch
            id={`perm-fotos-${leadId}-${prestadorId}`}
            checked={perm.pode_ver_fotos}
            onCheckedChange={toggleFotos}
            disabled={!isEditable || upsertPermissao.isPending}
            className="data-[state=checked]:bg-gold scale-[0.8]"
          />
        </div>
        {perm.pode_ver_fotos && (
          <AnexoPickerList
            items={fotos}
            loading={anexosLoading}
            emptyLabel="Nenhuma foto anexada ao lead."
            perm={perm}
            anexos={anexos}
            onToggle={(id) => salvar({ anexos_visiveis: toggleAnexoId(id, anexos, perm) })}
            disabled={!isEditable || upsertPermissao.isPending}
          />
        )}
      </div>

      {/* PDFs */}
      <div className="pl-5 space-y-2 border-t border-gold-border-subtle/60 pt-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-cream-secondary flex items-center gap-1.5 cursor-pointer" htmlFor={`perm-pdfs-${leadId}-${prestadorId}`}>
            <FileText className="h-3.5 w-3.5 text-gold-soft" />
            PDFs do projeto
          </Label>
          <Switch
            id={`perm-pdfs-${leadId}-${prestadorId}`}
            checked={perm.pode_ver_pdfs}
            onCheckedChange={togglePdfs}
            disabled={!isEditable || upsertPermissao.isPending}
            className="data-[state=checked]:bg-gold scale-[0.8]"
          />
        </div>
        {perm.pode_ver_pdfs && (
          <AnexoPickerList
            items={pdfs}
            loading={anexosLoading}
            emptyLabel="Nenhum PDF anexado ao lead."
            perm={perm}
            anexos={anexos}
            onToggle={(id) => salvar({ anexos_visiveis: toggleAnexoId(id, anexos, perm) })}
            disabled={!isEditable || upsertPermissao.isPending}
          />
        )}
      </div>

      {/* Orçamentos do sistema */}
      <div className="pl-5 space-y-2 border-t border-gold-border-subtle/60 pt-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-cream-secondary flex items-center gap-1.5 cursor-pointer" htmlFor={`perm-orc-${leadId}-${prestadorId}`}>
            <Presentation className="h-3.5 w-3.5 text-gold-soft" />
            Orçamentos do sistema
          </Label>
          <Switch
            id={`perm-orc-${leadId}-${prestadorId}`}
            checked={perm.pode_ver_orcamento}
            onCheckedChange={toggleOrcamento}
            disabled={!isEditable || upsertPermissao.isPending}
            className="data-[state=checked]:bg-gold scale-[0.8]"
          />
        </div>
        {perm.pode_ver_orcamento && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {orcamentosLoading ? (
              <div className="flex items-center gap-2 text-xs text-cream-muted py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando orçamentos…
              </div>
            ) : orcamentos.length === 0 ? (
              <p className="text-[11px] text-cream-muted italic">Nenhum orçamento criado para este lead.</p>
            ) : (
              orcamentos.map((o) => (
                <label
                  key={o.id}
                  className="flex items-start gap-2 rounded-md border border-gold-border-subtle/50 bg-mahogany-base/30 px-2 py-1.5 cursor-pointer hover:bg-mahogany-soft/20"
                >
                  <Checkbox
                    checked={orcamentoEstaMarcado(o.id, perm)}
                    onCheckedChange={() =>
                      salvar({
                        orcamentos_visiveis: toggleOrcamentoId(
                          o.id,
                          orcamentos.map((x) => x.id),
                          perm,
                        ),
                      })
                    }
                    disabled={!isEditable || upsertPermissao.isPending}
                    className="mt-0.5 border-gold-border data-[state=checked]:bg-gold data-[state=checked]:text-gold-on"
                  />
                  <span className="text-[11px] text-cream-secondary leading-snug min-w-0">
                    <span className="font-medium block truncate">{o.cliente_nome || o.identificador}</span>
                    <span className="text-cream-muted font-mono">{o.identificador}</span>
                  </span>
                </label>
              ))
            )}
            {orcamentos.length > 0 && (
              <p className="text-[10px] text-cream-muted">
                Marque quais apresentações o prestador pode visualizar.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnexoPickerList({
  items,
  loading,
  emptyLabel,
  perm,
  anexos,
  onToggle,
  disabled,
}: {
  items: LeadPDF[];
  loading: boolean;
  emptyLabel: string;
  perm: ReturnType<ReturnType<typeof useLeadPrestadorPermissoes>['getPermissao']>;
  anexos: LeadPDF[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-cream-muted py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando arquivos…
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-[11px] text-cream-muted italic">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-start gap-2 rounded-md border border-gold-border-subtle/50 bg-mahogany-base/30 px-2 py-1.5 cursor-pointer hover:bg-mahogany-soft/20"
        >
          <Checkbox
            checked={anexoEstaMarcado(item.id, anexos, perm)}
            onCheckedChange={() => onToggle(item.id)}
            disabled={disabled}
            className="mt-0.5 border-gold-border data-[state=checked]:bg-gold data-[state=checked]:text-gold-on"
          />
          <span className="text-[11px] text-cream-secondary leading-snug min-w-0 truncate" title={item.file_name}>
            {item.titulo || item.file_name}
          </span>
        </label>
      ))}
      <p className="text-[10px] text-cream-muted">Desmarque para ocultar itens específicos.</p>
    </div>
  );
}

// ── Formulário de configuração do campo ──────────────────────────────────────
interface FieldFormState {
  nome: string;
  tipo: CustomFieldType;
  opcoes: string;
  pontuaGarboAtivo: boolean;
  pontuaGarboPercentual: string;
}

const DEFAULT_FORM: FieldFormState = {
  nome: '',
  tipo: 'texto',
  opcoes: '',
  pontuaGarboAtivo: false,
  pontuaGarboPercentual: '10',
};

function fieldFormFromDef(def: LeadCustomFieldDefinition): FieldFormState {
  return {
    nome: def.nome,
    tipo: def.tipo,
    opcoes: def.opcoes?.join(', ') ?? '',
    pontuaGarboAtivo: def.config_pontua_garbo?.ativo ?? false,
    pontuaGarboPercentual: String(getPontuaPercentualPadraoFromField(def)),
  };
}

function buildPontuaGarboConfig(form: FieldFormState): PontuaGarboConfig | null {
  if (form.tipo !== 'usuario_sistema' || !form.pontuaGarboAtivo) return null;
  const percentual_padrao = parsePontuaPercentualInput(form.pontuaGarboPercentual);
  return { ativo: true, percentual_padrao };
}

interface FieldFormProps {
  form: FieldFormState;
  onChange: (form: FieldFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function FieldForm({ form, onChange, onSave, onCancel, isSaving }: FieldFormProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <Input
        placeholder="Nome do campo"
        value={form.nome}
        onChange={(e) => onChange({ ...form, nome: e.target.value })}
        className="w-full"
        autoFocus
      />

      <Select
        value={form.tipo}
        onValueChange={(v) => onChange({ ...form, tipo: v as CustomFieldType, pontuaGarboAtivo: false })}
      >
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(TIPO_LABELS) as CustomFieldType[]).map((t) => (
            <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {form.tipo === 'select' && (
        <Input
          placeholder="Opções separadas por vírgula (ex: Sim, Não, Talvez)"
          value={form.opcoes}
          onChange={(e) => onChange({ ...form, opcoes: e.target.value })}
          className="w-full"
        />
      )}

      {/* Configuração Pontua Garbo — só para usuario_sistema */}
      {form.tipo === 'usuario_sistema' && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">Pontua Garbo</span>
              <span className="text-[10px] text-amber-600">— sistema de comissionamento</span>
            </div>
            <Switch
              checked={form.pontuaGarboAtivo}
              onCheckedChange={(v) => onChange({ ...form, pontuaGarboAtivo: v })}
            />
          </div>

          {form.pontuaGarboAtivo && (
            <p className="text-[11px] text-amber-700 leading-snug">
              O % abaixo é só sugestão para leads novos. A comissão de cada lead é definida no card amarelo
              daquele lead — alterar aqui não muda leads já cadastrados.
            </p>
          )}
          {form.pontuaGarboAtivo && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-amber-800 shrink-0">% sugerido (novos leads):</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.pontuaGarboPercentual}
                onChange={(e) => onChange({ ...form, pontuaGarboPercentual: e.target.value })}
                className="h-7 w-24 text-sm"
              />
              <span className="text-xs text-amber-700">%</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={!form.nome.trim() || isSaving}>
          <Check className="h-3 w-3 mr-1" /> Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function LeadCustomFieldsSection({
  leadId,
  isEditable,
  isAdmin,
  canManagePrestadorVisibilidade = false,
  budgetValue = 0,
  onPontuaGarboSaleInfoChange,
}: LeadCustomFieldsSectionProps) {
  const { fields, isLoading: isLoadingFields, createField, updateField, deleteField } = useLeadCustomFieldDefs();
  const { values, upsertValue, savePontuaGarboPercentual } = useLeadCustomFieldValues(leadId);
  const { users: systemUsers = [] } = useUsers();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [localPercentuais, setLocalPercentuais] = useState<Record<string, string>>({});

  const isSameRecord = (a: Record<string, string>, b: Record<string, string>) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  };

  const valuesFingerprint = useMemo(
    () =>
      values
        .map((v) => `${v.field_id}:${v.valor ?? ''}:${v.pontua_garbo_percentual ?? ''}`)
        .join('|'),
    [values],
  );

  useEffect(() => {
    if (!leadId) {
      setLocalValues({});
      setLocalPercentuais({});
      return;
    }
    const map: Record<string, string> = {};
    const pctMap: Record<string, string> = {};
    values.forEach((v) => {
      if (v.valor !== null) map[v.field_id] = v.valor;
      const def = fields.find((f) => f.id === v.field_id);
      pctMap[v.field_id] = String(resolvePontuaPercentual(v, def));
    });
    setLocalValues((prev) => (isSameRecord(prev, map) ? prev : map));
    setLocalPercentuais((prev) => (isSameRecord(prev, pctMap) ? prev : pctMap));
  }, [leadId, valuesFingerprint, fields]);

  const findUser = useMemo(
    () => (id: string) => systemUsers.find((u) => u.id === id),
    [systemUsers],
  );

  useEffect(() => {
    if (!onPontuaGarboSaleInfoChange) return;

    let saleInfo: LeadPontuaGarboSaleInfo | null = null;
    for (const field of fields) {
      if (!isPontuaGarboFieldActive(field)) continue;
      const prestadorId = (localValues[field.id] ?? '').trim();
      if (!prestadorId) continue;
      const prestador = findUser(prestadorId);
      if (!prestador) continue;
      const stored = values.find((v) => v.field_id === field.id);
      const pctFromLocal = localPercentuais[field.id];
      const valueRow =
        pctFromLocal !== undefined
          ? { pontua_garbo_percentual: parsePontuaPercentualInput(pctFromLocal) }
          : stored;
      const info = buildLeadPontuaGarboSaleInfo(field, prestadorId, prestador, valueRow);
      if (info) {
        saleInfo = info;
        break;
      }
    }
    onPontuaGarboSaleInfoChange(saleInfo);
  }, [
    fields,
    localValues,
    localPercentuais,
    values,
    findUser,
    onPontuaGarboSaleInfoChange,
  ]);

  // ── Add field state ──────────────────────────────────────────────────────────
  const [addingField, setAddingField] = useState(false);
  const [addForm, setAddForm] = useState<FieldFormState>(DEFAULT_FORM);

  // ── Edit field state ─────────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<LeadCustomFieldDefinition | null>(null);
  const [editForm, setEditForm] = useState<FieldFormState>(DEFAULT_FORM);

  // ── Delete confirmation state ─────────────────────────────────────────────────
  const [fieldToDelete, setFieldToDelete] = useState<LeadCustomFieldDefinition | null>(null);

  const resetAdd = () => { setAddingField(false); setAddForm(DEFAULT_FORM); };

  const handleCreate = async () => {
    if (!addForm.nome.trim()) return;
    const opcoes = addForm.tipo === 'select'
      ? addForm.opcoes.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    await createField.mutateAsync({
      nome: addForm.nome,
      tipo: addForm.tipo,
      opcoes,
      config_pontua_garbo: buildPontuaGarboConfig(addForm),
    });
    resetAdd();
  };

  const startEdit = (field: LeadCustomFieldDefinition) => {
    if (isPontuaGarboCampoDefinitivo(field)) return;
    setEditingField(field);
    setEditForm(fieldFormFromDef(field));
  };

  const cancelEdit = () => { setEditingField(null); setEditForm(DEFAULT_FORM); };

  const handleUpdate = async () => {
    if (!editingField || !editForm.nome.trim()) return;
    const opcoes = editForm.tipo === 'select'
      ? editForm.opcoes.split(',').map((o) => o.trim()).filter(Boolean)
      : null;
    await updateField.mutateAsync({
      id: editingField.id,
      nome: editForm.nome,
      tipo: editForm.tipo,
      opcoes,
      config_pontua_garbo: buildPontuaGarboConfig(editForm),
    });
    cancelEdit();
  };

  const persistFieldValue = async (
    fieldId: string,
    valor: string,
    pontuaPct?: number | null,
  ) => {
    if (!leadId) return;
    const field = fields.find((f) => f.id === fieldId);
    const payload: {
      field_id: string;
      valor: string | null;
      pontua_garbo_percentual?: number | null;
    } = { field_id: fieldId, valor: valor || null };

    if (isPontuaGarboFieldActive(field) && valor) {
      const prestador = findUser(valor);
      if (prestador?.tipo_usuario === 'prestador_servico' && prestador.comissao_ativa) {
        const pct =
          pontuaPct !== undefined
            ? pontuaPct
            : parsePontuaPercentualInput(localPercentuais[fieldId] ?? String(PONTUA_GARBO_PERCENTUAL_PADRAO));
        payload.pontua_garbo_percentual = pct;
      } else {
        payload.pontua_garbo_percentual = null;
      }
    }

    await upsertValue.mutateAsync(payload);
  };

  const handleValueChange = async (fieldId: string, valor: string) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: valor }));
    const field = fields.find((f) => f.id === fieldId);
    if (valor && isPontuaGarboFieldActive(field)) {
      const prestador = findUser(valor);
      if (prestador?.tipo_usuario === 'prestador_servico' && prestador.comissao_ativa) {
        const existing = values.find((v) => v.field_id === fieldId);
        if (existing?.pontua_garbo_percentual == null) {
          const suggested = String(getPontuaPercentualPadraoFromField(field));
          setLocalPercentuais((prev) => ({
            ...prev,
            [fieldId]: prev[fieldId] ?? suggested,
          }));
          await persistFieldValue(fieldId, valor, parsePontuaPercentualInput(suggested));
          return;
        }
      }
    }
    await persistFieldValue(fieldId, valor);
  };

  const handlePercentualCommit = async (fieldId: string) => {
    if (!leadId) return;
    const valor = localValues[fieldId] ?? '';
    if (!valor) return;
    const pct = parsePontuaPercentualInput(
      localPercentuais[fieldId] ?? String(PONTUA_GARBO_PERCENTUAL_PADRAO),
    );
    setLocalPercentuais((prev) => ({ ...prev, [fieldId]: String(pct) }));
    await savePontuaGarboPercentual.mutateAsync({
      field_id: fieldId,
      valor,
      percentual: pct,
    });
  };

  return (
    <div className="space-y-3 w-full overflow-hidden">
      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Campos Personalizados</Label>
        {isAdmin && !addingField && (
          <Button size="sm" variant="outline" onClick={() => setAddingField(true)} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Novo campo
          </Button>
        )}
      </div>

      {/* Formulário de adição (admin) */}
      {addingField && isAdmin && (
        <FieldForm
          form={addForm}
          onChange={setAddForm}
          onSave={handleCreate}
          onCancel={resetAdd}
          isSaving={createField.isPending}
        />
      )}

      {isLoadingFields && (
        <p className="text-xs text-muted-foreground">Carregando campos...</p>
      )}

      {!isLoadingFields && fields.length === 0 && !addingField && (
        <p className="text-xs text-muted-foreground">
          {isAdmin
            ? 'Nenhum campo personalizado. Clique em "Novo campo" para adicionar.'
            : 'Nenhum campo personalizado configurado.'}
        </p>
      )}

      {/* Lista de campos */}
      {fields.map((field) => {
        const isEditing = editingField?.id === field.id;
        const value = localValues[field.id] ?? '';

        if (isEditing) {
          return (
            <FieldForm
              key={field.id}
              form={editForm}
              onChange={setEditForm}
              onSave={handleUpdate}
              onCancel={cancelEdit}
              isSaving={updateField.isPending}
            />
          );
        }

        const selectedUser = field.tipo === 'usuario_sistema' && value ? findUser(value) : null;
        const valueRowForPontua = {
          pontua_garbo_percentual:
            localPercentuais[field.id] !== undefined
              ? parsePontuaPercentualInput(localPercentuais[field.id])
              : values.find((v) => v.field_id === field.id)?.pontua_garbo_percentual ?? null,
        };
        const showPontuaGarbo =
          isPontuaGarboFieldActive(field) &&
          isPontuaGarboComissaoAtivaNoLead(field, value, selectedUser ?? undefined, valueRowForPontua);
        const isCampoDefinitivo = isPontuaGarboCampoDefinitivo(field);
        const showPrestadorVisibilidade =
          Boolean(leadId) &&
          Boolean(selectedUser) &&
          canManagePrestadorVisibilidade &&
          (showPontuaGarbo || selectedUser?.tipo_usuario === 'prestador_servico');

        return (
          <div key={field.id} className="space-y-1 w-full overflow-hidden">
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {field.nome}
                <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                  ({TIPO_LABELS[field.tipo]})
                </span>
                {isPontuaGarboFieldActive(field) && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-normal">
                    <Trophy className="h-2.5 w-2.5" /> Pontua Garbo
                  </span>
                )}
                {isCampoDefinitivo && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-cream-muted font-normal">
                    <Lock className="h-2.5 w-2.5" /> Campo do sistema
                  </span>
                )}
              </Label>
              {isAdmin && !isCampoDefinitivo && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button" size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => startEdit(field)} aria-label="Editar campo"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button" size="icon" variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => setFieldToDelete(field)} aria-label="Remover campo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* ── Inputs por tipo ── */}
            {field.tipo === 'texto' && (
              <Input
                value={value}
                onChange={(e) => handleValueChange(field.id, e.target.value)}
                disabled={!isEditable}
                className="w-full max-w-full"
              />
            )}
            {field.tipo === 'numero' && (
              <Input
                type="number"
                value={value}
                onChange={(e) => handleValueChange(field.id, e.target.value)}
                disabled={!isEditable}
                className="w-full max-w-full"
              />
            )}
            {field.tipo === 'data' && (
              <Input
                type="date"
                value={value}
                onChange={(e) => handleValueChange(field.id, e.target.value)}
                disabled={!isEditable}
                className="w-full max-w-full"
              />
            )}
            {field.tipo === 'select' && (
              <Select
                value={value || '__none__'}
                onValueChange={(v) => handleValueChange(field.id, v === '__none__' ? '' : v)}
                disabled={!isEditable}
              >
                <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Selecionar --</SelectItem>
                  {(field.opcoes ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {field.tipo === 'usuario_sistema' && (
              <>
                <Select
                  value={value || '__none__'}
                  onValueChange={(v) => handleValueChange(field.id, v === '__none__' ? '' : v)}
                  disabled={!isEditable}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <SelectValue placeholder="Selecionar usuário..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Selecionar usuário --</SelectItem>
                    {systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex flex-col">
                          <span>{u.nome}</span>
                          {u.tipo_usuario === 'prestador_servico' && u.titulo && (
                            <span className="text-[10px] text-muted-foreground">{u.titulo}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Painel Pontua Garbo */}
                {showPontuaGarbo && selectedUser && (
                  <PontuaGarboLeadPanel
                    percentualInput={
                      localPercentuais[field.id] ??
                      String(resolvePontuaPercentual(
                        values.find((v) => v.field_id === field.id),
                        field,
                      ))
                    }
                    onPercentualChange={(raw) =>
                      setLocalPercentuais((prev) => ({ ...prev, [field.id]: raw }))
                    }
                    onPercentualCommit={() => void handlePercentualCommit(field.id)}
                    budgetValue={budgetValue}
                    userName={selectedUser.titulo || selectedUser.nome}
                    isEditable={isEditable && !!leadId}
                  />
                )}

                {/* Painel de visibilidade do prestador (admin e vendedor) */}
                {showPrestadorVisibilidade && selectedUser && leadId && (
                  <PrestadorVisibilidadePanel
                    leadId={leadId}
                    prestadorId={value}
                    prestadorNome={selectedUser.titulo || selectedUser.nome}
                    isEditable={canManagePrestadorVisibilidade}
                  />
                )}
              </>
            )}
          </div>
        );
      })}

      {!leadId && fields.length > 0 && (
        <p className="text-xs text-muted-foreground">Salve o lead para preencher os campos personalizados.</p>
      )}

      {/* Confirmação de exclusão global de campo */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => { if (!open) setFieldToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campo de TODOS os leads?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O campo <strong className="text-foreground">"{fieldToDelete?.nome}"</strong> será desativado
                  para <strong className="text-foreground">todos os leads</strong> da empresa — não apenas este card.
                </p>
                <p>
                  Para remover somente deste lead, selecione <strong className="text-foreground">"— Selecionar usuário —"</strong> no campo acima.
                </p>
                <p className="text-destructive font-medium">Esta ação não pode ser desfeita pela interface.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!fieldToDelete) return;
                if (isPontuaGarboCampoDefinitivo(fieldToDelete)) {
                  setFieldToDelete(null);
                  return;
                }
                void deleteField.mutateAsync(fieldToDelete.id);
                setFieldToDelete(null);
              }}
            >
              Remover de todos os leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
