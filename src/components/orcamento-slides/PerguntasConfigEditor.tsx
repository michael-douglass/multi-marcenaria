import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { OrcamentoPergunta, PerguntaTipo } from '@/lib/orcamento-slide-types';
import { useOrcamentoSlidePerguntas } from '@/hooks/useOrcamentoSlidePerguntas';

const TIPOS_PERGUNTA: { value: PerguntaTipo; label: string }[] = [
  { value: 'texto', label: 'Texto' },
  { value: 'select', label: 'Escolha única' },
  { value: 'multi', label: 'Múltipla escolha' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
  { value: 'toggle', label: 'Sim / Não' },
  { value: 'imagem', label: 'Imagens' },
];

const TIPOS_COM_OPCOES: PerguntaTipo[] = ['select', 'multi'];

function slugValor(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function labelTipo(tipo: PerguntaTipo) {
  return TIPOS_PERGUNTA.find((t) => t.value === tipo)?.label ?? tipo;
}

interface PerguntaItemEditorProps {
  pergunta: OrcamentoPergunta;
  expandida: boolean;
  onToggle: () => void;
}

function PerguntaItemEditor({ pergunta, expandida, onToggle }: PerguntaItemEditorProps) {
  const {
    atualizarPergunta,
    removerPergunta,
    criarOpcao,
    atualizarOpcao,
    removerOpcao,
  } = useOrcamentoSlidePerguntas();

  const [label, setLabel] = useState(pergunta.label);
  const [tipo, setTipo] = useState<PerguntaTipo>(pergunta.tipo);
  const [obrigatorio, setObrigatorio] = useState(pergunta.obrigatorio);
  const [novaOpcao, setNovaOpcao] = useState('');
  const [opcoesEdit, setOpcoesEdit] = useState(
    () => (pergunta.opcoes ?? []).map((o) => ({ id: o.id, label: o.label, valor: o.valor })),
  );

  useEffect(() => {
    setLabel(pergunta.label);
    setTipo(pergunta.tipo);
    setObrigatorio(pergunta.obrigatorio);
    setOpcoesEdit((pergunta.opcoes ?? []).map((o) => ({ id: o.id, label: o.label, valor: o.valor })));
  }, [pergunta]);

  const salvarPergunta = () => {
    if (!label.trim()) return;
    atualizarPergunta.mutate({
      id: pergunta.id,
      label: label.trim(),
      tipo,
      obrigatorio,
    });
  };

  const handleAddOpcao = () => {
    const texto = novaOpcao.trim();
    if (!texto) return;
    criarOpcao.mutate({
      pergunta_id: pergunta.id,
      label: texto,
      valor: slugValor(texto) || `opcao_${(pergunta.opcoes?.length ?? 0) + 1}`,
      ordem: pergunta.opcoes?.length ?? 0,
    });
    setNovaOpcao('');
  };

  const salvarOpcao = (opcaoId: string, campo: 'label' | 'valor', valor: string) => {
    if (!valor.trim()) return;
    atualizarOpcao.mutate({ id: opcaoId, [campo]: valor.trim() });
  };

  const mostraOpcoes = TIPOS_COM_OPCOES.includes(tipo);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{pergunta.label}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{labelTipo(pergunta.tipo)}</Badge>
            {pergunta.obrigatorio && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
            {mostraOpcoes && (
              <span className="text-xs text-muted-foreground">
                {(pergunta.opcoes?.length ?? 0)} opç{(pergunta.opcoes?.length ?? 0) === 1 ? 'ão' : 'ões'}
              </span>
            )}
          </div>
        </div>
        {expandida ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expandida && (
        <div className="border-t border-border/50 px-4 py-4 flex flex-col gap-4 bg-muted/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs">Texto da pergunta</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={salvarPergunta}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tipo de resposta</Label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  const novoTipo = v as PerguntaTipo;
                  setTipo(novoTipo);
                  atualizarPergunta.mutate({
                    id: pergunta.id,
                    label: label.trim() || pergunta.label,
                    tipo: novoTipo,
                    obrigatorio,
                  });
                }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PERGUNTA.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id={`obr-${pergunta.id}`}
                checked={obrigatorio}
                onCheckedChange={(c) => {
                  setObrigatorio(c);
                  atualizarPergunta.mutate({ id: pergunta.id, obrigatorio: c });
                }}
              />
              <Label htmlFor={`obr-${pergunta.id}`} className="text-xs cursor-pointer">
                Resposta obrigatória
              </Label>
            </div>
          </div>

          {mostraOpcoes && (
            <div className="flex flex-col gap-3 rounded-lg border border-border/40 p-3 bg-background/50">
              <Label className="text-xs font-semibold">Opções de resposta</Label>
              {opcoesEdit.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma opção ainda. Adicione abaixo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {opcoesEdit.map((op, idx) => (
                    <li key={op.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                      <Input
                        className="h-8 text-sm flex-1"
                        value={op.label}
                        placeholder="Texto exibido"
                        onChange={(e) => {
                          const v = e.target.value;
                          setOpcoesEdit((prev) =>
                            prev.map((o) => (o.id === op.id ? { ...o, label: v } : o)),
                          );
                        }}
                        onBlur={(e) => salvarOpcao(op.id, 'label', e.target.value)}
                      />
                      <Input
                        className="h-8 text-sm w-28 font-mono text-xs"
                        value={op.valor}
                        placeholder="valor"
                        onChange={(e) => {
                          const v = e.target.value;
                          setOpcoesEdit((prev) =>
                            prev.map((o) => (o.id === op.id ? { ...o, valor: v } : o)),
                          );
                        }}
                        onBlur={(e) => salvarOpcao(op.id, 'valor', e.target.value)}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removerOpcao.mutate(op.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  value={novaOpcao}
                  placeholder="Nova opção..."
                  onChange={(e) => setNovaOpcao(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOpcao())}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  disabled={!novaOpcao.trim() || criarOpcao.isPending}
                  onClick={handleAddOpcao}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => removerPergunta.mutate(pergunta.id)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Excluir pergunta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PerguntasConfigEditorProps {
  className?: string;
}

export function PerguntasConfigEditor({ className }: PerguntasConfigEditorProps) {
  const { perguntas, criarPergunta, isLoading } = useOrcamentoSlidePerguntas();
  const [form, setForm] = useState({ label: '', tipo: 'texto' as PerguntaTipo, obrigatorio: false });
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  const handleCriar = () => {
    if (!form.label.trim()) return;
    criarPergunta.mutate(
      {
        label: form.label.trim(),
        tipo: form.tipo,
        obrigatorio: form.obrigatorio,
        ordem: perguntas.length,
      },
      {
        onSuccess: (data) => {
          if (data?.id && TIPOS_COM_OPCOES.includes(form.tipo)) {
            setExpandidaId(data.id as string);
          }
          setForm({ label: '', tipo: 'texto', obrigatorio: false });
        },
      },
    );
  };

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-card">
        <h3 className="text-sm font-semibold">Nova pergunta</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            className="sm:col-span-2"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="Ex.: Quais ambientes?"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCriar())}
          />
          <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as PerguntaTipo }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_PERGUNTA.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="nova-pergunta-obrigatoria"
              checked={form.obrigatorio}
              onCheckedChange={(c) => setForm((p) => ({ ...p, obrigatorio: c }))}
            />
            <Label htmlFor="nova-pergunta-obrigatoria" className="text-xs cursor-pointer">
              Obrigatória
            </Label>
          </div>
          <Button
            size="sm"
            disabled={!form.label.trim() || criarPergunta.isPending}
            onClick={handleCriar}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : perguntas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma pergunta cadastrada. Crie a primeira acima.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Clique em uma pergunta para editar texto, tipo e opções.
          </p>
          {perguntas.map((p) => (
            <PerguntaItemEditor
              key={p.id}
              pergunta={p}
              expandida={expandidaId === p.id}
              onToggle={() => setExpandidaId((atual) => (atual === p.id ? null : p.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
