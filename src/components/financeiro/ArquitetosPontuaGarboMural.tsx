import { useState } from 'react';
import { Award, Loader2, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArquitetoContatoDialog } from '@/components/financeiro/ArquitetoContatoDialog';
import type { PrestadorFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import {
  formatBRLPontua,
  iniciaisNomeArquiteto,
  labelDesdeCadastro,
  tituloReconhecidoPontuaGarbo,
} from '@/lib/pontua-garbo-arquiteto';
import { cn } from '@/lib/utils';
import { finArquitetoSeal, finTextTertiary } from '@/components/financeiro/financeiro-styles';

const muralCss = `
@keyframes pontua-arquiteto-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.pontua-arquiteto-enter {
  animation: pontua-arquiteto-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .pontua-arquiteto-enter { animation: none !important; }
}
`;

interface ArquitetosPontuaGarboMuralProps {
  arquitetos: PrestadorFinanceiro[];
  totalCadastrados: number;
  isLoading: boolean;
  busca: string;
  onBuscaChange: (value: string) => void;
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
}

export function ArquitetosPontuaGarboMural({
  arquitetos,
  totalCadastrados,
  isLoading,
  busca,
  onBuscaChange,
  selecionadoId,
  onSelecionar,
}: ArquitetosPontuaGarboMuralProps) {
  const [contatoId, setContatoId] = useState<string | null>(null);
  const arquitetoContato = arquitetos.find((item) => item.id === contatoId) ?? null;

  const handleAbrirContato = (id: string) => {
    setContatoId(id);
    onSelecionar(id);
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#f2d892]/25 bg-gradient-to-br from-[#1a100c] via-[#2a1812] to-[#3d2418] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-7"
      aria-labelledby="mural-arquitetos-titulo"
    >
      <style>{muralCss}</style>
      <div className="pointer-events-none absolute inset-0 grain-overlay opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(242,216,146,0.18) 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f2d892]/80">
              Programa Pontua Garbo
            </p>
            <h2
              id="mural-arquitetos-titulo"
              className="mt-1 font-display text-3xl italic leading-tight text-[#fffaf4] sm:text-4xl"
            >
              Arquitetos reconhecidos
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[#edd9c4]">
              Todo profissional cadastrado no Pontua Garbo aparece aqui, com nome e título.
              Clique no cartão para ver nome completo e telefone.
            </p>
          </div>

          <div className="w-full shrink-0 sm:max-w-xs">
            <Label htmlFor="busca-arquiteto" className="sr-only">
              Buscar arquiteto pelo nome ou e-mail
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f2d892]/70" />
              <Input
                id="busca-arquiteto"
                value={busca}
                onChange={(e) => onBuscaChange(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="border-[#f2d892]/25 bg-black/25 pl-9 text-[#fffaf4] placeholder:text-[#d4bc9f]/70"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[#d4bc9f]">
            <Loader2 className="h-4 w-4 animate-spin text-[#f2d892]" />
            Carregando arquitetos cadastrados…
          </div>
        ) : arquitetos.length === 0 ? (
          <p className={`text-sm ${finTextTertiary}`}>
            {totalCadastrados === 0
              ? 'Nenhum arquiteto cadastrado no Pontua Garbo ainda.'
              : 'Nenhum arquiteto encontrado com esse nome.'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {arquitetos.map((arquiteto, index) => {
              const titulo = tituloReconhecidoPontuaGarbo(arquiteto.titulo);
              const desde = labelDesdeCadastro(arquiteto.criadoEm);
              const isSelected = selecionadoId === arquiteto.id;
              return (
                <li
                  key={arquiteto.id}
                  className="pontua-arquiteto-enter"
                  style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => handleAbrirContato(arquiteto.id)}
                    aria-pressed={isSelected}
                    aria-label={`Ver dados de ${arquiteto.nome}`}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors motion-safe:transition-transform motion-safe:hover:-translate-y-0.5',
                      isSelected
                        ? 'border-[#f2d892]/70 bg-[#f2d892]/15 ring-1 ring-[#f2d892]/35'
                        : 'border-[#f2d892]/18 bg-black/25 hover:border-[#f2d892]/45 hover:bg-black/40',
                    )}
                  >
                    <Avatar className="h-12 w-12 shrink-0 ring-2 ring-[#f2d892]/40">
                      {arquiteto.avatarUrl && (
                        <AvatarImage src={arquiteto.avatarUrl} alt="" />
                      )}
                      <AvatarFallback className="bg-[#3d2418] font-display text-sm text-[#f2d892]">
                        {iniciaisNomeArquiteto(arquiteto.nome)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display text-lg leading-tight text-[#fffaf4]">
                          {arquiteto.nome}
                        </p>
                        <Award className="h-3.5 w-3.5 shrink-0 text-[#f2d892]" aria-hidden />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={finArquitetoSeal}>{titulo}</span>
                        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                          Reconhecido
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[#d4bc9f]">
                        {desde ?? 'Cadastrado no programa'}
                        {arquiteto.saldoParaSacar > 0
                          ? ` · saldo ${formatBRLPontua(arquiteto.saldoParaSacar)}`
                          : ''}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ArquitetoContatoDialog
        arquiteto={arquitetoContato}
        open={contatoId !== null}
        onOpenChange={(open) => {
          if (!open) setContatoId(null);
        }}
      />
    </section>
  );
}
