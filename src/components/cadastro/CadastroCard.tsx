import { useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, Mail, Calendar, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CadastroAluno } from '@/types/cadastro';
import { DIAS_SEMANA, HORARIOS } from '@/types/cadastro';
import {
  useUpdateCadastroAluno,
  useDeleteCadastroAluno,
  type UpdateCadastroAlunoPayload,
} from '@/hooks/useCadastroAlunos';
import { usePlanosFin, useCadastroConfig } from '@/hooks/useCadastroAlunos';
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

interface CadastroCardProps {
  cadastro: CadastroAluno;
}

const diaLabel = (d: string) => DIAS_SEMANA.find((x) => x.value === d)?.label ?? d;
const horarioLabel = (h: string) => HORARIOS.find((x) => x.value === h)?.label ?? h;

/** Valor sentinela para Select de plano "Nenhum" (Radix não permite value vazio). */
const PLANO_NENHUM_VALUE = '__nenhum__';
export function CadastroCard({ cadastro }: CadastroCardProps) {
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<UpdateCadastroAlunoPayload>({
    nome: cadastro.nome,
    email: cadastro.email,
    telefone: cadastro.telefone ?? '',
    nome_aluno: cadastro.nome_aluno ?? null,
    ano_escolar: cadastro.ano_escolar ?? null,
    idade: cadastro.idade ?? null,
    cpf_responsavel: cadastro.cpf_responsavel ?? null,
    melhores_dias: cadastro.melhores_dias ?? [],
    melhor_horario: cadastro.melhor_horario ?? [],
    plano_id: cadastro.plano_id ?? null,
    dia_pagamento: cadastro.dia_pagamento ?? null,
    data_inicio_prevista: cadastro.data_inicio_prevista ?? null,
    disciplinas: cadastro.disciplinas ?? [],
  });

  const updateCadastro = useUpdateCadastroAluno();
  const deleteCadastro = useDeleteCadastroAluno();
  const { data: planos = [] } = usePlanosFin();
  const { data: config } = useCadastroConfig();
  const disciplinasConfig = config?.disciplinas ?? [];

  const openPopup = useCallback((editMode: boolean) => {
    setForm({
      nome: cadastro.nome,
      email: cadastro.email,
      telefone: cadastro.telefone ?? '',
      nome_aluno: cadastro.nome_aluno ?? null,
      ano_escolar: cadastro.ano_escolar ?? null,
      idade: cadastro.idade ?? null,
      cpf_responsavel: cadastro.cpf_responsavel ?? null,
      melhores_dias: cadastro.melhores_dias ?? [],
      melhor_horario: cadastro.melhor_horario ?? [],
      plano_id: cadastro.plano_id ?? null,
      dia_pagamento: cadastro.dia_pagamento ?? null,
      data_inicio_prevista: cadastro.data_inicio_prevista ?? null,
      disciplinas: cadastro.disciplinas ?? [],
    });
    setMode(editMode ? 'edit' : 'view');
    setOpen(true);
  }, [cadastro]);

  const handleSaveEdit = () => {
    const payload: UpdateCadastroAlunoPayload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone?.trim() || null,
      nome_aluno: form.nome_aluno?.trim() || null,
      ano_escolar: form.ano_escolar?.trim() || null,
      idade: form.idade != null && form.idade >= 1 && form.idade <= 120 ? form.idade : null,
      cpf_responsavel: form.cpf_responsavel?.replace(/\D/g, '').trim() || null,
      melhores_dias: form.melhores_dias,
      melhor_horario: form.melhor_horario,
      plano_id: form.plano_id || null,
      dia_pagamento: form.dia_pagamento != null && form.dia_pagamento >= 1 && form.dia_pagamento <= 31 ? form.dia_pagamento : null,
      data_inicio_prevista: form.data_inicio_prevista ?? null,
      disciplinas: form.disciplinas ?? [],
    };
    if (!payload.nome || !payload.email) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }
    if (payload.melhores_dias.length === 0) {
      toast.error('Selecione ao menos um dia para as aulas');
      return;
    }
    if (payload.melhor_horario.length === 0) {
      toast.error('Selecione ao menos um horário para as aulas');
      return;
    }
    updateCadastro.mutate(
      { id: cadastro.id, payload },
      {
        onSuccess: () => {
          setMode('view');
          setOpen(false);
        },
      }
    );
  };

  return (
    <>
      <Card
        className="bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => openPopup(false)}
      >
        <CardContent className="p-4 space-y-3 relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              openPopup(true);
            }}
            aria-label="Editar lead"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {cadastro.criado_em && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{format(parseISO(cadastro.criado_em), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
          )}
          <p className="font-semibold text-sm truncate pr-8">{cadastro.nome}</p>
          {cadastro.nome_aluno && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Aluno:</span> {cadastro.nome_aluno}
            </div>
          )}
          {cadastro.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <a
                href={`mailto:${cadastro.email}`}
                className="truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {cadastro.email}
              </a>
            </div>
          )}
          {cadastro.telefone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{cadastro.telefone}</span>
            </div>
          )}
          {cadastro.cpf_responsavel && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">CPF resp.:</span>{' '}
              {cadastro.cpf_responsavel.length === 11
              ? cadastro.cpf_responsavel.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
              : cadastro.cpf_responsavel}
            </div>
          )}
          {cadastro.ano_escolar && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Ano escolar:</span> {cadastro.ano_escolar}
            </div>
          )}
          {cadastro.idade != null && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Idade:</span> {cadastro.idade}
            </div>
          )}
          {cadastro.melhores_dias?.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Dias:</span> {cadastro.melhores_dias.map(diaLabel).join(', ')}
            </div>
          )}
          {cadastro.melhor_horario?.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Horário:</span> {cadastro.melhor_horario.map(horarioLabel).join(', ')}
            </div>
          )}
          {cadastro.dia_pagamento != null && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Dia pag.:</span> {cadastro.dia_pagamento}
            </div>
          )}
          {cadastro.plano_id && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Plano:</span>{' '}
              {planos.find((p) => p.id === cadastro.plano_id)?.nome ?? cadastro.plano_id}
            </div>
          )}
          {cadastro.data_inicio_prevista && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Início previsto:</span>{' '}
              {format(parseISO(cadastro.data_inicio_prevista), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          )}
          {cadastro.disciplinas?.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Disciplinas:</span> {cadastro.disciplinas.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{mode === 'view' ? cadastro.nome : 'Editar lead'}</DialogTitle>
            <DialogDescription className="sr-only">
              {mode === 'view' ? 'Detalhes do lead' : 'Formulário de edição do lead'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[55vh] min-h-[200px] w-full -mx-1 px-1 rounded-md border">
            {mode === 'view' ? (
              <div className="space-y-4 py-2 pr-3">
                {cadastro.criado_em && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>Cadastro em {format(parseISO(cadastro.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Nome (responsável)</span>
                  <p className="font-medium">{cadastro.nome || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Nome do aluno</span>
                  <p className="text-foreground">{cadastro.nome_aluno || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">E-mail</span>
                  <p>
                    {cadastro.email ? (
                      <a href={`mailto:${cadastro.email}`} className="text-primary hover:underline">
                        {cadastro.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Telefone</span>
                  <p>{cadastro.telefone || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">CPF do responsável</span>
                  <p>
                    {cadastro.cpf_responsavel
                      ? cadastro.cpf_responsavel.length === 11
                        ? cadastro.cpf_responsavel.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                        : cadastro.cpf_responsavel
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Ano escolar</span>
                  <p>{cadastro.ano_escolar || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Idade</span>
                  <p>{cadastro.idade != null ? cadastro.idade : '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Dias</span>
                  <p>
                    {cadastro.melhores_dias?.length
                      ? cadastro.melhores_dias.map(diaLabel).join(', ')
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Horário</span>
                  <p>
                    {cadastro.melhor_horario?.length
                      ? cadastro.melhor_horario.map(horarioLabel).join(', ')
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Dia pag.</span>
                  <p>{cadastro.dia_pagamento != null ? cadastro.dia_pagamento : '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Plano</span>
                  <p>
                    {cadastro.plano_id && planos.length > 0
                      ? planos.find((p) => p.id === cadastro.plano_id)?.nome ?? cadastro.plano_id
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Início previsto</span>
                  <p>
                    {cadastro.data_inicio_prevista
                      ? format(parseISO(cadastro.data_inicio_prevista), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Disciplinas</span>
                  <p>{cadastro.disciplinas?.length ? cadastro.disciplinas.join(', ') : '—'}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2 pr-3">
                <div className="grid gap-2">
                  <Label>Nome (responsável)</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nome do aluno</Label>
                  <Input
                    value={form.nome_aluno ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, nome_aluno: e.target.value || null }))}
                    placeholder="Nome completo do aluno"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value || null }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>CPF do responsável</Label>
                  <Input
                    value={form.cpf_responsavel ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, cpf_responsavel: e.target.value || null }))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Ano escolar</Label>
                  <Input
                    value={form.ano_escolar ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, ano_escolar: e.target.value || null }))}
                    placeholder="Ex: 1º ano"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Idade</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={form.idade ?? ''}
                    onChange={(e) => {
                      const v = e.target.value ? parseInt(e.target.value, 10) : null;
                      setForm((f) => ({ ...f, idade: v != null && !Number.isNaN(v) ? v : null }));
                    }}
                    placeholder="Idade"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Melhores dias</Label>
                  <div className="flex flex-wrap gap-3">
                    {DIAS_SEMANA.map((d) => (
                      <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={form.melhores_dias.includes(d.value)}
                          onCheckedChange={(checked) => {
                            setForm((f) => ({
                              ...f,
                              melhores_dias: checked
                                ? [...f.melhores_dias, d.value]
                                : f.melhores_dias.filter((x) => x !== d.value),
                            }));
                          }}
                        />
                        <span className="text-sm">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Melhor horário</Label>
                  <div className="flex flex-wrap gap-3">
                    {HORARIOS.map((h) => (
                      <label key={h.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={form.melhor_horario.includes(h.value)}
                          onCheckedChange={(checked) => {
                            setForm((f) => ({
                              ...f,
                              melhor_horario: checked
                                ? [...f.melhor_horario, h.value]
                                : f.melhor_horario.filter((x) => x !== h.value),
                            }));
                          }}
                        />
                        <span className="text-sm">{h.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Plano</Label>
                  <Select
                    value={form.plano_id ?? PLANO_NENHUM_VALUE}
                    onValueChange={(v) => setForm((f) => ({ ...f, plano_id: v === PLANO_NENHUM_VALUE ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PLANO_NENHUM_VALUE}>Nenhum</SelectItem>
                      {planos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} – {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Dia pag. (1–31)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dia_pagamento ?? ''}
                    onChange={(e) => {
                      const v = e.target.value ? parseInt(e.target.value, 10) : null;
                      setForm((f) => ({ ...f, dia_pagamento: v != null && v >= 1 && v <= 31 ? v : null }));
                    }}
                    placeholder="Ex: 10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Início previsto</Label>
                  <Input
                    type="date"
                    value={form.data_inicio_prevista ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, data_inicio_prevista: e.target.value || null }))}
                  />
                </div>
                {disciplinasConfig.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Disciplinas</Label>
                    <div className="flex flex-wrap gap-3">
                      {disciplinasConfig.map((d) => (
                        <label key={d} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={form.disciplinas?.includes(d) ?? false}
                            onCheckedChange={(checked) => {
                              setForm((f) => ({
                                ...f,
                                disciplinas: checked
                                  ? [...(f.disciplinas ?? []), d]
                                  : (f.disciplinas ?? []).filter((x) => x !== d),
                              }));
                            }}
                          />
                          <span className="text-sm">{d}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0 flex-wrap">
            {mode === 'view' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </Button>
                <Button type="button" onClick={() => setMode('edit')} className="gap-2">
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setMode('view')}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSaveEdit} disabled={updateCadastro.isPending}>
                  {updateCadastro.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cadastro de <strong>{cadastro.nome}</strong> será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteCadastro.mutate(cadastro.id, {
                  onSuccess: () => {
                    setDeleteConfirmOpen(false);
                    setOpen(false);
                  },
                });
              }}
              disabled={deleteCadastro.isPending}
            >
              {deleteCadastro.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}