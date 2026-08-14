import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppToast } from '@/components/ui/AppToast'
import { PwaManager } from '@/pwa'
import { MainLayout } from '@/components/layout/MainLayout'
import { useApp } from '@/context/AppContext'
import { OptionalFinanceDataProvider, useFinanceDataOptional } from '@/context/FinanceDataContext'
import { sectionFromPath, defaultPathForRoles } from '@/lib/app-navigation'
import { canAccessSection } from '@/lib/role-access'
import { rememberLastRoute, readLastRoute } from '@/lib/last-route'
import { consumePontoResumeFlag, peekPontoResumeFlag } from '@/hooks/useBaterPonto'
import { hasChegadaMateriaisAccess, hasObrasAdminSectionsAccess, hasObrasMenuAccess } from '@/lib/obra-permissions'
import { Dashboard } from '@/pages/Dashboard'
import { Fornecedores } from '@/pages/Fornecedores'
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
import { MeuPerfil } from '@/pages/MeuPerfil'
import { PontoPage } from '@/pages/PontoPage'
import { ResumoPonto } from '@/pages/ResumoPonto'
import { HistoricoPonto } from '@/pages/HistoricoPonto'
import { Configuracoes } from '@/pages/Configuracoes'
import { Funcionarios } from '@/pages/Funcionarios'
import { FuncionarioDetalhe } from '@/pages/FuncionarioDetalhe'
import { Login } from '@/pages/Login'
import { OrcamentoPublico } from '@/pages/OrcamentoPublico'
import { Visualizacao } from '@/pages/Visualizacao'
import { ObrasProvider } from '@/hooks/useObras'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'
import { GarboLoadingBrand } from '@/components/ui/GarboLoadingBrand'

