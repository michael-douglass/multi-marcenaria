import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppToast } from '@/components/ui/AppToast'
import { MainLayout } from '@/components/layout/MainLayout'
import { useApp } from '@/context/AppContext'
import { useCaixaFornecedor } from '@/hooks/useCaixaFornecedor'
import { useFornecedores } from '@/hooks/useFornecedores'
import { useProdutos } from '@/hooks/useProdutos'
import { usePedidos } from '@/hooks/usePedidos'
import { useClientes } from '@/hooks/useClientes'
import { useContasPagar } from '@/hooks/useContasPagar'
import { useContasReceber } from '@/hooks/useContasReceber'
import { sectionFromPath } from '@/lib/app-navigation'
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
import { CalendarioObras } from '@/pages/CalendarioObras'
import { MetricasObras } from '@/pages/MetricasObras'
import { Configuracoes } from '@/pages/Configuracoes'
import { Login } from '@/pages/Login'
import type { ActiveSection, UserRole } from '@/types'

const OBRAS_SECTIONS: ActiveSection[] = ['agendaObras', 'calendarioObras', 'metricasObras']

const ROLE_SECTIONS: Record<UserRole, ActiveSection[]> = {
  Administrador: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'produtos', 'pedidos', 'aprovacao', 'contasPagar', 'caixaFornecedor', 'biblioteca', 'caixa', ...OBRAS_SECTIONS, 'configuracoes'],
  Financeiro: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'produtos', 'pedidos', 'contasPagar', 'caixaFornecedor', 'biblioteca', 'caixa'],
  Marceneiro: ['dashboard'],
  MontadorAdmin: [...OBRAS_SECTIONS],
  Montador: ['agendaObras', 'calendarioObras'],
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
  const { role } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  const defaultPath = (role === 'Montador' || role === 'MontadorAdmin') ? '/agenda-obras' : '/dashboard'

  useEffect(() => {
    if (!role) return
    const section = sectionFromPath(location.pathname)
    const allowed = ROLE_SECTIONS[role] ?? ['dashboard']
    if (!allowed.includes(section)) {
      navigate(defaultPath, { replace: true })
    }
  }, [role, location.pathname, navigate])

  return null
}

function AuthenticatedRoutes() {
  const { role } = useApp()
  const readOnly = role === 'Marceneiro'

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
          <Route index element={
            (role === 'Montador' || role === 'MontadorAdmin')
              ? <Navigate to="/agenda-obras" replace />
              : <Navigate to="/dashboard" replace />
          } />
          <Route
            path="/dashboard"
            element={
              <Dashboard />
            }
          />
          <Route path="/clientes" element={guardReadOnly(<Clientes readOnly={readOnly} />)} />
          <Route path="/cobrancas" element={guardReadOnly(<ContasReceber clientes={clientesHook.data} readOnly={readOnly} />)} />
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
              role === 'Administrador' ? (
                <Aprovacao fornecedores={fornecedoresHook.data} produtos={produtosHook.data} />
              ) : (
                <Restricted message="Exclusivo para Administradores." />
              )
            }
          />
          <Route
            path="/contas-pagar"
            element={guardReadOnly(
              <ContasPagar
                fornecedores={fornecedoresHook.data}
                getSaldoFornecedor={caixaFornecedorHook.getSaldoFornecedor}
                debitarSaldo={caixaFornecedorHook.debitarSaldo}
                readOnly={readOnly}
              />
            )}
          />
          <Route
            path="/caixa-fornecedor"
            element={guardReadOnly(<CaixaFornecedor fornecedores={fornecedoresHook.data} role={role} readOnly={readOnly} />)}
          />
          <Route
            path="/biblioteca"
            element={guardReadOnly(<Biblioteca readOnly={readOnly} />)}
          />
          <Route
            path="/caixa"
            element={guardReadOnly(<Caixa />)}
          />

          {/* Agenda de Obras */}
          <Route
            path="/agenda-obras"
            element={
              role === 'Administrador' || role === 'MontadorAdmin' || role === 'Montador'
                ? <AgendaObras />
                : <Restricted message="Acesso restrito ao módulo de Obras." />
            }
          />
          <Route
            path="/calendario-obras"
            element={
              role === 'Administrador' || role === 'MontadorAdmin' || role === 'Montador'
                ? <CalendarioObras />
                : <Restricted message="Acesso restrito ao módulo de Obras." />
            }
          />
          <Route
            path="/metricas-obras"
            element={
              role === 'Administrador' || role === 'MontadorAdmin'
                ? <MetricasObras />
                : <Restricted message="Métricas disponíveis apenas para Admin e Montador Admin." />
            }
          />

          {/* Configurações */}
          <Route
            path="/configuracoes"
            element={
              role === 'Administrador'
                ? <Configuracoes />
                : <Restricted message="Acesso restrito a Administradores." />
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </>
  )
}

function AppRoutes() {
  const { authLoading, profileLoading, session, userProfile, signOut } = useApp()

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#150c09] font-raleway text-sm tracking-wider text-[#d4a853]">
        Carregando...
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#150c09] font-raleway text-center text-[#d4a853]">
        <div>
          <p className="mb-1 text-lg font-semibold">Usuário não configurado.</p>
          <p className="text-sm opacity-60">Contate o administrador para criar seu perfil de acesso.</p>
          <button
            onClick={signOut}
            className="mt-6 text-xs underline opacity-40 hover:opacity-80"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  return <AuthenticatedRoutes />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <AppToast />
    </BrowserRouter>
  )
}
