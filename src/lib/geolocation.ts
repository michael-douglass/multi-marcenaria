export interface UserLocationResult {
  latitude?: number;
  longitude?: number;
  erro?: string;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permissão de localização negada pelo navegador';
    case error.POSITION_UNAVAILABLE:
      return 'Localização indisponível no momento';
    case error.TIMEOUT:
      return 'Tempo esgotado ao obter localização';
    default:
      return 'Localização não disponível';
  }
}

/**
 * Tenta obter a localização do usuário de forma silenciosa.
 * Falhas não bloqueiam o fluxo — retorna apenas um objeto com `erro` amigável.
 */
export function captureUserLocation(): Promise<UserLocationResult | null> {
  if (!navigator.geolocation) {
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
        resolve({ erro: getGeolocationErrorMessage(error) });
      },
      GEOLOCATION_OPTIONS,
    );
  });
}
