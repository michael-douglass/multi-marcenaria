import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Clock, Palette, Edit2, MapPin, Megaphone, Type, Sparkles } from 'lucide-react';
import { WhiteboardTextSettingsCard } from '@/components/pipeline/WhiteboardTextSettingsCard';
import { PipelineLeadAISettingsCard } from '@/components/pipeline/PipelineLeadAISettingsCard';
import { usePipelineTimeConfig, PipelineTimeConfig } from '@/hooks/usePipelineTimeConfig';
import { useLeadOrigins } from '@/hooks/useLeadOrigins';
import { useRegioes } from '@/hooks/useRegioes';
import { usePermissions } from '@/hooks/usePermissions';
import { PipelineKanbanSettings } from '@/components/pipeline/PipelineKanbanSettings';
import { toast } from 'sonner';

const CORES_PREDEFINIDAS = [
  { valor: '#22c55e', nome: 'Verde' },
  { valor: '#84cc16', nome: 'Verde Lima' },
  { valor: '#eab308', nome: 'Amarelo' },
  { valor: '#f97316', nome: 'Laranja' },
  { valor: '#ef4444', nome: 'Vermelho' },
  { valor: '#dc2626', nome: 'Vermelho Escuro' },
  { valor: '#991b1b', nome: 'Vermelho Crítico' },
  { valor: '#7f1d1d', nome: 'Marrom' },
  { valor: '#6366f1', nome: 'Indigo' },
  { valor: '#8b5cf6', nome: 'Violeta' },
];

