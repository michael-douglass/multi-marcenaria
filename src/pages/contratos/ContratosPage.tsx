import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Search, Settings, Plus, MoreHorizontal,
  Download, Trash2, FileX, CheckCircle2, Send, XCircle, Pencil, Cloud, Link2, Contact,
} from 'lucide-react';
import { VincularContratoLeadDialog } from '@/components/contratos/VincularContratoLeadDialog';
import { ContratoIdentificadorCell } from '@/components/contratos/ContratoIdentificadorCell';
import { OrcamentoLeadCardDock } from '@/components/orcamento-slides/OrcamentoLeadCardDock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useContratos,
  useContratosRascunhosEmProducao,
  podeGerenciarContratos,
  type Contrato,
  type ContratoStatus,
} from '@/hooks/useContratos';
import { buildAssinaturasCompletas, imprimirContrato } from '@/lib/contratos-print';
import { getContratoNomeExibicao, parseRascunhoCampos } from '@/lib/contrato-rascunho';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { getContratosEmpresaFromContext } from '@/hooks/useContratosEmpresaConfig';
import { useContratosVariaveis } from '@/hooks/useContratosVariaveis';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';

const STATUS_CONFIG: Record<ContratoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho: { label: 'Em produção', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: <Cloud className="h-3 w-3" /> },
  gerado:   { label: 'Gerado',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    icon: <FileText className="h-3 w-3" /> },
  enviado:  { label: 'Enviado',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: <Send className="h-3 w-3" /> },
  assinado: { label: 'Assinado',  color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelado:{ label: 'Cancelado', color: 'bg-red-500/15 text-red-400 border-red-500/30',       icon: <XCircle className="h-3 w-3" /> },
};

const PROXIMOS_STATUS: Record<ContratoStatus, ContratoStatus[]> = {
  rascunho:  [],
  gerado:    ['enviado', 'assinado', 'cancelado'],
  enviado:   ['assinado', 'cancelado'],
  assinado:  ['cancelado'],
  cancelado: ['gerado'],
};

