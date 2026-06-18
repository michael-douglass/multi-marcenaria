import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppToast } from '@/components/ui/AppToast'
import { PwaManager } from '@/pwa'
import { MainLayout } from '@/components/layout/MainLayout'
import { useApp } from '@/context/AppContext'
import { useCaixaFornecedor } from '@/hooks/useCaixaFornecedor'
import { useFornecedores } from '@/hooks/useFornecedores'
import { useProdutos } from '@/hooks/useProdutos'
import { usePedidos } from '@/hooks/usePedidos'
import { useClientes } from '@/hooks/useClientes'
import { useContasPagar } from '@/hooks/useContasPagar'
import { useContasReceber } from '@/hooks/useContasReceber'
import { sectionFromPath, defaultPathForRole } from '@/lib/app-navigation'
import { hasChegadaMateriaisAccess, hasObrasAdminSectionsAccess, hasObrasMenuAccess } from '@/lib/obra-permissions'
import { Dashboard } from '@/pages/Dashboard'
import { Fornecedores } from '@/pages/Fornecedores'
import { Produtos } from '@/pages/Produtos'
import { PedidosCompra } from '@/pages/PedidosCompra'
import { Aprovacao } from '@/pages/Aprovacao'
import { ContasPagar } from '@/pages/ContasPagar'
import { Clientes } from '@/pages/Clientes'
import { ContasReceber } from '@/pages/ContasReceber'
import { Biblioteca } from '@/pages/Biblioteca'
import { CaixaFornecedor } from '@/pages/CaixaFornecedor'
import { Caixa } from '@/pages/Caixa'
import { AgendaObras } from '@/pages/AgendaObras'
import { AcompanhamentoObras } from '@/pages/AcompanhamentoObras'
import { CalendarioObras } from '@/pages/CalendarioObras'
import { ChegadaMateriaisCalendario } from '@/pages/ChegadaMateriaisCalendario'
import { MetricasObras } from '@/pages/MetricasObras'
import { MeuFinanceiro } from '@/pages/MeuFinanceiro'
import { Configuracoes } from '@/pages/Configuracoes'
import { Contratos } from '@/pages/Contratos'
import { Login } from '@/pages/Login'
import { OrcamentoPublico } from '@/pages/OrcamentoPublico'
import { Visualizacao } from '@/pages/Visualizacao'
import type { ActiveSection, UserRole } from '@/types'

const OBRAS_SECTIONS: ActiveSection[] = [
  'agendaObras',
  'acompanhamentoObras',
  'calendarioObras',
  'calendarioChegadaMateriais',
  'metricasObras',
]

const ROLE_SECTIONS: Record<UserRole, ActiveSection[]> = {
  Administrador: ['dashboard', 'clientes', 'cobranças', 'contratos', 'fornecedores', 'produtos', 'pedidos', 'aprovacao', 'contasPagar', 'caixaFornecedor', 'biblioteca', 'caixa', ...OBRAS_SECTIONS, 'visualizacao', 'configuracoes'],
  Financeiro: ['dashboard', 'clientes', 'cobranças', 'contratos', 'fornecedores', 'produtos', 'pedidos', 'biblioteca', 'visualizacao'],
  Marceneiro: ['dashboard'],
  MontadorAdmin: [...OBRAS_SECTIONS, 'meuFinanceiro', 'visualizacao'],
  AdministradorObras: [...OBRAS_SECTIONS, 'visualizacao'],
  Montador: ['agendaObras', 'calendarioObras', 'meuFinanceiro'],
  Visualizador: ['visualizacao'],
}

function getAllowedSections(roles: UserRole[]): ActiveSection[] {
  const sections = new Set<ActiveSection>()
  for (const r of roles) {
    for (const s of ROLE_SECTIONS[r] ?? []) sections.add(s)
  }
  return [...sections]
}

function Restricted({ message }: { message: string }) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="mb-3 text-4xl">🔒</div>
      <p className="text-[0.95rem] font-semibold text-red-400">{message}</p>
    </div>
  )
}

