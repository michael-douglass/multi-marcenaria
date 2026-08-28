import { useEffect, useRef, useState, type RefObject } from 'react';
import { Trophy, Wallet, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';
import {
  formatBRL,
  GARBO_PONTUA_DEMO,
  labelComissaoStatus,
} from './garbo-pontua-demo-data';
import { GarboPontuaPointsScene } from './GarboPontuaPointsScene';
import { useGarboPontuaScroll } from './use-garbo-pontua-scroll';

interface GarboApresentacaoPontuaGarboProps {
  scrollerRef: RefObject<HTMLElement | null>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  emphasize,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
  color: string;
  emphasize?: boolean;
}) {
  return (
    <div
      data-pontua-reveal
      className={cn(
        'flex flex-col gap-2 rounded-2xl border p-5',
        emphasize && 'sm:col-span-2 sm:p-6',
      )}
      style={{
        background: 'rgba(255,250,244,0.03)',
        borderColor: 'rgba(242,216,146,0.14)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={emphasize ? 16 : 13} style={{ color }} aria-hidden />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'rgba(255,250,244,0.38)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
        >
          {label}
        </span>
      </div>
      <p
        className={cn('font-light tracking-wide', emphasize ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl')}
        style={{ color, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
      >
        {formatBRL(value)}
      </p>
    </div>
  );
}

/**
 * Capítulo final da apresentação: demonstra o Pontua Garbo com dados fictícios
 * para o arquiteto entender o programa de pontuação/comissão.
 */
export function GarboApresentacaoPontuaGarbo({ scrollerRef }: GarboApresentacaoPontuaGarboProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [sceneActive, setSceneActive] = useState(false);

  useGarboPontuaScroll({ scrollerRef, rootRef, enabled: true });

  useEffect(() => {
    const scroller = scrollerRef.current;
    const root = rootRef.current;
    if (!scroller || !root) return;

    const intro = root.querySelector('#pontua-garbo');
    if (!intro) return;

    const obs = new IntersectionObserver(
      ([entry]) => setSceneActive(Boolean(entry?.isIntersecting)),
      { root: scroller, threshold: 0.15 },
    );
    obs.observe(intro);
    return () => obs.disconnect();
  }, [scrollerRef]);

  const { parceiro, metricas, ganhosPorMes, passos, comissoes, saques } = GARBO_PONTUA_DEMO;
  const maxBar = Math.max(...ganhosPorMes.map((m) => m.valor), 1);

  return (
    <section ref={rootRef} className="relative w-full" aria-label="Programa de Pontuação Garbo">
      {/* ── Intro + Three.js ── */}
      <div
        id="pontua-garbo"
        data-garbo-section="pontua-garbo"
        className="relative isolate flex min-h-[100dvh] w-full snap-start snap-always flex-col justify-center overflow-hidden px-6 py-16 sm:px-10"
        style={{ background: GARBO_APRESENTACAO_THEME.bgBase }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 70% 55% at 70% 40%, rgba(242,216,146,0.1), transparent 60%),
              linear-gradient(180deg, #0a0908 0%, #14100c 55%, #0a0908 100%)
            `,
          }}
        />

        <GarboPontuaPointsScene
          active={sceneActive}
          className="pointer-events-none absolute inset-y-0 right-0 z-0 w-full opacity-70 sm:w-[58%] sm:opacity-90"
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div className="max-w-xl">
            <p
              data-pontua-reveal
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
            >
              {GARBO_PONTUA_DEMO.eyebrow}
            </p>
            <h2
              data-pontua-reveal
              className="mb-4 text-[clamp(2rem,5vw,3.35rem)] font-light leading-[1.12] tracking-tight"
              style={{
                color: GARBO_APRESENTACAO_THEME.textPrimary,
                fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
                textShadow: GARBO_APRESENTACAO_THEME.textShadowTitle,
              }}
            >
              {GARBO_PONTUA_DEMO.title}
            </h2>
            <p
              data-pontua-reveal
              className="mb-6 max-w-md text-base leading-relaxed sm:text-lg"
              style={{
                color: GARBO_APRESENTACAO_THEME.textMuted,
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                textShadow: GARBO_APRESENTACAO_THEME.textShadowBody,
              }}
            >
              {GARBO_PONTUA_DEMO.subtitle}
            </p>
            <div
              data-pontua-reveal
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: 'rgba(242,216,146,0.35)',
                color: GARBO_APRESENTACAO_THEME.goldMuted,
                background: 'rgba(242,216,146,0.08)',
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {GARBO_PONTUA_DEMO.badge}
            </div>
          </div>

          <div
            data-pontua-reveal
            className="rounded-2xl border p-5 backdrop-blur-md sm:p-6"
            style={{
              borderColor: 'rgba(242,216,146,0.18)',
              background: 'rgba(10,9,8,0.55)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            <p
              className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'rgba(255,250,244,0.4)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
            >
              Parceiro (exemplo)
            </p>
            <p
              className="text-2xl font-light"
              style={{ color: GARBO_APRESENTACAO_THEME.textPrimary, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
            >
              {parceiro.nome}
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: GARBO_APRESENTACAO_THEME.textMuted, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
            >
              {parceiro.escritorio} · {parceiro.cidade}
            </p>
            <div
              className="mt-5 flex items-end justify-between border-t pt-4"
              style={{ borderColor: 'rgba(242,216,146,0.12)' }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'rgba(255,250,244,0.35)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                >
                  Comissão do programa
                </p>
                <p
                  className="text-4xl font-light"
                  style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
                >
                  {parceiro.percentual}%
                </p>
              </div>
              <Trophy className="mb-1 h-8 w-8" style={{ color: GARBO_APRESENTACAO_THEME.gold }} aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {/* ── Como funciona ── */}
      <div
        id="pontua-passos"
        data-garbo-section="pontua-passos"
        className="relative flex min-h-[100dvh] w-full snap-start snap-always flex-col justify-center overflow-hidden px-6 py-16 sm:px-10"
        style={{ background: GARBO_APRESENTACAO_THEME.bgMogno }}
      >
        <div className="mx-auto w-full max-w-5xl">
          <p
            data-pontua-reveal
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
          >
            Como funciona
          </p>
          <h3
            data-pontua-reveal
            className="mb-10 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-light leading-tight"
            style={{ color: GARBO_APRESENTACAO_THEME.textPrimary, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
          >
            Três passos do projeto ao PIX
          </h3>

          <ol className="grid gap-5 md:grid-cols-3">
            {passos.map((passo) => (
              <li
                key={passo.step}
                data-pontua-step
                className="rounded-2xl border p-6"
                style={{
                  borderColor: 'rgba(242,216,146,0.16)',
                  background: 'rgba(10,9,8,0.45)',
                }}
              >
                <span
                  className="mb-4 block text-sm font-semibold tracking-[0.2em]"
                  style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                >
                  {passo.step}
                </span>
                <h4
                  className="mb-2 text-xl font-light"
                  style={{ color: GARBO_APRESENTACAO_THEME.textPrimary, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
                >
                  {passo.title}
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: GARBO_APRESENTACAO_THEME.textMuted, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                >
                  {passo.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Painel demo ── */}
      <div
        id="pontua-painel"
        data-garbo-section="pontua-painel"
        className="relative flex min-h-[100dvh] w-full snap-start snap-always flex-col justify-center overflow-hidden px-6 py-16 sm:px-10"
        style={{ background: GARBO_APRESENTACAO_THEME.bgBase }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 20% 20%, rgba(242,216,146,0.07), transparent 55%)',
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div>
            <div className="mb-4 h-px w-10 bg-amber-400/30" />
            <h3
              data-pontua-reveal
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-wide"
              style={{ color: GARBO_APRESENTACAO_THEME.textPrimary, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
            >
              Painel do parceiro
            </h3>
            <p
              data-pontua-reveal
              className="mt-2 max-w-xl text-sm"
              style={{ color: 'rgba(255,250,244,0.45)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
            >
              Simulação do que o arquiteto vê no programa — saldo, histórico e pedidos de saque.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricCard icon={TrendingUp} label="A ganhar" value={metricas.aGanar} color="#f2d892" />
            <MetricCard
              icon={Wallet}
              label="Para sacar"
              value={metricas.paraSacar}
              color="#4ade80"
              emphasize
            />
            <MetricCard icon={Trophy} label="Retirado" value={metricas.retirado} color="rgba(255,250,244,0.4)" />
          </div>

          <p
            data-pontua-reveal
            className="text-xs"
            style={{ color: 'rgba(240,210,140,0.85)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
          >
            {formatBRL(metricas.aguardandoLiberacao)} de vendas concluídas aguardam liberação do administrador
            antes de entrar em &quot;Para sacar&quot;.
          </p>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div
              data-pontua-chart
              data-pontua-reveal
              className="rounded-2xl border p-5"
              style={{
                borderColor: 'rgba(242,216,146,0.14)',
                background: 'rgba(255,250,244,0.03)',
              }}
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'rgba(255,250,244,0.35)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                  >
                    Ganhos por mês
                  </p>
                  <p
                    className="text-2xl font-light"
                    style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
                  >
                    {formatBRL(metricas.totalComissaoGanha)}
                  </p>
                </div>
                <p
                  className="text-xs"
                  style={{ color: 'rgba(255,250,244,0.4)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                >
                  Média {formatBRL(metricas.mediaMensalGanhos)} / mês
                </p>
              </div>

              <div className="flex h-40 items-end gap-2 sm:gap-3">
                {ganhosPorMes.map((mes) => (
                  <div key={mes.key} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end justify-center">
                      <div
                        data-pontua-chart-bar
                        className="w-full max-w-[2.5rem] rounded-t-md origin-bottom"
                        style={{
                          height: `${(mes.valor / maxBar) * 100}%`,
                          background: 'linear-gradient(180deg, #f2d892 0%, rgba(242,216,146,0.35) 100%)',
                          minHeight: 8,
                        }}
                        title={formatBRL(mes.valor)}
                      />
                    </div>
                    <span
                      className="text-[10px]"
                      style={{ color: 'rgba(255,250,244,0.4)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                    >
                      {mes.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {comissoes.map((item) => {
                const status = labelComissaoStatus(item.status);
                return (
                  <div
                    key={item.id}
                    data-pontua-meter
                    data-pontua-reveal
                    data-value={String(item.comissao)}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: 'rgba(242,216,146,0.12)',
                      background: 'rgba(255,250,244,0.025)',
                    }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: GARBO_APRESENTACAO_THEME.textPrimary, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                        >
                          {item.projeto}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: 'rgba(255,250,244,0.4)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                        >
                          {item.cliente} · venda {formatBRL(item.valorVenda)}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ color: status.color, background: `${status.color}22` }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p
                        className="text-lg font-light"
                        style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay }}
                      >
                        {formatBRL(item.comissao)}
                      </p>
                      <span
                        className="text-[10px]"
                        style={{ color: 'rgba(255,250,244,0.35)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                      >
                        {item.data}
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ background: 'rgba(255,250,244,0.06)' }}
                    >
                      <div
                        data-pontua-meter-bar
                        className="h-full rounded-full origin-left transition-transform duration-1000 ease-out"
                        style={{
                          background: status.color,
                          width: `${Math.min(100, Math.max(12, (item.comissao / 9000) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div data-pontua-reveal>
            <p
              className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'rgba(255,250,244,0.35)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
            >
              Pedidos de saque (exemplo)
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {saques.map((saque) => {
                const isOk = saque.status === 'aprovado';
                return (
                  <div
                    key={saque.id}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                    style={{
                      borderColor: 'rgba(242,216,146,0.12)',
                      background: 'rgba(255,250,244,0.025)',
                    }}
                  >
                    <div>
                      <p
                        className="text-base font-light"
                        style={{
                          color: isOk ? '#4ade80' : '#f2d892',
                          fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
                        }}
                      >
                        {formatBRL(saque.valor)}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: 'rgba(255,250,244,0.35)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                      >
                        {saque.data}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        color: isOk ? '#4ade80' : '#f2d892',
                        fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                      }}
                    >
                      {isOk ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p
            data-pontua-reveal
            className="text-center text-sm italic"
            style={{
              color: GARBO_APRESENTACAO_THEME.goldMuted,
              fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
            }}
          >
            Parceria com clareza: cada indicação vira pontuação — e a pontuação vira resultado.
          </p>
        </div>
      </div>
    </section>
  );
}