export default function ContratosPage() {
  const { userRole, isSuperAdmin } = useAuth();
  const podeGerenciar = podeGerenciarContratos(userRole, isSuperAdmin);
  const { contratos, isLoading, atualizarStatus, excluirContrato } = useContratos();
  const { data: rascunhos = [], isLoading: loadingRascunhos } = useContratosRascunhosEmProducao();
  const { users } = useUsers();
  const { empresa } = useEmpresa();
  const { variaveis } = useContratosVariaveis();
  const empresaContrato = getContratosEmpresaFromContext(empresa);
  const [busca, setBusca] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<Contrato | null>(null);
  const [novoStatus, setNovoStatus] = useState<ContratoStatus | ''>('');
  const [vincularContrato, setVincularContrato] = useState<Contrato | null>(null);
  const [leadCardDock, setLeadCardDock] = useState<{
    id: number;
    nome?: string;
    open: boolean;
    nonce: number;
  } | null>(null);

  const abrirLeadCard = (leadId: number, leadNome?: string | null, open = true) => {
    setLeadCardDock({
      id: leadId,
      nome: leadNome?.trim() || undefined,
      open,
      nonce: Date.now(),
    });
  };

  const nomeCriador = (criadoPor: string | null) => {
    if (!criadoPor) return 'Usuário';
    return users?.find((u) => u.id === criadoPor)?.nome ?? 'Usuário';
  };

  const termoBusca = busca.trim().toLowerCase();

  const contratoCorrespondeBusca = (c: Contrato) => {
    if (!termoBusca) return true;
    const nomeCliente = getContratoNomeExibicao(c, variaveis).toLowerCase();
    const nomeLead = (c.lead?.nome ?? '').toLowerCase();
    return (
      c.identificador.toLowerCase().includes(termoBusca) ||
      nomeCliente.includes(termoBusca) ||
      nomeLead.includes(termoBusca) ||
      (c.cliente_nome ?? '').toLowerCase().includes(termoBusca)
    );
  };

  const rascunhosFiltrados = rascunhos.filter(contratoCorrespondeBusca);
  const filtrados = contratos.filter(contratoCorrespondeBusca);

  const handleImprimirContrato = (c: Contrato) => {
    const { valores } = parseRascunhoCampos(c.campos_valores ?? {});
    const assinaturas = buildAssinaturasCompletas(valores, variaveis, empresaContrato);
    imprimirContrato({
      conteudo: c.conteudo_final,
      logoUrl: empresa?.logo_url,
      nomeEmpresa: empresaContrato.nomeFantasia,
      razaoSocial: empresaContrato.razaoSocial || empresaContrato.nomeFantasia,
      cnpj: empresaContrato.cnpj,
      assinaturas,
    });
  };

  const handleAtualizarStatus = async () => {
    if (!statusDialog || !novoStatus) return;
    await atualizarStatus.mutateAsync({ id: statusDialog.id, status: novoStatus as ContratoStatus });
    setStatusDialog(null);
    setNovoStatus('');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30">
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            Contratos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {podeGerenciar
              ? 'Contratos do card do lead e do menu Contratos ficam aqui — inclusive rascunhos em produção'
              : 'Histórico de contratos gerados (também os feitos pelo card do lead)'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link to="/contratos/configuracoes">
              <Settings className="h-4 w-4" />
              Configurações
            </Link>
          </Button>
          <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold" asChild>
            <Link to="/contratos/novo">
              <Plus className="h-4 w-4" />
              Novo Contrato
            </Link>
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, lead ou identificador..."
          className="pl-9"
        />
      </div>

      {/* Rascunhos em produção */}
      {podeGerenciar && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-violet-500/20 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold">Em produção</h2>
              {rascunhos.length > 0 && (
                <Badge variant="outline" className="text-violet-400 border-violet-500/40 text-xs">
                  {rascunhos.length}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Atualiza automaticamente enquanto alguém preenche o contrato
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-violet-500/5 hover:bg-violet-500/5">
                <TableHead className="font-semibold">Cliente / Lead</TableHead>
                <TableHead className="font-semibold">Responsável</TableHead>
                <TableHead className="font-semibold">Última alteração</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRascunhos ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rascunhosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum contrato em produção no momento.
                  </TableCell>
                </TableRow>
              ) : (
                rascunhosFiltrados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[280px]">
                      <ContratoIdentificadorCell
                        contrato={r}
                        variaveis={variaveis}
                        ocultarData
                        onAbrirLead={(leadId, leadNome) => abrirLeadCard(leadId, leadNome, true)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nomeCriador(r.criado_por)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
                        asChild
                      >
                        <Link to={`/contratos/novo?rascunho=${r.id}`}>
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tabela — contratos finalizados */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold">Cliente / Lead</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                </TableRow>
              ))
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <FileX className="h-12 w-12 opacity-30" />
                    <p className="text-sm font-medium">
                      {busca ? 'Nenhum contrato encontrado para essa busca.' : 'Nenhum contrato ainda.'}
                    </p>
                    {!busca && (
                      <Button variant="link" className="text-amber-400 h-auto p-0" asChild>
                        <Link to="/contratos/novo">Criar primeiro contrato</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((contrato) => {
                const cfg = STATUS_CONFIG[contrato.status];
                return (
                  <TableRow key={contrato.id} className="group">
                    <TableCell className="max-w-[280px]">
                      <ContratoIdentificadorCell
                        contrato={contrato}
                        variaveis={variaveis}
                        ocultarData
                        onAbrirLead={(leadId, leadNome) => abrirLeadCard(leadId, leadNome, true)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(contrato.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`gap-1.5 text-xs font-medium ${cfg.color}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {podeGerenciar && (
                            <DropdownMenuItem className="gap-2" asChild>
                              <Link to={`/contratos/novo?editar=${contrato.id}`}>
                                <Pencil className="h-4 w-4" />
                                Editar contrato
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => handleImprimirContrato(contrato)}
                          >
                            <Download className="h-4 w-4" />
                            Baixar PDF
                          </DropdownMenuItem>
                          {contrato.lead_id ? (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() =>
                                abrirLeadCard(contrato.lead_id as number, contrato.lead?.nome, true)
                              }
                            >
                              <Contact className="h-4 w-4" />
                              Abrir card do lead
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => setVincularContrato(contrato)}
                          >
                            <Link2 className="h-4 w-4" />
                            {contrato.lead_id ? 'Alterar lead vinculado' : 'Vincular ao lead'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {PROXIMOS_STATUS[contrato.status].map((s) => (
                            <DropdownMenuItem
                              key={s}
                              className="gap-2"
                              onClick={() => {
                                setStatusDialog(contrato);
                                setNovoStatus(s);
                              }}
                            >
                              {STATUS_CONFIG[s].icon}
                              Marcar como {STATUS_CONFIG[s].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-red-400 focus:text-red-400"
                            onClick={() => setDeleteId(contrato.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog alterar status */}
      <Dialog open={!!statusDialog} onOpenChange={(o) => { if (!o) { setStatusDialog(null); setNovoStatus(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar status do contrato</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alterar <span className="font-medium text-foreground">{statusDialog?.cliente_nome}</span> para:
          </p>
          <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as ContratoStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o novo status" />
            </SelectTrigger>
            <SelectContent>
              {statusDialog && PROXIMOS_STATUS[statusDialog.status].map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStatusDialog(null); setNovoStatus(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAtualizarStatus}
              disabled={!novoStatus || atualizarStatus.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contrato será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (deleteId) {
                  excluirContrato.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {vincularContrato && (
        <VincularContratoLeadDialog
          open={!!vincularContrato}
          onOpenChange={(o) => !o && setVincularContrato(null)}
          contratoId={vincularContrato.id}
          contratoLabel={getContratoNomeExibicao(vincularContrato, variaveis)}
        />
      )}

      {leadCardDock && (
        <OrcamentoLeadCardDock
          key={`${leadCardDock.id}-${leadCardDock.nonce}`}
          leadId={leadCardDock.id}
          leadNome={leadCardDock.nome}
          defaultOpen={leadCardDock.open}
          position="fixed"
        />
      )}
    </div>
  );
}
