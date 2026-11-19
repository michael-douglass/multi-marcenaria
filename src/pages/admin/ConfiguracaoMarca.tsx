import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmpresaDadosForm } from '@/components/admin/EmpresaDadosForm';
import { PrestadorBannerForm } from '@/components/admin/PrestadorBannerForm';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaPortal } from '@/hooks/useEmpresaPortal';
import { Palette, Image, Building2 } from 'lucide-react';

/**
 * /admin/marca — identidade da empresa (mesmo formulário do /profile). O banner do portal do parceiro
 * só aparece na empresa-modelo: é definido nos modelos padrão e chega às empresas pelo pacote Pontua.
 */
export default function ConfiguracaoMarca() {
  const { hasRole } = useAuth();
  const { empresa } = useEmpresa();
  const portal = useEmpresaPortal();

  if (!hasRole('admin')) {
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
          Logo e dados da empresa
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Logo, CNPJ e dados cadastrais usados no menu, nos slides, contratos e PDFs.
        </p>
      </div>

      {empresa && (
        <p className="text-sm text-muted-foreground">
          Configurando: <strong className="text-foreground">{empresa.nome}</strong>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Dados da empresa
          </CardTitle>
          <CardDescription>
            Ao digitar o CNPJ, buscamos os dados na Receita Federal. Revise e salve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmpresaDadosForm />
        </CardContent>
      </Card>

      {portal.data?.e_modelo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Banner do portal do parceiro (modelo)
            </CardTitle>
            <CardDescription>
              Banner exibido aos prestadores no portal. Faz parte do modelo Pontua: as empresas recebem estas imagens quando o modelo é enviado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PrestadorBannerForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
