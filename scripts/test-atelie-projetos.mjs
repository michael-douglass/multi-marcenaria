import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function normalize(nome) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function looksWaiting(nome) {
  const n = normalize(nome)
  return n.includes('aguardando') || n.includes('aguadando') || n.includes('fila')
}

function looksVisita(nome) {
  return normalize(nome).includes('visita')
}

function classify(stage, stages) {
  const ordered = [...stages].sort((a, b) => a.ordem - b.ordem)
  const last = ordered.length >= 2 ? ordered[ordered.length - 1] : null
  if (last && stage.id === last.id) return 'feito'
  if (looksVisita(stage.nome)) return 'visita'
  if (looksWaiting(stage.nome)) return 'waiting'
  return 'other'
}

const STAGES = [
  { id: '1', nome: 'Visita agendada', ordem: 0 },
  { id: '2', nome: 'Projetos aguardando serem feitos', ordem: 1 },
  { id: '3', nome: 'Projetos Urgentes aguadando serem feitos', ordem: 2 },
  { id: '4', nome: 'Projetos semi prontos para orçamentos', ordem: 3 },
  { id: '5', nome: 'Projetos feitos', ordem: 4 },
]

describe('P0 — domínio do ateliê', () => {
  it('classifica as 5 colunas reais pelo nome (incluindo o typo aguadando)', () => {
    assert.equal(classify(STAGES[0], STAGES), 'visita')
    assert.equal(classify(STAGES[1], STAGES), 'waiting')
    assert.equal(classify(STAGES[2], STAGES), 'waiting')
    assert.equal(classify(STAGES[3], STAGES), 'other')
    assert.equal(classify(STAGES[4], STAGES), 'feito')
  })

  it('em desenho exige arquiteto_id e fila desligada', () => {
    const lib = readSrc('src/lib/projetos-atelie.ts')
    assert.match(lib, /arquiteto_id/)
    assert.match(lib, /aguardando_resposta !== true/)
    assert.match(lib, /aguadando/)
    assert.match(lib, /getWaitingProjetoStageId/)
  })

  it('papéis estão em app-roles e o menu esconde Pipeline do projetista-only', () => {
    const roles = readSrc('src/lib/app-roles.ts')
    const nav = readSrc('src/lib/app-navigation.ts')
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(roles, /export function isProjetistaOnly/)
    assert.match(roles, /export function isProjetistaAdminRole/)
    assert.match(roles, /export function canAccessProjetosBoard/)
    assert.match(nav, /hideIfProjetistaOnly/)
    assert.match(identity, /pathname.startsWith\('\/pipeline'\)/)
    assert.match(identity, /isProjetistaOnlyCrm/)
  })

  it('hooks têm pegar, soltar, puxar, realtime e chat', () => {
    const hook = readSrc('src/hooks/useLeadProjetos.ts')
    assert.match(hook, /useLeadProjetos\(/)
    assert.match(hook, /realtime/)
    assert.match(hook, /pegar/)
    assert.match(hook, /puxarParaProjeto/)
    assert.match(hook, /useLeadProjetoNotas/)
    assert.match(hook, /useLeadProjetoChatBoard/)
    assert.match(hook, /useCriarLeadProjeto/)
  })
})

describe('P1 — casco da página + auras', () => {
  it('página ocupa a altura e usa o fundo WebGL, não o CrmPageFrame', () => {
    const page = readSrc('src/pages/Projetos.tsx')
    assert.match(page, /ProjetosBoardAura/)
    assert.match(page, /ProjetosAbertosCard/)
    assert.match(page, /ProjetosChatPreview/)
    assert.match(page, /KanbanPageZoomControls/)
    assert.match(page, /SETOR/)
    assert.doesNotMatch(page, /CrmPageFrame/)
    assert.match(page, /pointerWithin/)
    assert.match(page, /distance: 8/)
    assert.match(page, /searchParams.get\('id'\)/)
  })

  it('auras WebGL usam low-power e congelam reduced-motion', () => {
    const hook = readSrc('src/hooks/useAtelieShaderPlane.ts')
    assert.match(hook, /powerPreference: 'low-power'/)
    assert.match(hook, /antialias: false/)
    assert.match(hook, /prefers-reduced-motion/)
  })
})

describe('P2 — card do ateliê + selo da Pipeline', () => {
  it('card tem lâmpada, titular e ações com stopPropagation', () => {
    const card = readSrc('src/components/projetos/ProjetoKanbanCard.tsx')
    assert.match(card, /ProjetoClaimedAura/)
    assert.match(card, /Aguardando projetista/)
    assert.match(card, /stopPropagation/)
    assert.match(card, /projeto-card-claimed/)
  })

  it('Pipeline ganha selo CSS sem canvas', () => {
    const signal = readSrc('src/components/kanban/KanbanProjetoSignal.tsx')
    const kanban = readSrc('src/components/kanban/KanbanCard.tsx')
    const pipeline = readSrc('src/pages/Pipeline.tsx')
    assert.match(signal, /Aguardando projetista/)
    assert.match(signal, /Em desenho agora/)
    assert.match(signal, /Projeto feito/)
    assert.doesNotMatch(signal, /THREE/)
    assert.match(kanban, /KanbanProjetoSignal/)
    assert.match(kanban, /LeadProjetoCardActions/)
    assert.match(pipeline, /useLeadProjetos\(\{ realtime: true \}\)/)
  })

  it('card da Pipeline envia ao setor e abre o canal de mensagens', () => {
    const actions = readSrc('src/components/projetos/LeadProjetoCardActions.tsx')
    const enviar = readSrc('src/components/projetos/LeadEnviarProjetoDialog.tsx')
    const canal = readSrc('src/components/projetos/LeadProjetoCanalDialog.tsx')
    assert.match(actions, /LeadEnviarProjetoDialog/)
    assert.match(actions, /LeadProjetoCanalDialog/)
    assert.match(actions, /onEnviado/)
    assert.match(enviar, /canEnviarDaPipeline/)
    assert.match(enviar, /variant === 'card'/)
    assert.match(enviar, /Enviar ao setor/)
    assert.match(enviar, /Solicitar de novo/)
    assert.match(canal, /Canal do ateliê/)
    assert.match(canal, /ProjetoChatComposer/)
    assert.match(canal, /ProjetoChatThread/)
  })
})

describe('P3 — chat / rádio', () => {
  it('rádio, thread, composer e upload da pasta chat existem', () => {
    const radio = readSrc('src/components/projetos/ProjetosChatPreview.tsx')
    const composer = readSrc('src/components/projetos/ProjetoChatComposer.tsx')
    const chat = readSrc('src/lib/lead-projeto-chat.ts')
    assert.match(radio, /RÁDIO/)
    assert.match(radio, /Abrir card/)
    assert.match(radio, /minmax\(18rem,22rem\)/)
    assert.match(radio, /line-clamp-2/)
    assert.match(radio, /ProjetosChatSheetAura/)
    assert.match(radio, /sm:max-w-3xl/)
    assert.match(composer, /Ctrl\/Cmd|ctrlKey|metaKey/)
    assert.match(composer, /MAX_CHAT_MENSAGEM/)
    assert.match(chat, /LEAD_CHAT_FOLDER_NAME/)
    assert.match(chat, /marketing-medias/)
    assert.match(chat, /\/chat\//)
  })
})

describe('P4 — LeadModal ateliê + envio da Pipeline', () => {
  it('modal recebe contextoProjeto e modoProjeto', () => {
    const modal = readSrc('src/components/leads/LeadModal.tsx')
    const page = readSrc('src/pages/Projetos.tsx')
    const dialog = readSrc('src/components/projetos/LeadEnviarProjetoDialog.tsx')
    assert.match(modal, /contextoProjeto/)
    assert.match(modal, /modoProjeto/)
    assert.match(modal, /LeadProjetoConclusaoPanel/)
    assert.match(modal, /LeadProjetoComposicaoSection/)
    assert.match(modal, /ocultarEnvioInicial|LeadProjetoPanel/)
    assert.match(page, /contextoProjeto/)
    assert.match(page, /modoProjeto=\{projetistaOnly\}/)
    assert.match(page, /statusChangeOnSelect=\{false\}/)
    assert.match(dialog, /MIN_CARACTERES_ENVIO_SETOR/)
    assert.match(dialog, /MAX_IMAGENS_ENVIO_SETOR/)
  })
})

describe('P5 — busca, novo lead, colunas', () => {
  it('busca tem dois escopos e novo lead não abre recado', () => {
    const search = readSrc('src/components/projetos/ProjetosLeadSearch.tsx')
    const criar = readSrc('src/components/projetos/CriarLeadProjetoDialog.tsx')
    const cols = readSrc('src/components/projetos/ProjetoStagesConfigDialog.tsx')
    const page = readSrc('src/pages/Projetos.tsx')
    assert.match(search, /Neste quadro/)
    assert.match(search, /Todos os leads/)
    assert.match(search, /MIN_CARACTERES_BUSCA_PROJETOS/)
    assert.match(search, /300/)
    assert.match(criar, /Criar na fila/)
    assert.match(cols, /Colunas do ateliê/)
    assert.match(page, /askConfirm\('puxar'/)
  })
})
