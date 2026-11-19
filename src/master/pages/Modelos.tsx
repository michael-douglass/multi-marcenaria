import { useMemo, useState } from 'react'
import { ArrowUpRight, Plus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConsumoIaPainel, PrecosIaPainel } from '@/master/components/ia/ConsumoIaPainel'
import { MotorIaPainel } from '@/master/components/ia/MotorIaPainel'
import { dataBR, erroMsg } from '@/components/master/master-utils'
import {
  useEmpresasModelo,
  useEntregasModelos,
  useModelosCatalogo,
  usePlanos,
  usePublicarModelo,
  type EmpresaModelo,
  type ModeloCatalogo,
} from '@/hooks/useMaster'
import { MasterPage, Numeros, Painel, Vazio } from '@/master/components/MasterUi'
import { EntrarEmpresaDialog } from '@/master/components/EntrarEmpresaDialog'
import { NovaEmpresaModeloDialog } from '@/master/components/modelos/NovaEmpresaModeloDialog'
import { EnviarModeloDialog } from '@/master/components/modelos/EnviarModeloDialog'
import { PontuaInterfaceDialog } from '@/master/components/modelos/PontuaInterfaceDialog'
import { TIPO_MODELO, descreverContagem, descreverResumo } from '@/master/components/modelos/modelos-ui'
import { cn } from '@/lib/utils'

/**
 * Modelos padrão: empresas-modelo (onde o master edita, nas telas normais) e o catálogo do que
 * pode descer para as marcenarias. Ver docs/modelos-padrao/ e ADR 0005.
 */
