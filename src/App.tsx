import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { useApp } from '@/context/AppContext'
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
import { Login } from '@/pages/Login'
import type { ActiveSection, UserRole } from '@/types'

const ROLE_SECTIONS: Record<UserRole, ActiveSection[]> = {
  Administrador: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'produtos', 'pedidos', 'aprovacao', 'contasPagar', 'biblioteca'],
  Financeiro: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'produtos', 'pedidos', 'contasPagar', 'biblioteca'],
  Marceneiro: ['dashboard'],
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

  useEffect(() => {
    if (!role) return
    const section = sectionFromPath(location.pathname)
    const allowed = ROLE_SECTIONS[role] ?? ['dashboard']
    if (!allowed.includes(section)) {
      navigate('/dashboard', { replace: true })
    }
  }, [role, location.pathname, navigate])

  return null
}

function AppRoutes() {
  const { role, authLoading, session } = useApp()
  const readOnly = role === 'Marceneiro'

  const fornecedoresHook = useFornecedores()
  const produtosHook = useProdutos()
  const pedidosHook = usePedidos()
  const clientesHook = useClientes()
  const contasPagarHook = useContasPagar()
  const contasReceberHook = useContasReceber()

  const pendingOrders = pedidosHook.data.filter(o => o.status === 'aguardando_aprovacao').length

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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                fornecedores={fornecedoresHook.data}
                produtos={produtosHook.data}
                pedidos={pedidosHook.data}
                clientes={clientesHook.data}
                contasPagar={contasPagarHook.data}
                contasReceber={contasReceberHook.data}
              />
            }
          />
          <Route path="/clientes" element={guardReadOnly(<Clientes readOnly={readOnly} />)} />
          <Route path="/cobrancas" element={guardReadOnly(<ContasReceber clientes={clientesHook.data} readOnly={readOnly} />)} />
          <Route path="/fornecedores" element={guardReadOnly(<Fornecedores readOnly={readOnly} />)} />
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
            element={guardReadOnly(<ContasPagar fornecedores={fornecedoresHook.data} readOnly={readOnly} />)}
          />
          <Route
            path="/biblioteca"
            element={guardReadOnly(<Biblioteca readOnly={readOnly} />)}
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
