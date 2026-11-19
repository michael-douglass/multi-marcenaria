/**
 * M54 (Fase J) — Página bloqueada não aparece. Monta o menu como a sidebar monta
 * (`getVisibleNavMainItems` + `attachPipelineKanbanPages` + `flattenSidebarPages`, que também
 * alimenta a busca) para vários bloqueios e perfis, e confere:
 *   1. nenhuma página bloqueada aparece no menu/busca;
 *   2. toda página liberada que aparecia sem bloqueio continua aparecendo;
 *   3. a URL de cada página bloqueada (e sub-rota) é recusada por `paginaLiberada` (RoleRedirect/crmPage);
 *   4. a tela inicial (`homeLiberada`) nunca é uma página bloqueada.
 *
 * Uso: npx tsx --tsconfig tsconfig.app.json scripts/multi-empresa/check-paginas-visiveis.mjs
 */
import { attachPipelineKanbanPages, getVisibleNavMainItems } from '../../src/lib/app-navigation.ts'
import { flattenSidebarPages } from '../../src/lib/sidebar-search.ts'
import { homeLiberada, listarPaginas, paginaIdFromPath, paginaLiberada } from '../../src/lib/paginas-catalogo.ts'
import { KANBANS_PADRAO } from '../../src/lib/kanbans-padrao.ts'

const KANBANS = KANBANS_PADRAO.map((k, i) => ({ slug: k.slug, nome: k.titulo, ativo: true, ordem: i + 1 }))
const catalogo = listarPaginas()
const bloqueaveis = catalogo.filter(p => p.bloqueavel).map(p => p.id)

const PERFIS = {
  'admin geral': {
    roles: ['Administrador', 'Financeiro', 'AdministradorObras'],
    crmRoles: ['admin'],
    crmAdmin: true,
    home: '/dashboard',
  },
  'vendedor (só CRM)': { roles: [], crmRoles: ['vendedor'], crmAdmin: false, home: '/pipeline' },
}

const CENARIOS = {
  'Orçamentos IA': ['orcamentosIa'],
  'WhatsApp (função)': ['whatsappCrm'],
  'IA no card lead (função)': ['iaCardLead'],
  'Orçamentos IA + WhatsApp': ['orcamentosIa', 'whatsappCrm'],
  'WhatsApp + IA no card lead': ['whatsappCrm', 'iaCardLead'],
  'kanban Prospecção': ['pipelineKanban:prospeccao'],
  'Kanban principal (kanbans padrão continuam)': ['pipeline'],
  'Orçamentos IA + Contratos + Manutenção': ['orcamentosIa', 'contratosCrm', 'pipelineKanban:manutencao'],
  'todo o CRM': catalogo.filter(p => p.secao === 'CRM' && p.bloqueavel).map(p => p.id),
  'tudo que é bloqueável': bloqueaveis,
}

function menu(perfil, bloqueadas) {
  const { home: _h, ...ctx } = perfil
  const items = attachPipelineKanbanPages(
    getVisibleNavMainItems({ ...ctx, paginasBloqueadas: bloqueadas }),
    KANBANS,
    0,
    bloqueadas,
  )
  return flattenSidebarPages(items)
}

let falhas = 0
let checagens = 0
const ok = (cond, msg) => {
  checagens++
  if (!cond) {
    falhas++
    console.log(`  ✗ ${msg}`)
  }
}

for (const [nomePerfil, perfil] of Object.entries(PERFIS)) {
  const base = menu(perfil, [])
  const baseIds = new Set(base.map(h => h.id))
  for (const k of KANBANS) ok(baseIds.has(`pipelineKanban:${k.slug}`), `[${nomePerfil}] sem bloqueio, kanban ${k.nome} deveria aparecer`)
  // Funções (sem rota) nunca viram item de menu/busca, nem com tudo liberado.
  for (const f of catalogo.filter(p => p.tipo === 'funcao')) ok(!baseIds.has(f.id), `[${nomePerfil}] função ${f.id} não deveria aparecer no menu`)

  for (const [nomeCenario, bloqueadas] of Object.entries(CENARIOS)) {
    console.log(`• ${nomePerfil} — ${nomeCenario} (${bloqueadas.length} bloqueada(s))`)
    const hits = menu(perfil, bloqueadas)
    const ids = new Set(hits.map(h => h.id))
    const bloq = new Set(bloqueadas)

    // 1. nada bloqueado no menu/busca (pelo id e pela página da URL)
    for (const h of hits) {
      ok(!bloq.has(h.id), `[${nomePerfil}/${nomeCenario}] "${h.title}" (${h.id}) bloqueada mas aparece`)
      if (h.url) {
        const [path, q = ''] = h.url.split('?')
        const pid = paginaIdFromPath(path, q ? `?${q}` : '')
        ok(!pid || !bloq.has(pid), `[${nomePerfil}/${nomeCenario}] "${h.title}" leva a ${h.url}, página bloqueada ${pid}`)
      }
    }
    // 2. o que estava liberado continua
    for (const id of baseIds) {
      if (!bloq.has(id)) ok(ids.has(id), `[${nomePerfil}/${nomeCenario}] ${id} liberada sumiu do menu`)
    }
    // 3. URL direta recusada
    for (const id of bloqueadas) {
      const p = catalogo.find(x => x.id === id)
      if (!p) continue
      const [path, q = ''] = p.url.split('?')
      ok(!paginaLiberada(path, bloqueadas, q ? `?${q}` : ''), `[${nomeCenario}] URL ${p.url} de ${id} não foi recusada`)
      const sub = `${path}/qualquer`
      if (!q && paginaIdFromPath(sub) === id) ok(!paginaLiberada(sub, bloqueadas), `[${nomeCenario}] sub-rota ${sub} não foi recusada`)
    }
    // 4. tela inicial liberada
    const { home, ...ctx } = perfil
    const destino = homeLiberada(home, bloqueadas, ctx)
    const [hp, hq = ''] = destino.split('?')
    ok(paginaLiberada(hp, bloqueadas, hq ? `?${hq}` : ''), `[${nomePerfil}/${nomeCenario}] tela inicial ${destino} está bloqueada`)
  }
}

console.log(`\n${checagens} checagens, ${falhas} falha(s).`)
if (falhas) process.exit(1)
console.log('OK: página bloqueada não aparece no menu, na busca, na URL direta nem na tela inicial.')
