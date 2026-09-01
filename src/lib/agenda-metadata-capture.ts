import type { AgendaConfig, MetadataCapturada } from '@/hooks/useAgenda';
import { captureUserLocation, type UserLocationResult } from '@/lib/geolocation';

export interface AgendaMetadataCaptureOptions {
  /** Localização já pedida no toque do botão (o iPhone recusa pedido automático ao abrir a tela). */
  prefetchedLocation?: UserLocationResult | null;
}

function isCaptureEnabled(flag: boolean | undefined | null): boolean {
  return flag !== false;
}

/** Monta metadados do lead conforme flags salvas na configuração da agenda. */
export async function buildAgendaMetadataCapturada(
  config: Pick<
    AgendaConfig,
    'capturar_dispositivo' | 'capturar_hora_marcacao' | 'capturar_localizacao'
  > | null | undefined,
  options?: AgendaMetadataCaptureOptions,
): Promise<MetadataCapturada> {
  const metadata: MetadataCapturada = {};

  if (isCaptureEnabled(config?.capturar_dispositivo)) {
    metadata.dispositivo = {
      userAgent: navigator.userAgent,
      plataforma: navigator.platform,
      idioma: navigator.language,
      tela: `${window.screen.width}x${window.screen.height}`,
    };
  }

  if (isCaptureEnabled(config?.capturar_hora_marcacao)) {
    metadata.hora_marcacao = new Date().toISOString();
  }

  if (isCaptureEnabled(config?.capturar_localizacao)) {
    const locationResult =
      options?.prefetchedLocation ?? (await captureUserLocation());
    if (locationResult) {
      metadata.localizacao = locationResult;
    }
  }

  return metadata;
}

export function hasMetadataCapturada(metadata: MetadataCapturada | null | undefined): boolean {
  if (!metadata) return false;
  return Object.keys(metadata).length > 0;
}
