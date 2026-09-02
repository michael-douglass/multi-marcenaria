import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppToast } from '@/components/ui/AppToast'
import { PwaManager } from '@/pwa'
import { MainLayout } from '@/components/layout/MainLayout'
import { useApp } from '@/context/AppContext'
import { OptionalFinanceDataProvider, useFinanceDataOptional } from '@/context/FinanceDataContext'
import { sectionFromPath } from '@/lib/app-navigation'
import { canAccessSection, canAccessFuncionarioPasta } from '@/lib/role-access'
import {
  canAccessCrmPath,
  defaultPathForIdentity,
  evaluateIdentityGate,
  hasCrmColaboradorAccess,
  isCrmAppPath,
  isCrmAdmin,
  isPortalOnly,
} from '@/lib/crm-identity'
import { ForaDoHorario } from '@/pages/ForaDoHorario'
import { ChatCrmPage } from '@/pages/crm/ChatCrmPage'
import { rememberLastRoute, readLastRoute } from '@/lib/last-route'
import { consumePontoResumeFlag, peekPontoResumeFlag } from '@/hooks/useBaterPonto'
import { canAccessProjetosProducao } from '@/lib/projetos-producao'
import { hasChegadaMateriaisAccess, hasObrasAdminSectionsAccess, hasObrasMenuAccess, hasPedidosObrasAccess } from '@/lib/obra-permissions'
import { Dashboard } from '@/pages/Dashboard'
import { Fornecedores } from '@/pages/Fornecedores'
import { ContasPagar } from '@/pages/ContasPagar'
import { Clientes } from '@/pages/Clientes'
import { ContasReceber } from '@/pages/ContasReceber'
import { Biblioteca } from '@/pages/Biblioteca'
import { CaixaFornecedor } from '@/pages/CaixaFornecedor'
import { Caixa } from '@/pages/Caixa'
import { AgendaObras } from '@/pages/AgendaObras'
import { PedidosObras } from '@/pages/PedidosObras'
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
import { Visualizacao } from '@/pages/Visualizacao'
import { ObrasProvider } from '@/hooks/useObras'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'
import { GarboLoadingBrand } from '@/components/ui/GarboLoadingBrand'
import { CrmSelletosProviders } from '@/components/crm/CrmSelletosProviders'
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback'
import { OAuthErrorRedirect } from '@/components/OAuthErrorRedirect'
import CadastroPublico from '@/pages/cadastro/CadastroPublico'

const Pipeline = lazy(() => import('@/pages/Pipeline'))
const PipelineKanbanPage = lazy(() => import('@/pages/PipelineKanbanPage'))
const PipelineSettings = lazy(() => import('@/pages/PipelineSettings'))
const Leads = lazy(() => import('@/pages/Leads'))
const AgendaComercial = lazy(() => import('@/pages/Agenda'))
const ContratosListPage = lazy(() => import('@/pages/contratos/ContratosPage'))
const NovoContratoPage = lazy(() => import('@/pages/contratos/NovoContratoPage'))
const ContratosConfigSelletosPage = lazy(() => import('@/pages/contratos/ContratosConfigPage'))
const MarkupListSelletosPage = lazy(() => import('@/pages/markup/MarkupListPage'))
const MarkupConfigSelletosPage = lazy(() => import('@/pages/markup/MarkupConfigPage'))
const OrcamentoSlidesListPage = lazy(() => import('@/pages/orcamento-slides/OrcamentoSlidesPage'))
const NovoOrcamentoSlidePage = lazy(() => import('@/pages/orcamento-slides/NovoOrcamentoSlidePage'))
const ApresentarOrcamentoSlidePage = lazy(() => import('@/pages/orcamento-slides/ApresentarOrcamentoSlidePage'))
const OrcamentoSlidesConfigPage = lazy(() => import('@/pages/orcamento-slides/OrcamentoSlidesConfigPage'))
const OrcamentoPublicoPage = lazy(() => import('@/pages/orcamento-slides/OrcamentoPublicoPage'))
const IniciarOrcamentoPublicoPage = lazy(() => import('@/pages/orcamento-slides/IniciarOrcamentoPublicoPage'))
const MarketingConteudo = lazy(() => import('@/pages/MarketingConteudo'))
const MarketingDisparos = lazy(() => import('@/pages/Marketing'))
const AutomacoesSelletos = lazy(() => import('@/pages/Automacoes'))
const ControleGastosSelletos = lazy(() => import('@/pages/ControleGastos'))
const FinanceiroPontua = lazy(() => import('@/pages/Financeiro'))
const AdminUsuarios = lazy(() => import('@/pages/Admin'))
const WebhooksConfig = lazy(() => import('@/pages/WebhooksConfig'))
const ConfiguracaoMarca = lazy(() => import('@/pages/admin/ConfiguracaoMarca'))
const CrmBiblioteca = lazy(() => import('@/pages/CrmBiblioteca'))
const PrestadorSelletos = lazy(() => import('@/pages/Prestador'))
const ProfilePage = lazy(() => import('@/pages/Profile'))
const ApresentacaoEmpresaPage = lazy(() => import('@/pages/marketing/ApresentacaoEmpresaPage'))
const PontuaGarboApresentacaoPage = lazy(() => import('@/pages/marketing/PontuaGarboApresentacaoPage'))
const ApresentacaoEmpresaPublicaPage = lazy(() => import('@/pages/marketing/ApresentacaoEmpresaPublicaPage'))
const AgendamentoPublico = lazy(() => import('@/pages/AgendamentoPublico'))
const CadastroDeAlunos = lazy(() => import('@/pages/CadastroDeAlunos'))
const ProjetosPage = lazy(() => import('@/pages/Projetos'))
const ProjetosProducaoPage = lazy(() => import('@/pages/ProjetosProducao'))
const ControleEventosPage = lazy(() => import('@/pages/ControleEventos'))
const ControleEventoBoardPage = lazy(() => import('@/pages/ControleEventoBoard'))

function PreserveSearchRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />
}

function CrmLazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
}

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
  const { roles, userProfile, crmProfile } = useApp()
  const location = useLocation()
  const defaultPath = defaultPathForIdentity(roles, userProfile, crmProfile)
  const fromPwa = new URLSearchParams(location.search).get('src') === 'pwa'
  const last = readLastRoute()
  const resumePonto = peekPontoResumeFlag()

  if (resumePonto && canAccessSection(roles, 'baterPonto')) {
    return <Navigate to="/bater-ponto" replace />
  }

  if (fromPwa && last) {
    const lastPath = last.split('?')[0] || '/'
    if (isCrmAppPath(lastPath)) {
      if (canAccessCrmPath(lastPath, crmProfile, userProfile)) {
        return <Navigate to={last} replace />
      }
    } else {
      const section = sectionFromPath(lastPath)
      if (canAccessSection(roles, section)) {
        return <Navigate to={last} replace />
      }
    }
  }

  return <Navigate to={defaultPath} replace />
}

function RoleRedirect() {
  const { roles, userProfile, crmProfile } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const restoredRef = useRef(false)

  const defaultPath = defaultPathForIdentity(roles, userProfile, crmProfile)

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
    const path = location.pathname
    if (isCrmAppPath(path)) {
      if (!canAccessCrmPath(path, crmProfile, userProfile)) {
        navigate(defaultPath, { replace: true })
      }
      return
    }
    if (!roles.length) {
      if (hasCrmColaboradorAccess(crmProfile)) {
        navigate(defaultPath, { replace: true })
      }
      return
    }
    const section = sectionFromPath(path)
    if (section === 'funcionarios') {
      if (!canAccessFuncionarioPasta(roles, path)) {
        navigate(defaultPath, { replace: true })
      }
      return
    }
    if (!canAccessSection(roles, section)) {
      navigate(defaultPath, { replace: true })
    }
  }, [roles, crmProfile, userProfile, location.pathname, navigate, defaultPath])

  return null
}