function RoleRedirect() {
  const { role, roles } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  const defaultPath = defaultPathForRole(role)

  useEffect(() => {
    if (!roles.length) return
    const section = sectionFromPath(location.pathname)
    const allowed = getAllowedSections(roles)
    if (!allowed.includes(section)) {
      navigate(defaultPath, { replace: true })
    }
  }, [roles, location.pathname, navigate, defaultPath])

  return null
}

function AuthenticatedRoutes() {
  const { role, roles } = useApp()
  const readOnly = roles.length > 0 && roles.every(r => r === 'Marceneiro')

  const fornecedoresHook = useFornecedores()
  const produtosHook = useProdutos()
  const pedidosHook = usePedidos()
  const clientesHook = useClientes()
  const contasPagarHook = useContasPagar()
  const contasReceberHook = useContasReceber()
  const caixaFornecedorHook = useCaixaFornecedor()


  const pendingOrders = pedidosHook.data.filter(o => o.status === 'aguardando_aprovacao').length

  const guardReadOnly = (page: React.ReactNode) =>
    readOnly ? (
      <Restricted message="Esta seção requer perfil Financeiro ou Administrador." />
    ) : (
      page
    )

  return (
    <>
      <RoleRedirect />
      <Routes>
        <Route element={<MainLayout pendingOrders={pendingOrders} />}>
          <Route index element={<Navigate to={defaultPathForRole(role)} replace />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard />
            }
          />
          <Route path="/clientes" element={guardReadOnly(<Clientes readOnly={readOnly} />)} />
          <Route path="/cobrancas" element={guardReadOnly(<ContasReceber clientes={clientesHook.data} readOnly={readOnly} />)} />
          <Route path="/contratos" element={guardReadOnly(<Contratos readOnly={readOnly} />)} />
          <Route
            path="/fornecedores"
            element={guardReadOnly(
              <Fornecedores
                readOnly={readOnly}
                contasPagar={contasPagarHook.data}
                getSaldoFornecedor={caixaFornecedorHook.getSaldoFornecedor}
              />,
            )}
          />
          <Route
            path="/produtos"
            element={guardReadOnly(<Produtos fornecedores={fornecedoresHook.data} readOnly={readOnly} />)}
          />
          <Route
            path="/pedidos"
            element={
              guardReadOnly(
                <PedidosCompra
                  fornecedores={fornecedoresHook.data}
                  produtos={produtosHook.data}
                  readOnly={readOnly}
                />,
              )
            }
          />
          <Route
            path="/aprovacao"
            element={
              roles.includes('Administrador') ? (
                <Aprovacao fornecedores={fornecedoresHook.data} produtos={produtosHook.data} />
              ) : (
                <Restricted message="Exclusivo para Administradores." />
              )
            }
          />
          <Route
            path="/contas-pagar"
            element={
              roles.includes('Administrador') ? (
                <ContasPagar
                  fornecedores={fornecedoresHook.data}
                  getSaldoFornecedor={caixaFornecedorHook.getSaldoFornecedor}
                  debitarSaldo={caixaFornecedorHook.debitarSaldo}
                  estornarDebitosContaPagar={caixaFornecedorHook.estornarDebitosContaPagar}
                  readOnly={readOnly}
                />
              ) : (
                <Restricted message="Acesso restrito a Administradores." />
              )
            }
          />
          <Route
            path="/caixa-fornecedor"
            element={
              roles.includes('Administrador') ? (
                <CaixaFornecedor fornecedores={fornecedoresHook.data} roles={roles} readOnly={readOnly} />
              ) : (
                <Restricted message="Acesso restrito a Administradores." />
              )
            }
          />
          <Route
            path="/biblioteca"
            element={guardReadOnly(<Biblioteca readOnly={readOnly} />)}
          />
          <Route
            path="/caixa"
            element={
              roles.includes('Administrador') ? (
                <Caixa />
              ) : (
                <Restricted message="Acesso restrito a Administradores." />
              )
            }
          />

          {/* Agenda de Obras */}
          <Route
            path="/agenda-obras"
            element={
              hasObrasMenuAccess(roles)
                ? <AgendaObras />
                : <Restricted message="Acesso restrito ao módulo de Obras." />
            }
          />
          <Route
            path="/calendario-obras"
            element={
              hasObrasMenuAccess(roles)
                ? <CalendarioObras />
                : <Restricted message="Acesso restrito ao módulo de Obras." />
            }
          />
          <Route
            path="/acompanhamento-obras"
            element={
              hasObrasAdminSectionsAccess(roles)
                ? <AcompanhamentoObras />
                : <Restricted message="Acompanhamento disponível apenas para perfis de gestão de Obras." />
            }
          />
          <Route
            path="/chegada-materiais"
            element={
              hasChegadaMateriaisAccess(roles)
                ? <ChegadaMateriaisCalendario />
                : <Restricted message="Chegada de materiais disponível apenas para perfis de gestão de Obras." />
            }
          />
          <Route
            path="/chegada-materiais/calendario"
            element={<Navigate to="/chegada-materiais" replace />}
          />
          <Route
            path="/calendario-chegada-materiais"
            element={<Navigate to="/chegada-materiais" replace />}
          />
          <Route
            path="/metricas-obras"
            element={
              hasObrasAdminSectionsAccess(roles)
                ? <MetricasObras />
                : <Restricted message="Métricas disponíveis apenas para perfis de gestão de Obras." />
            }
          />
          <Route
            path="/meu-financeiro"
            element={
              roles.includes('Montador') || roles.includes('MontadorAdmin')
                ? <MeuFinanceiro />
                : <Restricted message="Disponível apenas para montadores." />
            }
          />

          {/* Visualização */}
          <Route
            path="/visualizacao"
            element={
              roles.includes('Visualizador')
                || roles.includes('Administrador')
                || roles.includes('Financeiro')
                || roles.includes('AdministradorObras')
                || roles.includes('MontadorAdmin')
                ? <Visualizacao />
                : <Restricted message="Acesso restrito ao painel de visualização." />
            }
          />

          {/* Configurações */}
          <Route
            path="/configuracoes"
            element={
              roles.includes('Administrador')
                ? <Configuracoes />
                : <Restricted message="Acesso restrito a Administradores." />
            }
          />

          <Route path="*" element={<Navigate to={defaultPathForRole(role)} replace />} />
        </Route>
      </Routes>
    </>
  )
}

