import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Building2, Plus, Users, Database, CheckCircle, XCircle, Palette, Globe, ArrowRight } from 'lucide-react';
import { EmpresaBrandingForm } from '@/components/admin/EmpresaBrandingForm';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

interface Empresa {
  id: string;
  nome: string;
  slug: string;
  schema_nome: string;
  ativo: boolean;
  cor_primaria: string | null;
  logo_url: string | null;
  criado_em: string;
}

interface NovaEmpresaForm {
  nome: string;
  slug: string;
  cor_primaria: string;
}

export default function GerenciamentoEmpresas() {
  const {
    isSuperAdmin,
    trocarEmpresa,
    limparEmpresaAtiva,
    empresa: empresaAtiva,
    isModoGlobal,
    schemaEmpresa,
  } = useEmpresa();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [brandingDialogAberto, setBrandingDialogAberto] = useState(false);
  const [empresaEmEdicao, setEmpresaEmEdicao] = useState<Empresa | null>(null);
  const [form, setForm] = useState<NovaEmpresaForm>({
    nome: '',
    slug: '',
    cor_primaria: '#6366f1',
  });

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas-lista'],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const criarEmpresaMutation = useMutation({
    mutationFn: async (dados: NovaEmpresaForm) => {
      const { data, error } = await supabase.rpc('me_criar_empresa', {
        p_nome: dados.nome,
        p_slug: dados.slug,
        p_cor_primaria: dados.cor_primaria,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Empresa criada com sucesso!', {
        description: `Schema emp_${form.slug} provisionado com todas as tabelas.`,
      });
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      setDialogAberto(false);
      setForm({ nome: '', slug: '', cor_primaria: '#6366f1' });
    },
    onError: (error: any) => {
      toast.error('Erro ao criar empresa', { description: error.message });
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({ ativo: !ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
    },
  });

  const handleSlugChange = (value: string) => {
    // Normalizar slug: minúsculas, sem espaços, só letras/números/underscore
    const slugNormalizado = value
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    setForm(prev => ({ ...prev, slug: slugNormalizado }));
  };

  const handleEntrarComoEmpresa = async (empresa: Empresa) => {
    await trocarEmpresa(empresa);
    toast.success(`Modo empresa: ${empresa.nome}`, {
      description: 'Novos leads serão salvos nesta empresa, não no cadastro global.',
    });
    navigate('/');
  };

  const handleModoGlobal = () => {
    limparEmpresaAtiva();
    toast.info('Modo cadastro global', {
      description: 'Você está no ambiente master. Para cadastrar leads de uma empresa, use Entrar na empresa desejada.',
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a super administradores.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Gerenciamento de Empresas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie e gerencie empresas. Cada empresa tem seu próprio schema isolado no banco de dados.
          </p>
        </div>

        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Criar Nova Empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Empresa</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Empresa ABC"
                  value={form.nome}
                  onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Identificador (slug)</Label>
                <Input
                  id="slug"
                  placeholder="Ex: empresa_abc"
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Schema criado: <code className="bg-muted px-1 rounded">emp_{form.slug || '...'}</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cor">Cor Principal</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="cor"
                    value={form.cor_primaria}
                    onChange={e => setForm(prev => ({ ...prev, cor_primaria: e.target.value }))}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.cor_primaria}
                    onChange={e => setForm(prev => ({ ...prev, cor_primaria: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium">O que será criado:</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• Schema PostgreSQL <code>emp_{form.slug || '...'}</code></li>
                  <li>• 60+ tabelas isoladas (leads, usuários, agenda...)</li>
                  <li>• Configurações de RLS por empresa</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => criarEmpresaMutation.mutate(form)}
                  disabled={!form.nome || !form.slug || criarEmpresaMutation.isPending}
                >
                  {criarEmpresaMutation.isPending ? 'Criando...' : 'Criar Empresa'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card
        className={
          isModoGlobal
            ? 'border-2 border-primary bg-primary/5'
            : 'border-primary/30 bg-muted/30'
        }
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {isModoGlobal ? (
                  <>
                    <Globe className="h-5 w-5 text-primary" />
                    Cadastro global (master)
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5 text-primary" />
                    Operando na empresa: {empresaAtiva?.nome}
                  </>
                )}
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                {isModoGlobal ? (
                  <>
                    Você está no ambiente central do sistema. Leads e dados criados aqui ficam no
                    cadastro global (<code className="text-xs bg-muted px-1 rounded">public</code>
                    ), visível só para o admin master.
                  </>
                ) : (
                  <>
                    Leads, pipeline e agenda usam o schema{' '}
                    <code className="text-xs bg-muted px-1 rounded">{schemaEmpresa}</code>. Tudo que
                    você cadastrar agora pertence a <strong>{empresaAtiva?.nome}</strong>, não ao
                    cadastro global.
                  </>
                )}
              </CardDescription>
            </div>
            {isModoGlobal ? (
              <Badge variant="default" className="shrink-0 gap-1">
                <Globe className="h-3 w-3" />
                Modo global ativo
              </Badge>
            ) : (
              <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={handleModoGlobal}>
                <Globe className="h-3.5 w-3.5" />
                Voltar ao cadastro global
              </Button>
            )}
          </div>
        </CardHeader>
        {!isModoGlobal && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Para trocar de empresa, clique em <strong>Entrar</strong> no card da empresa abaixo.
            </p>
          </CardContent>
        )}
      </Card>

      {empresaAtiva && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Empresa ativa no menu: {empresaAtiva.nome}</CardTitle>
            <CardDescription>
              Ajuste logo e nome exibidos no menu lateral. Também disponível em{' '}
              <Link to="/admin/marca" className="text-primary underline">
                Administração → Logo e Nome
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmpresaBrandingForm empresa={empresaAtiva} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted rounded" />
            </Card>
          ))}
        </div>
      ) : empresas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Nenhuma empresa cadastrada</p>
              <p className="text-muted-foreground text-sm mt-1">
                Crie a primeira empresa com o botão <strong>Nova Empresa</strong> acima.
                Depois use <strong>Logo e Nome</strong> no card para configurar a marca no menu.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {empresas.map(empresa => {
            const isEmpresaAtiva = empresaAtiva?.id === empresa.id;
            return (
            <Card
              key={empresa.id}
              className={`relative overflow-hidden ${isEmpresaAtiva ? 'ring-2 ring-primary shadow-md' : ''}`}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: empresa.cor_primaria ?? '#6366f1' }}
              />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{empresa.nome}</CardTitle>
                    <CardDescription className="mt-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {empresa.schema_nome}
                      </code>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isEmpresaAtiva && (
                      <Badge className="bg-primary/90">Empresa ativa</Badge>
                    )}
                    <Badge variant={empresa.ativo ? 'default' : 'secondary'}>
                      {empresa.ativo ? (
                        <><CheckCircle className="h-3 w-3 mr-1" />Ativa</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" />Inativa</>
                      )}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="h-4 w-4" />
                  <span>Schema: <strong>{empresa.schema_nome}</strong></span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Criada em: {new Date(empresa.criado_em).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1"
                    variant={isEmpresaAtiva ? 'secondary' : 'default'}
                    onClick={() => handleEntrarComoEmpresa(empresa)}
                    disabled={!empresa.ativo}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {isEmpresaAtiva ? 'Em uso' : 'Entrar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      setEmpresaEmEdicao(empresa);
                      setBrandingDialogAberto(true);
                    }}
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Logo e Nome
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAtivoMutation.mutate({ id: empresa.id, ativo: empresa.ativo })}
                  >
                    {empresa.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={brandingDialogAberto} onOpenChange={setBrandingDialogAberto}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Identidade visual — {empresaEmEdicao?.nome}</DialogTitle>
          </DialogHeader>
          <EmpresaBrandingForm
            empresa={empresaEmEdicao}
            onSalvo={() => setBrandingDialogAberto(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
