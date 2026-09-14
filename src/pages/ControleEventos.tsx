import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CreateTarefaPessoalDialog } from '@/components/agenda/CreateTarefaPessoalDialog'
import { EventoFolderCard } from '@/components/eventos/EventoFolderCard'
import { EventoFolderDialog } from '@/components/eventos/EventoFolderDialog'
import { EventoTarefasDialog } from '@/components/eventos/EventoTarefasDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useControleEventos } from '@/hooks/useControleEventos'
import { eventoCorrespondeBusca, parseDataEventoLocal } from '@/lib/evento-helpers'
import { getCurrentHora24h } from '@/lib/horarios-24h'
import type { EventoPastaCard } from '@/lib/evento-types'

export default function ControleEventos() {
  const navigate = useNavigate()
  const { pastas, loading, error, criar, atualizar, atualizarData, fixar, excluir } = useControleEventos()
  const [busca, setBusca] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<EventoPastaCard | null>(null)
  const [tarefasDe, setTarefasDe] = useState<EventoPastaCard | null>(null)
  const [novaTarefaDe, setNovaTarefaDe] = useState<EventoPastaCard | null>(null)
  const [excluirDe, setExcluirDe] = useState<EventoPastaCard | null>(null)

  const filtradas = useMemo(
    () => pastas.filter((pasta) => eventoCorrespondeBusca(pasta, busca)),
    [pastas, busca],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-1 pb-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold/70">Marketing · Dossiê</p>
          <h1 className="title-page">Controle de Eventos</h1>
          <p className="mt-1 max-w-xl text-sm text-cream-muted">
            Cada festa ou evento de arquitetos ganha uma pasta. Por fora: data, gente, gastos e o que falta. Por dentro: o caderno de quatro colunas.
          </p>
        </div>
        <button type="button" className="btn btn-proforco btn-md" onClick={() => { setEditando(null); setDialogOpen(true) }}>
          Nova pasta
        </button>
      </header>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-faint" />
        <Input
          aria-label="Buscar evento por nome, tipo ou data"
          className="h-10 pl-9"
          placeholder="Buscar evento por nome, tipo ou data…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !error && pastas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gold px-6 py-16 text-center">
          <p className="title-page text-2xl">Nenhuma pasta ainda</p>
          <p className="mt-2 text-sm text-cream-muted">Exemplo: Festa de fim de ano</p>
        </div>
      )}
      {!loading && pastas.length > 0 && filtradas.length === 0 && (
        <p className="text-sm text-cream-muted">A busca ignora acentos.</p>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtradas.map((pasta) => (
          <EventoFolderCard
            key={pasta.id}
            pasta={pasta}
            onOpen={() => navigate(`/controle-eventos/${pasta.id}`)}
            onPin={() => fixar.mutate({ id: pasta.id, fixado: !pasta.fixado })}
            onTarefas={() => setTarefasDe(pasta)}
            onAddTarefa={() => setNovaTarefaDe(pasta)}
            onEdit={() => { setEditando(pasta); setDialogOpen(true) }}
            onDelete={() => setExcluirDe(pasta)}
            onChangeDate={(iso) => atualizarData.mutate({ id: pasta.id, data_evento: iso })}
          />
        ))}
      </div>

      <EventoFolderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pasta={editando}
        saving={criar.isPending || atualizar.isPending}
        onSave={async (input) => {
          if (editando) {
            await atualizar.mutateAsync({ id: editando.id, ...input })
            setDialogOpen(false)
            return
          }
          const pasta = await criar.mutateAsync(input)
          setDialogOpen(false)
          navigate(`/controle-eventos/${pasta.id}`)
        }}
      />

      <EventoTarefasDialog
        open={Boolean(tarefasDe)}
        onOpenChange={(open) => { if (!open) setTarefasDe(null) }}
        eventoId={tarefasDe?.id ?? null}
        titulo={tarefasDe?.titulo ?? ''}
        dataEvento={tarefasDe?.data_evento ?? ''}
      />

      <CreateTarefaPessoalDialog
        open={Boolean(novaTarefaDe)}
        onOpenChange={(open) => { if (!open) setNovaTarefaDe(null) }}
        initialDate={novaTarefaDe ? parseDataEventoLocal(novaTarefaDe.data_evento) : undefined}
        initialHora={getCurrentHora24h()}
        eventoVinculo={
          novaTarefaDe
            ? { eventoId: novaTarefaDe.id, tituloEvento: novaTarefaDe.titulo }
            : null
        }
      />

      <AlertDialog open={Boolean(excluirDe)} onOpenChange={(open) => { if (!open) setExcluirDe(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga participantes, itens, tarefas e o caderno. Sem volta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluirDe) excluir.mutate(excluirDe.id)
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