function AuthenticatedRoutes() {
  const { roles, userProfile, crmProfile } = useApp()
  const location = useLocation()
  const readOnly = roles.length > 0 && roles.every(r => r === 'Marceneiro')
  const finance = useFinanceDataOptional()
  const homePath = defaultPathForIdentity(roles, userProfile, crmProfile)

  const apresentarMatch = location.pathname.match(/^\/orcamento-slides\/([^/]+)\/apresentar\/?$/)
  if (apresentarMatch) {
    return (
      <CrmLazy>
        <ApresentarOrcamentoSlidePage orcamentoId={apresentarMatch[1]} />
      </CrmLazy>
    )
  }
  if (location.pathname.startsWith('/marketing/apresentacao-interna')) {
    return (
      <CrmLazy>
        <ApresentacaoEmpresaPage />
      </CrmLazy>
    )
  }
  if (location.pathname.startsWith('/marketing/pontua-garbo')) {
    return (
      <CrmLazy>
        <PontuaGarboApresentacaoPage />
      </CrmLazy>
    )
  }

  if (location.pathname.startsWith('/portal-parceiro')) {
    if (!canAccessCrmPath('/portal-parceiro', crmProfile, userProfile)) {
      return <Navigate to={homePath} replace />
    }
    return (
      <CrmLazy>
        <PrestadorSelletos />
      </CrmLazy>
    )
  }

  const crmPage = (path: string, page: ReactNode) =>
    canAccessCrmPath(path, crmProfile, userProfile)
      ? <CrmLazy>{page}</CrmLazy>
      : <Navigate to={homePath} replace />

  const guardReadOnly = (page: ReactNode) =>
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
                : <Navigate to={homePath} replace />
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
          <Route
            path="/funcionarios"
            element={
              canAccessSection(roles, 'funcionarios')
                ? guardReadOnly(<Funcionarios readOnly={readOnly} />)
                : <Restricted message="Pastas de funcionários disponíveis para RH e Montador Admin." />
            }
          />
          <Route
            path="/funcionarios/:id"
            element={
              canAccessFuncionarioPasta(roles, location.pathname)
                ? guardReadOnly(<FuncionarioDetalhe readOnly={readOnly} />)
                : <Restricted message="Pasta disponível para RH e Montador Admin (somente registros de ponto)." />
            }
          />
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
            path="/projetos-producao"
            element={
              canAccessProjetosProducao(
                crmProfile,
                roles,
                isCrmAdmin(crmProfile) || roles.includes('Administrador'),
              )
                ? (
                  <CrmLazy>
                    <ProjetosProducaoPage />
                  </CrmLazy>
                )
                : <Restricted message="Projetos de produção: projetista, vendedor ou Montador Admin." />
            }
          />
          <Route
            path="/agenda-obras"
            element={
              hasObrasMenuAccess(roles)
                ? <AgendaObras />
                : <Restricted message="Acesso restrito ao módulo de Obras." />
            }
          />
          <Route
            path="/pedidos-obras"
            element={
              hasPedidosObrasAccess(roles)
                ? <PedidosObras />
                : <Restricted message="Pedidos disponível apenas para Financeiro e Administrador de Obras." />
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
                : <Restricted message="Só funcionários cadastrados pela empresa podem bater ponto." />
            }
          />
          <Route
            path="/resumo-ponto"
            element={
              canAccessSection(roles, 'resumoPonto')
                ? <ResumoPonto />
                : <Restricted message="Disponível para RH e Montador Admin." />
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

          {/* CRM Selletos — páginas 1:1 com o GitHub */}
          <Route path="/pipeline/configuracoes" element={crmPage('/pipeline', <PipelineSettings />)} />
          <Route path="/pipeline/:kanbanSlug" element={crmPage('/pipeline', <PipelineKanbanPage />)} />
          <Route path="/pipeline" element={crmPage('/pipeline', <Pipeline />)} />
          <Route path="/leads/lousa" element={crmPage('/leads', <Leads />)} />
          <Route path="/leads/:id/lousa" element={crmPage('/leads', <Leads />)} />
          <Route path="/leads" element={crmPage('/leads', <Leads />)} />
          <Route path="/projetos" element={crmPage('/projetos', <ProjetosPage />)} />
          <Route path="/agenda" element={<PreserveSearchRedirect to="/agenda-comercial" />} />
          <Route path="/agenda-comercial" element={crmPage('/agenda-comercial', <AgendaComercial />)} />
          <Route path="/contratos/configuracoes" element={crmPage('/contratos', <ContratosConfigSelletosPage />)} />
          <Route path="/contratos/novo" element={crmPage('/contratos', <NovoContratoPage />)} />
          <Route path="/contratos/:id" element={crmPage('/contratos', <NovoContratoPage />)} />
          <Route path="/contratos" element={crmPage('/contratos', <ContratosListPage />)} />
          <Route path="/orcamento-slides/configuracoes" element={crmPage('/orcamento-slides', <OrcamentoSlidesConfigPage />)} />
          <Route path="/orcamento-slides/novo" element={crmPage('/orcamento-slides', <NovoOrcamentoSlidePage />)} />
          <Route path="/orcamento-slides/:id/editar" element={crmPage('/orcamento-slides', <NovoOrcamentoSlidePage />)} />
          <Route path="/orcamento-slides" element={crmPage('/orcamento-slides', <OrcamentoSlidesListPage />)} />
          <Route path="/markup/configuracoes" element={crmPage('/markup', <MarkupConfigSelletosPage />)} />
          <Route path="/markup" element={crmPage('/markup', <MarkupListSelletosPage />)} />
          <Route path="/automacoes/marketing" element={crmPage('/automacoes/marketing', <MarketingDisparos />)} />
          <Route path="/automacoes" element={crmPage('/automacoes', <AutomacoesSelletos />)} />
          <Route path="/marketing-conteudo" element={crmPage('/marketing-conteudo', <MarketingConteudo />)} />
          <Route path="/biblioteca-crm" element={crmPage('/biblioteca-crm', <CrmBiblioteca />)} />
          <Route path="/admin/marca" element={crmPage('/admin/marca', <ConfiguracaoMarca />)} />
          <Route path="/admin/empresas" element={<Navigate to="/admin/marca" replace />} />
          <Route path="/admin/webhooks" element={crmPage('/admin/marca', <WebhooksConfig />)} />
          <Route path="/admin" element={crmPage('/admin/marca', <AdminUsuarios />)} />
          <Route path="/controle-gastos" element={crmPage('/controle-gastos', <ControleGastosSelletos />)} />
          <Route path="/controle-eventos/:eventoId" element={crmPage('/controle-eventos', <ControleEventoBoardPage />)} />
          <Route path="/controle-eventos" element={crmPage('/controle-eventos', <ControleEventosPage />)} />
          <Route path="/financeiro-pontua" element={crmPage('/financeiro-pontua', <FinanceiroPontua />)} />
          <Route path="/eventos-crm" element={<Navigate to="/controle-eventos" replace />} />
          <Route path="/chat-crm" element={crmPage('/chat-crm', <ChatCrmPage />)} />
          <Route path="/profile" element={<CrmLazy><ProfilePage /></CrmLazy>} />

          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Route>
      </Routes>
    </>
  )
}

