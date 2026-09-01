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
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading'>('idle');

  useEffect(() => {
    if (open) return;
    setEndereco('');
    setGeoStatus('idle');
  }, [open]);

  const handleStart = async () => {
    setGeoStatus('loading');
    const result = await captureUserLocation();
    const lat = result?.latitude;
    const lng = result?.longitude;
    let enderecoFinal = endereco.trim();

    if (lat != null && lng != null && !enderecoFinal) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'pt-BR' } },
        );
        const data = (await res.json()) as { display_name?: string };
        if (data?.display_name) enderecoFinal = data.display_name;
      } catch {
        // Endereço digitado (ou vazio) segue valendo.
      }
    }

    onStart(enderecoFinal || undefined, lat, lng);
    setEndereco('');
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
            <p className="mt-1 text-xs text-muted-foreground">
              Ao tocar em Iniciar serviço, o celular pode pedir permissão de localização. Toque em Permitir.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Horário de entrada será registrado automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleStart()}
            disabled={geoStatus === 'loading'}
            className="w-full bg-emerald-500 hover:bg-emerald-600"
          >
            {geoStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Iniciar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