export default function PipelineSettings() {
  const navigate = useNavigate();
  const { userRole } = usePermissions();
  const { configs, isLoading: isLoadingTime, addConfig, updateConfig, deleteConfig } = usePipelineTimeConfig();
  const { origins, isLoading: isLoadingOrigins, createOrigin, deleteOrigin, updateOrigin } = useLeadOrigins();
  const { regioes, isLoading: isLoadingRegioes, addRegiao, updateRegiao, deleteRegiao } = useRegioes();
  
  // State para tempo
  const [isAddTimeDialogOpen, setIsAddTimeDialogOpen] = useState(false);
  const [editingTimeConfig, setEditingTimeConfig] = useState<PipelineTimeConfig | null>(null);
  const [tempoValor, setTempoValor] = useState('');
  const [tempoUnidade, setTempoUnidade] = useState<'minutos' | 'horas' | 'dias'>('minutos');
  const [corSelecionada, setCorSelecionada] = useState(CORES_PREDEFINIDAS[0].valor);
  const [nomeLegenda, setNomeLegenda] = useState('');

  // State para origens de tráfego
  const [isAddOriginDialogOpen, setIsAddOriginDialogOpen] = useState(false);
  const [newOriginName, setNewOriginName] = useState('');
  const [editingOrigin, setEditingOrigin] = useState<{ id: string; nome: string } | null>(null);

  // State para regiões
  const [isAddRegiaoDialogOpen, setIsAddRegiaoDialogOpen] = useState(false);
  const [newRegiaoName, setNewRegiaoName] = useState('');
  const [newRegiaoTabela, setNewRegiaoTabela] = useState('');
  const [editingRegiao, setEditingRegiao] = useState<{ id: string; nomeAmigavel: string } | null>(null);

  const isAdmin = userRole === 'admin';

  // Funções de tempo
  const calcularMinutos = (valor: number, unidade: 'minutos' | 'horas' | 'dias'): number => {
    switch (unidade) {
      case 'horas': return valor * 60;
      case 'dias': return valor * 1440;
      default: return valor;
    }
  };

  const formatarTempoCompleto = (minutos: number): string => {
    if (minutos < 60) return `${minutos} minutos`;
    if (minutos < 1440) {
      const horas = Math.floor(minutos / 60);
      const mins = minutos % 60;
      return mins > 0 ? `${horas}h ${mins}min` : `${horas} hora${horas > 1 ? 's' : ''}`;
    }
    const dias = Math.floor(minutos / 1440);
    const horasRestantes = Math.floor((minutos % 1440) / 60);
    return horasRestantes > 0 ? `${dias}d ${horasRestantes}h` : `${dias} dia${dias > 1 ? 's' : ''}`;
  };

  const handleAddTimeConfig = async () => {
    const valor = parseInt(tempoValor);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Digite um valor de tempo válido');
      return;
    }

    const minutos = calcularMinutos(valor, tempoUnidade);
    
    try {
      await addConfig.mutateAsync({
        tempoMinutos: minutos,
        cor: corSelecionada,
        nomeLegenda: nomeLegenda || `Até ${formatarTempoCompleto(minutos)}`,
      });
      
      setIsAddTimeDialogOpen(false);
      resetTimeForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateTimeConfig = async () => {
    if (!editingTimeConfig) return;
    
    const valor = parseInt(tempoValor);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Digite um valor de tempo válido');
      return;
    }

    const minutos = calcularMinutos(valor, tempoUnidade);
    
    try {
      await updateConfig.mutateAsync({
        id: editingTimeConfig.id,
        updates: {
          tempoMinutos: minutos,
          cor: corSelecionada,
          nomeLegenda: nomeLegenda || `Até ${formatarTempoCompleto(minutos)}`,
        },
      });
      
      setEditingTimeConfig(null);
      resetTimeForm();
    } catch (error) {
      console.error(error);
    }
  };

  const resetTimeForm = () => {
    setTempoValor('');
    setTempoUnidade('minutos');
    setCorSelecionada(CORES_PREDEFINIDAS[0].valor);
    setNomeLegenda('');
  };

  const openEditTimeDialog = (config: PipelineTimeConfig) => {
    setEditingTimeConfig(config);
    
    if (config.tempoMinutos >= 1440) {
      setTempoValor(String(Math.floor(config.tempoMinutos / 1440)));
      setTempoUnidade('dias');
    } else if (config.tempoMinutos >= 60) {
      setTempoValor(String(Math.floor(config.tempoMinutos / 60)));
      setTempoUnidade('horas');
    } else {
      setTempoValor(String(config.tempoMinutos));
      setTempoUnidade('minutos');
    }
    
    setCorSelecionada(config.cor);
    setNomeLegenda(config.nomeLegenda);
  };

  // Funções de origens de tráfego
  const handleAddOrigin = async () => {
    if (!newOriginName.trim()) {
      toast.error('Nome da origem não pode estar vazio');
      return;
    }

    try {
      await createOrigin(newOriginName.trim());
      setNewOriginName('');
      setIsAddOriginDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateOrigin = async () => {
    if (!editingOrigin) return;

    try {
      await updateOrigin.mutateAsync({ id: editingOrigin.id, nome: editingOrigin.nome });
      setEditingOrigin(null);
    } catch (error) {
      console.error(error);
    }
  };

  // Funções de regiões
  const handleAddRegiao = async () => {
    if (!newRegiaoName.trim()) {
      toast.error('Nome da região não pode estar vazio');
      return;
    }

    try {
      await addRegiao.mutateAsync({
        nomeAmigavel: newRegiaoName.trim(),
        nomeTabela: newRegiaoTabela.trim() || newRegiaoName.trim().toLowerCase().replace(/\s+/g, '_'),
      });
      setNewRegiaoName('');
      setNewRegiaoTabela('');
      setIsAddRegiaoDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateRegiao = async () => {
    if (!editingRegiao) return;

    try {
      await updateRegiao.mutateAsync({ id: editingRegiao.id, nomeAmigavel: editingRegiao.nomeAmigavel });
      setEditingRegiao(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold text-foreground">Acesso Negado</h2>
          <p className="text-muted-foreground">Apenas administradores podem acessar as configurações.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pipeline')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold leading-tight">Configurações do Pipeline</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Gerencie origens e tempos dos leads
          </p>
        </div>
      </div>

      <Tabs defaultValue="origens" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 p-1.5">
          <TabsTrigger value="kanbans" className="flex shrink-0 items-center gap-2 px-3 py-2">
            <MapPin className="h-4 w-4 shrink-0" />
            Kanbans
          </TabsTrigger>
          <TabsTrigger value="origens" className="flex shrink-0 items-center gap-2 px-3 py-2">
            <MapPin className="h-4 w-4 shrink-0" />
            Origens
          </TabsTrigger>
          <TabsTrigger value="tempo" className="flex shrink-0 items-center gap-2 px-3 py-2">
            <Clock className="h-4 w-4 shrink-0" />
            Tempo
          </TabsTrigger>
          <TabsTrigger value="lousa" className="flex shrink-0 items-center gap-2 px-3 py-2">
            <Type className="h-4 w-4 shrink-0" />
            Lousa
          </TabsTrigger>
          <TabsTrigger value="ia" className="flex shrink-0 items-center gap-2 px-3 py-2">
            <Sparkles className="h-4 w-4 shrink-0" />
            IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanbans">
          <PipelineKanbanSettings />
        </TabsContent>

        <TabsContent value="lousa">
          <WhiteboardTextSettingsCard />
        </TabsContent>

        <TabsContent value="ia">
          <PipelineLeadAISettingsCard />
        </TabsContent>

        {/* TAB DE ORIGENS */}
        <TabsContent value="origens" className="space-y-6">
          {/* Regiões (Locais) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Regiões (Locais)
                </CardTitle>
                <CardDescription>
                  Regiões geográficas que aparecem nos cards do pipeline
                </CardDescription>
              </div>
              
              <Dialog open={isAddRegiaoDialogOpen} onOpenChange={setIsAddRegiaoDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setNewRegiaoName(''); setNewRegiaoTabela(''); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Região
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Região</DialogTitle>
                    <DialogDescription>
                      Adicione uma nova região para categorizar seus leads
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome da Região</Label>
                      <Input
                        placeholder="Ex: Rio de Janeiro"
                        value={newRegiaoName}
                        onChange={(e) => setNewRegiaoName(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este nome será salvo no campo "regiao" dos leads
                    </p>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddRegiaoDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddRegiao} disabled={addRegiao.isPending}>
                      {addRegiao.isPending ? 'Salvando...' : 'Adicionar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingRegioes ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Região</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regioes.map(regiao => (
                      <TableRow key={regiao.id}>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <MapPin className="h-3 w-3 mr-1" />
                            {regiao.nomeAmigavel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog open={editingRegiao?.id === regiao.id} onOpenChange={(open) => !open && setEditingRegiao(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setEditingRegiao({ id: regiao.id, nomeAmigavel: regiao.nomeAmigavel })}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Região</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Nome da Região</Label>
                                    <Input
                                      value={editingRegiao?.nomeAmigavel || ''}
                                      onChange={(e) => setEditingRegiao(prev => prev ? { ...prev, nomeAmigavel: e.target.value } : null)}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setEditingRegiao(null)}>Cancelar</Button>
                                  <Button onClick={handleUpdateRegiao} disabled={updateRegiao.isPending}>
                                    {updateRegiao.isPending ? 'Salvando...' : 'Salvar'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover região?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Leads existentes com esta região não serão afetados.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteRegiao.mutateAsync(regiao.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {regioes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                          Nenhuma região cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Fontes de Tráfego */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Fontes de Tráfego
                </CardTitle>
                <CardDescription>
                  De onde os leads vieram (Google Ads, Instagram, etc.)
                </CardDescription>
              </div>
              
              <Dialog open={isAddOriginDialogOpen} onOpenChange={setIsAddOriginDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setNewOriginName('')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Fonte
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Fonte de Tráfego</DialogTitle>
                    <DialogDescription>
                      Adicione uma nova fonte de onde os leads podem vir
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome da Fonte</Label>
                      <Input
                        placeholder="Ex: TikTok Ads"
                        value={newOriginName}
                        onChange={(e) => setNewOriginName(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOriginDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddOrigin}>
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingOrigins ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {origins.map(origin => (
                      <TableRow key={origin.id}>
                        <TableCell>
                          <Badge variant="secondary">
                            {origin.nome}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {origin.is_default ? 'Padrão do sistema' : 'Personalizada'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog open={editingOrigin?.id === origin.id} onOpenChange={(open) => !open && setEditingOrigin(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setEditingOrigin({ id: origin.id, nome: origin.nome })}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Fonte de Tráfego</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Nome da Fonte</Label>
                                    <Input
                                      value={editingOrigin?.nome || ''}
                                      onChange={(e) => setEditingOrigin(prev => prev ? { ...prev, nome: e.target.value } : null)}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setEditingOrigin(null)}>Cancelar</Button>
                                  <Button onClick={handleUpdateOrigin} disabled={updateOrigin.isPending}>
                                    {updateOrigin.isPending ? 'Salvando...' : 'Salvar'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            {!origin.is_default && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover fonte de tráfego?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteOrigin(origin.id)}>
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB DE TEMPO */}
        <TabsContent value="tempo" className="space-y-6">
          {/* Legenda Visual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Legenda de Cores
              </CardTitle>
              <CardDescription>
                Os cards do pipeline mudam de cor baseado no tempo desde a última interação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {configs?.map(config => {
                  // Gerar legenda dinâmica baseada no tempo configurado
                  const legendaDinamica = config.tempoMinutos < 60 
                    ? `Até ${config.tempoMinutos} min`
                    : config.tempoMinutos < 1440
                      ? `Até ${Math.floor(config.tempoMinutos / 60)}h`
                      : `Até ${Math.floor(config.tempoMinutos / 1440)}d`;
                  
                  return (
                    <Badge
                      key={config.id}
                      variant="outline"
                      className="flex items-center gap-2 py-2 px-3"
                      style={{ 
                        borderColor: config.cor,
                        backgroundColor: `${config.cor}20`,
                      }}
                    >
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: config.cor }}
                      />
                      <span className="text-sm">{legendaDinamica}</span>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Configurações de Tempo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Configurações de Tempo
                </CardTitle>
                <CardDescription>
                  Configure os tempos limites e cores correspondentes
                </CardDescription>
              </div>
              
              <Dialog open={isAddTimeDialogOpen} onOpenChange={setIsAddTimeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetTimeForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Tempo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Configuração de Tempo</DialogTitle>
                    <DialogDescription>
                      Defina um novo limite de tempo e sua cor correspondente
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tempo</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 30"
                          value={tempoValor}
                          onChange={(e) => setTempoValor(e.target.value)}
                          min={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unidade</Label>
                        <Select value={tempoUnidade} onValueChange={(v) => setTempoUnidade(v as typeof tempoUnidade)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutos">Minutos</SelectItem>
                            <SelectItem value="horas">Horas</SelectItem>
                            <SelectItem value="dias">Dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Cor</Label>
                      <div className="flex flex-wrap gap-2">
                        {CORES_PREDEFINIDAS.map(cor => (
                          <button
                            key={cor.valor}
                            type="button"
                            onClick={() => setCorSelecionada(cor.valor)}
                            className={`h-8 w-8 rounded-full border-2 transition-all ${
                              corSelecionada === cor.valor ? 'border-foreground scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: cor.valor }}
                            title={cor.nome}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Nome da Legenda (opcional)</Label>
                      <Input
                        placeholder="Ex: Até 30 minutos"
                        value={nomeLegenda}
                        onChange={(e) => setNomeLegenda(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddTimeDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddTimeConfig} disabled={addConfig.isPending}>
                      {addConfig.isPending ? 'Salvando...' : 'Adicionar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingTime ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cor</TableHead>
                      <TableHead>Tempo Limite</TableHead>
                      <TableHead>Legenda</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs?.map(config => (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div 
                            className="h-6 w-6 rounded-full border"
                            style={{ backgroundColor: config.cor }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatarTempoCompleto(config.tempoMinutos)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {config.nomeLegenda}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog open={editingTimeConfig?.id === config.id} onOpenChange={(open) => !open && setEditingTimeConfig(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => openEditTimeDialog(config)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Configuração</DialogTitle>
                                </DialogHeader>
                                
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Tempo</Label>
                                      <Input
                                        type="number"
                                        value={tempoValor}
                                        onChange={(e) => setTempoValor(e.target.value)}
                                        min={1}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Unidade</Label>
                                      <Select value={tempoUnidade} onValueChange={(v) => setTempoUnidade(v as typeof tempoUnidade)}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="minutos">Minutos</SelectItem>
                                          <SelectItem value="horas">Horas</SelectItem>
                                          <SelectItem value="dias">Dias</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Cor</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {CORES_PREDEFINIDAS.map(cor => (
                                        <button
                                          key={cor.valor}
                                          type="button"
                                          onClick={() => setCorSelecionada(cor.valor)}
                                          className={`h-8 w-8 rounded-full border-2 transition-all ${
                                            corSelecionada === cor.valor ? 'border-foreground scale-110' : 'border-transparent'
                                          }`}
                                          style={{ backgroundColor: cor.valor }}
                                          title={cor.nome}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Nome da Legenda</Label>
                                    <Input
                                      value={nomeLegenda}
                                      onChange={(e) => setNomeLegenda(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setEditingTimeConfig(null)}>Cancelar</Button>
                                  <Button onClick={handleUpdateTimeConfig} disabled={updateConfig.isPending}>
                                    {updateConfig.isPending ? 'Salvando...' : 'Salvar'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover configuração de tempo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteConfig.mutateAsync(config.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!configs || configs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma configuração de tempo cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
