import type {
  OrcamentoPrecificacao,
  OrcamentoPublicoPayload,
  OrcamentoSlideBloco,
  OrcamentoSlideFormaPagamento,
  OrcamentoSlideOpcao,
  OrcamentoSlidePergunta,
} from '@/types/orcamento-publico'
import { fmtCur, fmtDate } from '@/lib/utils'

interface Props {
  payload: OrcamentoPublicoPayload
}

function cfg<T>(bloco: OrcamentoSlideBloco, key: string, fallback: T): T {
  const value = bloco.config[key]
  return (value as T) ?? fallback
}

function resolveResposta(
  perguntaId: string,
  valor: unknown,
  perguntas: OrcamentoSlidePergunta[],
  opcoes: OrcamentoSlideOpcao[],
): string {
  const pergunta = perguntas.find(item => item.id === perguntaId)
  if (!pergunta) return String(valor ?? '—')

  const labelsFor = (raw: string) =>
    opcoes.find(item => item.pergunta_id === perguntaId && item.valor === raw)?.label ?? raw

  if (Array.isArray(valor)) {
    return valor.map(labelsFor).join(', ')
  }

  if (pergunta.tipo === 'data' && typeof valor === 'string' && valor) {
    return fmtDate(valor)
  }

  return labelsFor(String(valor ?? ''))
}

