import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import { useSaquePedidosAdmin } from '@/hooks/useSaquePedidos';

const PUBLIC_SAQUES = 'CRM-multi-empresas>prestador_saque_pedidos<' as const;

/** Alerta global de saques pendentes para administradores (popup + ícone no header). */
export function useSaquePedidosAdminAlert() {
  const { user, userRole, isSuperAdmin } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const qc = useQueryClient();
  const isFinanceAdmin = userRole === 'admin' || isSuperAdmin;

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const prevPendingCountRef = useRef<number | null>(null);
  const userDismissedRef = useRef(false);

  const admin = useSaquePedidosAdmin(isFinanceAdmin && queriesReady);
  const pendentesCount = admin.pendentes.length;

  const realtimeSchema = isSchemaApiExposed(schemaEmpresa) ? schemaEmpresa! : 'public';
  const realtimeTable = isSchemaApiExposed(schemaEmpresa) ? 'prestador_saque_pedidos' : PUBLIC_SAQUES;

  useEffect(() => {
    if (!user?.id || !isFinanceAdmin || !queriesReady) return;

    const channel = supabase
      .channel(`saque-pedidos-admin-${schemaEmpresa ?? 'master'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: realtimeSchema, table: realtimeTable },
        () => {
          qc.invalidateQueries({ queryKey: ['saque-pedidos-admin', schemaEmpresa] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isFinanceAdmin, queriesReady, schemaEmpresa, realtimeSchema, realtimeTable, qc]);

  useEffect(() => {
    if (!isFinanceAdmin) return;

    const prev = prevPendingCountRef.current;

    if (pendentesCount > 0 && prev !== null && pendentesCount > prev) {
      userDismissedRef.current = false;
    }

    if (pendentesCount > 0) {
      if (!userDismissedRef.current) {
        setIsPopupOpen(true);
      }
    } else {
      setIsPopupOpen(false);
      userDismissedRef.current = false;
    }

    prevPendingCountRef.current = pendentesCount;
  }, [pendentesCount, isFinanceAdmin]);

  const openPopup = useCallback(() => {
    userDismissedRef.current = false;
    setIsPopupOpen(true);
  }, []);

  const closePopup = useCallback(() => {
    userDismissedRef.current = true;
    setIsPopupOpen(false);
  }, []);

  return {
    enabled: isFinanceAdmin,
    isPopupOpen,
    openPopup,
    closePopup,
    pendentesCount,
    ...admin,
  };
}
