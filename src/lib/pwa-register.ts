import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

/** Registra o service worker e avisa quando há nova versão do app. */
export function setupPwaServiceWorker(): void {
  const updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      toast.info('CRM disponível offline para consulta básica.');
    },
    onNeedRefresh() {
      toast('Nova versão disponível', {
        description: 'Atualize para usar as últimas melhorias.',
        action: {
          label: 'Atualizar',
          onClick: () => updateSW(true),
        },
        duration: Infinity,
      });
    },
    onRegisterError(error) {
      console.warn('[PWA] Falha ao registrar service worker:', error);
    },
  });
}
