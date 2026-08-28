# Copia pastas de domínio do CRM Selletos sem sobrescrever a fábrica.
$ErrorActionPreference = 'Stop'
$src = 'F:\crm multiemrpesas\CRM-Multiemrpesas\src'
$dst = 'F:\Movelaria-Garbo\Movelaria\src'

function Copy-Tree($rel) {
  $from = Join-Path $src $rel
  $to = Join-Path $dst $rel
  if (-not (Test-Path $from)) {
    Write-Host "SKIP missing: $rel"
    return
  }
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  Copy-Item -Path (Join-Path $from '*') -Destination $to -Recurse -Force
  Write-Host "COPIED $rel"
}

function Copy-FileIfMissing($rel) {
  $from = Join-Path $src $rel
  $to = Join-Path $dst $rel
  if (-not (Test-Path $from)) { Write-Host "SKIP missing file: $rel"; return }
  if (Test-Path $to) { Write-Host "KEEP existing: $rel"; return }
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Copy-Item $from $to -Force
  Write-Host "ADDED $rel"
}

function Copy-FileForce($rel) {
  $from = Join-Path $src $rel
  $to = Join-Path $dst $rel
  if (-not (Test-Path $from)) { Write-Host "SKIP missing file: $rel"; return }
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Copy-Item $from $to -Force
  Write-Host "OVERWROTE $rel"
}

# Pastas de domínio CRM (1:1)
$domains = @(
  'components\leads',
  'components\kanban',
  'components\pipeline',
  'components\projetos',
  'components\agenda',
  'components\orcamento-slides',
  'components\markup',
  'components\contratos',
  'components\admin',
  'components\financeiro',
  'components\prestador',
  'components\marketing',
  'components\marketing-conteudo',
  'components\controle-eventos',
  'components\controle-gastos',
  'components\biblioteca',
  'components\cadastro',
  'components\automacoes',
  'pages\orcamento-slides',
  'pages\contratos',
  'pages\markup',
  'pages\marketing',
  'pages\cadastro',
  'pages\admin'
)

foreach ($d in $domains) { Copy-Tree $d }

# Páginas CRM na raiz de pages (não sobrescreve Caixa/Login/Obras)
$crmPages = @(
  'pages\Pipeline.tsx',
  'pages\PipelineKanbanPage.tsx',
  'pages\PipelineSettings.tsx',
  'pages\Leads.tsx',
  'pages\Agenda.tsx',
  'pages\Biblioteca.tsx',
  'pages\Prestador.tsx',
  'pages\Financeiro.tsx',
  'pages\ControleGastos.tsx',
  'pages\MarketingConteudo.tsx',
  'pages\Marketing.tsx',
  'pages\Automacoes.tsx',
  'pages\WebhooksConfig.tsx',
  'pages\Admin.tsx',
  'pages\AgendamentoPublico.tsx',
  'pages\CadastroDeAlunos.tsx',
  'pages\PendingAccess.tsx',
  'pages\OutOfAccessHours.tsx',
  'pages\NotFound.tsx',
  'pages\Profile.tsx',
  'pages\Auth.tsx'
)
foreach ($p in $crmPages) { Copy-FileForce $p }

# Layout CRM extra (não MainLayout/AppSidebar/NavigationHeader da fábrica)
$layoutExtras = Get-ChildItem (Join-Path $src 'components\layout') -File
foreach ($f in $layoutExtras) {
  $name = $f.Name
  if ($name -in @('MainLayout.tsx', 'AppSidebar.tsx', 'NavigationHeader.tsx')) {
    Write-Host "KEEP factory layout: $name"
    continue
  }
  Copy-Item $f.FullName (Join-Path $dst "components\layout\$name") -Force
  Write-Host "LAYOUT extra: $name"
}

# UI Shadcn que a Movelaria ainda não tem
$uiSrc = Join-Path $src 'components\ui'
$uiDst = Join-Path $dst 'components\ui'
Get-ChildItem $uiSrc -File | ForEach-Object {
  $destFile = Join-Path $uiDst $_.Name
  if (Test-Path $destFile) {
    Write-Host "KEEP ui: $($_.Name)"
  } else {
    Copy-Item $_.FullName $destFile -Force
    Write-Host "UI added: $($_.Name)"
  }
}

# Hooks CRM (não sobrescreve hooks da fábrica com o mesmo nome)
Get-ChildItem (Join-Path $src 'hooks') -File | ForEach-Object {
  $destFile = Join-Path $dst "hooks\$($_.Name)"
  if (Test-Path $destFile) {
    Write-Host "KEEP hook: $($_.Name)"
  } else {
    Copy-Item $_.FullName $destFile -Force
    Write-Host "HOOK added: $($_.Name)"
  }
}

# Lib CRM — não sobrescreve supabase/utils/app-navigation da fábrica
$keepLib = @(
  'supabase.ts',
  'supabase-auth-storage.ts',
  'utils.ts',
  'app-navigation.ts',
  'boot-guard.ts',
  'date-br.ts',
  'network-error.ts',
  'device.ts',
  'page-zoom.ts'
)
Get-ChildItem (Join-Path $src 'lib') -File | ForEach-Object {
  if ($keepLib -contains $_.Name) {
    Write-Host "KEEP lib: $($_.Name)"
    return
  }
  Copy-Item $_.FullName (Join-Path $dst "lib\$($_.Name)") -Force
  Write-Host "LIB: $($_.Name)"
}

# Contextos CRM (não AppContext da fábrica — pasta diferente)
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'contexts') | Out-Null
Get-ChildItem (Join-Path $src 'contexts') -File | ForEach-Object {
  if ($_.Name -eq 'AppContext.tsx') {
    Write-Host "SKIP CRM AppContext (fábrica tem o próprio)"
    return
  }
  Copy-Item $_.FullName (Join-Path $dst "contexts\$($_.Name)") -Force
  Write-Host "CTX: $($_.Name)"
}

# Tipos CRM (não sobrescreve src/types/index.ts da fábrica)
Copy-FileForce 'types\kanban-config.ts'
Copy-FileForce 'types\cadastro.ts'
$crmTypes = Join-Path $src 'types\index.ts'
Copy-Item $crmTypes (Join-Path $dst 'types\selletos.ts') -Force
Write-Host 'TYPES: selletos.ts from CRM types/index.ts'

# Integração supabase types
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'integrations\supabase') | Out-Null
Copy-FileIfMissing 'integrations\supabase\types.ts'
Copy-FileIfMissing 'components\AppErrorBoundary.tsx'
Copy-FileIfMissing 'vite-env.d.ts'

Write-Host 'DONE copy-crm-selletos'
