import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown, ListChecks, Plus } from 'lucide-react'
import { EventoDocumentoPanel } from '@/components/eventos/EventoDocumentoPanel'
import { EventoFolderDialog } from '@/components/eventos/EventoFolderDialog'
import { EventoItemCard, EventoItemDialog } from '@/components/eventos/EventoItemCard'
import { EventoParticipanteCard, EventoParticipanteDialog } from '@/components/eventos/EventoParticipanteCard'
import { EventoCardFotosSheet } from '@/components/eventos/EventoCardFotosSheet'
import { EventoPdfExportDialog } from '@/components/eventos/EventoPdfExportDialog'
import { EventoTarefasDialog } from '@/components/eventos/EventoTarefasDialog'
import { EventoTotaisPanel } from '@/components/eventos/EventoTotaisPanel'
import { useEventoBoard } from '@/hooks/useEventoBoard'
import { useControleEventos } from '@/hooks/useControleEventos'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { labelEventoDataExtenso, labelEventoTipo, totaisDoEvento } from '@/lib/evento-helpers'
import type { EventoItem, EventoParticipante } from '@/lib/evento-types'
import { LoadingState } from '@/components/ui/EmptyState'

export default function ControleEventoBoard() {
  const { eventoId } = useParams()
  const { empresa } = useEmpresa()
  const { atualizar } = useControleEventos()
  const boardApi = useEventoBoard(eventoId)
  const {
    board, loading, error, catalogo,
    salvarParticipante, excluirParticipante, salvarItem, excluirItem,
    salvarPagina, criarFolha, excluirFolha, uploadFoto, salvarAnotacoes, excluirFoto,
  } = boardApi

  const [pessoaOpen, setPessoaOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [tarefasOpen, setTarefasOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [editPasta, setEditPasta] = useState(false)
  const [fotosDe, setFotosDe] = useState<
    | { kind: 'participantes'; owner: EventoParticipante }
    | { kind: 'itens'; owner: EventoItem }
    | null
  >(null)

  const branding = {
    nome: empresa?.nome || 'Garbo Movelaria',
    cnpj: empresa?.cnpj || null,
    logoUrl: empresa?.logo_url ?? null,
  }

  const totais = useMemo(
    () => totaisDoEvento(board?.participantes.length ?? 0, board?.itens ?? []),
    [board],
  )
  const pendentes = board?.tarefas.filter((t) => !t.concluida).length ?? 0

  if (loading) return <LoadingState variant="page" message="Abrindo o caderno..." />
  if (error || !board) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="title-page text-2xl">Pasta não encontrada</p>
        <Link to="/controle-eventos" className="mt-4 inline-block text-gold underline">
          Voltar às pastas
        </Link>
      </div>
    )
  }

  const fotosOwner = fotosDe
    ? fotosDe.kind === 'participantes'
      ? { titulo: fotosDe.owner.nome, midias: fotosDe.owner.midias, ownerId: fotosDe.owner.id }
      : { titulo: fotosDe.owner.nome, midias: fotosDe.owner.midias, ownerId: fotosDe.owner.id }
    : null

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:overflow-hidden">
      <header className="mb-4 shrink-0 px-1">
        <Link to="/controle-eventos" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Pastas
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button type="button" className="title-page text-left" onClick={() => setEditPasta(true)}>
              {board.evento.titulo}
            </button>
            <p className="text-sm text-cream-muted">
              {labelEventoDataExtenso(board.evento.data_evento)} · {labelEventoTipo(board.evento.tipo, board.evento.tipo_custom)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-md" onClick={() => setTarefasOpen(true)}>
              <ListChecks className="h-4 w-4" />
              Tarefas
              {pendentes > 0 && <span className="ml-1 text-gold">{pendentes}</span>}
            </button>
            <button type="button" className="btn btn-proforco btn-md" onClick={() => setPdfOpen(true)}>
              <FileDown className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(30rem,1.55fr)] xl:grid-rows-[minmax(0,1fr)_minmax(10.5rem,0.38fr)] xl:overflow-hidden">
        <section className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-3 xl:col-start-1 xl:row-start-1 xl:min-h-0">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">1 · Participantes</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPessoaOpen(true)}>
              <Plus className="h-3 w-3" />
              Pessoa
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {board.participantes.length === 0 && (
              <p className="rounded-lg border border-dashed border-gold-border px-3 py-8 text-center text-sm text-cream-faint">
                Ninguém na lista ainda. Adicione um lead com nome, telefone e e-mail.
              </p>
            )}
            {board.participantes.map((pessoa) => (
              <EventoParticipanteCard
                key={pessoa.id}
                pessoa={pessoa}
                onSave={(input) => salvarParticipante.mutateAsync(input)}
                onDelete={() => excluirParticipante.mutate(pessoa.id)}
                onFotos={() => setFotosDe({ kind: 'participantes', owner: pessoa })}
              />
            ))}
          </div>
        </section>

        <section className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-3 xl:col-start-2 xl:row-start-1 xl:min-h-0">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">2 · Compras</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setItemOpen(true)}>
              <Plus className="h-3 w-3" />
              Item
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {board.itens.length === 0 && (
              <p className="rounded-lg border border-dashed border-gold-border px-3 py-8 text-center text-sm text-cream-faint">
                Adicione o que precisa comprar. O preço fica salvo para a próxima vez.
              </p>
            )}
            {board.itens.map((item) => (
              <EventoItemCard
                key={item.id}
                item={item}
                catalogo={catalogo}
                onSave={(input) => salvarItem.mutateAsync(input)}
                onDelete={() => excluirItem.mutate(item.id)}
                onFotos={() => setFotosDe({ kind: 'itens', owner: item })}
              />
            ))}
          </div>
        </section>

        <EventoDocumentoPanel
          className="min-h-[520px] lg:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:min-h-0"
          paginas={board.paginas}
          onSave={(input) => salvarPagina.mutateAsync(input)}
          onNovaFolha={(secao) => criarFolha.mutateAsync(secao)}
          onExcluirFolha={(input) => excluirFolha.mutateAsync(input)}
        />

        <EventoTotaisPanel className="overflow-hidden xl:col-span-2 xl:col-start-1 xl:row-start-2 xl:min-h-0" totais={totais} itens={board.itens} />
      </div>

      <EventoParticipanteDialog
        open={pessoaOpen}
        onOpenChange={setPessoaOpen}
        onSave={async (input) => {
          await salvarParticipante.mutateAsync(input)
          setPessoaOpen(false)
        }}
      />
      <EventoItemDialog
        open={itemOpen}
        onOpenChange={setItemOpen}
        catalogo={catalogo}
        onSave={async (input) => {
          await salvarItem.mutateAsync(input)
          setItemOpen(false)
        }}
      />
      <EventoTarefasDialog
        open={tarefasOpen}
        onOpenChange={setTarefasOpen}
        eventoId={board.evento.id}
        titulo={board.evento.titulo}
        dataEvento={board.evento.data_evento}
      />
      <EventoPdfExportDialog open={pdfOpen} onOpenChange={setPdfOpen} board={board} branding={branding} />
      <EventoFolderDialog
        open={editPasta}
        onOpenChange={setEditPasta}
        pasta={board.evento}
        saving={atualizar.isPending}
        onSave={async (input) => {
          await atualizar.mutateAsync({ id: board.evento.id, ...input })
          setEditPasta(false)
        }}
      />
      {fotosDe && fotosOwner && (
        <EventoCardFotosSheet
          open
          onOpenChange={(open) => { if (!open) setFotosDe(null) }}
          titulo={fotosOwner.titulo}
          midias={fotosOwner.midias}
          branding={branding}
          onUpload={(file) => uploadFoto.mutateAsync({ kind: fotosDe.kind, ownerId: fotosOwner.ownerId, file })}
          onAnotacoes={(midiaId, anotacoes) => salvarAnotacoes.mutateAsync({ kind: fotosDe.kind, midiaId, anotacoes })}
          onDelete={(midia) => excluirFoto.mutateAsync({
            kind: fotosDe.kind,
            midiaId: midia.id,
            storagePath: midia.storage_path,
          })}
        />
      )}
    </div>
  )
}
