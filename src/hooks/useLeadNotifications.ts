import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function useLeadNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('lead-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'CRM-multi-empresas>leads<'
        },
        (payload) => {
          // Mostrar notificação animada
          toast.success('🎉 Ebaaa! Mais um lead foi cadastrado!', {
            duration: 1000,
            position: 'top-center',
            style: {
              background: '#10b981',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              border: '2px solid #059669',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
