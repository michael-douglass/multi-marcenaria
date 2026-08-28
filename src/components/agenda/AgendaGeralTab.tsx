import { AgendaGeralContent } from './AgendaGeralContent';

export type { AgendaEvent } from '@/hooks/useAgendaGeral';

interface AgendaGeralTabProps {
  onSelectedDateChange?: (date: Date) => void;
}

export function AgendaGeralTab({ onSelectedDateChange }: AgendaGeralTabProps) {
  return <AgendaGeralContent onSelectedDateChange={onSelectedDateChange} />;
}
