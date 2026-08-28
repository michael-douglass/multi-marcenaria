import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { MASTER_TABLES } from '@/lib/empresa-tables';

interface UsoConfig {
  inatividade_minutos: number;
  ausencia_alerta_minutos: number;
  repetir_alerta_minutos: number;
}

export function usePresenceTracking() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const db = useEmpresaSupabase();
  const table = useTableName();
  // Presença/ponto ficam no schema public (sessões globais do projeto)
  const presenceTable = MASTER_TABLES.presence_sessions;
  const pontoTable = MASTER_TABLES.ponto_registros;
  const usoConfigTable = MASTER_TABLES.uso_config;
  const tables = {
    usuarios: table('usuarios', MASTER_TABLES.usuarios),
    user_roles: table('user_roles', MASTER_TABLES.user_roles),
    notifications: table('notifications', MASTER_TABLES.notifications),
  };
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absenceAlertRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const accessTokenRef = useRef<string | null>(null);
  const [showStartService, setShowStartService] = useState(false);
  const [showInactivityCheck, setShowInactivityCheck] = useState(false);
  const inactivityShownAtRef = useRef<number | null>(null);
  const initDoneRef = useRef(false);
  const isVendedorRef = useRef(false);

  // Fetch uso_config
  const { data: usoConfig } = useQuery({
    queryKey: ['uso-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(usoConfigTable)
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as UsoConfig | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const inactivityMinutes = usoConfig?.inatividade_minutos ?? 5;
  const absenceAlertMinutes = usoConfig?.ausencia_alerta_minutos ?? 2;
  const repeatAlertMinutes = usoConfig?.repetir_alerta_minutos ?? 5;

  const isVendedor = userRole === 'vendedor';
  isVendedorRef.current = isVendedor;

  // Check if user already has an active session today
  const checkTodaySession = useCallback(async () => {
    if (!user?.id) return false;
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from(presenceTable)
      .select('id')
      .eq('user_id', user.id)
      .gte('started_at', `${today}T00:00:00`)
      .is('ended_at', null)
      .limit(1);
    
    if (data && data.length > 0) {
      sessionIdRef.current = data[0].id;
      return true;
    }
    return false;
  }, [user?.id]);

  // Create a presence session silently (for all users on app load)
  const createPresenceSession = useCallback(async (endereco?: string) => {
    if (!user?.id) return;
    // Prevent duplicate: check again
    const hasSession = await checkTodaySession();
    if (hasSession) return;

    const { data, error } = await supabase
      .from(presenceTable)
      .insert({
        user_id: user.id,
        endereco: endereco || null,
      })
      .select('id')
      .single();

    if (!error && data) {
      sessionIdRef.current = data.id;
      queryClient.invalidateQueries({ queryKey: ['online-users'] });
    }
  }, [user?.id, queryClient, checkTodaySession]);

  // Start a session (vendedor flow with ponto)
  const startSession = useCallback(async (endereco?: string, latitude?: number, longitude?: number) => {
    if (!user?.id) return;
    
    // Avoid duplicate session
    if (sessionIdRef.current) {
      setShowStartService(false);
      return;
    }

    const hasSession = await checkTodaySession();
    if (hasSession) {
      setShowStartService(false);
      return;
    }

    const { data, error } = await supabase
      .from(presenceTable)
      .insert({
        user_id: user.id,
        endereco: endereco || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      })
      .select('id')
      .single();

    if (!error && data) {
      sessionIdRef.current = data.id;
      // Register ponto only for vendedor
      await supabase.from(pontoTable).insert({
        user_id: user.id,
        tipo: 'entrada',
        endereco: endereco || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ['online-users'] });
    }
    setShowStartService(false);
  }, [user?.id, queryClient, checkTodaySession]);

  // Heartbeat
  const doHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || !user?.id) return;
    const now = Date.now();
    // Throttle: at most once every 30s
    if (now - lastHeartbeatRef.current < 30000) return;
    lastHeartbeatRef.current = now;

    try {
      await supabase
        .from(presenceTable)
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    } catch {
      // Falha de rede/CORS não deve travar a interface
    }
  }, [user?.id]);

  // Send absence alert to admins
  const sendAbsenceAlert = useCallback(async () => {
    if (!user?.id) return;
    const { data: userData } = await db
      .from(tables.usuarios)
      .select('nome')
      .eq('id', user.id)
      .single();

    const vendorName = userData?.nome || 'Vendedor';

    const { data: adminRoles } = await db
      .from(tables.user_roles)
      .select('user_id')
      .eq('role', 'admin');

    if (adminRoles) {
      for (const admin of adminRoles) {
        await db.from(tables.notifications).insert({
          user_id: admin.user_id,
          notification_type: 'vendedor_ausente',
          message: `O vendedor ${vendorName} está ausente há ${absenceAlertMinutes} minutos`,
          vendor_name: vendorName,
        });
      }
    }
  }, [user?.id, absenceAlertMinutes]);

  // Reset inactivity timer (vendedor only)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (absenceAlertRef.current) {
      clearInterval(absenceAlertRef.current);
      absenceAlertRef.current = null;
    }
    setShowInactivityCheck(false);
    inactivityShownAtRef.current = null;

    inactivityRef.current = setTimeout(() => {
      setShowInactivityCheck(true);
      inactivityShownAtRef.current = Date.now();

      const absenceTimeout = setTimeout(() => {
        sendAbsenceAlert();
        absenceAlertRef.current = setInterval(() => {
          sendAbsenceAlert();
        }, repeatAlertMinutes * 60 * 1000);
      }, absenceAlertMinutes * 60 * 1000);

      absenceAlertRef.current = absenceTimeout as any;
    }, inactivityMinutes * 60 * 1000);
  }, [inactivityMinutes, absenceAlertMinutes, repeatAlertMinutes, sendAbsenceAlert]);

  // Handle "Sim, estou aqui"
  const confirmPresence = useCallback(() => {
    setShowInactivityCheck(false);
    inactivityShownAtRef.current = null;
    if (absenceAlertRef.current) {
      clearInterval(absenceAlertRef.current);
      clearTimeout(absenceAlertRef.current as any);
      absenceAlertRef.current = null;
    }
    lastHeartbeatRef.current = 0; // force next heartbeat
    doHeartbeat();
    resetInactivityTimer();
  }, [doHeartbeat, resetInactivityTimer]);

  // End session on logout / unmount
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || !user?.id) return;
    try {
      await supabase
        .from(presenceTable)
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    } catch {
      /* ignore */
    }

    if (isVendedor) {
      await supabase.from(pontoTable).insert({
        user_id: user.id,
        tipo: 'saida',
      });
    }

    sessionIdRef.current = null;
    queryClient.invalidateQueries({ queryKey: ['online-users'] });
  }, [user?.id, queryClient, isVendedor]);

  // Keep access token ref updated for use in beforeunload
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    // Also set it immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initialize for ALL logged-in users
  useEffect(() => {
    if (!user?.id || !userRole) return;
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const currentIsVendedor = userRole === 'vendedor';

    const init = async () => {
      const hasSession = await checkTodaySession();

      if (!hasSession) {
        if (currentIsVendedor) {
          setShowStartService(true);
          await createPresenceSession();
        } else {
          await createPresenceSession();
        }
      }

      if (currentIsVendedor) {
        resetInactivityTimer();
      }
    };
    init();

    // Activity listeners: heartbeat on any activity (throttled to 30s)
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handleActivity = () => {
      if (sessionIdRef.current) {
        doHeartbeat();
        if (isVendedorRef.current && !inactivityShownAtRef.current) {
          resetInactivityTimer();
        }
      }
    };
    activityEvents.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    // End session on beforeunload
    const handleUnload = () => {
      if (sessionIdRef.current && user?.id) {
        const token = accessTokenRef.current || import.meta.env.VITE_SUPABASE_ANON_KEY;
        const presencePath = encodeURIComponent(presenceTable);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${presencePath}` +
          `?id=eq.${sessionIdRef.current}`;
        const headers = {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        };
        const body = JSON.stringify({ ended_at: new Date().toISOString() });
        try {
          fetch(url, {
            method: 'PATCH',
            headers,
            body,
            keepalive: true,
          });
        } catch {
          // Silenciar erro no unload
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (absenceAlertRef.current) {
        clearInterval(absenceAlertRef.current);
        clearTimeout(absenceAlertRef.current as any);
      }
      activityEvents.forEach(e => window.removeEventListener(e, handleActivity));
      window.removeEventListener('beforeunload', handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole]);

  return {
    showStartService,
    showInactivityCheck,
    startSession,
    confirmPresence,
    endSession,
    setShowStartService,
    myActiveSession: sessionIdRef.current,
  };
}
