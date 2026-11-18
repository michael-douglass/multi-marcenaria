import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { listarPaginas, SECOES_PAGINAS, type PaginaCatalogo } from '@/lib/paginas-catalogo'
import { cn } from '@/lib/utils'

type Props =
  | {
      modo: 'plano'
      /** Páginas bloqueadas pelo plano. */
      bloqueadas: string[]
      salvando: boolean
      onSalvar: (bloqueadas: string[]) => void
    }
  | {
      modo: 'empresa'
      /** Bloqueios do plano da empresa (padrão). */
      bloqueadasPlano: string[]
      planoNome: string | null
      /** Ajustes da empresa: true = liberada, false = bloqueada. */
      ajustes: Record<string, boolean>
      salvando: boolean
      onSalvar: (ajustes: Record<string, boolean>) => void
    }

interface Grupo {
  chave: string
  titulo: string
  paginas: PaginaCatalogo[]
}

function agrupar(paginas: PaginaCatalogo[]) {
  return SECOES_PAGINAS.map((secao) => {
    const grupos: Grupo[] = []
    for (const p of paginas.filter((x) => x.secao === secao)) {
      const titulo = p.subgrupo && p.grupo !== p.subgrupo ? `${p.grupo} › ${p.subgrupo}` : p.grupo
      const chave = `${secao}:${titulo}`
      let g = grupos.find((x) => x.chave === chave)
      if (!g) {
        g = { chave, titulo, paginas: [] }
        grupos.push(g)
      }
      g.paginas.push(p)
    }
    return { secao, grupos }
  }).filter((s) => s.grupos.length > 0)
}

