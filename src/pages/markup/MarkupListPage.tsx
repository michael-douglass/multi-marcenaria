import { useMemo, useState } from 'react';
import { Calculator, Loader2, Search, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useMarkupOrcamentos } from '@/hooks/useMarkupOrcamentos';
import { correspondeBuscaFlexivel } from '@/lib/markup-busca';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MarkupListPage() {
  const { userRole, isSuperAdmin } = useAuth();
  const { orcamentos, isLoading } = useMarkupOrcamentos();
  const [busca, setBusca] = useState('');

  const orcamentosFiltrados = useMemo(() => {
    const termo = busca.trim();
    if (!termo) return orcamentos;

    return orcamentos.filter((o) => {
      const texto = [o.titulo, o.lead_id != null ? String(o.lead_id) : '', o.status]
        .filter(Boolean)
        .join(' ');
      return correspondeBuscaFlexivel(texto, termo);
    });
  }, [orcamentos, busca]);

  if (userRole === 'marketing') {
    return (
      <div className="p-8 text-center text-muted-foreground">Acesso restrito.</div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Markups
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Orçamentos de custo interno vinculados aos leads
          </p>
        </div>
        {(userRole === 'admin' || isSuperAdmin) && (
          <Button variant="outline" asChild>
            <Link to="/markup/configuracoes">
              <Settings className="h-4 w-4 mr-1" />
              Configurações
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Todos os markups</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, lead ou status..."
              className="pl-9"
              aria-label="Buscar markups"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orcamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum markup salvo. Abra um card de lead e use a calculadora.
            </p>
          ) : orcamentosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum markup encontrado para “{busca.trim()}”.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Lead ID</TableHead>
                  <TableHead className="text-right">Preço final</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamentosFiltrados.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.titulo}</TableCell>
                    <TableCell>{o.lead_id ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatarMoedaMarkup(o.preco_final)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.atualizado_em
                        ? format(new Date(o.atualizado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{o.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
