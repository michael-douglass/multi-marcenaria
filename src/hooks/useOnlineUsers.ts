import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OnlineUser {
  session_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  started_at: string;
  last_heartbeat_at: string;
}

export function useOnlineUsers() {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const queryClient = useQueryClient();

  const { data: onlineUsers = [], isLoading } = useQuery({
    queryKey: ['online-users'],
    queryFn: async () => {
      // Sessions where last_heartbeat_at is within the last 2 minutes and ended_at is null
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const { data: sessions, error } = await supabase
        .from('CRM-multi-empresas>presence_sessions<')
        .select('id, user_id, started_at, last_heartbeat_at')
        .is('ended_at', null)
        .gte('last_heartbeat_at', twoMinutesAgo);

      if (error || !sessions) return [];

      // Fetch user names
      const userIds = [...new Set(sessions.map(s => s.user_id))];
      if (userIds.length === 0) return [];

      const { data: users } = await supabase
        .from('CRM-multi-empresas>usuarios<')
        .select('id, nome, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      return sessions.map(s => ({
        session_id: s.id,
        user_id: s.user_id,
        user_name: userMap.get(s.user_id)?.nome || 'Desconhecido',
        avatar_url: userMap.get(s.user_id)?.avatar_url || null,
        started_at: s.started_at,
        last_heartbeat_at: s.last_heartbeat_at,
      })) as OnlineUser[];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('online-users-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'CRM-multi-empresas>presence_sessions<',
        },
        () => {
          // Invalidate and refetch on any change (new session, heartbeat update, session end)
          queryClient.invalidateQueries({ queryKey: ['online-users'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);

  return { onlineUsers, isLoading, count: onlineUsers.length };
}
