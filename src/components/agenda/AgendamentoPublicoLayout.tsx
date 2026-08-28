import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { hasAgendaCustomBanner, resolveAgendaBannerUrl } from '@/lib/agenda-layout';
import type { AgendaConfig } from '@/hooks/useAgenda';
import { resolveAgendaPublicSubtitle } from '@/lib/agenda-public-text';
import { resolveBrandLogo, resolveBrandName } from '@/lib/app-branding';

interface AgendamentoPublicoLayoutProps {
  config: AgendaConfig;
  step: 'date' | 'time' | 'form' | 'success';
  empresaLogoUrl?: string | null;
  empresaNome?: string | null;
  children: ReactNode;
}

export function AgendamentoPublicoLayout({
  config,
  step,
  empresaLogoUrl,
  empresaNome,
  children,
}: AgendamentoPublicoLayoutProps) {
  const brandLogo = resolveBrandLogo(empresaLogoUrl);
  const brandName = resolveBrandName(empresaNome);
  const hasBanner = hasAgendaCustomBanner(config);
  const desktopBanner = resolveAgendaBannerUrl(config, 'desktop');
  const mobileBanner = resolveAgendaBannerUrl(config, 'mobile');
  const subtitle = resolveAgendaPublicSubtitle(
    config.texto_pagina_agendamento,
    config.duracao_minutos,
  );

  return (
    <div className="agendamento-publico min-h-screen bg-[#1a100c] text-[#faf6f2]">
      <style>{`
        .agendamento-publico {
          font-family: 'Raleway', system-ui, sans-serif;
          --ag-ink: #1a100c;
          --ag-body: #4a3228;
          --ag-accent: #c45c26;
          --ag-card-from: #fffaf6;
          --ag-card-to: #f3e8dc;
        }
        .agendamento-publico .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.04em;
        }
        .agendamento-publico .agendamento-card {
          background: linear-gradient(168deg, var(--ag-card-from) 0%, #f8efe6 45%, var(--ag-card-to) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.75),
            0 28px 72px rgba(0, 0, 0, 0.44),
            0 10px 28px rgba(26, 16, 12, 0.14);
        }
        .agendamento-publico .agendamento-card-inner {
          color: var(--ag-ink);
          color-scheme: light;
        }
        /* Sobrescreve glass-input do CRM (fundo escuro) no card claro */
        .agendamento-publico .agendamento-card .glass-input {
          background: #ffffff !important;
          color: #1a100c !important;
          border: 2px solid #8a7060 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow:
            inset 0 1px 3px rgba(26, 16, 12, 0.08),
            0 2px 8px rgba(26, 16, 12, 0.08) !important;
          font-weight: 600;
        }
        .agendamento-publico .agendamento-card .glass-input::placeholder {
          color: #4a3228 !important;
          opacity: 1 !important;
          font-weight: 500;
        }
        .agendamento-publico .agendamento-card .glass-input:focus,
        .agendamento-publico .agendamento-card .glass-input:focus-visible {
          background: #ffffff !important;
          color: #1a100c !important;
          border-color: #c45c26 !important;
          box-shadow:
            0 0 0 3px rgba(196, 92, 38, 0.22),
            0 4px 14px rgba(26, 16, 12, 0.1) !important;
          outline: none !important;
        }
        .agendamento-publico .agendamento-card textarea {
          background: #ffffff !important;
          color: #1a100c !important;
          border: 2px solid #8a7060 !important;
          font-weight: 600;
          box-shadow:
            inset 0 1px 3px rgba(26, 16, 12, 0.08),
            0 2px 8px rgba(26, 16, 12, 0.08) !important;
        }
        .agendamento-publico .agendamento-card textarea::placeholder {
          color: #5c4034 !important;
          opacity: 1 !important;
        }
        .agendamento-publico .agendamento-card textarea:focus,
        .agendamento-publico .agendamento-card textarea:focus-visible {
          background: #ffffff !important;
          border-color: #c45c26 !important;
          box-shadow:
            0 0 0 3px rgba(196, 92, 38, 0.22),
            0 4px 14px rgba(26, 16, 12, 0.1) !important;
          outline: none !important;
        }
        .agendamento-publico input[type='file']::file-selector-button {
          margin-right: 0.75rem;
          border: 1px solid rgba(184, 160, 144, 0.85);
          border-radius: 0.5rem;
          background: linear-gradient(180deg, #fff 0%, #f5ebe3 100%);
          color: var(--ag-body);
          font-weight: 600;
          font-size: 0.75rem;
          padding: 0.35rem 0.75rem;
          box-shadow: 0 2px 6px rgba(26, 16, 12, 0.08);
          cursor: pointer;
        }
        .agendamento-publico input[type='file']::file-selector-button:hover {
          background: #fff7f2;
          border-color: rgba(196, 92, 38, 0.45);
        }
        .agendamento-publico .agendamento-card input[type='date'].glass-input,
        .agendamento-publico .agendamento-card input[type='time'].glass-input,
        .agendamento-publico .agendamento-card input[type='datetime-local'].glass-input {
          color-scheme: light;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .agendamento-publico .agendamento-card input[type='date']::-webkit-calendar-picker-indicator,
        .agendamento-publico .agendamento-card input[type='time']::-webkit-calendar-picker-indicator,
        .agendamento-publico .agendamento-card input[type='datetime-local']::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 1;
          filter: none;
          width: 1.1rem;
          height: 1.1rem;
        }
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-fields-wrapper,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-text,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-month-field,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-day-field,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-year-field,
        .agendamento-publico .agendamento-card input[type='time']::-webkit-datetime-edit,
        .agendamento-publico .agendamento-card input[type='datetime-local']::-webkit-datetime-edit {
          color: #1a100c !important;
          font-weight: 700;
        }
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-month-field:focus,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-day-field:focus,
        .agendamento-publico .agendamento-card input[type='date']::-webkit-datetime-edit-year-field:focus {
          background: rgba(196, 92, 38, 0.12);
          color: #1a100c !important;
          outline: none;
        }
        @keyframes agendamento-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .agendamento-animate-in {
          animation: agendamento-fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* Hero / banner */}
      <header className="relative w-full overflow-hidden">
        <div
          className={cn(
            'relative w-full',
            hasBanner ? 'h-[220px] sm:h-[280px] lg:h-[320px]' : 'h-[180px] sm:h-[220px]',
          )}
        >
          {hasBanner ? (
            <>
              {mobileBanner && (
                <div
                  className="absolute inset-0 bg-cover bg-center md:hidden scale-105"
                  style={{ backgroundImage: `url("${mobileBanner}")` }}
                  aria-hidden
                />
              )}
              {desktopBanner && (
                <div
                  className="absolute inset-0 hidden bg-cover bg-center md:block scale-105"
                  style={{ backgroundImage: `url("${desktopBanner}")` }}
                  aria-hidden
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-[#1a100c]/30 via-[#1a100c]/55 to-[#1a100c]" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1a100c]/40 via-transparent to-[#1a100c]/25" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-[#c45c26]/35 via-[#2a1812] to-[#1a100c]" />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 20%, rgba(255,180,120,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(196,92,38,0.2), transparent 40%)',
                }}
              />
            </>
          )}

          <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-10 text-center agendamento-animate-in">
            <img
              src={brandLogo}
              alt={brandName}
              className="mb-3 h-14 w-14 object-contain drop-shadow-lg sm:h-16 sm:w-16"
            />
            <h1 className="hero-title text-4xl sm:text-5xl text-white drop-shadow-md">
              {config.nome_agenda}
            </h1>
            <p className="mt-2 max-w-md text-sm sm:text-base text-white/80 font-light tracking-wide">
              {subtitle}
            </p>
          </div>
        </div>

        {step !== 'success' && (
          <div className="flex justify-center gap-2 pb-2 pt-1">
            {(['form', 'date', 'time'] as const).map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-500',
                  step === s ? 'w-8 bg-[#e8924a]' : 'w-3 bg-white/20',
                )}
              />
            ))}
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <main className="relative z-20 px-4 pb-12 pt-2 sm:px-6">
        <div className="mx-auto max-w-lg agendamento-animate-in" style={{ animationDelay: '0.08s' }}>
          <div className="agendamento-card agendamento-card-inner rounded-2xl border border-white/20 backdrop-blur-md">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
