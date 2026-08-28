import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Kanban, Settings, FileUp, CalendarDays } from 'lucide-react';
import { MarketingKanbanBoard } from '@/components/marketing-conteudo/MarketingKanbanBoard';
import { MarketingSettingsTab } from '@/components/marketing-conteudo/MarketingSettingsTab';
import { MarketingPlanningBoard } from '@/components/marketing-conteudo/MarketingPlanningBoard';
import { MarketingMediasTab } from '@/components/marketing-conteudo/MarketingMediasTab';
import { MarketingCalendarTab } from '@/components/marketing-conteudo/MarketingCalendarTab';
import { isMarketingOnly } from '@/lib/app-roles';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function MarketingConteudo() {
  const { userRoles, isSuperAdmin } = useAuth();
  const isMarketingUser = isMarketingOnly(userRoles, isSuperAdmin);

  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTab = useMemo(() => searchParams.get('tab'), [searchParams]);
  const cardFromUrl = useMemo(() => searchParams.get('card'), [searchParams]);

  const [tabValue, setTabValue] = useState<string>('producao');

  // Se vier com ?card=... ou ?tab=..., garantir que o Tabs abra na aba correta.
  useEffect(() => {
    if (cardFromUrl) {
      setTabValue('producao');
      return;
    }

    if (requestedTab) {
      // aceita alias históricos (kanban/calendario)
      const normalized =
        requestedTab === 'kanban'
          ? 'producao'
          : requestedTab === 'calendario'
            ? 'agendamento'
            : requestedTab;

      setTabValue(normalized);
    }
  }, [cardFromUrl, requestedTab]);

  const handleTabChange = (value: string) => {
    setTabValue(value);
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    // ao trocar de aba manualmente, remover card da URL
    next.delete('card');
    setSearchParams(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-2xl font-bold">Marketing de Conteúdo</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie a produção de conteúdo para redes sociais
        </p>
      </div>

      <Tabs value={tabValue} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 pt-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
              <TabsTrigger value="producao" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                <Kanban className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Conteúdos em</span> Produção
              </TabsTrigger>
              <TabsTrigger value="agendamento" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
                Agendamento
              </TabsTrigger>
              <TabsTrigger value="midias" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                <FileUp className="h-3 w-3 sm:h-4 sm:w-4" />
                Mídias
              </TabsTrigger>
              {/* Esconder configurações para usuários marketing */}
              {!isMarketingUser && (
                <TabsTrigger value="configuracoes" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Configurações e</span> Config.
                </TabsTrigger>
              )}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <TabsContent value="producao" className="flex-1 mt-0">
          <MarketingKanbanBoard />
        </TabsContent>

        <TabsContent value="agendamento" className="flex-1 mt-0 overflow-auto">
          <MarketingCalendarTab />
        </TabsContent>

        <TabsContent value="midias" className="flex-1 mt-0 overflow-auto">
          <MarketingMediasTab />
        </TabsContent>

        {/* Renderizar conteúdo apenas se não for marketing user */}
        {!isMarketingUser && (
          <TabsContent value="configuracoes" className="flex-1 mt-0 overflow-auto">
            <div className="space-y-6">
              <MarketingSettingsTab />
              <div className="px-4">
                <h2 className="text-xl font-semibold mb-4">Lousa de Planejamento</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie nós de planejamento, organize ideias e envie para produção quando estiver pronto.
                </p>
              </div>
              <MarketingPlanningBoard />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}