export default function Modelos() {
  const { data: empresasModelo = [], isLoading: carregandoEmpresas } = useEmpresasModelo()
  const { data: catalogo = [], isLoading: carregandoCatalogo } = useModelosCatalogo()
  const { data: entregas = [] } = useEntregasModelos()
  const { data: planos = [] } = usePlanos()
  const publicar = usePublicarModelo()
  const [novaAberta, setNovaAberta] = useState(false)
  const [entrar, setEntrar] = useState<{ empresa: EmpresaModelo; destino?: string } | null>(null)
  const [enviando, setEnviando] = useState<ModeloCatalogo | null>(null)
  const [interfaceModelo, setInterfaceModelo] = useState<ModeloCatalogo | null>(null)

  const porEmpresa = useMemo(() => {
    const m = new Map<string, ModeloCatalogo[]>()
    for (const it of catalogo) m.set(it.empresa_modelo_id, [...(m.get(it.empresa_modelo_id) ?? []), it])
    return m
  }, [catalogo])
  const nomePlano = useMemo(() => new Map(planos.map((p) => [p.id, p.nome])), [planos])

  const publicados = catalogo.filter((m) => m.publicado).length
  const alternarPublicado = async (m: ModeloCatalogo, v: boolean) => {
    try {
      await publicar.mutateAsync({ modeloId: m.id, publicado: v })
      toast.success(v ? `“${m.nome}” publicado.` : `“${m.nome}” despublicado.`)
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível alterar a publicação'))
    }
  }

  return (
    <MasterPage
      titulo="Modelos padrão"
      resumo="Monte markup, slides, contratos, apresentação e Pontua numa empresa-modelo, publique e escolha quem recebe. Cada marcenaria ganha uma cópia própria para editar."
      acoes={
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Nova empresa-modelo
        </Button>
      }
    >
      <Tabs defaultValue="modelos">
      <TabsList className="mb-6">
        <TabsTrigger value="modelos">Modelos e empresas-modelo</TabsTrigger>
        <TabsTrigger value="ia">Motor de IA do card lead</TabsTrigger>
      </TabsList>
      <TabsContent value="modelos" className="mt-0">
      <Numeros
        itens={[
          { rotulo: 'Empresas-modelo', valor: empresasModelo.length },
          { rotulo: 'Modelos no catálogo', valor: catalogo.length },
          { rotulo: 'Publicados', valor: publicados },
          { rotulo: 'Entregas', valor: entregas.length, nota: 'últimas 200' },
        ]}
      />

      <div className="mt-8 space-y-8">
        {carregandoEmpresas || carregandoCatalogo ? (
          <Vazio>Carregando…</Vazio>
        ) : empresasModelo.length === 0 ? (
          <Painel>
            <div className="max-w-[40rem] py-4">
              <p className="font-semibold text-[var(--m-ink)]">Nenhuma empresa-modelo ainda.</p>
              <p className="mt-1 text-sm text-[var(--m-ink-2)]">
                Crie a primeira e, se quiser, copie os dados de uma empresa existente: o markup, os slides e os contratos dela viram o ponto de partida,
                e você ajusta o que quiser antes de publicar.
              </p>
              <Button className="mt-4" onClick={() => setNovaAberta(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Criar empresa-modelo
              </Button>
            </div>
          </Painel>
        ) : (
          empresasModelo.map((em) => {
            const itens = porEmpresa.get(em.id) ?? []
            return (
              <Painel
                key={em.id}
                titulo={em.nome}
                descricao={`${em.segmento ? `Segmento ${em.segmento} · ` : ''}criada em ${dataBR(em.criado_em)}`}
                acao={
                  <Button variant="outline" size="sm" onClick={() => setEntrar({ empresa: em })}>
                    Entrar para editar <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                }
                corpoClassName="p-0"
              >
                {itens.length === 0 ? (
                  <Vazio>Sem modelos ainda.</Vazio>
                ) : (
                  <ul className="divide-y divide-[var(--m-line)]">
                    {itens.map((m) => {
                      const tipo = TIPO_MODELO[m.tipo]
                      const Icon = tipo.icon
                      return (
                        <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                          <Icon className="h-5 w-5 shrink-0 text-[var(--m-ink-2)]" aria-hidden />
                          <div className="min-w-[14rem] flex-1">
                            <p className="text-[0.95rem] font-medium text-[var(--m-ink)]">
                              {m.tipo === 'contrato' ? <span className="text-[var(--m-ink-2)]">Contrato · </span> : null}
                              {m.nome}
                              {m.versao > 1 ? <span className="m-num ml-2 text-[0.78rem] text-[var(--m-ink-2)]">v{m.versao}</span> : null}
                            </p>
                            <p className="text-[0.8rem] text-[var(--m-ink-2)]">
                              {descreverContagem(m)}
                              {m.entregas ? ` · ${m.entregas} ${m.entregas === 1 ? 'entrega' : 'entregas'}` : ''}
                              {m.planos.length ? ` · planos: ${m.planos.map((p) => nomePlano.get(p) ?? '—').join(', ')}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEntrar({ empresa: em, destino: tipo.rota })}
                            className="min-h-10 rounded-md px-2 text-sm font-medium text-[var(--m-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]"
                          >
                            Editar
                          </button>
                          {m.tipo === 'pontua' ? (
                            <button
                              type="button"
                              onClick={() => setInterfaceModelo(m)}
                              className="min-h-10 rounded-md px-2 text-sm font-medium text-[var(--m-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]"
                            >
                              Interface…
                            </button>
                          ) : null}
                          <label className="inline-flex min-h-10 items-center gap-2 text-sm text-[var(--m-ink-2)]">
                            <Switch
                              checked={m.publicado}
                              disabled={publicar.isPending}
                              onCheckedChange={(v) => void alternarPublicado(m, v)}
                              aria-label={`Publicar ${m.nome}`}
                            />
                            <span className={cn(m.publicado && 'font-medium text-[var(--m-accent)]')}>
                              {m.publicado ? 'Publicado' : 'Rascunho'}
                            </span>
                          </label>
                          <Button size="sm" variant="outline" disabled={!m.publicado} onClick={() => setEnviando(m)}
                            title={m.publicado ? undefined : 'Publique para poder enviar'}>
                            <Send className="mr-1.5 h-4 w-4" aria-hidden /> Enviar…
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Painel>
            )
          })
        )}

        <Painel titulo="Entregas" descricao="O que foi copiado para cada marcenaria (pelo plano, ao criar, ou por envio)." corpoClassName="p-0">
          {entregas.length === 0 ? (
            <Vazio>Nenhuma entrega ainda.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[0.78rem] text-[var(--m-ink-2)]">
                  <tr className="border-b border-[var(--m-line)]">
                    <th className="px-5 py-2.5 font-medium">Quando</th>
                    <th className="px-5 py-2.5 font-medium">Marcenaria</th>
                    <th className="px-5 py-2.5 font-medium">Modelo</th>
                    <th className="px-5 py-2.5 font-medium">O que entrou</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--m-line)]">
                  {entregas.map((e) => (
                    <tr key={e.id}>
                      <td className="m-num whitespace-nowrap px-5 py-2.5 text-[var(--m-ink-2)]">{dataBR(e.entregue_em)}</td>
                      <td className="px-5 py-2.5 text-[var(--m-ink)]">{e.empresa_nome}</td>
                      <td className="px-5 py-2.5 text-[var(--m-ink)]">
                        {TIPO_MODELO[e.tipo]?.rotulo === e.modelo_nome ? e.modelo_nome : `${TIPO_MODELO[e.tipo]?.rotulo ?? e.tipo}: ${e.modelo_nome}`}
                        {e.versao > 1 ? <span className="m-num ml-1 text-[var(--m-ink-2)]">v{e.versao}</span> : null}
                      </td>
                      <td className="px-5 py-2.5 text-[var(--m-ink-2)]">{descreverResumo(e.tipo, e.resumo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>

      </TabsContent>
      <TabsContent value="ia" className="mt-0 space-y-8">
        <MotorIaPainel />
        <ConsumoIaPainel />
        <PrecosIaPainel />
      </TabsContent>
      </Tabs>

      <NovaEmpresaModeloDialog open={novaAberta} onClose={() => setNovaAberta(false)} />
      <EnviarModeloDialog modelo={enviando} onClose={() => setEnviando(null)} />
      <PontuaInterfaceDialog modelo={interfaceModelo} onClose={() => setInterfaceModelo(null)} />
      <EntrarEmpresaDialog
        empresa={entrar?.empresa ?? null}
        destino={entrar?.destino}
        modoInicial="total"
        onClose={() => setEntrar(null)}
      />
    </MasterPage>
  )
}