function BootLoading({ message }: { message: string }) {
  const { signOut } = useApp()
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setStuck(true), 8_000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="relative min-h-screen">
      <GarboLoadingBrand variant="fullscreen" message={message} />
      {stuck ? (
        <div className="fixed inset-x-0 bottom-8 z-[80] flex flex-col items-center gap-3 px-6">
          <p className="text-center text-xs text-[#edd9c4]">
            Está demorando no celular. Atualize ou saia e entre de novo.
          </p>
          <div className="flex items-center gap-4">
            <AppRefreshButton variant="toolbar" showLabel />
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs font-semibold text-[#f2d892] underline opacity-80 hover:opacity-100"
            >
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Restricted({ message }: { message: string }) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="mb-3 text-4xl">🔒</div>
      <p className="text-[0.95rem] font-semibold text-red-400">{message}</p>
    </div>
  )
}

function HomeRedirect() {
  const { roles } = useApp()
  const location = useLocation()
  const defaultPath = defaultPathForRoles(roles)
  const fromPwa = new URLSearchParams(location.search).get('src') === 'pwa'
  const last = readLastRoute()
  const resumePonto = peekPontoResumeFlag()

  if (resumePonto && canAccessSection(roles, 'baterPonto')) {
    return <Navigate to="/bater-ponto" replace />
  }

  if (fromPwa && last) {
    const lastPath = last.split('?')[0] || '/'
    const section = sectionFromPath(lastPath)
    if (canAccessSection(roles, section)) {
      return <Navigate to={last} replace />
    }
  }

  return <Navigate to={defaultPath} replace />
}

function RoleRedirect() {
  const { roles } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const restoredRef = useRef(false)

  const defaultPath = defaultPathForRoles(roles)

  // Guarda a página atual para retomar se o PWA reabrir na home.
  useEffect(() => {
    rememberLastRoute(`${location.pathname}${location.search}${location.hash}`)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!roles.length || restoredRef.current) return
    restoredRef.current = true

    const shouldResumePonto = consumePontoResumeFlag()
    if (shouldResumePonto && canAccessSection(roles, 'baterPonto') && location.pathname !== '/bater-ponto') {
      navigate('/bater-ponto', { replace: true })
    }
  }, [roles, location.pathname, navigate])

  useEffect(() => {
    if (!roles.length) return
    const section = sectionFromPath(location.pathname)
    if (!canAccessSection(roles, section)) {
      navigate(defaultPath, { replace: true })
    }
  }, [roles, location.pathname, navigate, defaultPath])

  return null
}

function AuthenticatedRoutes() {
  const { roles } = useApp()
  const readOnly = roles.length > 0 && roles.every(r => r === 'Marceneiro')
  const finance = useFinanceDataOptional()

  const guardReadOnly = (page: React.ReactNode) =>
    readOnly ? (
      <Restricted message="Esta seção requer perfil Financeiro ou Administrador." />
    ) : (
      page
    )

  const emptyFinance = {
    data: [] as never[],
    getSaldoFornecedor: () => 0,
    debitarSaldo: async () => {},
    estornarDebitosContaPagar: async () => {},
    create: async () => {
      throw new Error('Operação indisponível para este perfil.')
    },
  }

  const clientesHook = finance?.clientes ?? {
    data: emptyFinance.data,
    create: emptyFinance.create as never,
  }
  const contasPagarHook = finance?.contasPagar ?? { data: emptyFinance.data }
  const caixaFornecedorHook = finance?.caixaFornecedor ?? {
    getSaldoFornecedor: emptyFinance.getSaldoFornecedor,
    debitarSaldo: emptyFinance.debitarSaldo as never,
    estornarDebitosContaPagar: emptyFinance.estornarDebitosContaPagar as never,
  }

  return (
    <>
      <RoleRedirect />
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route
            path="/dashboard"
            element={
              canAccessSection(roles, 'dashboard')
                ? <Dashboard />
                : <Navigate to={defaultPathForRoles(roles)} replace />
            }
          />
          <Route path="/clientes" element={guardReadOnly(<Clientes readOnly={readOnly} />)} />
          <Route path="/cobrancas" element={guardReadOnly(<ContasReceber clientes={clientesHook.data} onCreateCliente={clientesHook.create} readOnly={readOnly} />)} />
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
          <Route path="/funcionarios" element={guardReadOnly(<Funcionarios readOnly={readOnly} />)} />
          <Route path="/funcionarios/:id" element={guardReadOnly(<FuncionarioDetalhe readOnly={readOnly} />)} />
          <Route
            path="/contas-pagar"
            element={
              roles.includes('Administrador') && finance ? (
                <ContasPagar
                  fornecedores={finance.fornecedores.data}
                  getSaldoFornecedor={finance.caixaFornecedor.getSaldoFornecedor}
                  debitarSaldo={finance.caixaFornecedor.debitarSaldo}
                  estornarDebitosContaPagar={finance.caixaFornecedor.estornarDebitosContaPagar}
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
              roles.includes('Administrador') && finance ? (
                <CaixaFornecedor fornecedores={finance.fornecedores.data} roles={roles} readOnly={readOnly} />
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
          <Route
            path="/bater-ponto"
            element={
              canAccessSection(roles, 'baterPonto')
                ? <PontoPage />
                : <Restricted message="Disponível para funcionários de campo e RH." />
            }
          />
          <Route
            path="/resumo-ponto"
            element={
              canAccessSection(roles, 'resumoPonto')
                ? <ResumoPonto />
                : <Restricted message="Disponível apenas para RH (Administrador e Financeiro)." />
            }
          />
          <Route
            path="/historico-ponto"
            element={
              canAccessSection(roles, 'historicoPonto')
                ? <HistoricoPonto />
                : <Restricted message="Disponível para funcionários de campo e RH." />
            }
          />
          <Route
            path="/meu-perfil"
            element={
              canAccessSection(roles, 'meuPerfil')
                ? <MeuPerfil />
                : <Restricted message="Disponível apenas para funcionários vinculados." />
            }
          />

          {/* Visualização */}
          <Route
            path="/visualizacao"
            element={
              canAccessSection(roles, 'visualizacao')
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

          <Route path="*" element={<Navigate to={defaultPathForRoles(roles)} replace />} />
        </Route>
      </Routes>
    </>
  )
}

function AuthenticatedApp() {
  return (
    <ObrasProvider>
      <OptionalFinanceDataProvider>
        <AuthenticatedRoutes />
      </OptionalFinanceDataProvider>
    </ObrasProvider>
  )
}

function AppRoutes() {
  const { authLoading, profileLoading, profileError, session, userProfile, signOut, retryProfile } = useApp()

  // Só bloqueia a tela inteira enquanto a sessão (login) não foi resolvida
  if (authLoading) {
    return <BootLoading message="Carregando..." />
  }

  if (!session) {
    return <Login />
  }

  if (profileLoading && !userProfile) {
    return <BootLoading message="Carregando perfil..." />
  }

  if (!userProfile) {
    const isConnectionError = profileError?.includes('banco') || profileError?.includes('conectar')
    const isPendingApproval = profileError?.includes('pendente de aprovação')
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2a1812] font-raleway text-center text-[#f2d892] px-6">
        <div className="max-w-md">
          <p className="mb-1 text-lg font-semibold">
            {isConnectionError
              ? 'Servidor indisponível'
              : isPendingApproval
                ? 'Conta pendente de aprovação'
                : 'Usuário não configurado'}
          </p>
          <p className="text-sm opacity-60">
            {profileError ?? 'Contate o administrador para criar seu perfil de acesso.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <AppRefreshButton variant="toolbar" showLabel />
            {(isConnectionError || isPendingApproval || profileError) && (
              <button
                type="button"
                onClick={retryProfile}
                className="text-xs font-semibold text-[#f2d892] underline opacity-80 hover:opacity-100"
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

  return <AuthenticatedApp />
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
