import { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarketingGastos, MktFonte, MktSubFonte } from '@/hooks/useMarketingGastos';
import { FonteCard } from '@/components/controle-gastos/FonteCard';
import { CreateFonteDialog } from '@/components/controle-gastos/CreateFonteDialog';
import { SubFonteSheet } from '@/components/controle-gastos/SubFonteSheet';
import { SpreadsheetView } from '@/components/controle-gastos/SpreadsheetView';

export default function ControleGastos() {
  const { fontes, subFontes, colunas, loading, fetchLancamentos } = useMarketingGastos();
  
  const [createFonteOpen, setCreateFonteOpen] = useState(false);
  const [selectedFonte, setSelectedFonte] = useState<MktFonte | null>(null);
  const [selectedSubFonte, setSelectedSubFonte] = useState<MktSubFonte | null>(null);

  // Handler para voltar à lista de fontes
  const handleBackToFontes = () => {
    setSelectedSubFonte(null);
    setSelectedFonte(null);
  };

  // Handler para selecionar uma fonte
  const handleSelectFonte = (fonte: MktFonte) => {
    setSelectedFonte(fonte);
  };

  // Handler para selecionar uma sub-fonte
  const handleSelectSubFonte = async (subFonte: MktSubFonte) => {
    setSelectedSubFonte(subFonte);
    // Carregar lançamentos para as colunas desta sub-fonte
    const subFonteColunas = colunas.filter(c => c.sub_fonte_id === subFonte.id);
    if (subFonteColunas.length > 0) {
      await fetchLancamentos(subFonteColunas.map(c => c.id));
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  // Vista de planilha para sub-fonte selecionada
  if (selectedSubFonte) {
    return (
      <SpreadsheetView
        subFonte={selectedSubFonte}
        fonte={selectedFonte!}
        onBack={handleBackToFontes}
      />
    );
  }

  // Vista de sub-fontes para fonte selecionada
  if (selectedFonte) {
    return (
      <SubFonteSheet
        fonte={selectedFonte}
        onBack={handleBackToFontes}
        onSelectSubFonte={handleSelectSubFonte}
      />
    );
  }

  // Vista principal - Lista de fontes
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
              <Wallet className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Controle de Gastos</h1>
              <p className="text-muted-foreground text-sm">
                Gerencie seus investimentos em marketing de forma inteligente
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateFonteOpen(true)} className="gap-2 shadow-lg">
            <Plus className="h-4 w-4" />
            Nova Fonte
          </Button>
        </div>
      </div>

      {/* Lista de Fontes */}
      <div className="flex-1 px-6 py-6 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Suas Fontes de Investimento
          </h2>
        </div>

        {fontes.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Wallet className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma fonte cadastrada</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Comece adicionando suas fontes de investimento em marketing como Google Ads, Meta Ads, TikTok, etc.
              </p>
              <Button onClick={() => setCreateFonteOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeira Fonte
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fontes.map(fonte => (
              <FonteCard
                key={fonte.id}
                fonte={fonte}
                subFontesCount={subFontes.filter(sf => sf.fonte_id === fonte.id).length}
                onClick={() => handleSelectFonte(fonte)}
              />
            ))}
            
            {/* Card para adicionar nova fonte */}
            <Card 
              className="border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
              onClick={() => setCreateFonteOpen(true)}
            >
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] py-8">
                <div className="p-3 rounded-full bg-muted group-hover:bg-primary/10 transition-colors mb-3">
                  <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-muted-foreground group-hover:text-primary font-medium transition-colors">
                  Adicionar Fonte
                </span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateFonteDialog 
        open={createFonteOpen} 
        onOpenChange={setCreateFonteOpen} 
      />
    </div>
  );
}
