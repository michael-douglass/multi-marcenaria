import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmpresaBrandingForm } from '@/components/admin/EmpresaBrandingForm';
import { PrestadorBannerForm } from '@/components/admin/PrestadorBannerForm';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { Palette, Building2, Image, FileText, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ConfiguracaoMarca() {
  const { userRole, user } = useAuth();
  const { empresa, isSuperAdmin, recarregarEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [cnpj, setCnpj] = useState((empresa as Record<string, unknown>)?.cnpj as string ?? '');

  function formatCNPJ(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{2})(\d)/, '$1.$2.$3/$4')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  const salvarCNPJ = useMutation({
    mutationFn: async () => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');
      const { error } = await supabase
        .from('CRM-multi-empresas>empresas<' as never)
        .update({ cnpj: cnpj.trim() || null } as never)
        .eq('id', empresa.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (user?.id) await recarregarEmpresa(user.id);
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('CNPJ salvo!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar CNPJ', { description: e.message }),
  });

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-6">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Logo e nome da empresa
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define o que aparece no topo do menu lateral (logo e nome da sua empresa).
        </p>
      </div>

      {isSuperAdmin && !empresa && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Super administrador
            </CardTitle>
            <CardDescription>
              A Garbo opera numa casa só. Se a marca não aparecer, recarregue a página — não há
              seletor de empresas neste sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Não há lista de empresas neste sistema. A marca da Garbo aparece abaixo quando a casa carrega.
            </p>
          </CardContent>
        </Card>
      )}

      {empresa && (
        <p className="text-sm text-muted-foreground">
          Configurando: <strong className="text-foreground">{empresa.nome}</strong>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identidade visual</CardTitle>
          <CardDescription>
            Envie a logo, o nome exibido no menu e a cor de destaque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmpresaBrandingForm empresa={empresa} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            Página do Prestador de Serviço
          </CardTitle>
          <CardDescription>
            Banner exibido na página exclusiva dos prestadores ao fazerem login. Use imagens de alta qualidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrestadorBannerForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Timbrado de Contratos
          </CardTitle>
          <CardDescription>
            CNPJ exibido no cabeçalho dos contratos gerados. O logo e o nome já vêm da identidade visual acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!empresa ? (
            <p className="text-sm text-muted-foreground">Selecione uma empresa para configurar o CNPJ.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="empresa-cnpj">CNPJ da empresa</Label>
                <Input
                  id="empresa-cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => salvarCNPJ.mutate()}
                  disabled={salvarCNPJ.isPending}
                  size="sm"
                >
                  {salvarCNPJ.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Salvar CNPJ
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
