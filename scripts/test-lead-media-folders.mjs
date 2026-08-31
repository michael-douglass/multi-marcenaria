import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function normalizeFolderName(nome) {
  return (nome ?? '').trim().replace(/\s+/g, ' ')
}

function findFolderByName(folders, nome) {
  const normalized = normalizeFolderName(nome).toLowerCase()
  if (!normalized) return undefined
  return folders.find((folder) => folder.nome.trim().toLowerCase() === normalized)
}

function isAttachmentInLeadFolder(folderId, leadFolderIds) {
  return Boolean(folderId) && leadFolderIds.has(folderId)
}

describe('PRD pastas do card do lead', () => {
  it('Sem pasta é id virtual e não vai para o banco', () => {
    const helpers = readSrc('src/lib/lead-media-folders.ts')
    const upload = readSrc('src/hooks/useLeadPDFs.ts')
    const ui = readSrc('src/components/leads/LeadPDFAttachments.tsx')
    assert.match(helpers, /LEAD_UNFILED_FOLDER_ID = '__unfiled__'/)
    assert.doesNotMatch(upload, /__unfiled__/)
    assert.match(ui, /LEAD_UNFILED_FOLDER_ID/)
    assert.doesNotMatch(upload, /folder_id: LEAD_UNFILED_FOLDER_ID/)
  })

  it('nome da pasta é único no lead, ignorando maiúsculas e espaços', () => {
    const folders = [{ id: '1', nome: 'Cozinha' }, { id: '2', nome: 'Sala' }]
    assert.equal(findFolderByName(folders, '  cozinha ' )?.id, '1')
    assert.equal(normalizeFolderName('  Sala   de   estar '), 'Sala de estar')
    const hook = readSrc('src/hooks/useLeadMediaFolders.ts')
    assert.match(hook, /Já existe uma pasta com esse nome neste lead/)
    assert.match(hook, /item\.id !== id/)
  })

  it('arquivo órfão ou da pasta da loja aparece em Sem pasta', () => {
    const leadFolderIds = new Set(['cozinha-uuid'])
    const items = [
      { id: 'a', folder_id: 'cozinha-uuid' },
      { id: 'b', folder_id: null },
      { id: 'c', folder_id: 'orcamentos-empresa' },
    ]
    const unfiled = items.filter((item) => !isAttachmentInLeadFolder(item.folder_id, leadFolderIds))
    assert.deepEqual(unfiled.map((item) => item.id), ['b', 'c'])
  })

  it('upload do lead não despeja na pasta orçamentos da loja', () => {
    const upload = readSrc('src/hooks/useLeadPDFs.ts')
    assert.doesNotMatch(upload, /getOrCreateOrcamentosFolder/)
    assert.match(upload, /buildStoragePath/)
    assert.match(upload, /folder_id: folderId \?\? null/)
    assert.match(upload, /ensureLeadFolderId/)
  })

  it('raiz exige nome da pasta; arrastar sem nome abre o diálogo sem Sem pasta', () => {
    const ui = readSrc('src/components/leads/LeadPDFAttachments.tsx')
    assert.match(ui, /id="lead-upload-folder-name"/)
    assert.match(ui, /Escreva o nome da pasta/)
    assert.match(ui, /allowUnfiled=\{false\}/)
    assert.match(ui, /askFolderName/)
    assert.match(ui, /title="Onde guardar\?"/)
    assert.match(ui, /Enviar para “\$\{folderLabel\}”/)
  })

  it('apagar pasta não apaga arquivo', () => {
    const hook = readSrc('src/hooks/useLeadMediaFolders.ts')
    const ui = readSrc('src/components/leads/LeadPDFAttachments.tsx')
    assert.match(hook, /Os arquivos ficaram sem pasta/)
    assert.doesNotMatch(hook, /from\(mediasConfig\.mediasTable\)\.delete/)
    assert.match(ui, /Os arquivos não são apagados/)
  })

  it('vendedor envia e só admin\/projetista apaga arquivo', () => {
    const access = readSrc('src/lib/lead-attachments-access.ts')
    assert.match(access, /role === 'vendedor'/)
    assert.match(access, /canDeleteLeadAttachments/)
    const deleteFn = access.slice(access.indexOf('export function canDeleteLeadAttachments'))
    assert.match(deleteFn, /role === 'admin'/)
    assert.match(deleteFn, /isProjetistaRole/)
    assert.equal(/role === 'vendedor'/.test(deleteFn), false)
  })

  it('grade da raiz usa cartão da gaveta e Sem pasta só se houver órfão', () => {
    const ui = readSrc('src/components/leads/LeadPDFAttachments.tsx')
    const card = readSrc('src/components/leads/LeadAttachmentFolderCard.tsx')
    assert.match(ui, /LeadAttachmentFolderCard/)
    assert.match(ui, /unfiledCount > 0/)
    assert.match(ui, /variant="unfiled"/)
    assert.match(card, /variant === 'unfiled'/)
    assert.match(card, /rotate\(\$\{\[-7, 0, 7\]/)
    assert.match(card, /repeating-radial-gradient/)
  })

  it('esqueleto não espera formulário nem render IA, e PDF tem tempo limite', () => {
    const ui = readSrc('src/components/leads/LeadPDFAttachments.tsx')
    assert.doesNotMatch(ui, /formUploadsLoading \|\| aiRendersLoading/)
    assert.match(ui, /\(isLoading \|\| foldersLoading\) && folders\.length === 0/)
    assert.match(ui, /setTimeout\(\(\) => resolve\(null\), 8000\)/)
  })

  it('canal realtime de aprovação não usa o mesmo nome em duas telas', () => {
    const hook = readSrc('src/hooks/useMarketingApprovalNotifications.ts')
    assert.match(hook, /marketing-approval-notifications-changes-\$\{crypto\.randomUUID\(\)\}/)
    assert.doesNotMatch(hook, /\.channel\('marketing-approval-notifications-changes'\)/)
  })

  it('lousa pede pasta ao salvar e o lápis do anexo abre a lousa', () => {
    const lousa = readSrc('src/components/leads/LeadWhiteboard.tsx')
    const ui = readSrc('src/components/leads/LeadPDFAttachments.tsx')
    assert.match(lousa, /LeadFolderPickDialog/)
    assert.match(lousa, /askFileName/)
    assert.match(lousa, /id="lead-whiteboard"/)
    assert.match(ui, /Editar na lousa/)
    assert.match(ui, /requestLeadWhiteboardImport/)
  })
})
