import { useMemo, useState } from 'react';
import { Lead } from '@/types/selletos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toSaoPauloTime } from '@/lib/utils';
import { EditableCardTitle } from './EditableCardTitle';

interface VendorRankingCardProps {
  allLeads: Lead[];
  isLoading: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface VendorStats {
  nome: string;
  vendas: number;
  totalLeads: number;
  taxaConversao: number;
  valor: number;
}

export function VendorRankingCard({
  allLeads,
  isLoading,
  open,
  onOpenChange,
}: VendorRankingCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isVisible = open ?? internalOpen;
  const setIsVisible = onOpenChange ?? setInternalOpen;

  // Calcular ranking de vendedores no mês atual
  const { ranking, monthLabel } = useMemo(() => {
    const now = toSaoPauloTime(new Date());
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const label = format(now, 'MMMM yyyy', { locale: ptBR });

    // Leads que chegaram no mês atual (para calcular conversão)
    const leadsDoMes = allLeads.filter(lead => 
      lead.dateArrived >= monthStart && lead.dateArrived <= monthEnd
    );

    // Agrupar por vendedor
    const vendedoresMap: Record<string, VendorStats> = {};

    // Contar leads por vendedor
    leadsDoMes.forEach(lead => {
      const vendedor = lead.vendor || 'Sem vendedor';
      if (!vendedoresMap[vendedor]) {
        vendedoresMap[vendedor] = {
          nome: vendedor,
          vendas: 0,
          totalLeads: 0,
          taxaConversao: 0,
          valor: 0,
        };
      }
      vendedoresMap[vendedor].totalLeads++;
    });

    // Vendas realizadas no mês
    const vendasDoMes = allLeads.filter(lead => 
      lead.status === 'Venda Realizada (Matriculado)' &&
      lead.saleDate &&
      lead.saleDate >= monthStart &&
      lead.saleDate <= monthEnd
    );

    // Contar vendas por vendedor
    vendasDoMes.forEach(lead => {
      const vendedor = lead.vendor || 'Sem vendedor';
      if (!vendedoresMap[vendedor]) {
        vendedoresMap[vendedor] = {
          nome: vendedor,
          vendas: 0,
          totalLeads: 0,
          taxaConversao: 0,
          valor: 0,
        };
      }
      vendedoresMap[vendedor].vendas++;
      vendedoresMap[vendedor].valor += lead.dealValue || 0;
    });

    // Calcular taxa de conversão e ordenar
    const vendedoresRanking = Object.values(vendedoresMap)
      .map(v => ({
        ...v,
        taxaConversao: v.totalLeads > 0 ? (v.vendas / v.totalLeads) * 100 : 0,
      }))
      .filter(v => v.vendas > 0 || v.totalLeads > 0) // Só mostrar quem tem alguma atividade
      .sort((a, b) => b.vendas - a.vendas || b.taxaConversao - a.taxaConversao);

    return {
      ranking: vendedoresRanking,
      monthLabel: label,
    };
  }, [allLeads]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getConversionColor = (rate: number) => {
    if (rate >= 20) return 'text-success';
    if (rate >= 10) return 'text-amber-500';
    return 'text-destructive';
  };

  const getRankBadgeColor = (position: number) => {
    switch (position) {
      case 1: return 'bg-amber-500 text-white';
      case 2: return 'bg-gray-400 text-white';
      case 3: return 'bg-amber-700 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center p-6">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </Card>
    );
  }

  return (
    <Collapsible open={isVisible} onOpenChange={setIsVisible}>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 p-0">
              <Award className="h-4 w-4 text-amber-500 shrink-0" />
              <EditableCardTitle labelKey="vendor_ranking" variant="section" className="normal-case tracking-normal" />
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              className="gap-1.5 h-7"
            >
              {isVisible ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="text-xs">Ocultar</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span className="text-xs">Mostrar</span>
                </>
              )}
            </Button>
          </div>
          <CardDescription className="text-xs">
            {monthLabel} • {ranking.length} vendedores ativos
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {ranking.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum vendedor com atividade no mês
              </div>
            ) : (
              <div className="space-y-2">
                {ranking.map((vendedor, index) => (
                  <div 
                    key={vendedor.nome}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Posição */}
                    <div 
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getRankBadgeColor(index + 1)}`}
                    >
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-medium">
                        {getInitials(vendedor.nome)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info do vendedor */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {vendedor.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendedor.vendas} {vendedor.vendas === 1 ? 'venda fechada' : 'vendas fechadas'}
                      </p>
                    </div>

                    {/* Taxa de conversão */}
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getConversionColor(vendedor.taxaConversao)}`}>
                        {vendedor.taxaConversao.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">conversão</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