/** Editor de páginas liberadas (plano ou empresa): grupos do menu, switches, busca e contagem. */
export function PaginasEditor(props: Props) {
  const catalogo = useMemo(() => listarPaginas(), [])
  const [busca, setBusca] = useState('')

  // Estado editável: plano → conjunto bloqueado; empresa → ajustes.
  const inicialPlano = props.modo === 'plano' ? props.bloqueadas : []
  const inicialAjustes = props.modo === 'empresa' ? props.ajustes : {}
  const [bloq, setBloq] = useState<Set<string>>(() => new Set(inicialPlano))
  const [ajustes, setAjustes] = useState<Record<string, boolean>>(() => ({ ...inicialAjustes }))

  const chaveInicial = JSON.stringify(props.modo === 'plano' ? [...inicialPlano].sort() : inicialAjustes)
  useEffect(() => {
    if (props.modo === 'plano') setBloq(new Set(props.bloqueadas))
    else setAjustes({ ...props.ajustes })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só quando o dado salvo muda
  }, [chaveInicial])

  const padraoPlano = (id: string) => (props.modo === 'empresa' ? !props.bloqueadasPlano.includes(id) : true)

  const liberada = (p: PaginaCatalogo) => {
    if (!p.bloqueavel) return true
    if (props.modo === 'plano') return !bloq.has(p.id)
    return ajustes[p.id] ?? padraoPlano(p.id)
  }

  const definir = (ids: string[], valor: boolean) => {
    if (props.modo === 'plano') {
      setBloq((prev) => {
        const n = new Set(prev)
        for (const id of ids) {
          if (valor) n.delete(id)
          else n.add(id)
        }
        return n
      })
    } else {
      setAjustes((prev) => {
        const n = { ...prev }
        for (const id of ids) {
          if (valor === padraoPlano(id)) delete n[id]
          else n[id] = valor
        }
        return n
      })
    }
  }

  const bloqueaveis = catalogo.filter((p) => p.bloqueavel)
  const totalLiberadas = catalogo.filter(liberada).length
  const atual = props.modo === 'plano' ? JSON.stringify([...bloq].sort()) : JSON.stringify(ajustes)
  const original = props.modo === 'plano' ? JSON.stringify([...props.bloqueadas].sort()) : JSON.stringify(props.ajustes)
  const sujo = atual !== original
  const qtdAjustes = Object.keys(ajustes).length

  const termo = busca.trim().toLowerCase()
  const visiveis = termo
    ? catalogo.filter((p) => `${p.titulo} ${p.grupo} ${p.subgrupo ?? ''} ${p.url}`.toLowerCase().includes(termo))
    : catalogo
  const secoes = agrupar(visiveis)

  const salvar = () => {
    if (props.modo === 'plano') props.onSalvar([...bloq].filter((id) => bloqueaveis.some((p) => p.id === id)).sort())
    else props.onSalvar(ajustes)
  }

  const descartar = () => {
    if (props.modo === 'plano') setBloq(new Set(props.bloqueadas))
    else setAjustes({ ...props.ajustes })
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m-ink-2)]" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar página" aria-label="Buscar página" className="h-10 pl-9" />
        </div>
        <p className="m-num text-sm text-[var(--m-ink-2)]">
          <span className="text-[1.1rem] font-semibold text-[var(--m-ink)]">{totalLiberadas}</span> de {catalogo.length} páginas liberadas
        </p>
        {props.modo === 'empresa' && qtdAjustes > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setAjustes({})}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> Voltar ao padrão do plano
          </Button>
        ) : null}
      </div>

      {props.modo === 'empresa' ? (
        <p className="mb-5 text-sm text-[var(--m-ink-2)]">
          {props.planoNome
            ? `O padrão vem do plano ${props.planoNome}. O que você mudar aqui vale só para esta marcenaria e aparece marcado como ajuste.`
            : 'Esta marcenaria não tem plano: o padrão é tudo liberado. O que você mudar aqui aparece marcado como ajuste.'}
        </p>
      ) : null}

      {secoes.length === 0 ? <p className="py-8 text-sm text-[var(--m-ink-2)]">Nenhuma página com esse nome.</p> : null}

      <div className="space-y-8">
        {secoes.map(({ secao, grupos }) => (
          <section key={secao} aria-labelledby={`sec-${secao}`}>
            <h3 id={`sec-${secao}`} className="m-titulo mb-3 text-[1.35rem] text-[var(--m-ink)]">{secao}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {grupos.map((g) => {
                const ids = g.paginas.filter((p) => p.bloqueavel).map((p) => p.id)
                const lib = g.paginas.filter(liberada).length
                const todas = lib === g.paginas.length
                return (
                  <div key={g.chave} className="rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]">
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--m-line)] px-4 py-2.5">
                      <p className="text-sm font-semibold text-[var(--m-ink)]">
                        {g.titulo} <span className="m-num font-normal text-[var(--m-ink-2)]">{lib} de {g.paginas.length}</span>
                      </p>
                      {ids.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => definir(ids, !todas)}
                          className="min-h-8 rounded px-2 text-[0.82rem] font-medium text-[var(--m-accent)] hover:bg-[var(--m-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]"
                        >
                          {todas ? 'Bloquear o grupo' : 'Liberar o grupo'}
                        </button>
                      ) : null}
                    </div>
                    <ul className="divide-y divide-[var(--m-line)]">
                      {g.paginas.map((p) => {
                        const on = liberada(p)
                        const ajuste = props.modo === 'empresa' && p.id in ajustes
                        const idSwitch = `pg-${p.id}`
                        return (
                          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Switch id={idSwitch} checked={on} disabled={!p.bloqueavel} onCheckedChange={(v) => definir([p.id], v)} />
                            <label htmlFor={idSwitch} className={cn('min-w-0 flex-1 cursor-pointer', !on && 'text-[var(--m-ink-2)]')}>
                              <span className={cn('block text-[0.92rem]', on ? 'text-[var(--m-ink)]' : 'line-through decoration-[var(--m-line)]')}>
                                {p.titulo}
                              </span>
                              <span className="block truncate text-[0.75rem] text-[var(--m-ink-2)]">
                                {p.bloqueavel ? p.url.split('?')[0] : 'Sempre liberada'}
                              </span>
                            </label>
                            {ajuste ? (
                              <button
                                type="button"
                                onClick={() => definir([p.id], padraoPlano(p.id))}
                                title="Voltar ao padrão do plano"
                                className="rounded border border-[var(--m-leitura)]/40 bg-[var(--m-leitura-bg)] px-1.5 py-0.5 text-[0.72rem] font-medium text-[var(--m-leitura)] hover:opacity-80"
                              >
                                ajuste
                              </button>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {sujo ? (
        <div className="sticky bottom-4 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--m-ink)] bg-[var(--m-ink)] px-4 py-3 text-white">
          <p className="text-sm">Há alterações nas páginas que ainda não foram salvas.</p>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={descartar} disabled={props.salvando}>
              Descartar
            </Button>
            <Button onClick={salvar} disabled={props.salvando} className="bg-white text-[var(--m-ink)] hover:bg-white/90">
              {props.salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Salvar páginas
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
