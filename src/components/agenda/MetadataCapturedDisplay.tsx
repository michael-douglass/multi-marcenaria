import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, Smartphone, Monitor, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { MetadataCapturada } from '@/hooks/useAgenda';
import { cn } from '@/lib/utils';

interface MetadataCapturedDisplayProps {
  metadata: MetadataCapturada;
  showSeparator?: boolean;
}

function formatLocationError(erro?: string): string {
  if (!erro) return 'Não disponível';
  if (erro.includes('googleapis') || erro.includes('403')) {
    return 'Localização indisponível no momento';
  }
  return erro;
}

/**
 * Detecta o tipo de dispositivo baseado nas dimensões da tela
 */
function detectDeviceType(screenDimensions?: string): { type: 'mobile' | 'tablet' | 'desktop'; label: string } {
  if (!screenDimensions) {
    return { type: 'desktop', label: 'Computador' };
  }

  const match = screenDimensions.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (!match) {
    return { type: 'desktop', label: 'Computador' };
  }

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);

  if (minDimension <= 480 || (minDimension <= 768 && maxDimension <= 1024)) {
    return { type: 'mobile', label: 'Celular' };
  }

  if (minDimension <= 1024 && maxDimension <= 1366) {
    return { type: 'tablet', label: 'Tablet' };
  }

  return { type: 'desktop', label: 'Computador' };
}

function formatDeviceInfo(dispositivo: MetadataCapturada['dispositivo']): {
  friendlyName: string;
  icon: 'mobile' | 'desktop';
  details: string[];
} {
  if (!dispositivo) {
    return { friendlyName: 'Desconhecido', icon: 'desktop', details: [] };
  }

  const device = detectDeviceType(dispositivo.tela);
  const details: string[] = [];

  if (dispositivo.plataforma) {
    const plataforma = dispositivo.plataforma.toLowerCase();
    let plataformaFriendly = dispositivo.plataforma;

    if (plataforma.includes('win')) plataformaFriendly = 'Windows';
    else if (plataforma.includes('mac')) plataformaFriendly = 'macOS';
    else if (plataforma.includes('linux')) plataformaFriendly = 'Linux';
    else if (plataforma.includes('android')) plataformaFriendly = 'Android';
    else if (plataforma.includes('iphone') || plataforma.includes('ios')) plataformaFriendly = 'iOS (iPhone)';
    else if (plataforma.includes('ipad')) plataformaFriendly = 'iPadOS';

    details.push(`Sistema: ${plataformaFriendly}`);
  }

  if (dispositivo.idioma) {
    const idioma = dispositivo.idioma.split('-')[0].toUpperCase();
    const idiomaMap: Record<string, string> = {
      PT: 'Português',
      EN: 'Inglês',
      ES: 'Espanhol',
      FR: 'Francês',
      DE: 'Alemão',
    };
    details.push(`Idioma: ${idiomaMap[idioma] || dispositivo.idioma}`);
  }

  if (dispositivo.tela) {
    details.push(`Resolução: ${dispositivo.tela}`);
  }

  return {
    friendlyName: device.label,
    icon: device.type === 'mobile' || device.type === 'tablet' ? 'mobile' : 'desktop',
    details,
  };
}

function useReverseGeocode(lat?: number, lng?: number) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lat || !lng) {
      setAddress(null);
      return;
    }

    const fetchAddress = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'pt-BR,pt',
              'User-Agent': 'CRM-Selletos/1.0',
            },
          },
        );

        if (!response.ok) {
          throw new Error('Erro ao buscar endereço');
        }

        const data = await response.json();

        if (data.address) {
          const addr = data.address;
          const parts: string[] = [];

          if (addr.road) parts.push(addr.road);
          if (addr.house_number) parts[parts.length - 1] += `, ${addr.house_number}`;
          if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
          if (addr.city || addr.town || addr.municipality) {
            parts.push(addr.city || addr.town || addr.municipality);
          }
          if (addr.state) parts.push(addr.state);

          setAddress(parts.join(' - ') || data.display_name);
        } else {
          setAddress(data.display_name || 'Endereço não encontrado');
        }
      } catch (err) {
        console.error('Erro ao buscar endereço:', err);
        setError('Não foi possível obter o endereço');
      } finally {
        setLoading(false);
      }
    };

    fetchAddress();
  }, [lat, lng]);

  return { address, loading, error };
}

function MetadataRow({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#c9b8a8]/90 bg-white px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide text-[#5c4034]">{label}</span>
      </div>
      <div className="pl-6 text-sm font-semibold text-[#1a100c] leading-relaxed">{children}</div>
    </div>
  );
}

export function MetadataCapturedDisplay({ metadata, showSeparator = true }: MetadataCapturedDisplayProps) {
  const { address, loading: addressLoading, error: addressError } = useReverseGeocode(
    metadata.localizacao?.latitude,
    metadata.localizacao?.longitude,
  );

  const deviceInfo = formatDeviceInfo(metadata.dispositivo);

  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-[#1a100c]">
          <Smartphone className="h-4 w-4 text-[#c45c26]" />
          Informações Capturadas pelo Sistema
        </h4>
        <div
          className={cn(
            'space-y-2.5 rounded-xl border border-[#a89080] bg-[#fffaf6] p-3.5 text-sm',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_10px_rgba(26,16,12,0.08)]',
          )}
        >
          {metadata.hora_marcacao && (
            <MetadataRow
              label="Hora da marcação"
              icon={<Clock className="h-4 w-4 text-[#c45c26] shrink-0" />}
            >
              {format(
                typeof metadata.hora_marcacao === 'string'
                  ? parseISO(metadata.hora_marcacao)
                  : new Date(metadata.hora_marcacao),
                "dd/MM/yyyy 'às' HH:mm:ss",
                { locale: ptBR },
              )}
            </MetadataRow>
          )}

          {metadata.dispositivo && (
            <MetadataRow
              label="Dispositivo"
              icon={
                deviceInfo.icon === 'mobile' ? (
                  <Smartphone className="h-4 w-4 text-[#c45c26] shrink-0" />
                ) : (
                  <Monitor className="h-4 w-4 text-[#c45c26] shrink-0" />
                )
              }
            >
              <span>{deviceInfo.friendlyName}</span>
              {deviceInfo.details.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs font-medium text-[#4a3228]">
                  {deviceInfo.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </MetadataRow>
          )}

          {metadata.localizacao && (
            <MetadataRow
              label="Localização"
              icon={<MapPin className="h-4 w-4 text-[#c45c26] shrink-0" />}
            >
              {metadata.localizacao.latitude ? (
                <div className="space-y-1.5">
                  {addressLoading ? (
                    <div className="flex items-center gap-2 text-xs font-medium text-[#4a3228]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c45c26]" />
                      <span>Buscando endereço...</span>
                    </div>
                  ) : address ? (
                    <p className="text-sm font-semibold text-[#1a100c]">{address}</p>
                  ) : addressError ? (
                    <p className="text-xs font-medium text-[#4a3228]">{addressError}</p>
                  ) : null}

                  <a
                    href={`https://www.google.com/maps?q=${metadata.localizacao.latitude},${metadata.localizacao.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#c45c26] hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    Ver no mapa
                  </a>
                </div>
              ) : (
                <span className="text-sm font-medium text-[#4a3228]">
                  {formatLocationError(metadata.localizacao.erro)}
                </span>
              )}
            </MetadataRow>
          )}
        </div>
      </div>
    </>
  );
}
