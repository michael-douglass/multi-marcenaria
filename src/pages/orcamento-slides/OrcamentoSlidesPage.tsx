import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Presentation,
  Plus,
  Search,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  MoreHorizontal,
  Send,
  CheckCircle2,
  Cloud,
  Link2,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useOrcamentoSlides } from '@/hooks/useOrcamentoSlides';
import { useAuth } from '@/contexts/AuthContext';
import type { OrcamentoSlide, OrcamentoSlideStatus } from '@/lib/orcamento-slide-types';
import { withOrcamentoReturnTo } from '@/lib/orcamento-slide-navigation';
import { isLinkPublicoAtivo, linkPublicoOrcamento } from '@/lib/orcamento-slide-public-link';

const STATUS_CONFIG: Record<OrcamentoSlideStatus, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho: { label: 'Rascunho', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: <Cloud className="h-3 w-3" /> },
  pronto:   { label: 'Pronto',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    icon: <CheckCircle2 className="h-3 w-3" /> },
  enviado:  { label: 'Enviado',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: <Send className="h-3 w-3" /> },
};

export default function OrcamentoSlidesPage() {
  const navigate = useNavigate();
  const { userRole, isSuperAdmin } = useAuth();
  const { schemaEmpresa } = useEmpresa();
  const isAdmin = userRole === 'admin' || isSuperAdmin;
  const { orcamentos, isLoading, excluirOrcamento, atualizarStatus, atualizarLinkPublico } = useOrcamentoSlides();
  const [busca, setBusca] = useState('');
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const getLinkPublico = (id: string) => linkPublicoOrcamento(schemaEmpresa ?? 'public', id);

  const copiarLink = (orcamento: OrcamentoSlide) => {
    navigator.clipboard.writeText(getLinkPublico(orcamento.id))
      .then(() => toast.success('Link copiado!', {
        description: isLinkPublicoAtivo(orcamento)
          ? 'Compartilhe com o cliente — qualquer pessoa com o link pode ver.'
          : 'O link está oculto. Ative-o antes de compartilhar.',
      }))
      .catch(() => toast.error('Erro ao copiar link'));
  };

  const alternarLinkPublico = (orcamento: OrcamentoSlide) => {
    atualizarLinkPublico.mutate({
      id: orcamento.id,
      dados: orcamento.dados,
      lead_id: orcamento.lead_id,
      oculto: isLinkPublicoAtivo(orcamento),
    });
  };

  const filtrados = orcamentos.filter((o) => {
    const t = busca.toLowerCase();
    return (
      o.cliente_nome.toLowerCase().includes(t) ||
      o.identificador.toLowerCase().includes(t)
    );
  });

  const handleExcluir = () => {
    if (!excluirId) return;
    excluirOrcamento.mutate(excluirId, { onSuccess: () => setExcluirId(null) });
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Presentation className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Slides de Orçamento</h1>
            <p className="text-sm text-muted-foreground">
              {orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/orcamento-slides/configuracoes">
                <Settings className="h-4 w-4 mr-1.5" />
                Configurações
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link to={withOrcamentoReturnTo('/orcamento-slides/novo?novo=1', '/orcamento-slides')}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo orçamento
            </Link>
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por cliente ou identificador..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identificador</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  {busca ? 'Nenhum orçamento encontrado.' : 'Nenhum orçamento criado ainda.'}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((o) => (
                <OrcamentoRow
                  key={o.id}
                  orcamento={o}
                  onExcluir={() => setExcluirId(o.id)}
                  onStatusChange={(status) => atualizarStatus.mutate({ id: o.id, status })}
                  onApresentar={() => navigate(`/orcamento-slides/${o.id}/apresentar`)}
                  onEditar={() =>
                    navigate(withOrcamentoReturnTo(`/orcamento-slides/${o.id}/editar`, '/orcamento-slides'))
                  }
                  onCopiarLink={() => copiarLink(o)}
                  onAlternarLinkPublico={() => alternarLinkPublico(o)}
                  linkPublicoAtivo={isLinkPublicoAtivo(o)}
                  alternandoLink={atualizarLinkPublico.isPending}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluirId} onOpenChange={(open) => !open && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O orçamento e suas mídias serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleExcluir}
              disabled={excluirOrcamento.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrcamentoRow({
  orcamento,
  onExcluir,
  onStatusChange,
  onApresentar,
  onEditar,
  onCopiarLink,
  onAlternarLinkPublico,
  linkPublicoAtivo,
  alternandoLink,
}: {
  orcamento: OrcamentoSlide;
  onExcluir: () => void;
  onStatusChange: (status: OrcamentoSlideStatus) => void;
  onApresentar: () => void;
  onEditar: () => void;
  onCopiarLink: () => void;
  onAlternarLinkPublico: () => void;
  linkPublicoAtivo: boolean;
  alternandoLink: boolean;
}) {
  const cfg = STATUS_CONFIG[orcamento.status];

  return (
    <TableRow className="group">
      <TableCell className="font-mono text-sm">{orcamento.identificador}</TableCell>
      <TableCell className="font-medium">{orcamento.cliente_nome || '—'}</TableCell>
      <TableCell>
        <Badge className={`${cfg.color} gap-1 border text-xs`} variant="outline">
          {cfg.icon}
          {cfg.label}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(orcamento.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={onApresentar} className="gap-1 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Ver
          </Button>
          <Button size="sm" variant="ghost" onClick={onEditar} className="gap-1 text-xs">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopiarLink}
            className="gap-1 text-xs text-amber-400 hover:text-amber-300"
            title="Copiar link para enviar ao cliente"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Link</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onAlternarLinkPublico}
            disabled={alternandoLink}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            title={linkPublicoAtivo ? 'Ocultar link público' : 'Ativar link público'}
          >
            {linkPublicoAtivo ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ocultar</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mostrar</span>
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onApresentar}>
                <Eye className="h-4 w-4 mr-2" />
                Apresentar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEditar}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopiarLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar link do cliente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAlternarLinkPublico} disabled={alternandoLink}>
                {linkPublicoAtivo ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar link público
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Ativar link público
                  </>
                )}
              </DropdownMenuItem>
              {orcamento.status !== 'pronto' && (
                <DropdownMenuItem onClick={() => onStatusChange('pronto')}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Marcar como Pronto
                </DropdownMenuItem>
              )}
              {orcamento.status !== 'enviado' && (
                <DropdownMenuItem onClick={() => onStatusChange('enviado')}>
                  <Send className="h-4 w-4 mr-2" />
                  Marcar como Enviado
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={onExcluir}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
