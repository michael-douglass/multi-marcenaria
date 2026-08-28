import { useState, useEffect } from 'react';
import { MapPin, Play, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { captureUserLocation } from '@/lib/geolocation';

interface StartServiceDialogProps {
  open: boolean;
  onStart: (endereco?: string, latitude?: number, longitude?: number) => void;
}

export function StartServiceDialog({ open, onStart }: StartServiceDialogProps) {
  const [endereco, setEndereco] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [geoStatus, setGeoStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');

  useEffect(() => {
    if (!open) return;
    setGeoStatus('loading');

    let cancelled = false;

    captureUserLocation().then(async (result) => {
      if (cancelled) return;

      if (!result?.latitude || !result?.longitude) {
        setGeoStatus('error');
        return;
      }

      const lat = result.latitude;
      const lng = result.longitude;
      setLatitude(lat);
      setLongitude(lng);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'pt-BR' } },
        );
        const data = await res.json();
        if (data?.display_name) {
          setEndereco(data.display_name);
        }
        setGeoStatus('success');
      } catch {
        setGeoStatus('success');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleStart = () => {
    onStart(endereco || undefined, latitude, longitude);
    setEndereco('');
    setLatitude(undefined);
    setLongitude(undefined);
    setGeoStatus('idle');
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-emerald-500" />
            Dar início no serviço
          </DialogTitle>
          <DialogDescription>
            Registre sua entrada no sistema. Horário atual: <strong>{format(new Date(), "HH:mm - dd/MM/yyyy", { locale: ptBR })}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="endereco" className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Endereço (opcional)
            </Label>
            <Input
              id="endereco"
              placeholder="Ex.: Rua X, 123"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="mt-1"
            />
            {geoStatus === 'loading' && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Obtendo localização automaticamente...
              </p>
            )}
            {geoStatus === 'error' && (
              <p className="text-xs text-amber-600 mt-1">
                Não foi possível obter a localização. Você pode digitar o endereço manualmente.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Horário de entrada será registrado automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleStart} className="w-full bg-emerald-500 hover:bg-emerald-600">
            <Play className="h-4 w-4 mr-2" />
            Iniciar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
