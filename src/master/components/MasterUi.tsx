/**
 * Peças visuais do console master. Superfícies planas com borda fina (sem sombra genérica);
 * a hierarquia vem da tipografia e do espaço, não de cartões iguais.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { SituacaoMensalidade, StatusEmpresa } from '@/hooks/useMaster'

export function MasterPage({ titulo, resumo, acoes, children }: {
  titulo: string
  resumo?: ReactNode
  acoes?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[46rem]">
          <h1 className="m-titulo text-[2.1rem] text-[var(--m-ink)] sm:text-[2.6rem]">{titulo}</h1>
          {resumo ? <p className="mt-2 text-[1.02rem] leading-relaxed text-[var(--m-ink-2)]">{resumo}</p> : null}
        </div>
        {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
      </header>
      {children}
    </div>
  )
}

/** Bloco de conteúdo: superfície branca com borda fina e título opcional à esquerda. */
export function Painel({ titulo, descricao, acao, className, corpoClassName, children }: {
  titulo?: string
  descricao?: ReactNode
  acao?: ReactNode
  className?: string
  corpoClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn('rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]', className)}>
      {titulo ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--m-line)] px-5 py-4">
          <div>
            <h2 className="text-[0.98rem] font-semibold text-[var(--m-ink)]">{titulo}</h2>
            {descricao ? <p className="mt-0.5 text-sm text-[var(--m-ink-2)]">{descricao}</p> : null}
          </div>
          {acao}
        </div>
      ) : null}
      <div className={cn('p-5', corpoClassName)}>{children}</div>
    </section>
  )
}

/** Faixa de números: valores lado a lado separados por linhas verticais (não são cartões). */
export function Numeros({ itens }: { itens: { rotulo: string; valor: ReactNode; nota?: ReactNode; tom?: 'alerta' }[] }) {
  return (
    <dl className="grid grid-cols-2 border-y border-[var(--m-line)] sm:grid-cols-3 lg:grid-cols-6">
      {itens.map((it) => (
        <div key={it.rotulo} className="border-[var(--m-line)] px-4 py-4 [&:not(:first-child)]:border-l max-sm:[&:nth-child(odd)]:border-l-0">
          <dt className="text-[0.8rem] text-[var(--m-ink-2)]">{it.rotulo}</dt>
          <dd className={cn('m-num mt-1 text-[1.45rem] font-semibold', it.tom === 'alerta' ? 'text-[var(--m-total)]' : 'text-[var(--m-ink)]')}>
            {it.valor}
          </dd>
          {it.nota ? <dd className="text-[0.75rem] text-[var(--m-ink-2)]">{it.nota}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

const STATUS_EMPRESA: Record<StatusEmpresa, { texto: string; cls: string; forma: string }> = {
  ativa: { texto: 'Ativa', cls: 'text-[var(--m-accent)]', forma: 'bg-[var(--m-accent)]' },
  bloqueada: { texto: 'Bloqueada', cls: 'text-[var(--m-total)]', forma: 'bg-[var(--m-total)] rotate-45 rounded-none' },
  inativa: { texto: 'Inativa', cls: 'text-[var(--m-ink-2)]', forma: 'border border-[var(--m-ink-2)] bg-transparent' },
}

/** Status por forma + texto (não só cor): círculo ativa, losango bloqueada, anel vazio inativa. */
export function StatusEmpresaTag({ status }: { status: StatusEmpresa }) {
  const s = STATUS_EMPRESA[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[0.82rem] font-medium', s.cls)}>
      <span className={cn('inline-block h-2 w-2 rounded-full', s.forma)} aria-hidden />
      {s.texto}
    </span>
  )
}

const SITUACAO: Record<SituacaoMensalidade, { texto: string; cls: string }> = {
  em_dia: { texto: 'Em dia', cls: 'text-[var(--m-ink-2)]' },
  vencida: { texto: 'Vencida', cls: 'text-[var(--m-leitura)] font-semibold' },
  bloqueada: { texto: 'Bloqueada', cls: 'text-[var(--m-total)] font-semibold' },
  sem_assinatura: { texto: 'Sem assinatura', cls: 'text-[var(--m-ink-2)] italic' },
}

export function SituacaoTag({ situacao }: { situacao: SituacaoMensalidade }) {
  const s = SITUACAO[situacao]
  return <span className={cn('text-[0.82rem]', s.cls)}>{s.texto}</span>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-[var(--m-ink-2)]">{children}</p>
}
