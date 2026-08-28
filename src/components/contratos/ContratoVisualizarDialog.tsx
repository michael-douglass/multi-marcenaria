import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, FileText, Loader2, Pencil, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContratoDocumento } from '@/components/contratos/ContratoDocumento';
import { ContratoDocumentoPreviewViewport } from '@/components/contratos/ContratoDocumentoPreviewViewport';
import { DataBrInput } from '@/components/contratos/DataBrInput';
import type { Contrato, ContratoStatus } from '@/hooks/useContratos';
import { useContratos } from '@/hooks/useContratos';
import { useContratosVariaveis } from '@/hooks/useContratosVariaveis';
import type { ContratoVariavel } from '@/hooks/useContratosVariaveis';
import { useContratosModelos } from '@/hooks/useContratosModelo';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { getContratosEmpresaFromContext } from '@/hooks/useContratosEmpresaConfig';
import { buildAssinaturasCompletas, imprimirContrato } from '@/lib/contratos-print';
import { ContratoAnexosSection } from '@/components/contratos/ContratoAnexosSection';
import { useContratoAnexos } from '@/hooks/useContratoAnexos';
import {
  buildConteudoContrato,
  embedMetaCamposValores,
  parseRascunhoCampos,
  resolverClienteNome,
} from '@/lib/contrato-rascunho';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_LABEL: Record<ContratoStatus, string> = {
  rascunho: 'Em produção',
  gerado: 'Gerado',
  enviado: 'Enviado',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
};

function formatCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function CampoInput({
  variavel,
  valor,
  onChange,
}: {
  variavel: ContratoVariavel;
  valor: string;
  onChange: (v: string) => void;
}) {
  if (variavel.tipo === 'cpf') {
    return (
      <Input
        value={valor}
        onChange={(e) => onChange(formatCPF(e.target.value))}
        placeholder="000.000.000-00"
        maxLength={14}
      />
    );
  }
  if (variavel.tipo === 'data') {
    return <DataBrInput value={valor} onChange={onChange} />;
  }
  if (variavel.tipo === 'valor') {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
          R$
        </span>
        <Input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          placeholder="0,00"
        />
      </div>
    );
  }
  return (
    <Input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Digite ${variavel.label.toLowerCase()}`}
    />
  );
}

interface ContratoVisualizarDialogProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContratoVisualizarDialog({
  contrato,
  open,
  onOpenChange,
}: ContratoVisualizarDialogProps) {
  const { empresa, schemaEmpresa } = useEmpresa();
  const { variaveis, isLoading: loadingVar } = useContratosVariaveis();
  const { modelos } = useContratosModelos();
  const { atualizarContrato } = useContratos();
  const empresaContrato = getContratosEmpresaFromContext(empresa);
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState(false);
  const [valoresEdicao, setValoresEdicao] = useState<Record<string, string>>({});
  // armazena o contrato após salvar para o preview refletir imediatamente
  const [contratoSalvo, setContratoSalvo] = useState<Contrato | null>(null);

  const contratoAtivo = contrato ? (contratoSalvo ?? contrato) : null;
  const { anexos: anexosContrato } = useContratoAnexos(contratoAtivo?.id);

  if (!contrato || !contratoAtivo) return null;

  const { valores, modeloId, etapa } = parseRascunhoCampos(contratoAtivo.campos_valores ?? {});

  const assinaturasPreview = buildAssinaturasCompletas(
    editando ? valoresEdicao : valores,
    variaveis,
    empresaContrato,
  );

  const variavelInputs = variaveis.filter((v) => !v.nome.startsWith('__'));

  const conteudoEdicao = (() => {
    if (!editando) return contratoAtivo.conteudo_final;
    const modelo =
      modelos.find((m) => m.id === modeloId) ?? modelos.find((m) => m.ativo);
    return modelo
      ? buildConteudoContrato(modelo.conteudo, valoresEdicao, variaveis)
      : contratoAtivo.conteudo_final;
  })();

  const iniciarEdicao = () => {
    setValoresEdicao({ ...valores });
    setEditando(true);
  };

  const cancelarEdicao = () => {
    setEditando(false);
    setValoresEdicao({});
  };

  const salvarEdicao = async () => {
    const modelo =
      modelos.find((m) => m.id === modeloId) ?? modelos.find((m) => m.ativo);
    const conteudoFinal = modelo
      ? buildConteudoContrato(modelo.conteudo, valoresEdicao, variaveis)
      : contratoAtivo.conteudo_final;

    const novoNome = resolverClienteNome(valoresEdicao, variaveis);
    const camposComMeta = embedMetaCamposValores(valoresEdicao, {
      modeloId,
      etapa,
    });

    const atualizado = await atualizarContrato.mutateAsync({
      id: contratoAtivo.id,
      identificador: contratoAtivo.identificador,
      cliente_nome: novoNome !== 'Rascunho' ? novoNome : contratoAtivo.cliente_nome,
      campos_valores: camposComMeta,
      conteudo_final: conteudoFinal,
    });

    setContratoSalvo(atualizado);
    setEditando(false);
    setValoresEdicao({});

    // atualiza a lista de contratos vinculados ao lead, se houver
    if (contratoAtivo.lead_id) {
      queryClient.invalidateQueries({
        queryKey: ['contratos-por-lead', schemaEmpresa, contratoAtivo.lead_id],
      });
    }
  };

  const handleFechar = (o: boolean) => {
    if (!o) {
      cancelarEdicao();
      setContratoSalvo(null);
    }
    onOpenChange(o);
  };

  const handlePdf = () => {
    imprimirContrato({
      conteudo: contratoAtivo.conteudo_final,
      logoUrl: empresa?.logo_url,
      nomeEmpresa: empresaContrato.nomeFantasia,
      razaoSocial: empresaContrato.razaoSocial || empresaContrato.nomeFantasia,
      cnpj: empresaContrato.cnpj,
      assinaturas: buildAssinaturasCompletas(valores, variaveis, empresaContrato),
      anexos: anexosContrato,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent
        className={`max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col transition-all duration-200 ${
          editando ? 'max-w-5xl' : 'max-w-4xl'
        }`}
      >
        {/* Cabeçalho */}
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="truncate">{contratoAtivo.identificador}</span>
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {contratoAtivo.cliente_nome} ·{' '}
                {format(new Date(contratoAtivo.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">
                {STATUS_LABEL[contratoAtivo.status]}
              </Badge>

              {!editando && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={handlePdf}
                    disabled={loadingVar}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={iniciarEdicao}
                    disabled={loadingVar}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar campos
                  </Button>
                </>
              )}

              {editando && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelarEdicao}
                    disabled={atualizarContrato.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                    onClick={salvarEdicao}
                    disabled={atualizarContrato.isPending}
                  >
                    {atualizarContrato.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Salvar
                  </Button>
                </>
              )}

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => handleFechar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo */}
        {editando ? (
          <div className="flex flex-1 min-h-0">
            {/* Painel de campos */}
            <div className="w-72 shrink-0 border-r flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/20">
                <p className="text-sm font-semibold">Campos do contrato</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Alterações refletem no preview ao lado
                </p>
              </div>
              <ScrollArea className="flex-1">
                <div className="px-4 py-4 space-y-4">
                  {variavelInputs.map((v) => (
                    <div key={v.id} className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        {v.label}
                        {v.obrigatorio && (
                          <span className="text-amber-400 ml-0.5">*</span>
                        )}
                      </Label>
                      <CampoInput
                        variavel={v}
                        valor={valoresEdicao[v.nome] ?? ''}
                        onChange={(val) =>
                          setValoresEdicao((prev) => ({ ...prev, [v.nome]: val }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Preview ao vivo */}
            <ContratoDocumentoPreviewViewport
              key={`edit-${contratoAtivo.id}`}
              className="flex-1"
            >
              {loadingVar ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                </div>
              ) : (
                <ContratoDocumento
                  conteudo={conteudoEdicao}
                  logoUrl={empresa?.logo_url}
                  nomeFantasia={empresaContrato.nomeFantasia}
                  cnpjCabecalho={empresaContrato.cnpj}
                  assinaturas={assinaturasPreview}
                />
              )}
            </ContratoDocumentoPreviewViewport>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <ContratoDocumentoPreviewViewport key={contratoAtivo.id} className="flex-1 min-h-0">
              {loadingVar ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                </div>
              ) : (
                <ContratoDocumento
                  conteudo={contratoAtivo.conteudo_final}
                  logoUrl={empresa?.logo_url}
                  nomeFantasia={empresaContrato.nomeFantasia}
                  cnpjCabecalho={empresaContrato.cnpj}
                  assinaturas={assinaturasPreview}
                />
              )}
            </ContratoDocumentoPreviewViewport>
            <div className="shrink-0 border-t px-5 py-4 max-h-[220px] overflow-y-auto">
              <ContratoAnexosSection contratoId={contratoAtivo.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
