import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Settings, Search, Copy, Plus, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useCadastroAlunos, useCadastroConfig, useUpdateCadastroConfig, usePlanosFin } from '@/hooks/useCadastroAlunos';
import { CadastroCard } from './CadastroCard';
import { usePermissions } from '@/hooks/usePermissions';
import { CADASTRO_PUBLIC_URL } from '@/lib/cadastro-url';

export function CadastroTabContent() {
  const { data: cadastros = [], isLoading } = useCadastroAlunos();
  const { data: config, isLoading: configLoading } = useCadastroConfig();
  const { data: planos = [] } = usePlanosFin();
  const updateConfig = useUpdateCadastroConfig();
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');

  /** Início do mês atual em YYYY-MM-DD */
  const getInicioMesAtual = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  };
  /** Último dia do mês atual em YYYY-MM-DD */
  const getFimMesAtual = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  };

  const [dataDe, setDataDe] = useState(getInicioMesAtual);
  const [dataAte, setDataAte] = useState(getFimMesAtual);

  const [planosSelecionados, setPlanosSelecionados] = useState<string[]>([]);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [novaDisciplina, setNovaDisciplina] = useState('');

  useEffect(() => {
    if (config?.planos_visiveis) setPlanosSelecionados(config.planos_visiveis);
  }, [config?.planos_visiveis]);

  useEffect(() => {
    if (Array.isArray(config?.disciplinas)) setDisciplinas(config.disciplinas);
  }, [config?.disciplinas]);

  const termoNormalizado = searchTerm.trim().toLowerCase();
  const termoDigitos = searchTerm.replace(/\D/g, '');

  const filteredCadastros = cadastros.filter((c) => {
    const criadoEm = c.criado_em ? c.criado_em.slice(0, 10) : '';
    const dentroDoPeriodo = criadoEm >= dataDe && criadoEm <= dataAte;

    if (!dentroDoPeriodo) return false;

    if (!termoNormalizado) return true;

    if (c.nome?.toLowerCase().includes(termoNormalizado)) return true;
    if (c.email?.toLowerCase().includes(termoNormalizado)) return true;
    if (c.telefone?.replace(/\D/g, '').includes(termoDigitos) || c.telefone?.includes(searchTerm.trim())) return true;
    if (termoDigitos && c.cpf_responsavel?.replace(/\D/g, '').includes(termoDigitos)) return true;
    if (c.cpf_responsavel?.toLowerCase().includes(termoNormalizado)) return true;

    return false;
  });

  const canEditConfig = hasPermission('leads', 'edit') ?? false;

  const handleSaveConfig = () => {
    updateConfig.mutate({ planos_visiveis: planosSelecionados, disciplinas });
  };

  const handleAddDisciplina = () => {
    const t = novaDisciplina.trim();
    if (!t || disciplinas.includes(t)) return;
    setDisciplinas((prev) => [...prev, t]);
    setNovaDisciplina('');
  };

  const handleRemoveDisciplina = (index: number) => {
    setDisciplinas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(CADASTRO_PUBLIC_URL);
      toast.success('Link copiado', {
        description: 'O link do formulário de cadastro foi copiado para a área de transferência.',
      });
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <Button asChild variant="default" className="flex-1 sm:flex-initial min-w-0">
            <a href={CADASTRO_PUBLIC_URL} target="_blank" rel="noopener noreferrer" className="gap-2 truncate">
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">Cadastro de alunos (abrir formulário)</span>
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Copiar link"
            onClick={handleCopyLink}
            aria-label="Copiar link do formulário de cadastro"
            className="shrink-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {canEditConfig && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" title="Configurações do formulário" className="shrink-0">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md w-[calc(100vw-2rem)] sm:w-full">
                <DialogHeader>
                  <DialogTitle>Configurações do formulário de cadastro</DialogTitle>
                  <DialogDescription>
                    Planos e disciplinas que aparecerão na página de cadastro.
                  </DialogDescription>
                </DialogHeader>
                {configLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium">Planos</Label>
                      <ScrollArea className="h-[200px] rounded-md border p-3 mt-1">
                        <div className="space-y-2">
                          {planos.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 cursor-pointer rounded p-2 hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={planosSelecionados.includes(p.id)}
                                onCheckedChange={(checked) => {
                                  setPlanosSelecionados((prev) =>
                                    checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                                  );
                                }}
                              />
                              <span className="text-sm">
                                {p.nome} – {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </label>
                          ))}
                          {planos.length === 0 && (
                            <p className="text-sm text-muted-foreground">Nenhum plano ativo encontrado.</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Disciplinas (dropdown do formulário)</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Cadastre as disciplinas que o cliente poderá escolher.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: Matemática"
                          value={novaDisciplina}
                          onChange={(e) => setNovaDisciplina(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDisciplina())}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={handleAddDisciplina} aria-label="Adicionar disciplina">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <ul className="mt-2 space-y-1 max-h-[120px] overflow-auto rounded border p-2">
                        {disciplinas.map((d, i) => (
                          <li key={`${d}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                            <span>{d}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveDisciplina(i)}
                              aria-label={`Remover ${d}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                        {disciplinas.length === 0 && (
                          <li className="text-sm text-muted-foreground">Nenhuma disciplina cadastrada.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    onClick={handleSaveConfig}
                    disabled={updateConfig.isPending || configLoading}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="flex flex-col gap-3 w-full sm:w-auto sm:min-w-0">
          <div className="relative w-full min-w-0 sm:min-w-[200px] sm:max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome, CPF, e-mail ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <Label htmlFor="data-de" className="text-sm text-muted-foreground shrink-0">
              De
            </Label>
            <Input
              id="data-de"
              type="date"
              lang="pt-BR"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="w-full min-w-0 sm:w-[130px] md:w-[140px]"
            />
            <Label htmlFor="data-ate" className="text-sm text-muted-foreground shrink-0">
              até
            </Label>
            <Input
              id="data-ate"
              type="date"
              lang="pt-BR"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="w-full min-w-0 sm:w-[130px] md:w-[140px]"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Cadastros ({filteredCadastros.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : filteredCadastros.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              Nenhum cadastro encontrado. Compartilhe o link do formulário para os clientes se cadastrarem.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredCadastros.map((cadastro) => (
                <CadastroCard key={cadastro.id} cadastro={cadastro} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
