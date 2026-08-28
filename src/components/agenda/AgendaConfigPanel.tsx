import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Clock, Calendar, Link, Copy, Check, Smartphone, MapPin, Ban, Plus, X, Webhook, Bell, MessageSquare, Send, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AgendaConfig, AgendaReuniao, BloqueioRecorrente } from '@/hooks/useAgenda';
import { useWebhooks } from '@/hooks/useWebhooks';
import { useTemplatesDisparo } from '@/hooks/useTemplatesDisparo';
import { toast } from 'sonner';
import { FormConfiguration } from './FormConfiguration';
import { AgendaLayoutPanel } from './AgendaLayoutPanel';
import { WebhookTestDispatch } from './WebhookTestDispatch';

interface AgendaConfigPanelProps {
  config: AgendaConfig | null;
  reunioes?: AgendaReuniao[];
  onUpdateConfig: (updates: Partial<AgendaConfig>) => void;
  publicUrl: string;
}

const diasSemana = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export function AgendaConfigPanel({ config, reunioes = [], onUpdateConfig, publicUrl }: AgendaConfigPanelProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<AgendaConfig & { template_lembrete_id?: number | null; template_confirmacao_id?: number | null }>>({});
  const [newBloqueio, setNewBloqueio] = useState<Partial<BloqueioRecorrente>>({});
  const { webhooks, isLoading: loadingWebhooks } = useWebhooks();
  const { data: templates, isLoading: loadingTemplates } = useTemplatesDisparo();

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDia = (dia: number) => {
    if (!config) return;
    const dias = localConfig.dias_disponiveis || config.dias_disponiveis;
    const newDias = dias.includes(dia)
      ? dias.filter((d) => d !== dia)
      : [...dias, dia].sort();
    setLocalConfig({ ...localConfig, dias_disponiveis: newDias });
  };

  const handleSave = () => {
    if (Object.keys(localConfig).length > 0) {
      onUpdateConfig(localConfig);
      setLocalConfig({});
    }
  };

  const getValue = <K extends keyof AgendaConfig>(key: K): AgendaConfig[K] | undefined => {
    return (localConfig[key] ?? config?.[key]) as AgendaConfig[K] | undefined;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações da Agenda
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Link Público */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link className="h-4 w-4" />
                Link Público para Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="md:text-sm" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Compartilhe este link para que as pessoas possam agendar reuniões
              </p>
            </CardContent>
          </Card>

          {config && (
            <AgendaLayoutPanel
              config={config}
              onUpdateConfig={onUpdateConfig}
              publicUrl={publicUrl}
            />
          )}

          {/* Configuração do Formulário — logo após o link público */}
          <FormConfiguration
            config={config}
            onUpdateConfig={onUpdateConfig}
            publicUrl={publicUrl}
            onDeleteLink={() => toast.info('Link desativado. Reative nas configurações.')}
          />

          {/* Duração e Intervalo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo das Reuniões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração padrão</Label>
                  <Select
                    value={getValue('duracao_minutos')?.toString() || '60'}
                    onValueChange={(v) => setLocalConfig({ ...localConfig, duracao_minutos: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1h 30min</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Intervalo entre slots</Label>
                  <Select
                    value={getValue('intervalo_minutos')?.toString() || '15'}
                    onValueChange={(v) => setLocalConfig({ ...localConfig, intervalo_minutos: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Antecedência mínima</Label>
                  <Select
                    value={getValue('antecedencia_minima_horas')?.toString() || '24'}
                    onValueChange={(v) => setLocalConfig({ ...localConfig, antecedencia_minima_horas: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="2">2 horas</SelectItem>
                      <SelectItem value="4">4 horas</SelectItem>
                      <SelectItem value="12">12 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                      <SelectItem value="48">48 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Antecedência máxima</Label>
                  <Select
                    value={getValue('antecedencia_maxima_dias')?.toString() || '30'}
                    onValueChange={(v) => setLocalConfig({ ...localConfig, antecedencia_maxima_dias: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="14">14 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horário de Funcionamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={getValue('horario_inicio') || '08:00'}
                    onChange={(e) => setLocalConfig({ ...localConfig, horario_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={getValue('horario_fim') || '18:00'}
                    onChange={(e) => setLocalConfig({ ...localConfig, horario_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dias disponíveis</Label>
                <div className="flex flex-wrap gap-2">
                  {diasSemana.map((dia) => {
                    const diasDisponiveis = getValue('dias_disponiveis') || [];
                    const isActive = diasDisponiveis.includes(dia.value);
                    return (
                      <Button
                        key={dia.value}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleDia(dia.value)}
                      >
                        {dia.label.slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bloqueios Recorrentes de Horário */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Bloqueios Recorrentes de Horário
              </CardTitle>
              <CardDescription className="text-xs">
                Horários automaticamente indisponíveis toda semana
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lista de bloqueios existentes */}
              {(getValue('bloqueios_recorrentes') || []).length > 0 && (
                <div className="space-y-2">
                  {(getValue('bloqueios_recorrentes') as BloqueioRecorrente[] || []).map((bloqueio, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {diasSemana.find(d => d.value === bloqueio.dia_semana)?.label}
                        </Badge>
                        <span className="text-sm">
                          {bloqueio.hora_inicio} - {bloqueio.hora_fim}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          const bloqueios = [...(getValue('bloqueios_recorrentes') as BloqueioRecorrente[] || [])];
                          bloqueios.splice(index, 1);
                          setLocalConfig({ ...localConfig, bloqueios_recorrentes: bloqueios });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar novo bloqueio */}
              <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                <Label className="text-xs text-muted-foreground">Adicionar novo bloqueio</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={newBloqueio.dia_semana?.toString() || ''}
                    onValueChange={(v) => setNewBloqueio({ ...newBloqueio, dia_semana: parseInt(v) })}
                  >
                    <SelectTrigger className="h-9 md:text-sm">
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {diasSemana.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value.toString()}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="time"
                    className="h-9 md:text-sm"
                    value={newBloqueio.hora_inicio || ''}
                    onChange={(e) => setNewBloqueio({ ...newBloqueio, hora_inicio: e.target.value })}
                    placeholder="Início"
                  />

                  <Input
                    type="time"
                    className="h-9 md:text-sm"
                    value={newBloqueio.hora_fim || ''}
                    onChange={(e) => setNewBloqueio({ ...newBloqueio, hora_fim: e.target.value })}
                    placeholder="Fim"
                  />
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={!newBloqueio.dia_semana?.toString() || !newBloqueio.hora_inicio || !newBloqueio.hora_fim}
                  onClick={() => {
                    if (newBloqueio.dia_semana !== undefined && newBloqueio.hora_inicio && newBloqueio.hora_fim) {
                      const bloqueios = [...(getValue('bloqueios_recorrentes') as BloqueioRecorrente[] || [])];
                      bloqueios.push({
                        dia_semana: newBloqueio.dia_semana,
                        hora_inicio: newBloqueio.hora_inicio,
                        hora_fim: newBloqueio.hora_fim,
                      });
                      setLocalConfig({ ...localConfig, bloqueios_recorrentes: bloqueios });
                      setNewBloqueio({});
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Bloqueio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Link de Videoconferência */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Link padrão de Videoconferência</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={getValue('link_video_conferencia') || ''}
                onChange={(e) => setLocalConfig({ ...localConfig, link_video_conferencia: e.target.value })}
                placeholder="https://meet.google.com/..."
              />
            </CardContent>
          </Card>

          {/* Captura de Informações do Lead */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Captura de Informações do Lead
              </CardTitle>
              <CardDescription className="text-xs">
                Dados capturados automaticamente ao marcar uma reunião
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Dispositivo</Label>
                  <p className="text-xs text-muted-foreground">Navegador, sistema operacional</p>
                </div>
                <Switch
                  checked={getValue('capturar_dispositivo') ?? true}
                  onCheckedChange={(checked) => 
                    setLocalConfig({ ...localConfig, capturar_dispositivo: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Hora da Marcação</Label>
                  <p className="text-xs text-muted-foreground">Momento exato do agendamento</p>
                </div>
                <Switch
                  checked={getValue('capturar_hora_marcacao') ?? true}
                  onCheckedChange={(checked) => 
                    setLocalConfig({ ...localConfig, capturar_hora_marcacao: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Localização
                  </Label>
                  <p className="text-xs text-muted-foreground">Solicita permissão de GPS</p>
                </div>
                <Switch
                  checked={getValue('capturar_localizacao') ?? true}
                  onCheckedChange={(checked) => 
                    setLocalConfig({ ...localConfig, capturar_localizacao: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Disparo de Webhook para Lembretes */}
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Webhook className="h-4 w-4 text-amber-600" />
                Disparo de Webhook (Lembretes)
              </CardTitle>
              <CardDescription className="text-xs">
                Configure o disparo automático de lembretes antes das reuniões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook para Lembrete</Label>
                <Select
                  value={getValue('webhook_lembrete_id') || 'none'}
                  onValueChange={(v) => setLocalConfig({ ...localConfig, webhook_lembrete_id: v === 'none' ? null : v })}
                  disabled={loadingWebhooks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um webhook" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (desativado)</SelectItem>
                    {webhooks.filter(w => w.ativo).map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex items-center gap-2">
                          <Bell className="h-3 w-3" />
                          {webhook.nome}
                          {webhook.tipo && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {webhook.tipo}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Configure os webhooks em{' '}
                  <a href="/webhooks" className="text-primary underline">Configuração de Webhooks</a>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Antecedência do Lembrete</Label>
                <Select
                  value={getValue('minutos_antecedencia_lembrete')?.toString() || '60'}
                  onValueChange={(v) => setLocalConfig({ ...localConfig, minutos_antecedencia_lembrete: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos antes</SelectItem>
                    <SelectItem value="30">30 minutos antes</SelectItem>
                    <SelectItem value="60">1 hora antes</SelectItem>
                    <SelectItem value="120">2 horas antes</SelectItem>
                    <SelectItem value="180">3 horas antes</SelectItem>
                    <SelectItem value="360">6 horas antes</SelectItem>
                    <SelectItem value="720">12 horas antes</SelectItem>
                    <SelectItem value="1440">1 dia antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {getValue('webhook_lembrete_id') && getValue('webhook_lembrete_id') !== 'none' && (
                <>
                  <div className="flex items-center gap-2">
                    <WebhookTestDispatch 
                      reunioes={reunioes} 
                      webhookConfigured={!!getValue('webhook_lembrete_id') && getValue('webhook_lembrete_id') !== 'none'} 
                    />
                    <span className="text-xs text-muted-foreground">
                      Dispare manualmente para testar
                    </span>
                  </div>

                  <div className="p-3 bg-background rounded-lg border text-xs space-y-1">
                    <p className="font-medium">Payload enviado:</p>
                    <code className="block whitespace-pre-wrap text-muted-foreground">
{`{
  "telefone": "5531999999999",
  "nome": "Nome do Convidado",
  "titulo": "Título da Reunião",
  "data": "19/01/2026",
  "horario": "14:30",
  "reuniao_id": "uuid"
}`}
                    </code>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Webhook: Relatório de reuniões (aula experimental) */}
          <Card className="border-sky-200 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Webhook className="h-4 w-4 text-sky-600" />
                Webhook: Relatório de reuniões
              </CardTitle>
              <CardDescription className="text-xs">
                URL usada ao clicar em &quot;Relatório de aula experimental&quot; nos cards da agenda. Recebe dados da reunião, convidado, formulário e metadados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook para Relatório de reuniões</Label>
                <Select
                  value={getValue('webhook_relatorio_reunioes_id') || 'none'}
                  onValueChange={(v) => {
                    const newValue = v === 'none' ? null : v;
                    setLocalConfig({ ...localConfig, webhook_relatorio_reunioes_id: newValue });
                    onUpdateConfig({ webhook_relatorio_reunioes_id: newValue } as Partial<AgendaConfig>);
                  }}
                  disabled={loadingWebhooks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um webhook" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (desativado)</SelectItem>
                    {webhooks.filter(w => w.ativo).map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          {webhook.nome}
                          {webhook.tipo && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {webhook.tipo}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Configure os webhooks em{' '}
                  <a href="/webhooks" className="text-primary underline">Configuração de Webhooks</a>
                </p>
              </div>

              {getValue('webhook_relatorio_reunioes_id') && getValue('webhook_relatorio_reunioes_id') !== 'none' && (
                <div className="p-3 bg-background rounded-lg border text-xs space-y-1">
                  <p className="font-medium">Payload enviado (exemplo):</p>
                  <code className="block whitespace-pre-wrap text-muted-foreground">
{`{
  "tipo_disparo": "relatorio_aula_experimental",
  "reuniao_id": "uuid",
  "titulo": "...",
  "data_reuniao": "2026-03-09",
  "data_reuniao_formatada": "segunda-feira, 9 de março de 2026",
  "horario_inicio": "10:30",
  "duracao_minutos": 30,
  "convidado_nome": "...",
  "convidado_whatsapp": "...",
  "telefone": "...",
  "resposta_formulario": "...",
  "resposta_formulario_parsed": { ... },
  "metadata_capturada": { ... },
  "observacoes": "..."
}`}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disparo de Webhook para Conclusão */}
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Webhook className="h-4 w-4 text-emerald-600" />
                Disparo de Webhook (Conclusão)
              </CardTitle>
              <CardDescription className="text-xs">
                Configure o disparo automático quando uma reunião for marcada como concluída
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook para Conclusão</Label>
                <Select
                  value={getValue('webhook_concluido_id') || 'none'}
                  onValueChange={(v) => {
                    const newValue = v === 'none' ? null : v;
                    setLocalConfig({ ...localConfig, webhook_concluido_id: newValue });
                    // Auto-save webhook selection
                    onUpdateConfig({ webhook_concluido_id: newValue } as any);
                  }}
                  disabled={loadingWebhooks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um webhook" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (desativado)</SelectItem>
                    {webhooks.filter(w => w.ativo).map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          {webhook.nome}
                          {webhook.tipo && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {webhook.tipo}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O webhook será disparado automaticamente ao marcar uma reunião como concluída.
                </p>
              </div>

              {getValue('webhook_concluido_id') && getValue('webhook_concluido_id') !== 'none' && (
                <div className="p-3 bg-background rounded-lg border text-xs space-y-1">
                  <p className="font-medium">Payload enviado:</p>
                  <code className="block whitespace-pre-wrap text-muted-foreground">
{`{
  "tipo_disparo": "conclusao",
  "reuniao_id": "uuid",
  "titulo": "Título da Reunião",
  "convidado_nome": "Nome",
  "convidado_whatsapp": "5531999999999",
  "concluido_em": "2026-01-22T10:30:00Z"
}`}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-600" />
                Templates de Mensagem (WhatsApp)
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione templates para envio direto via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template de Lembrete */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Template de Lembrete (Antecedência)
                </Label>
                <Select
                  value={(localConfig as any).template_lembrete_id?.toString() || (config as any)?.template_lembrete_id?.toString() || 'none'}
                  onValueChange={(v) => {
                    const newValue = v === 'none' ? null : parseInt(v);
                    setLocalConfig({ ...localConfig, template_lembrete_id: newValue });
                    // Auto-save template selection
                    onUpdateConfig({ template_lembrete_id: newValue } as any);
                  }}
                  disabled={loadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (desativado)</SelectItem>
                    {templates?.filter(t => t.mensagem?.includes('{{'))?.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Bell className="h-3 w-3 text-amber-500" />
                          {template.titulo}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Mensagem enviada antes da reunião (de acordo com a antecedência configurada)
                </p>
              </div>

              {/* Template de Confirmação */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Send className="h-3 w-3" />
                  Template de Confirmação (Ao Marcar)
                </Label>
                <Select
                  value={(localConfig as any).template_confirmacao_id?.toString() || (config as any)?.template_confirmacao_id?.toString() || 'none'}
                  onValueChange={(v) => {
                    const newValue = v === 'none' ? null : parseInt(v);
                    setLocalConfig({ ...localConfig, template_confirmacao_id: newValue });
                    // Auto-save template selection
                    onUpdateConfig({ template_confirmacao_id: newValue } as any);
                  }}
                  disabled={loadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (desativado)</SelectItem>
                    {templates?.filter(t => t.mensagem?.includes('{{'))?.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Send className="h-3 w-3 text-green-500" />
                          {template.titulo}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Mensagem enviada automaticamente quando um lead marca uma reunião pública
                </p>
              </div>

              {/* Link para criar templates */}
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  Crie templates com variáveis em{' '}
                  <button 
                    type="button"
                    onClick={() => navigate('/automacoes', { state: { defaultTab: 'disparos' } })}
                    className="text-primary underline hover:text-primary/80"
                  >
                    Automações &gt; Marketing &gt; Disparos
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{{nome}}'}</code>, <code className="bg-muted px-1 rounded">{'{{data}}'}</code>, <code className="bg-muted px-1 rounded">{'{{horario}}'}</code>, etc.
                </p>
              </div>
            </CardContent>
          </Card>

          {Object.keys(localConfig).length > 0 && (
            <Button onClick={handleSave} className="w-full">
              Salvar Configurações
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
