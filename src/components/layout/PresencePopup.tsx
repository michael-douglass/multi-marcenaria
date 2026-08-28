import { useState } from 'react';
import { X, Users, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineUser } from '@/hooks/useOnlineUsers';
import { floatingPopupBesideIconsClass } from '@/lib/floating-ui-layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PresencePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onlineUsers: OnlineUser[];
}

interface SessionHistory {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  started_at: string;
  ended_at: string | null;
  endereco: string | null;
}

export function PresencePopup({ isOpen, onClose, onlineUsers }: PresencePopupProps) {
  const [days, setDays] = useState(7);

  const { data: sessionHistory = [] } = useQuery({
    queryKey: ['presence-history', days],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const { data: sessions, error } = await supabase
        .from('CRM-multi-empresas>presence_sessions<')
        .select('id, user_id, started_at, ended_at, endereco')
        .gte('started_at', cutoff.toISOString())
        .order('started_at', { ascending: false })
        .limit(100);

      if (error || !sessions) return [];

      const userIds = [...new Set(sessions.map(s => s.user_id))];
      const { data: users } = await supabase
        .from('CRM-multi-empresas>usuarios<')
        .select('id, nome, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      return sessions.map(s => ({
        id: s.id,
        user_id: s.user_id,
        user_name: userMap.get(s.user_id)?.nome || 'Desconhecido',
        avatar_url: userMap.get(s.user_id)?.avatar_url || null,
        started_at: s.started_at,
        ended_at: s.ended_at,
        endereco: s.endereco,
      })) as SessionHistory[];
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const getDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const mins = differenceInMinutes(endDate, startDate);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) return `${hours}h ${remainingMins}min`;
    return `${remainingMins}min`;
  };

  return (
    <Card className={`${floatingPopupBesideIconsClass} w-96 shadow-2xl border-emerald-200 animate-in slide-in-from-right-5 duration-300`}>
      <div className="flex items-center justify-between p-4 border-b bg-emerald-50/50">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          <h3 className="font-semibold text-foreground">Usuários Online</h3>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            {onlineUsers.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="online">
        <TabsList className="grid w-full grid-cols-2 m-2 mb-0" style={{ width: 'calc(100% - 16px)' }}>
          <TabsTrigger value="online">Online agora</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="online" className="m-0">
          <ScrollArea className="h-[350px]">
            {onlineUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum usuário online</p>
              </div>
            ) : (
              <div className="divide-y p-2">
                {onlineUsers.map(u => (
                  <div key={u.session_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                    <div className="relative">
                      <UserAvatar user={{ name: u.user_name, avatarUrl: u.avatar_url || undefined }} size="sm" />
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.user_name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Desde {format(new Date(u.started_at), 'HH:mm', { locale: ptBR })}</span>
                        <span>· {getDuration(u.started_at, null)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="m-0">
          <div className="flex gap-1 p-2 pb-0">
            {[7, 30].map(d => (
              <Button
                key={d}
                variant={days === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDays(d)}
                className="text-xs"
              >
                {d} dias
              </Button>
            ))}
          </div>
          <ScrollArea className="h-[320px]">
            {sessionHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum registro</p>
              </div>
            ) : (
              <div className="divide-y p-2">
                {sessionHistory.map(s => (
                  <div key={s.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={{ name: s.user_name, avatarUrl: s.avatar_url || undefined }} size="sm" />
                        <span className="text-sm font-medium">{s.user_name}</span>
                      </div>
                      <Badge variant={s.ended_at ? 'secondary' : 'default'} className={!s.ended_at ? 'bg-emerald-500' : ''}>
                        {s.ended_at ? getDuration(s.started_at, s.ended_at) : 'Online'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-8">
                      <Clock className="h-3 w-3" />
                      <span>
                        {format(new Date(s.started_at), 'dd/MM HH:mm')}
                        {s.ended_at && ` → ${format(new Date(s.ended_at), 'HH:mm')}`}
                      </span>
                    </div>
                    {s.endereco && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-8">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{s.endereco}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