function BlocoCapa({
  bloco,
  clienteNome,
  identificador,
}: {
  bloco: OrcamentoSlideBloco
  clienteNome: string
  identificador: string
}) {
  const titulo = cfg(bloco, 'titulo', 'Proposta Comercial')
  const subtitulo = cfg(bloco, 'subtitulo', '')
  const imagemUrl = cfg(bloco, 'imagem_url', '')

  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden">
      {imagemUrl ? (
        <img
          src={imagemUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[var(--orc-cor-primaria)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20" />
      <div className="relative z-10 w-full px-6 pb-16 pt-28 md:px-16 md:pb-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--orc-cor-secundaria)]">
          {identificador}
        </p>
        <h1 className="max-w-4xl font-['Bebas_Neue'] text-5xl leading-none text-white md:text-7xl">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="mt-4 max-w-2xl text-lg text-white/85 md:text-xl">{subtitulo}</p>
        )}
        <div className="mt-10 inline-flex rounded-full border border-white/25 bg-white/10 px-6 py-3 backdrop-blur-sm">
          <span className="text-sm uppercase tracking-[0.2em] text-white/70">Cliente</span>
          <span className="ml-4 text-lg font-semibold text-white">{clienteNome}</span>
        </div>
      </div>
    </section>
  )
}

function BlocoValorizacao({ bloco }: { bloco: OrcamentoSlideBloco }) {
  const titulo = cfg(bloco, 'titulo', '')
  const texto = cfg(bloco, 'texto', '')
  const percentual = cfg(bloco, 'percentual', '')
  const imagemUrl = cfg(bloco, 'imagem_url', '')

  return (
    <section className="grid min-h-[70svh] items-center gap-10 px-6 py-16 md:grid-cols-2 md:px-16">
      <div>
        {percentual && (
          <p className="mb-4 font-['Bebas_Neue'] text-6xl text-[var(--orc-cor-secundaria)] md:text-8xl">
            {percentual}
          </p>
        )}
        <h2 className="font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)] md:text-5xl">{titulo}</h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--orc-cor-texto)]/80 md:text-lg">
          {texto}
        </p>
      </div>
      {imagemUrl && (
        <div className="overflow-hidden rounded-3xl shadow-2xl shadow-black/20">
          <img src={imagemUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
    </section>
  )
}

function BlocoGaleria({ bloco }: { bloco: OrcamentoSlideBloco }) {
  const titulo = cfg(bloco, 'titulo', 'Nossos Projetos')
  const imagens = cfg<Array<{ url?: string; orientacao?: string }>>(bloco, 'imagens', [])

  return (
    <section className="px-6 py-16 md:px-16">
      <h2 className="mb-8 font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)] md:text-5xl">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {imagens.map((item, index) => (
          <div key={`${item.url ?? 'img'}-${index}`} className="overflow-hidden rounded-2xl">
            {item.url && (
              <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover transition hover:scale-[1.02]" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function labelsSelecionados(
  perguntaId: string | undefined,
  valores: unknown,
  opcoes: OrcamentoSlideOpcao[],
): string[] {
  if (!perguntaId || !valores) return []
  const lista = Array.isArray(valores) ? valores : [valores]
  return lista
    .map(valor => opcoes.find(item => item.pergunta_id === perguntaId && item.valor === valor)?.label ?? String(valor))
    .map(label => label.toLowerCase())
}

function BlocoComparativo({
  bloco,
  selecionados,
}: {
  bloco: OrcamentoSlideBloco
  selecionados: string[]
}) {
  const titulo = cfg(bloco, 'titulo', 'Ferragens')
  const itens = cfg<Array<{ titulo?: string; descricao?: string; imagem_url?: string; valor?: string }>>(
    bloco,
    'itens',
    [],
  )

  return (
    <section className="px-6 py-16 md:px-16">
      <h2 className="mb-8 font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)] md:text-5xl">{titulo}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {itens.map((item, index) => {
          const tituloItem = item.titulo?.toLowerCase() ?? ''
          const ativo = selecionados.some(label => tituloItem.includes(label) || label.includes(tituloItem))
          return (
            <article
              key={`${item.titulo ?? 'item'}-${index}`}
              className={`rounded-2xl border p-6 transition ${
                ativo
                  ? 'border-[var(--orc-cor-secundaria)] bg-[var(--orc-cor-secundaria)]/10'
                  : 'border-black/10 bg-white/50'
              }`}
            >
              <h3 className="text-lg font-semibold text-[var(--orc-cor-texto)]">{item.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--orc-cor-texto)]/75">{item.descricao}</p>
              {ativo && (
                <span className="mt-4 inline-flex rounded-full bg-[var(--orc-cor-secundaria)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Selecionado
                </span>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function BlocoDadosProjeto({
  bloco,
  payload,
}: {
  bloco: OrcamentoSlideBloco
  payload: OrcamentoPublicoPayload
}) {
  const titulo = cfg(bloco, 'titulo', 'Dados do projeto')
  const etiqueta = cfg(bloco, 'etiqueta', 'Seu projeto')
  const imagemFundo = cfg(bloco, 'imagem_fundo_url', '')
  const respostas = payload.slide.dados.respostas ?? {}

  const linhas = payload.perguntas
    .map(pergunta => {
      const valor = respostas[pergunta.id]
      if (valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0)) {
        return null
      }
      return {
        label: pergunta.label,
        valor: resolveResposta(pergunta.id, valor, payload.perguntas, payload.opcoes),
      }
    })
    .filter(Boolean) as Array<{ label: string; valor: string }>

  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-16">
      {imagemFundo && (
        <>
          <img src={imagemFundo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[var(--orc-cor-primaria)]/88" />
        </>
      )}
      <div className="relative z-10 mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--orc-cor-secundaria)]">{etiqueta}</p>
        <h2 className="mt-3 font-['Bebas_Neue'] text-4xl text-white md:text-5xl">{titulo}</h2>
        <div className="mt-8 grid gap-4">
          {linhas.map(linha => (
            <div
              key={linha.label}
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{linha.label}</p>
              <p className="mt-2 text-base text-white md:text-lg">{linha.valor}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function resolveFormasPagamentoIds(prec: OrcamentoPrecificacao): string[] {
  if (prec.formas_pagamento_ids?.length) return prec.formas_pagamento_ids
  if (prec.forma_pagamento_id) return [prec.forma_pagamento_id]
  return []
}

function valorFormaPagamento(prec: OrcamentoPrecificacao, formaId: string): number | undefined {
  const valorMap = prec.formas_pagamento_valores?.[formaId]
  if (valorMap != null) return valorMap
  if (formaId === prec.forma_pagamento_id) return prec.valor_final
  return undefined
}

function descontoFormaPagamento(prec: OrcamentoPrecificacao, formaId: string): number | undefined {
  const descontoMap = prec.formas_pagamento_descontos?.[formaId]
  if (descontoMap != null) return descontoMap
  if (formaId === prec.forma_pagamento_id) return prec.desconto_percent
  return undefined
}

function detalhesFormaPagamento(
  prec: OrcamentoPrecificacao,
  forma: OrcamentoSlideFormaPagamento,
  formaId: string,
  valor: number,
): string[] {
  const linhas: string[] = []
  const isPrincipal = formaId === prec.forma_pagamento_id

  if (forma.tipo === 'entrada_entrega') {
    const entrada = isPrincipal && prec.valor_entrada != null && prec.valor_entrada > 0
      ? prec.valor_entrada
      : valor * 0.6
    const entrega = isPrincipal && prec.valor_entrega != null && prec.valor_entrega > 0
      ? prec.valor_entrega
      : valor * 0.4
    linhas.push(`Entrada: ${fmtCur(entrada)}`)
    linhas.push(`Na entrega: ${fmtCur(entrega)}`)
    return linhas
  }

  if (forma.tipo === 'parcelado') {
    const parcelas =
      prec.formas_pagamento_parcelas?.[formaId]
      ?? (isPrincipal ? prec.parcelas : undefined)
    if (parcelas && parcelas > 1) {
      const valorParcela = isPrincipal && prec.valor_parcela
        ? prec.valor_parcela
        : valor / parcelas
      linhas.push(`${parcelas}x de ${fmtCur(valorParcela)}`)
    }
    return linhas
  }

  return linhas
}

function BlocoPrecificacao({
  bloco,
  payload,
}: {
  bloco: OrcamentoSlideBloco
  payload: OrcamentoPublicoPayload
}) {
  const titulo = cfg(bloco, 'titulo', 'Investimento')
  const prec = payload.slide.dados.precificacao
  const formaIds = prec ? resolveFormasPagamentoIds(prec) : []

  if (!prec) {
    return (
      <section className="px-6 py-16 md:px-16">
        <h2 className="font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)]">{titulo}</h2>
        <p className="mt-4 text-[var(--orc-cor-texto)]/70">Valores ainda não definidos.</p>
      </section>
    )
  }

  const formas = formaIds
    .map(id => {
      const forma = payload.formasPagamento.find(item => item.id === id)
      const valor = valorFormaPagamento(prec, id)
      if (!forma || valor == null) return null
      return {
        id,
        forma,
        valor,
        desconto: descontoFormaPagamento(prec, id),
        detalhes: detalhesFormaPagamento(prec, forma, id, valor),
        selecionada: id === prec.forma_pagamento_id,
      }
    })
    .filter(Boolean) as Array<{
      id: string
      forma: OrcamentoSlideFormaPagamento
      valor: number
      desconto?: number
      detalhes: string[]
      selecionada: boolean
    }>

  return (
    <section className="px-6 py-16 md:px-16">
      <h2 className="font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)] md:text-5xl">{titulo}</h2>

      {prec.valor_integral != null && prec.valor_integral > 0 && (
        <p className="mt-3 text-sm text-[var(--orc-cor-texto)]/65">
          Valor integral do projeto: <strong>{fmtCur(prec.valor_integral)}</strong>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {formas.length > 0 ? (
          formas.map(item => (
            <article
              key={item.id}
              className={`rounded-3xl border p-6 md:p-8 ${
                item.selecionada
                  ? 'border-[var(--orc-cor-secundaria)] bg-[var(--orc-cor-secundaria)]/10 shadow-md'
                  : 'border-black/10 bg-white/70'
              }`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--orc-cor-texto)]/60">
                    Forma de pagamento
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--orc-cor-texto)]">{item.forma.nome}</p>
                  {item.forma.descricao && (
                    <p className="mt-2 text-sm text-[var(--orc-cor-texto)]/70">{item.forma.descricao}</p>
                  )}
                </div>
                <p className="mt-3 font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-primaria)] sm:mt-0 sm:text-5xl">
                  {fmtCur(item.valor)}
                </p>
              </div>

              {item.desconto != null && item.desconto > 0 && prec.valor_integral != null && prec.valor_integral > 0 && (
                <p className="mt-3 text-sm text-[var(--orc-cor-texto)]/75">
                  Desconto de {item.desconto}% sobre {fmtCur(prec.valor_integral)}
                </p>
              )}

              {item.detalhes.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-black/10 pt-4 text-sm text-[var(--orc-cor-texto)]">
                  {item.detalhes.map(linha => (
                    <p key={linha}>{linha}</p>
                  ))}
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-[var(--orc-cor-primaria)] p-8 text-white shadow-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/60">Valor final</p>
            <p className="mt-3 font-['Bebas_Neue'] text-5xl text-[var(--orc-cor-secundaria)] md:text-6xl">
              {fmtCur(prec.valor_final)}
            </p>
            {prec.desconto_percent ? (
              <p className="mt-3 text-sm text-white/75">
                Desconto de {prec.desconto_percent}% sobre {fmtCur(prec.valor_integral)}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}

function BlocoPrazos({ bloco, payload }: { bloco: OrcamentoSlideBloco; payload: OrcamentoPublicoPayload }) {
  const titulo = cfg(bloco, 'titulo', 'Prazos')
  const prazo = payload.slide.dados.prazo_entrega
  const inicio = payload.slide.dados.inicio_execucao

  return (
    <section className="px-6 py-16 md:px-16">
      <h2 className="font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)] md:text-5xl">{titulo}</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--orc-cor-texto)]/60">
            Prazo de entrega
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--orc-cor-texto)]">
            {prazo ? fmtDate(prazo) : 'A combinar'}
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--orc-cor-texto)]/60">
            Início da execução
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--orc-cor-texto)]">
            {inicio ? fmtDate(inicio) : 'A combinar'}
          </p>
        </div>
      </div>
    </section>
  )
}

function BlocoGarantia({ bloco, payload }: { bloco: OrcamentoSlideBloco; payload: OrcamentoPublicoPayload }) {
  const titulo = cfg(bloco, 'titulo', 'Garantia')
  const texto = cfg(bloco, 'texto', '')
  const meses = payload.slide.dados.garantia_meses || cfg(bloco, 'meses', '')
  const imagemFundo = cfg(bloco, 'imagem_fundo_url', '')

  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-16">
      {imagemFundo && (
        <>
          <img src={imagemFundo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </>
      )}
      <div className="relative z-10 max-w-3xl">
        <h2 className="font-['Bebas_Neue'] text-4xl text-white md:text-5xl">{titulo}</h2>
        {meses && (
          <p className="mt-4 font-['Bebas_Neue'] text-6xl text-[var(--orc-cor-secundaria)]">{meses} meses</p>
        )}
        <p className="mt-5 text-base leading-relaxed text-white/85 md:text-lg">{texto}</p>
      </div>
    </section>
  )
}

function BlocoImagensOrcamento({
  bloco,
  payload,
}: {
  bloco: OrcamentoSlideBloco
  payload: OrcamentoPublicoPayload
}) {
  const titulo = cfg(bloco, 'titulo', 'Imagens do orçamento')
  const etiqueta = cfg(bloco, 'etiqueta', 'Projeto')

  if (!payload.midias.length) return null

  return (
    <section className="px-6 py-16 md:px-16">
      <p className="text-sm uppercase tracking-[0.3em] text-[var(--orc-cor-secundaria)]">{etiqueta}</p>
      <h2 className="mt-3 font-['Bebas_Neue'] text-4xl text-[var(--orc-cor-texto)] md:text-5xl">{titulo}</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {payload.midias.map(midia => (
          <div key={midia.id} className="overflow-hidden rounded-2xl shadow-lg">
            {midia.tipo === 'video' ? (
              <video src={midia.file_url} controls className="aspect-[4/3] w-full object-cover" />
            ) : (
              <img src={midia.file_url} alt={midia.file_name ?? ''} className="aspect-[4/3] w-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function renderBloco(bloco: OrcamentoSlideBloco, payload: OrcamentoPublicoPayload) {
  const ferragensPergunta = payload.perguntas.find(item =>
    item.label.toLowerCase().includes('ferragem'),
  )
  const selecionados = labelsSelecionados(
    ferragensPergunta?.id,
    ferragensPergunta ? payload.slide.dados.respostas?.[ferragensPergunta.id] : undefined,
    payload.opcoes,
  )

  switch (bloco.tipo) {
    case 'capa':
      return (
        <BlocoCapa
          key={bloco.id}
          bloco={bloco}
          clienteNome={payload.slide.cliente_nome}
          identificador={payload.slide.identificador}
        />
      )
    case 'valorizacao':
      return <BlocoValorizacao key={bloco.id} bloco={bloco} />
    case 'galeria_projetos':
      return <BlocoGaleria key={bloco.id} bloco={bloco} />
    case 'comparativo_ferragens':
      return <BlocoComparativo key={bloco.id} bloco={bloco} selecionados={selecionados} />
    case 'dados_projeto':
      return <BlocoDadosProjeto key={bloco.id} bloco={bloco} payload={payload} />
    case 'precificacao':
      return <BlocoPrecificacao key={bloco.id} bloco={bloco} payload={payload} />
    case 'prazos':
      return <BlocoPrazos key={bloco.id} bloco={bloco} payload={payload} />
    case 'garantia':
      return <BlocoGarantia key={bloco.id} bloco={bloco} payload={payload} />
    case 'imagens_orcamento':
      return <BlocoImagensOrcamento key={bloco.id} bloco={bloco} payload={payload} />
    default:
      return null
  }
}

export function OrcamentoPublicoSlides({ payload }: Props) {
  return (
    <div className="overflow-x-hidden">
      {payload.blocos.map(bloco => renderBloco(bloco, payload))}
      <footer className="border-t border-black/10 px-6 py-10 text-center md:px-16">
        <p className="text-sm text-[var(--orc-cor-texto)]/60">
          Proposta preparada para <strong>{payload.slide.cliente_nome}</strong>
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[var(--orc-cor-texto)]/45">
          {payload.template.nome}
        </p>
      </footer>
    </div>
  )
}
