import { Lead } from '@/types/selletos';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatYMDToBRShort } from '@/lib/utils';

interface LeadsListViewProps {
  leads: Lead[];
  onLeadClick: (leadId: number) => void;
}

export function LeadsListView({ leads, onLeadClick }: LeadsListViewProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Novo Lead': 'bg-primary/10 text-primary',
      'Aula Experimental Marcada': 'bg-warning/10 text-warning',
      'Não Entraram para Aula Experimental': 'bg-destructive/10 text-destructive',
      'Aula Realizada': 'bg-success/10 text-success',
      'Venda Realizada (Matriculado)': 'bg-success/10 text-success',
      'Orçamentos Perdidos': 'bg-muted text-muted-foreground',
      'Clientes Já Cadastrados': 'bg-secondary/10 text-secondary',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">Nome</TableHead>
            <TableHead className="hidden md:table-cell min-w-[180px]">Email</TableHead>
            <TableHead className="hidden sm:table-cell min-w-[120px]">Telefone</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[150px]">Empresa</TableHead>
            <TableHead className="hidden xl:table-cell">Origem</TableHead>
            <TableHead className="hidden md:table-cell">Vendedor</TableHead>
            <TableHead className="min-w-[140px]">Status</TableHead>
            <TableHead className="hidden sm:table-cell">Data</TableHead>
            <TableHead className="text-right min-w-[100px]">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                Nenhum lead encontrado
              </TableCell>
            </TableRow>
          ) : (
            leads.map(lead => (
              <TableRow 
                key={lead.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onLeadClick(lead.id)}
              >
                <TableCell className="font-medium text-sm">
                  <div>{lead.name}</div>
                  <div className="md:hidden text-xs text-muted-foreground mt-1">
                    {lead.email || lead.phone || '-'}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{lead.email || '-'}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm">{lead.phone || '-'}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm">{lead.company || '-'}</TableCell>
                <TableCell className="hidden xl:table-cell text-sm">{lead.origin}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{lead.vendor}</TableCell>
                <TableCell>
                  <Badge className={`${getStatusColor(lead.status)} text-xs whitespace-nowrap`} variant="secondary">
                    {lead.status.length > 20 ? lead.status.substring(0, 20) + '...' : lead.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {formatYMDToBRShort(lead.dateArrived)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  <div>R$ {lead.dealValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="sm:hidden text-xs text-muted-foreground mt-1">
                    {formatYMDToBRShort(lead.dateArrived)}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}