/**
 * Testes estáticos da unificação CRM Selletos (épicos 0–20).
 * Rode: node scripts/test-crm-unificacao.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const src = (p) => join(root, 'src', p)
const fail = []
const ok = []

function read(p) {
  return readFileSync(p, 'utf8')
}

function mustExist(rel, label) {
  const p = join(root, rel)
  if (!existsSync(p)) fail.push(`faltou ${label}: ${rel}`)
  else ok.push(label)
}

function mustContain(rel, needle, label) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    fail.push(`faltou arquivo ${rel}`)
    return
  }
  const t = read(p)
  if (!t.includes(needle)) fail.push(`${label}: não achou "${needle}" em ${rel}`)
  else ok.push(label)
}

mustContain('src/index.css', '--background:       15 40% 12%', 'DNA HSL background')
mustContain('src/index.css', '--primary:          43 78% 76%', 'DNA HSL primary')
mustContain('src/index.css', '--color-gold-on', 'DNA gold-on')
mustContain('src/index.css', '.glass-dialog', 'glass-dialog')
mustContain('src/index.css', '.title-display', 'title-display')
mustContain('index.html', 'Cormorant+Garamond', 'fonte Cormorant')
mustContain('index.html', '#2a1812', 'theme-color mogno')
mustContain('src/lib/empresa-tables.ts', 'emp_garbo', 'empresa-tables emp_garbo')
mustContain('src/lib/empresa-tables.ts', 'CRM-multi-empresas>leads<', 'tabela master leads')
mustContain('src/contexts/EmpresaContext.tsx', "schema_nome: 'emp_garbo'", 'empresa congelada')
mustContain('src/lib/adapters.ts', 'adaptLeadFromDatabase', 'adapter de lead')
mustContain('src/main.tsx', 'garbo-crm-rq-cache-v1', 'cache RQ persistido')
mustContain('src/lib/app-navigation.ts', "title: 'CRM'", 'menu pai CRM')
mustExist('src/pages/Pipeline.tsx', 'Pipeline GitHub')
mustExist('src/pages/PipelineSettings.tsx', 'Pipeline settings')
mustExist('src/components/leads/LeadModal.tsx', 'LeadModal')
mustExist('src/pages/Leads.tsx', 'lista de leads')
mustExist('src/pages/Agenda.tsx', 'agenda comercial')
mustExist('src/pages/Prestador.tsx', 'portal prestador')
mustExist('src/pages/contratos/ContratosPage.tsx', 'contratos')
mustExist('src/pages/markup/MarkupListPage.tsx', 'markup')
mustExist('src/pages/orcamento-slides/ApresentarOrcamentoSlidePage.tsx', 'slides apresentar')
mustExist('src/pages/MarketingConteudo.tsx', 'marketing conteúdo')
mustExist('src/components/marketing/apresentacao-empresa/GarboPontuaPointsScene.tsx', 'cena Pontua 3D')
mustContain('src/components/marketing/apresentacao-empresa/GarboPontuaPointsScene.tsx', 'ShaderMaterial', 'shader fresnel no núcleo')
mustContain('src/components/marketing/apresentacao-empresa/GarboPontuaPointsScene.tsx', 'prefers-reduced-motion', 'reduced motion Pontua')
mustExist('src/pages/ControleGastos.tsx', 'controle de gastos')
mustExist('src/pages/Financeiro.tsx', 'financeiro Pontua')
mustExist('src/pages/Automacoes.tsx', 'automações')
mustExist('src/pages/WebhooksConfig.tsx', 'webhooks')
mustExist('src/pages/CrmBiblioteca.tsx', 'biblioteca CRM')
mustExist('src/pages/Admin.tsx', 'admin usuários')
mustExist('src/pages/AgendamentoPublico.tsx', 'agenda pública')
mustContain('src/App.tsx', '/pipeline/configuracoes', 'rota config pipeline')
mustContain('src/App.tsx', '/apresentacao/garbo', 'rota apresentação pública')
mustContain('src/App.tsx', '/caixa', 'rota caixa intacta')
mustContain('src/components/layout/MainLayout.tsx', 'useKanbanRealtimeSync', 'realtime no casco')
mustContain('src/components/layout/MainLayout.tsx', 'isCrmArea', 'FABs fábrica somem no CRM')
mustContain('src/components/layout/MainLayout.tsx', 'CrmSelletosDock', 'dock Selletos no CRM')
mustExist('supabase/functions/_shared/render-prompts.ts', 'prompts de render IA')
mustExist('src/pages/Caixa.tsx', 'página Caixa')
mustExist('src/pages/Login.tsx', 'login fábrica')

if (existsSync(src('pages/Projetos.tsx'))) ok.push('Projetos presente')
else ok.push('Projetos ausente no GitHub clone — épico 6 pulado com registro')

if (existsSync(src('pages/ControleEventos.tsx'))) ok.push('ControleEventos presente')
else ok.push('ControleEventos ausente no GitHub clone — épico 14 eventos usa EventosCrmPage')

console.log(`OK ${ok.length}  FAIL ${fail.length}`)
for (const f of fail) console.error(' -', f)
if (fail.length) process.exit(1)
