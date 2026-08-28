import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, CalendarIcon, Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DIAS_SEMANA, HORARIOS } from '@/types/cadastro';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CADASTRO_CONFIG_TABLE = 'CRM-multi-empresas>cadastro_config<';
const PLANOS_TABLE = 'plataforma-pro-forco-fin_planos';

const formSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  nome_aluno: z.string().optional(),
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  telefone: z.string().optional(),
  cpf_responsavel: z.string().optional(),
  ano_escolar: z.string().optional(),
  idade: z.number().min(1).max(120).optional().nullable(),
  melhores_dias: z.array(z.string()).min(1, 'Selecione ao menos um dia'),
  melhor_horario: z.array(z.string()).min(1, 'Selecione ao menos um horário'),
  plano_id: z.string().min(1, 'Selecione um plano'),
  dia_pagamento: z.number().min(1).max(31),
  data_inicio_prevista: z.date().optional(),
  disciplinas: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

/** Decodifica o payload de um JWT (apenas base64, para preencher dados do Google). */
function decodeJwtPayload(token: string): { email?: string; name?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      email: payload.email ?? payload.email_address,
      name: payload.name ?? payload.given_name,
    };
  } catch {
    return {};
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export default function CadastroDeAlunos() {
  const [planos, setPlanos] = useState<{ id: string; nome: string; valor: number }[]>([]);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [planosLoading, setPlanosLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [googleCaptureLoading, setGoogleCaptureLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: config } = await (supabase as any)
          .from(CADASTRO_CONFIG_TABLE)
          .select('planos_visiveis, disciplinas')
          .limit(1)
          .maybeSingle();
        const ids = (config?.planos_visiveis ?? []) as string[];
        setDisciplinas(Array.isArray(config?.disciplinas) ? config.disciplinas : []);
        if (ids.length === 0) {
          setPlanos([]);
          setPlanosLoading(false);
          return;
        }
        const { data: planosData, error } = await (supabase as any)
          .from(PLANOS_TABLE)
          .select('id, nome, valor')
          .in('id', ids)
          .eq('ativo', true)
          .order('nome');
        if (error) throw error;
        setPlanos(planosData ?? []);
      } catch {
        setPlanos([]);
      } finally {
        setPlanosLoading(false);
      }
    })();
  }, []);

  /** Preenche e-mail (e nome): se o usuário já estiver conectado (ex.: Google), usa a sessão; senão abre o One Tap do Google. */
  const handlePreencherEmailGoogle = async (onCapture: (email: string, name: string) => void) => {
    setGoogleCaptureLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const email = user?.email?.trim();
      if (email) {
        const name =
          (user?.user_metadata?.full_name as string) ||
          (user?.user_metadata?.name as string) ||
          (user?.user_metadata?.given_name as string) ||
          '';
        onCapture(email, name ?? '');
        toast.success('E-mail da sua conta preenchido.');
        return;
      }
    } catch {
      // segue para One Tap
    } finally {
      setGoogleCaptureLoading(false);
    }

    if (!GOOGLE_CLIENT_ID) {
      toast.error('Configuração do Google não disponível. Preencha o e-mail manualmente.');
      return;
    }
    const w = typeof window !== 'undefined' ? window : null;
    const g = w ? (w as unknown as { google?: { accounts: { id: { initialize: (c: object) => void; prompt: (c?: (n: object) => void) => void } } } }).google : undefined;
    if (!g?.accounts?.id) {
      toast.error('Carregue a página novamente e tente de novo.');
      return;
    }
    setGoogleCaptureLoading(true);
    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        setGoogleCaptureLoading(false);
        const { email, name } = decodeJwtPayload(response.credential);
        if (email) {
          onCapture(email, name ?? '');
          toast.success('E-mail do Google preenchido.');
        } else {
          toast.error('Não foi possível obter o e-mail.');
        }
      },
      auto_select: false,
    });
    g.accounts.id.prompt((notification: { isNotDisplayed?: () => boolean; getNotDisplayedReason?: () => string }) => {
      setGoogleCaptureLoading(false);
      if (notification?.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.() ?? '';
        if (reason.includes('popup_closed') || reason.includes('cancel')) return;
        toast.error('Não foi possível abrir a seleção de conta. Tente novamente.');
      }
    });
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      nome_aluno: '',
      email: '',
      telefone: '',
      cpf_responsavel: '',
      ano_escolar: '',
      idade: undefined,
      melhores_dias: [],
      melhor_horario: [],
      plano_id: '',
      dia_pagamento: 10,
      data_inicio_prevista: undefined,
      disciplinas: [],
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cadastro-alunos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          nome: values.nome,
          nome_aluno: values.nome_aluno?.trim() || null,
          email: values.email,
          telefone: values.telefone || null,
          cpf_responsavel: values.cpf_responsavel?.replace(/\D/g, '').trim() || null,
          ano_escolar: values.ano_escolar?.trim() || null,
          idade:
            values.idade != null && !Number.isNaN(Number(values.idade))
              ? Number(values.idade)
              : null,
          melhores_dias: values.melhores_dias,
          melhor_horario: values.melhor_horario,
          plano_id: values.plano_id || null,
          dia_pagamento: values.dia_pagamento,
          data_inicio_prevista: values.data_inicio_prevista
            ? values.data_inicio_prevista.toISOString().slice(0, 10)
            : null,
          disciplinas: values.disciplinas ?? [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao enviar cadastro');
      }
      toast.success(data.message ?? 'Cadastro enviado com sucesso!');
      form.reset();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Formulário de cadastro</CardTitle>
          <CardDescription>Preencha suas preferências para as aulas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-2">
              <Label>Nome completo (responsável)</Label>
              <Input {...form.register('nome')} placeholder="Seu nome" />
              {form.formState.errors.nome && (
                <p className="text-sm text-destructive">{form.formState.errors.nome.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Nome completo do aluno</Label>
              <Input {...form.register('nome_aluno')} placeholder="Nome do aluno" />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>E-mail</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    handlePreencherEmailGoogle((email, name) => {
                      form.setValue('email', email);
                      if (name) form.setValue('nome', name);
                    })
                  }
                  disabled={googleCaptureLoading}
                >
                  {googleCaptureLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  Preencher com e-mail do Google
                </Button>
              </div>
              <Input
                {...form.register('email')}
                type="email"
                placeholder="seu@email.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input {...form.register('telefone')} type="tel" placeholder="(00) 00000-0000" />
            </div>
            <div className="grid gap-2">
              <Label>CPF do responsável</Label>
              <Input
                {...form.register('cpf_responsavel')}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div className="grid gap-2">
              <Label>Ano escolar</Label>
              <Input {...form.register('ano_escolar')} placeholder="Ex: 1º ano, 2º ano" />
            </div>
            <div className="grid gap-2">
              <Label>Idade (somente números)</Label>
              <Input
                {...form.register('idade', { valueAsNumber: true })}
                type="number"
                min={1}
                max={120}
                placeholder="Idade do aluno"
              />
            </div>

            <div className="grid gap-2">
              <Label>Melhores dias para aula</Label>
              <div className="flex flex-wrap gap-3">
                {DIAS_SEMANA.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.watch('melhores_dias').includes(d.value)}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('melhores_dias');
                        form.setValue(
                          'melhores_dias',
                          checked ? [...current, d.value] : current.filter((x) => x !== d.value)
                        );
                      }}
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
              {form.formState.errors.melhores_dias && (
                <p className="text-sm text-destructive">{form.formState.errors.melhores_dias.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Melhor horário para aula</Label>
              <div className="flex flex-wrap gap-3">
                {HORARIOS.map((h) => (
                  <label key={h.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.watch('melhor_horario').includes(h.value)}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('melhor_horario');
                        form.setValue(
                          'melhor_horario',
                          checked ? [...current, h.value] : current.filter((x) => x !== h.value)
                        );
                      }}
                    />
                    <span className="text-sm">{h.label}</span>
                  </label>
                ))}
              </div>
              {form.formState.errors.melhor_horario && (
                <p className="text-sm text-destructive">{form.formState.errors.melhor_horario.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Plano desejado</Label>
              {planosLoading ? (
                <p className="text-sm text-muted-foreground">Carregando planos...</p>
              ) : planos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum plano disponível. Entre em contato com a escola.</p>
              ) : (
                <Select
                  value={form.watch('plano_id')}
                  onValueChange={(v) => form.setValue('plano_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} – {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.plano_id && (
                <p className="text-sm text-destructive">{form.formState.errors.plano_id.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Melhor dia para pagamento (do mês)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('dia_pagamento') ? `Dia ${form.watch('dia_pagamento')}` : 'Escolher dia'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('dia_pagamento') ? new Date(2000, 0, form.watch('dia_pagamento')) : undefined}
                    onSelect={(date) => form.setValue('dia_pagamento', date ? date.getDate() : 1)}
                    locale={ptBR}
                    fixedWeeks
                    disabled={(date) => date.getDate() > 28}
                  />
                  <div className="p-2 border-t flex flex-wrap gap-1">
                    {[5, 10, 15, 20, 25].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={form.watch('dia_pagamento') === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => form.setValue('dia_pagamento', d)}
                      >
                        Dia {d}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Que dia pretende começar?</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('data_inicio_prevista')
                      ? format(form.watch('data_inicio_prevista')!, 'PPP', { locale: ptBR })
                      : 'Escolher data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('data_inicio_prevista') ?? undefined}
                    onSelect={(date) => form.setValue('data_inicio_prevista', date ?? undefined)}
                    locale={ptBR}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                <Sparkles className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                <p className="text-sm font-medium text-foreground leading-snug">
                  Já comece hoje para garantir a vaga com os melhores professores!
                </p>
              </div>
            </div>

            {disciplinas.length > 0 && (
              <div className="grid gap-2">
                <Label>Quais disciplinas?</Label>
                <div className="flex flex-wrap gap-3">
                  {disciplinas.map((d) => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.watch('disciplinas')?.includes(d) ?? false}
                        onCheckedChange={(checked) => {
                          const current = form.getValues('disciplinas') ?? [];
                          form.setValue(
                            'disciplinas',
                            checked ? [...current, d] : current.filter((x) => x !== d)
                          );
                        }}
                      />
                      <span className="text-sm">{d}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitLoading || planos.length === 0}>
              {submitLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar cadastro'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}