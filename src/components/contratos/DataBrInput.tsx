import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  formatDataBrMask,
  parseBRToYMD,
  valorDataParaExibicaoBR,
} from '@/lib/utils';

interface DataBrInputProps {
  value: string;
  onChange: (isoYmd: string) => void;
  disabled?: boolean;
}

/** Campo de data no padrão brasileiro: dia / mês / ano (dd/mm/aaaa). */
export function DataBrInput({ value, onChange, disabled }: DataBrInputProps) {
  const [display, setDisplay] = useState(() => valorDataParaExibicaoBR(value));

  useEffect(() => {
    setDisplay(valorDataParaExibicaoBR(value));
  }, [value]);

  return (
    <Input
      value={display}
      disabled={disabled}
      onChange={(e) => {
        const masked = formatDataBrMask(e.target.value);
        setDisplay(masked);
        if (masked.length === 10) {
          const iso = parseBRToYMD(masked);
          if (iso) onChange(iso);
        } else if (masked.length === 0) {
          onChange('');
        }
      }}
      onBlur={() => {
        if (display.length === 0) {
          onChange('');
          return;
        }
        if (display.length === 10) {
          const iso = parseBRToYMD(display);
          if (iso) {
            onChange(iso);
            setDisplay(valorDataParaExibicaoBR(iso));
          } else {
            setDisplay(valorDataParaExibicaoBR(value));
          }
        } else {
          setDisplay(valorDataParaExibicaoBR(value));
        }
      }}
      placeholder="dd/mm/aaaa"
      maxLength={10}
      inputMode="numeric"
      autoComplete="off"
    />
  );
}
