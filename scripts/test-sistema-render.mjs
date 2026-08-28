import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('R0 — config de ambiente', () => {
  it('interruptor e prompts de ambiente existem no cliente', () => {
    const config = readSrc('src/lib/pipeline-lead-ai-config.ts')
    const hook = readSrc('src/hooks/usePipelineLeadAIConfig.ts')
    const settings = readSrc('src/components/pipeline/PipelineLeadAISettingsCard.tsx')
    assert.match(config, /renderAmbienteAtivo/)
    assert.match(config, /DEFAULT_AMBIENTE_ANALYSIS_PROMPT/)
    assert.match(hook, /render_ambiente_ativo/)
    assert.match(settings, /renderAmbienteAtivo/)
  })
})

describe('R1 — lousa de ambiente', () => {
  it('compositor, foil, toolbar e export JPEG estão no mapa do PRD', () => {
    const composer = readSrc('src/components/leads/LeadAIAmbienteComposer.tsx')
    const foil = readSrc('src/components/leads/ambiente/AmbienteAtmosphereFoil.tsx')
    const toolbar = readSrc('src/components/leads/ambiente/AmbienteDrawToolbar.tsx')
    const exp = readSrc('src/lib/lead-ai-ambiente-export.ts')
    assert.match(composer, /lead-ai-ambiente-composer/)
    assert.match(composer, /Compor ambiente/)
    assert.match(composer, /data-ambiente-toolbar="true"/)
    assert.match(composer, /AMBIENTE_FULLSCREEN_ATTR/)
    assert.match(foil, /powerPreference: 'low-power'/)
    assert.match(toolbar, /data-ambiente-draw-toolbar/)
    assert.match(exp, /exportAmbienteCompositionToJpeg/)
  })
})

describe('R2 — três botões no card', () => {
  it('a aba de render tem os três caminhos do PRD', () => {
    const tab = readSrc('src/components/leads/LeadAIRenderTab.tsx')
    assert.match(tab, /Editar por pontos/)
    assert.match(tab, /Renderizar projeto/)
    assert.match(tab, /Renderizar com ambiente/)
    assert.match(tab, /LeadAIAmbienteComposer/)
    assert.match(tab, /AmbienteAtmosphereFoil/)
  })
})

describe('R3 — jobs, histórico e fullscreen', () => {
  it('contexto tem fila de ambiente e o modal não fecha na lousa cheia', () => {
    const ctx = readSrc('src/contexts/LeadAIRenderBackgroundContext.tsx')
    const history = readSrc('src/components/leads/LeadAIRenderHistoryPanel.tsx')
    const modal = readSrc('src/components/leads/LeadModal.tsx')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    assert.match(ctx, /startBackgroundAmbienteRender/)
    assert.match(ctx, /ambienteJobs/)
    assert.match(history, /mode === 'ambiente'/)
    assert.match(guard, /AMBIENTE_FULLSCREEN_ATTR/)
    assert.match(modal, /AMBIENTE_FULLSCREEN_ATTR/)
  })
})

describe('R4 — motor render-lead-ambiente', () => {
  it('API e Edge usam analyze/render e não expõem a chave', () => {
    const api = readSrc('src/lib/render-lead-ambiente-api.ts')
    const fn = readSrc('supabase/functions/render-lead-ambiente/index.ts')
    assert.match(api, /render-lead-ambiente/)
    assert.match(api, /invokeAnalyzeLeadAmbiente/)
    assert.match(fn, /action\?: 'analyze' \| 'render'/)
    assert.match(fn, /action === 'analyze'/)
    assert.match(fn, /action === 'render'/)
    assert.doesNotMatch(fn, /VITE_/)
  })
})

describe('R5 — anexos da lousa de ambiente', () => {
  it('sabe guardar a cópia numa pasta do lead', () => {
    const hook = readSrc('src/hooks/useLeadPDFs.ts')
    assert.match(hook, /uploadAttachment/)
    assert.match(hook, /titulo\?: string \| null/)
  })
})
