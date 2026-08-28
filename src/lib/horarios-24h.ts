/** Horários em formato 24h (00:00 até 23:45, a cada 15 min) */
export const HORARIOS_24H: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

/** Inclui horário atual se não estiver na grade padrão (ex.: 09:07). */
export function buildHoraOptions24h(current?: string | null): string[] {
  if (current && !HORARIOS_24H.includes(current)) {
    return [...HORARIOS_24H, current].sort();
  }
  return HORARIOS_24H;
}

/** Horário atual em HH:mm (ex.: "14:56") — usado ao abrir formulários de criação. */
export function getCurrentHora24h(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Arredonda o horário para o slot mais próximo da grade (passo em minutos).
 * Útil para selects que só listam :00 / :30.
 */
export function getNearestHoraSlot(
  date: Date = new Date(),
  stepMinutes = 15,
): string {
  const total = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.round(total / stepMinutes) * stepMinutes;
  const clamped = Math.min(Math.max(rounded, 0), 23 * 60 + (60 - stepMinutes));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}
