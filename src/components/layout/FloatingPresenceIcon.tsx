import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FloatingPresenceIconProps {
  count: number;
  onClick: () => void;
}

export function FloatingPresenceIcon({ count, onClick }: FloatingPresenceIconProps) {
  return (
    <button
      onClick={onClick}
      className="relative z-50 p-3 rounded-full shadow-lg bg-emerald-500 hover:bg-emerald-600 transition-all hover:scale-105 animate-in fade-in zoom-in duration-300"
      title={`${count} usuário${count !== 1 ? 's' : ''} online`}
    >
      <div className="relative">
        <Users className="h-5 w-5 text-white" />
        {count > 0 && (
          <span className="absolute -top-3 -right-3 bg-white text-emerald-600 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
            {count}
          </span>
        )}
      </div>
    </button>
  );
}
