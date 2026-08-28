import { useState } from 'react';
import { Loader2, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { canManagePontuaGarboFinanceiro } from '@/lib/pontua-garbo-access';
import {
  useCadastrarLeadComoPontuaGarbo,
  usePontuaGarboPartnerBadge,
} from '@/hooks/usePontuaGarboPartnerLeads';
import { LeadPontuaGarboPartnerBadge } from '@/components/leads/LeadPontuaGarboPartnerBadge';
import { EMAIL_FORMATO_INVALIDO, isValidLeadEmail, parseLeadEmail } from '@/lib/lead-email';

interface LeadPontuaGarboContactPanelProps {
  leadId: number | null | undefined;
  nome: string;
  email: string;
  telefone: string;
  className?: string;
}

export function LeadPontuaGarboContactPanel({
  leadId,
  nome,
  email,
  telefone,
  className,
}: LeadPontuaGarboContactPanelProps) {
  const { userRole, isSuperAdmin } = useAuth();
  const canRegister = canManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
  const badge = usePontuaGarboPartnerBadge(leadId);
  const cadastrar = useCadastrarLeadComoPontuaGarbo();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  if (!leadId) return null;

  if (badge) {
    return (
      <div className={cn('sm:col-span-2', className)}>
        <LeadPontuaGarboPartnerBadge badge={badge} variant="modal" />
      </div>
    );
  }

  if (!canRegister) return null;

  const phoneDigits = telefone.replace(/\D/g, '');

  const handleConfirm = async () => {
    const parsed = parseLeadEmail(emailInput || email);
    if (parsed.normalized && parsed.normalized !== emailInput.trim()) {
      setEmailInput(parsed.normalized);
    }
    if (!parsed.normalized || !isValidLeadEmail(parsed.normalized)) {
      toast.error('E-mail inválido', {
        description: EMAIL_FORMATO_INVALIDO,
      });
      return;
    }
    try {
      await cadastrar.mutateAsync({
        leadId,
        nome: nome.trim() || 'Parceiro Pontua Garbo',
        email: parsed.normalized,
        telefone,
      });
      setConfirmOpen(false);
    } catch {
      // O toast de erro já é exibido no onError da mutation.
    }
  };

  return (
    <div className={cn('sm:col-span-2 space-y-2', className)}>
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => {
            setEmailInput(parseLeadEmail(email).normalized);
            setConfirmOpen(true);
          }}
          disabled={cadastrar.isPending}
          className={cn(
            'group relative w-full overflow-hidden rounded-xl border border-gold/30 text-left',
            'bg-gradient-to-r from-gold/12 via-mahogany-elevated/35 to-mahogany-card/20',
            'px-4 py-3 transition-all duration-300',
            'hover:border-gold/55 hover:from-gold/18 hover:shadow-[0_10px_28px_-14px_rgba(242,216,146,0.55)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
            'disabled:opacity-60',
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-mahogany-base/50">
              <Sparkles className="h-5 w-5 text-gold" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm tracking-wide text-gold">
                Cadastrar ou unir no Pontua Garbo
              </p>
              <p className="text-xs text-cream-muted leading-relaxed">
                Se já for arquiteto do programa, une este card ao cadastro. Senão, cria o acesso e marca com a estrelinha.
              </p>
            </div>
            <Star className="h-4 w-4 shrink-0 text-gold/70 transition-transform duration-300 group-hover:rotate-12 group-hover:text-gold" />
          </div>
        </button>
      ) : (
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border border-gold/35',
            'bg-gradient-to-br from-gold/14 via-mahogany-card/45 to-mahogany-elevated/30',
            'p-4 space-y-3',
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
            aria-hidden
          />
          <div>
            <p className="font-display text-sm text-gold">Confirmar cadastro</p>
            <p className="mt-1 text-xs text-cream-muted leading-relaxed">
              {nome.trim() || 'Este lead'} entra no Pontua Garbo. Se ele já tiver cadastro, só unimos o card.
              {phoneDigits
                ? ` Se for cadastro novo, a senha inicial é o telefone (${phoneDigits}).`
                : ' Se for cadastro novo, informe o e-mail e depois defina a senha em Admin.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pontua-garbo-email" className="text-xs">
              E-mail de acesso (só se for cadastro novo)
            </Label>
            <Input
              id="pontua-garbo-email"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
              placeholder="email@exemplo.com"
              className="border-gold-border-subtle/40"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={cadastrar.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={cadastrar.isPending}
              className="bg-gold text-mahogany-base hover:bg-gold/90"
            >
              {cadastrar.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Star className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  Confirmar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
