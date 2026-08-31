import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function orcamentosDoLead(lista, leadId) {
  return lista
    .filter(item => item.lead_id === leadId)
    .sort((a, b) => String(b.atualizado_em ?? '').localeCompare(String(a.atualizado_em ?? '')))
}

describe('Épico 11 — ficha do lead', () => {
  it('orçamentos do lead ficam no lead certo, mais recente primeiro', () => {
    const lista = [
      { lead_id: 1, id: 'a', atualizado_em: '2026-01-01' },
      { lead_id: 2, id: 'b', atualizado_em: '2026-08-01' },
      { lead_id: 1, id: 'c', atualizado_em: '2026-08-20' },
    ]
    assert.deepEqual(orcamentosDoLead(lista, 1).map(i => i.id), ['c', 'a'])
  })

  it('ficha tem abas Detalhes e Análise IA, markup embutido e WhatsApp', () => {
    const modal = readSrc('src/components/crm/PipelineLeadModal.tsx')
    assert.match(modal, /Detalhes/)
    assert.match(modal, /Análise IA/)
    assert.match(modal, /MarkupLeadSection/)
    assert.match(modal, /LeadWhatsAppPanel/)
    assert.match(modal, /LeadIaPanel/)
    assert.match(modal, /Materiais do lead/)
    assert.doesNotMatch(modal, /Módulos do card/)
  })

  it('visualização de orçamento em slides rola por cima do card', () => {
    const secao = readSrc('src/components/leads/LeadOrcamentoSlidesSection.tsx')
    const apresentacao = readSrc('src/components/orcamento-slides/OrcamentoSlideApresentacao.tsx')
    const passthrough = readSrc('src/lib/overlay-scroll-passthrough.ts')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    assert.match(secao, /data-orcamento-visualizar/)
    assert.match(secao, /overflow-visible overscroll-y-contain/)
    assert.match(secao, /bindOrcamentoVisualizarScrollPassthrough/)
    assert.match(apresentacao, /overscroll-y-contain touch-pan-y/)
    assert.match(passthrough, /window\.addEventListener\('wheel'/)
    assert.match(passthrough, /document\.addEventListener\('wheel'/)
    assert.match(passthrough, /event\.stopPropagation\(\)/)
    assert.match(passthrough, /scrollOrcamentoVisualizarBy\(event\.deltaY/)
    assert.match(secao, /onWheel/)
    assert.match(guard, /export function isOrcamentoVisualizarOpen/)
  })

  it('exportar da visualização abre o menu por cima e captura os slides', () => {
    const menu = readSrc('src/components/orcamento-slides/OrcamentoSlideExportMenu.tsx')
    const hook = readSrc('src/hooks/useOrcamentoSlideExport.tsx')
    const z = readSrc('src/lib/overlay-z-index.ts')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    const ficha = readSrc('src/components/leads/LeadModal.tsx')
    assert.match(menu, /<DropdownMenu modal>/)
    assert.match(menu, /onPointerDownOutside=\{\(event\) => event\.preventDefault\(\)\}/)
    assert.match(menu, /container=\{portalContainer\}/)
    assert.match(menu, /orcamentoVisualizarNestedClass/)
    assert.match(menu, /!bg-\[#2a1812\]/)
    assert.match(menu, /pointer-events-auto/)
    assert.match(ficha, /modal=\{!orcamentoVisualizarOpen\}/)
    assert.match(guard, /subscribeOrcamentoVisualizarOpen/)
    assert.match(hook, /Sem opacity:0/)
    assert.doesNotMatch(hook, /opacity: 0/)
    assert.match(z, /Z_ORCAMENTO_VISUALIZAR_NESTED = 260/)
    assert.match(guard, /data-orcamento-export-menu/)
  })

  it('baixar PNG/PDF do render abre o menu por cima da tela cheia', () => {
    const menu = readSrc('src/components/leads/LeadAIRenderDownloadMenu.tsx')
    const exportLib = readSrc('src/lib/lead-ai-render-export.ts')
    const download = readSrc('src/lib/download-file.ts')
    const fullscreen = readSrc('src/components/leads/LeadAIImageFullscreenDialog.tsx')
    const compare = readSrc('src/components/leads/LeadAIRenderFullscreenDialog.tsx')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    const z = readSrc('src/lib/overlay-z-index.ts')
    assert.match(menu, /modal=\{menuModal\}/)
    assert.match(menu, /menuModal = false/)
    assert.doesNotMatch(menu, /onPointerDownOutside=\{\(event\) => event\.preventDefault\(\)\}/)
    assert.match(menu, /onFocusOutside=\{\(event\) => event\.preventDefault\(\)\}/)
    assert.match(menu, /data-lead-ai-render-download-menu/)
    assert.match(menu, /leadNestedMenuClass/)
    assert.match(fullscreen, /data-lead-ai-image-fullscreen/)
    assert.match(compare, /data-lead-ai-render-fullscreen/)
    assert.match(guard, /data-lead-ai-render-download-menu/)
    assert.match(z, /Z_LEAD_NESTED_MENU = 80/)
    assert.match(exportLib, /from 'jspdf'/)
    assert.match(exportLib, /triggerBlobDownload\(blob/)
    assert.match(download, /downloadImageViaCanvas/)
    assert.doesNotMatch(exportLib, /window\.open/)
  })

  it('tela cheia da composição não cancela clique nem foco', () => {
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    const dialog = readSrc('src/components/ui/dialog.tsx')
    const ficha = readSrc('src/components/leads/LeadModal.tsx')
    const composer = readSrc('src/components/leads/LeadAIAmbienteComposer.tsx')
    assert.match(guard, /export function isLeadNestedLayerEvent/)
    assert.match(guard, /data-ambiente-composer-fullscreen/)
    assert.match(guard, /setAmbienteFullscreenOpenFlag/)
    assert.match(dialog, /isLeadNestedLayerEvent\(event\)/)
    assert.match(ficha, /modal=\{!orcamentoVisualizarOpen\}/)
    assert.match(ficha, /if \(isLeadNestedLayerEvent\(e\)\) return/)
    assert.match(composer, /updateFullscreen/)
    assert.match(composer, /setAmbienteFullscreenOpenFlag/)
  })

  it('clique no fundo fecha o card; atualizar a página reabre pelo ?id=', () => {
    const ficha = readSrc('src/components/leads/LeadModal.tsx')
    const dialog = readSrc('src/components/ui/dialog.tsx')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    const pipeline = readSrc('src/pages/Pipeline.tsx')
    assert.match(ficha, /onOverlayClick/)
    assert.match(ficha, /isPrimaryDialogBackdrop/)
    assert.match(ficha, /shouldBlockLeadModalBackdropClose/)
    assert.match(dialog, /onOverlayClick/)
    assert.match(dialog, /if \(onOverlayClick\) event\.preventDefault/)
    assert.match(guard, /swallowClickThroughAfterDialogClose/)
    assert.match(pipeline, /leadIdFromUrl/)
    assert.match(pipeline, /\[leadIdFromUrl, tabFromUrl, iaSubtabFromUrl\]/)
  })

  it('seção de markup lista, cria e abre existente', () => {
    const src = readSrc('src/components/crm/MarkupLeadSection.tsx')
    assert.match(src, /Novo markup/)
    assert.match(src, /Abrir calculadora/)
    assert.match(src, /MarkupCardPreview/)
    assert.match(src, /readOnly/)
  })

  it('página passa os orçamentos do lead e fecha a ficha ao abrir a calculadora', () => {
    const page = readSrc('src/pages/crm/PipelinePage.tsx')
    assert.match(page, /orcamentosDoLead/)
    assert.match(page, /markupItens/)
    assert.match(page, /abrirMarkupDoLead\(current, orcamentoId\)/)
    const lib = readSrc('src/lib/crm-markup.ts')
    assert.match(lib, /export function orcamentosDoLead/)
  })
})
