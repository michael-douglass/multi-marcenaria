import { useState } from 'react'
import { CheckCircle, Loader2, Play, RotateCcw, Users } from 'lucide-react'
import { ObraEquipeConfirmBackdrop } from '@/components/obras/ObraEquipeConfirmBackdrop'
import {
  podeComandarEquipeObra,
  podeExibirBotaoConcluirObra,
  podeExibirBotaoIniciarObra,
  podeExibirBotaoReabrirObra,
} from '@/lib/obra-permissions'
import { cn } from '@/lib/utils'
import type { ObraFull, UserRole } from '@/types'

type EquipeConfirmKind = 'iniciar' | 'concluir' | 'reabrir'

interface ObraEquipeActionBarProps {
  obra: ObraFull
  roles: UserRole[]
  canEdit: boolean
  isMontador: boolean
  montadorUserId?: string | null
  loading?: boolean
  onIniciar: (id: string) => void
  onConcluir: (id: string) => void
  onReabrir?: (id: string) => void
  compact?: boolean
  dense?: boolean
  className?: string
}

/** Botões no card: iniciar, concluir e reabrir. No admin, a marcação vale para toda a equipe. */
export function ObraEquipeActionBar({
  obra,
  roles,
  canEdit,
  isMontador,
  montadorUserId,
  loading = false,
  onIniciar,
  onConcluir,
  onReabrir,
  compact = false,
  dense = false,
  className,
}: ObraEquipeActionBarProps) {
  const [confirm, setConfirm] = useState<EquipeConfirmKind | null>(null)
  const comandaEquipe = podeComandarEquipeObra(roles)
  const mostrarIniciar = podeExibirBotaoIniciarObra({
    obra,
    roles,
    canEdit,
    isMontador,
    montadorUserId,
  })
  const mostrarConcluir = podeExibirBotaoConcluirObra({
    obra,
    roles,
    canEdit,
    isMontador,
    montadorUserId,
  })
  const mostrarReabrir = !!onReabrir && podeExibirBotaoReabrirObra({ obra, roles })

  if (!mostrarIniciar && !mostrarConcluir && !mostrarReabrir) return null

  const pedirOuExecutar = (kind: EquipeConfirmKind, run: () => void) => {
    if (comandaEquipe) {
      setConfirm(kind)
      return
    }
    run()
  }

  const confirmar = () => {
    if (confirm === 'iniciar') onIniciar(obra.id)
    if (confirm === 'concluir') onConcluir(obra.id)
    if (confirm === 'reabrir') onReabrir?.(obra.id)
    setConfirm(null)
  }

  return (
    <div
      className={cn('obra-equipe-actions', dense && 'obra-equipe-actions--dense', className)}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {confirm ? (
        <div
          className={cn(
            'obra-equipe-confirm',
            confirm === 'concluir' && 'obra-equipe-confirm--done',
            confirm === 'reabrir' && 'obra-equipe-confirm--reopen',
          )}
          role="group"
          aria-label={
            confirm === 'iniciar'
              ? 'Confirmar início para toda a equipe'
              : confirm === 'concluir'
                ? 'Confirmar conclusão para toda a equipe'
                : 'Confirmar reabertura da obra'
          }
        >
          <ObraEquipeConfirmBackdrop tone={confirm === 'concluir' ? 1 : 0} />
          <p className="obra-equipe-confirm__text">
            <Users size={dense ? 10 : 12} aria-hidden />
            {confirm === 'iniciar'
              ? 'Inicia para todos os montadores desta obra.'
              : confirm === 'concluir'
                ? 'Conclui para todos os montadores desta obra.'
                : 'Reabre a obra e devolve a comissão para como estava antes de concluir.'}
          </p>
          <div className="obra-equipe-confirm__btns">
            <button
              type="button"
              className="obra-equipe-confirm__no"
              disabled={loading}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="obra-equipe-confirm__yes"
              disabled={loading}
              onClick={confirmar}
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : null}
              Confirmar
            </button>
          </div>
        </div>
      ) : (
        <div className="obra-equipe-actions__row">
          {mostrarIniciar && (
            <button
              type="button"
              disabled={loading}
              className={cn('obra-equipe-btn obra-equipe-btn--start', compact && 'obra-equipe-btn--compact')}
              title={comandaEquipe ? 'Iniciar a obra para toda a equipe' : 'Iniciar a obra'}
              onClick={() => pedirOuExecutar('iniciar', () => onIniciar(obra.id))}
            >
              {loading ? <Loader2 size={dense ? 10 : 12} className="animate-spin shrink-0" /> : <Play size={dense ? 10 : 12} className="shrink-0" />}
              <span>{comandaEquipe ? (dense ? 'Iniciar' : 'Iniciar equipe') : 'Iniciar'}</span>
            </button>
          )}
          {mostrarConcluir && (
            <button
              type="button"
              disabled={loading}
              className={cn('obra-equipe-btn obra-equipe-btn--done', compact && 'obra-equipe-btn--compact')}
              title={comandaEquipe ? 'Concluir a obra para toda a equipe' : 'Marcar como concluída'}
              onClick={() => pedirOuExecutar('concluir', () => onConcluir(obra.id))}
            >
              {loading ? <Loader2 size={dense ? 10 : 12} className="animate-spin shrink-0" /> : <CheckCircle size={dense ? 10 : 12} className="shrink-0" />}
              <span>{comandaEquipe ? (dense ? 'Concluir' : 'Concluir equipe') : 'Concluir'}</span>
            </button>
          )}
          {mostrarReabrir && (
            <button
              type="button"
              disabled={loading}
              className={cn('obra-equipe-btn obra-equipe-btn--reopen', compact && 'obra-equipe-btn--compact')}
              title="Reabrir a obra e devolver a comissão à previsão"
              onClick={() => pedirOuExecutar('reabrir', () => onReabrir?.(obra.id))}
            >
              {loading ? <Loader2 size={dense ? 10 : 12} className="animate-spin shrink-0" /> : <RotateCcw size={dense ? 10 : 12} className="shrink-0" />}
              <span>Reabrir</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
