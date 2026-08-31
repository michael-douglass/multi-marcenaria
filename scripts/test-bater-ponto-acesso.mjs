/**
 * Bater ponto: só funcionário cadastrado + página leve (sem WebGL).
 * Rodar: node --test scripts/test-bater-ponto-acesso.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('bater ponto — só funcionário cadastrado', () => {
  it('tipos de pasta que batem ponto não incluem financeiro', () => {
    const constants = readSrc('src/lib/funcionario-constants.ts')
    assert.match(constants, /TIPOS_FUNCIONARIO_PONTO/)
    assert.match(constants, /podeBaterPontoPorTipo/)
    assert.match(constants, /montador_admin/)
    assert.match(constants, /administrador_obras/)
    const block = constants.slice(
      constants.indexOf('TIPOS_FUNCIONARIO_PONTO'),
      constants.indexOf('podeBaterPontoPorTipo'),
    )
    assert.doesNotMatch(block, /financeiro/)
  })

  it('a página de ponto exige cadastro, não só o perfil de login', () => {
    const page = readSrc('src/pages/PontoPage.tsx')
    assert.match(page, /useMeuFuncionario/)
    assert.match(page, /podeBaterPontoPorTipo/)
    assert.match(page, /Só funcionários cadastrados pela empresa podem bater ponto/)
    assert.doesNotMatch(page, /isFuncionarioCampo/)
  })

  it('o sino de ponto no topo só aparece com pasta cadastrada', () => {
    const header = readSrc('src/components/layout/NavigationHeader.tsx')
    assert.match(header, /useMeuFuncionario/)
    assert.match(header, /podeBaterPontoPorTipo/)
    assert.doesNotMatch(header, /isFuncionarioCampo/)
  })
})

describe('bater ponto — sem WebGL em computador antigo', () => {
  it('o sistema testa WebGL uma vez e não insiste se falhar', () => {
    const support = readSrc('src/lib/webgl-support.ts')
    assert.match(support, /failIfMajorPerformanceCaveat/)
    assert.match(support, /tryCreateWebGLRenderer/)
    assert.match(support, /markWebGLUnavailable/)
    assert.match(support, /isPontoLightPath/)
  })

  it('a tela de ponto não liga o fundo 3D nem os efeitos do menu', () => {
    const layout = readSrc('src/components/layout/MainLayout.tsx')
    const sidebar = readSrc('src/components/layout/AppSidebar.tsx')
    const search = readSrc('src/components/layout/SidebarSearchField.tsx')
    assert.match(layout, /isPontoLightPath/)
    assert.match(layout, /!hideFabsOnPonto \? <AppPaperAura/)
    assert.match(sidebar, /skipWebGL/)
    assert.match(sidebar, /disableAura=\{skipWebGL\}/)
    assert.match(search, /disableAura/)
  })

  it('os efeitos 3D do layout usam o teste antes de criar o Three.js', () => {
    const paper = readSrc('src/components/layout/AppPaperAura.tsx')
    const ribbon = readSrc('src/components/layout/SidebarAmberRibbon.tsx')
    const search = readSrc('src/components/layout/SidebarSearchAura.tsx')
    for (const src of [paper, ribbon, search]) {
      assert.match(src, /tryCreateWebGLRenderer/)
      assert.match(src, /failIfMajorPerformanceCaveat: true/)
    }
  })
})
