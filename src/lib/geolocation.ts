export interface UserLocationResult {
  latitude?: number;
  longitude?: number;
  erro?: string;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

/** Leitura recente vale: bater ponto não precisa de GPS novo a cada segundo. */
const PONTO_GEO_MAX_AGE_MS = 120_000;
const PONTO_GEO_WAIT_MS = 30_000;

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function readGeolocationErrorCode(error: unknown): number | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'number') return code;
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/denied/i.test(message)) return 1;
  if (/unavailable/i.test(message)) return 2;
  if (/timeout/i.test(message)) return 3;
  return null;
}

/**
 * Traduz o erro cru do navegador ("User denied Geolocation") para um texto
 * que a pessoa consegue seguir no celular.
 */
export function formatGeolocationError(error: unknown): string {
  if (error instanceof Error && !('code' in error) && error.message && !/denied|unavailable|timeout/i.test(error.message)) {
    return error.message;
  }

  const code = readGeolocationErrorCode(error);
  const peloAppNaTelaInicial = isStandalonePwa();

  switch (code) {
    case 1:
      return peloAppNaTelaInicial
        ? 'O celular bloqueou a localização deste aplicativo. No iPhone: Ajustes → GARBO → Localização → Ao Usar. No Android: toque no cadeado ao lado do endereço → Permissões → Localização → Permitir. Depois volte e toque de novo em Permitir localização.'
        : 'O celular bloqueou a localização deste site. No iPhone: Ajustes → Safari → Localização → Permitir (e Confirme que Serviços de Localização estão ligados). No Android: toque no cadeado ao lado do endereço → Permissões → Localização → Permitir. Depois volte e toque de novo em Permitir localização.';
    case 2:
      return 'Não encontramos sua posição agora. Ligue o GPS, espere alguns segundos e toque de novo em Permitir localização.';
    case 3:
      return 'Demorou demais para achar sua posição. Ligue o GPS e toque de novo em Permitir localização.';
    default:
      return 'Não foi possível obter sua localização. Ligue o GPS e toque de novo em Permitir localização.';
  }
}

export function isGeolocationPermissionDenied(message: string): boolean {
  return /bloqueou a localização|permissão de localização|localização está bloqueada/i.test(
    message,
  );
}

/**
 * Tenta obter a localização do usuário de forma silenciosa.
 * Falhas não bloqueiam o fluxo — retorna apenas um objeto com `erro` amigável.
 */
export function captureUserLocation(): Promise<UserLocationResult | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ erro: 'Geolocalização não suportada neste navegador' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        resolve({ erro: formatGeolocationError(error) });
      },
      GEOLOCATION_OPTIONS,
    );
  });
}

/**
 * Pede a localização no mesmo instante do toque (sem segunda tentativa depois).
 * No iPhone, um segundo pedido fora do toque vira "User denied Geolocation"
 * mesmo quando a pessoa tocou em Permitir.
 */
export function requestGeolocation(timeoutMs = PONTO_GEO_WAIT_MS): Promise<GeoPosition> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return Promise.reject(
      new Error(
        'A localização só funciona em conexão segura. Abra o sistema pelo endereço oficial (https), não por um link inseguro.',
      ),
    );
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Este aparelho não oferece localização neste navegador.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let watchId: number | null = null;
    let timer = 0;

    const cleanup = () => {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timer) window.clearTimeout(timer);
    };

    const succeed = (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(formatGeolocationError(error)));
    };

    // Sem `timeout` nas opções do GPS: no iPhone o Safari às vezes trata
    // tempo esgotado como se a pessoa tivesse recusado a permissão.
    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: PONTO_GEO_MAX_AGE_MS,
    };

    try {
      navigator.geolocation.getCurrentPosition(succeed, (err) => {
        if (err.code === err.PERMISSION_DENIED) fail(err);
      }, options);
      watchId = navigator.geolocation.watchPosition(succeed, fail, options);
    } catch (error) {
      fail(error);
      return;
    }

    timer = window.setTimeout(() => {
      fail(
        new Error(
          'Não deu tempo de achar sua posição. Ligue o GPS, espere um pouco ao ar livre se puder, e toque de novo em Permitir localização.',
        ),
      );
    }, timeoutMs);
  });
}
