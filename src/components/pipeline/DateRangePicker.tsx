import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn, toSaoPauloTime } from '@/lib/utils';

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (range: DateRange | undefined) => {
    onChange?.(range);
  };

  const presets = [
    { 
      label: 'Hoje', 
      getValue: () => {
        const today = toSaoPauloTime(new Date());
        return { from: today, to: today };
      }
    },
    { 
      label: 'Mês atual', 
      getValue: () => {
        const today = toSaoPauloTime(new Date());
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: toSaoPauloTime(firstDay), to: today };
      }
    },
    { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(toSaoPauloTime(new Date()), 6), to: toSaoPauloTime(new Date()) }) },
    { label: 'Últimos 15 dias', getValue: () => ({ from: subDays(toSaoPauloTime(new Date()), 14), to: toSaoPauloTime(new Date()) }) },
    { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(toSaoPauloTime(new Date()), 29), to: toSaoPauloTime(new Date()) }) },
    { label: 'Últimos 60 dias', getValue: () => ({ from: subDays(toSaoPauloTime(new Date()), 59), to: toSaoPauloTime(new Date()) }) },
    { 
      label: 'Total (tudo)', 
      getValue: () => ({ from: new Date(2020, 0, 1), to: toSaoPauloTime(new Date()) })
    },
  ];

  const formatDateRange = (range?: DateRange) => {
    if (!range?.from) return 'Selecionar período';
    
    if (!range.to) {
      return format(range.from, 'dd/MM/yyyy', { locale: ptBR });
    }

    return `${format(range.from, 'dd/MM', { locale: ptBR })} - ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal w-full sm:w-[280px]",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1 px-2">Períodos rápidos</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => {
                  handleSelect(preset.getValue());
                  setIsOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={value}
              onSelect={handleSelect}
              numberOfMonths={1}
              className="pointer-events-auto"
              locale={ptBR}
              disabled={(date) => date > toSaoPauloTime(new Date())}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
