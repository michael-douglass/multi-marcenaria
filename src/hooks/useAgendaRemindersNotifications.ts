import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadLembrete } from '@/hooks/useLeadLembretes';
import type { TarefaPessoal } from '@/hooks/useAgendaPessoal';
import {
  type AgendaReminderNotificationItem,
  markReminderDismissed,
  mergeDueReminders,
} from '@/lib/agenda-reminder-notifications';

const POLL_INTERVAL_MS = 30_000;

function showBrowserNotification(item: AgendaReminderNotificationItem): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const label = item.kind === 'lembrete' ? 'Lembrete de lead' : 'Agenda pessoal';
  const body =
    item.kind === 'lembrete' && item.lembrete?.lead?.nome
      ? `${item.lembrete.lead.nome} — ${item.titulo}`
      : item.titulo;

  try {
    new Notification(label, {
      body,
      tag: item.key,
      icon: '/favicon.ico',
    });
  } catch {
    // Notificações nativas indisponíveis neste contexto
  }
}

interface UseAgendaRemindersNotificationsOptions {
  lembretes: LeadLembrete[];
  tarefas: TarefaPessoal[];
  enabled?: boolean;
}

export function useAgendaRemindersNotifications({
  lembretes,
  tarefas,
  enabled = true,
}: UseAgendaRemindersNotificationsOptions) {
  const { user } = useAuth();
  const [activeItems, setActiveItems] = useState<AgendaReminderNotificationItem[]>([]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const permissionRequestedRef = useRef(false);

  const syncDueItems = useCallback(() => {
    if (!enabled || !user?.id) {
      setActiveItems([]);
      return;
    }

    const due = mergeDueReminders(lembretes, tarefas, user.id);

    for (const item of due) {
      if (notifiedKeysRef.current.has(item.key)) continue;
      notifiedKeysRef.current.add(item.key);
      showBrowserNotification(item);
    }

    setActiveItems(due);
  }, [enabled, user?.id, lembretes, tarefas]);

  useEffect(() => {
    if (!enabled || permissionRequestedRef.current) return;
    if (typeof Notification === 'undefined') return;

    permissionRequestedRef.current = true;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [enabled]);

  useEffect(() => {
    syncDueItems();
    if (!enabled || !user?.id) return;

    const interval = window.setInterval(syncDueItems, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [syncDueItems, enabled, user?.id]);

  const dismissItem = useCallback((key: string) => {
    markReminderDismissed(key);
    setActiveItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const dismissAll = useCallback(() => {
    setActiveItems((prev) => {
      for (const item of prev) markReminderDismissed(item.key);
      return [];
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setActiveItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  return {
    activeItems,
    dismissItem,
    dismissAll,
    removeItem,
    hasActiveItems: activeItems.length > 0,
  };
}