function AuthenticatedApp() {
  return (
    <CrmSelletosProviders>
      <ObrasProvider>
        <OptionalFinanceDataProvider>
          <AuthenticatedRoutes />
        </OptionalFinanceDataProvider>
      </ObrasProvider>
    </CrmSelletosProviders>
  )
}

function AppRoutes() {
  const {
    authLoading,
    profileLoading,
    profileError,
    session,
    userProfile,
    crmProfile,
    signOut,
    retryProfile,
  } = useApp()

  if (authLoading) {
    return <BootLoading message="Carregando..." />
  }

  if (!session) {
    return <Login />
  }

  if (profileLoading && !userProfile && !crmProfile) {
    return <BootLoading message="Carregando perfil..." />
  }

  const gate = evaluateIdentityGate(userProfile, crmProfile)
  if (gate.ok === false && gate.reason === 'hours') {
    return <ForaDoHorario />
  }

  if (isPortalOnly(userProfile, crmProfile) && gate.ok) {
    return (
      <CrmSelletosProviders>
        <CrmLazy>
          <PrestadorSelletos />
        </CrmLazy>
      </CrmSelletosProviders>
    )
  }

  if (!gate.ok) {
    const isConnectionError =
      profileError?.includes('banco')
      || profileError?.includes('conectar')
      || profileError?.includes('internet')
      || /failed to fetch/i.test(profileError ?? '')
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
      <OAuthErrorRedirect>
        <Routes>
          <Route path="/orcamento/:schema/:id" element={<CrmLazy><OrcamentoPublicoPage /></CrmLazy>} />
          <Route path="/iniciar-orcamento/:schema/:token" element={<CrmLazy><IniciarOrcamentoPublicoPage /></CrmLazy>} />
          <Route path="/agendar/:empresaSlug/:slug" element={<CrmLazy><AgendamentoPublico /></CrmLazy>} />
          <Route path="/agendar/:slug" element={<CrmLazy><AgendamentoPublico /></CrmLazy>} />
          <Route path="/cadastro-de-alunos" element={<CrmLazy><CadastroDeAlunos /></CrmLazy>} />
          <Route path="/cadastro/:tipo" element={<CadastroPublico />} />
          <Route path="/apresentacao/garbo" element={<CrmLazy><ApresentacaoEmpresaPublicaPage /></CrmLazy>} />
          <Route path="/marketing/apresentacao-empresa" element={<Navigate to="/apresentacao/garbo" replace />} />
          <Route path="*" element={<AppRoutes />} />
        </Routes>
      </OAuthErrorRedirect>
      <PwaManager />
      <AppToast />
    </BrowserRouter>
  )
}
