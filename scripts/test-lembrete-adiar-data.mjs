import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Lembrete — adiar data dentro da janela', () => {
  it('calendário do lembrete abre em camada modal e fecha ao escolher o dia', () => {
    const dialog = readSrc('src/components/agenda/LeadLembreteDialog.tsx')
    assert.match(dialog, /<Popover modal/)
    assert.match(dialog, /datePickerOpen/)
    assert.match(dialog, /Adiar 1 dia/)
    assert.match(dialog, /handleAdiarUmDia/)
    assert.match(dialog, /if \(datePickerOpen\) event\.preventDefault/)
    assert.doesNotMatch(dialog, /initialFocus/)
  })

  it('popover padrão é modal e sobe acima da janela da agenda', () => {
    const popover = readSrc('src/components/ui/popover.tsx')
    assert.match(popover, /modal = true/)
    assert.match(popover, /floatingNestedOverlayClass/)
    assert.match(popover, /pointer-events-auto/)
    assert.doesNotMatch(popover, /"z-50 w-72/)
  })

  it('clicar no calendário ou na hora não fecha a janela do lembrete', () => {
    const dialog = readSrc('src/components/ui/dialog.tsx')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    assert.match(dialog, /shouldPreventDialogOutsideClose/)
    assert.match(dialog, /onPointerDownOutside/)
    assert.match(guard, /data-date-picker-root/)
    assert.match(guard, /data-radix-popper-content-wrapper/)
  })
})