function AppRoutes() {
  const { authLoading, profileLoading, profileError, session, userProfile, signOut, retryProfile } = useApp()

  // Só bloqueia a tela inteira enquanto a sessão (login) não foi resolvida
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#150c09] font-raleway text-sm tracking-wider text-[#d4a853]">
        Carregando...
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (profileLoading && !userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#150c09] font-raleway text-sm tracking-wider text-[#d4a853]">
        Carregando perfil...
      </div>
    )
  }

  if (!userProfile) {
    const isConnectionError = profileError?.includes('banco') || profileError?.includes('conectar')
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#150c09] font-raleway text-center text-[#d4a853] px-6">
        <div className="max-w-md">
          <p className="mb-1 text-lg font-semibold">
            {isConnectionError ? 'Servidor indisponível' : 'Usuário não configurado'}
          </p>
          <p className="text-sm opacity-60">
            {profileError ?? 'Contate o administrador para criar seu perfil de acesso.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            {isConnectionError && (
              <button
                type="button"
                onClick={retryProfile}
                className="text-xs font-semibold text-[#d4a853] underline opacity-80 hover:opacity-100"
              >
                Tentar novamente
              </button>
            )}
            <button
              type="button"
              onClick={signOut}
              className="text-xs underline opacity-40 hover:opacity-80"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <AuthenticatedRoutes />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/orcamento/:schema/:id" element={<OrcamentoPublico />} />
        <Route path="*" element={<AppRoutes />} />
      </Routes>
      <PwaManager />
      <AppToast />
    </BrowserRouter>
  )
}
