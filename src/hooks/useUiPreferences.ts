import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FloatingAgendaSide = 'left' | 'right';

interface UiPreferences {
  disableMessageNotificationsPopup: boolean;
  hideFloatingPopups: boolean;
  floatingAgendaSide: FloatingAgendaSide;
  minimizeLeadWhatsappHistory: boolean;
}

const defaultPreferences: UiPreferences = {
  disableMessageNotificationsPopup: false,
  hideFloatingPopups: false,
  floatingAgendaSide: 'right',
  minimizeLeadWhatsappHistory: true,
};

export function useUiPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) {
        setPreferences(defaultPreferences);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('crm_multiempresas_ui_preferences')
        .select(
          'disable_message_notifications_popup, hide_floating_popups, floating_agenda_side, minimize_lead_whatsapp_history',
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar preferências de UI:', error);
        setPreferences(defaultPreferences);
        setLoading(false);
        return;
      }

      if (!data) {
        setPreferences(defaultPreferences);
        setLoading(false);
        return;
      }

      setPreferences({
        disableMessageNotificationsPopup: data.disable_message_notifications_popup,
        hideFloatingPopups: data.hide_floating_popups,
        floatingAgendaSide:
          data.floating_agenda_side === 'left' ? 'left' : 'right',
        minimizeLeadWhatsappHistory: data.minimize_lead_whatsapp_history ?? true,
      });
      setLoading(false);
    };

    fetchPreferences();
  }, [user]);

  const updatePreferences = useCallback(
    async (updates: Partial<UiPreferences>) => {
      if (!user) return;

      setPreferences((prev) => ({ ...prev, ...updates }));

      const nextPreferences = {
        disable_message_notifications_popup:
          updates.disableMessageNotificationsPopup ?? preferences.disableMessageNotificationsPopup,
        hide_floating_popups: updates.hideFloatingPopups ?? preferences.hideFloatingPopups,
        floating_agenda_side: updates.floatingAgendaSide ?? preferences.floatingAgendaSide,
        minimize_lead_whatsapp_history:
          updates.minimizeLeadWhatsappHistory ?? preferences.minimizeLeadWhatsappHistory,
      };

      const { error } = await supabase.from('crm_multiempresas_ui_preferences').upsert(
        {
          user_id: user.id,
          ...nextPreferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.error('Erro ao salvar preferências de UI:', error);
      }
    },
    [
      user,
      preferences.disableMessageNotificationsPopup,
      preferences.hideFloatingPopups,
      preferences.floatingAgendaSide,
      preferences.minimizeLeadWhatsappHistory,
    ]
  );

  return {
    preferences,
    loading,
    updatePreferences,
  };
}
