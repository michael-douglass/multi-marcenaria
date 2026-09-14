/** Visões unificadas da página de obras (`/agenda-obras?view=`). */
export type AgendaObraView = 'filas' | 'kanban' | 'calendario'

export const AGENDA_OBRA_VIEWS: AgendaObraView[] = ['filas', 'kanban', 'calendario']

export const AGENDA_OBRA_VIEW_LABEL: Record<AgendaObraView, string> = {
  filas: 'Filas',
  kanban: 'Kanban',
  calendario: 'Calendário',
}

export const AGENDA_OBRAS_DEFAULT_VIEW: AgendaObraView = 'filas'

export function parseAgendaObraView(raw: string | null | undefined): AgendaObraView {
  if (raw === 'kanban' || raw === 'calendario' || raw === 'filas') return raw
  return AGENDA_OBRAS_DEFAULT_VIEW
}

/** Atualiza `?view=` preservando os demais params (ex.: `obra=`). */
export function setAgendaObraViewParam(
  searchParams: URLSearchParams,
  view: AgendaObraView,
): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  if (view === AGENDA_OBRAS_DEFAULT_VIEW) next.delete('view')
  else next.set('view', view)
  return next
}
