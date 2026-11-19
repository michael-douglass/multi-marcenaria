/**
 * Console master — ambiente isolado do app da marcenaria (ADR 0004).
 * Renderizado por `AppRoutes` antes do `AuthenticatedApp`: não monta os providers do CRM/Obras/
 * finanças, nem o MainLayout e os popups. Chunk próprio (lazy).
 */
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MasterLayout } from '@/master/MasterLayout'
import './master.css'

const VisaoGeral = lazy(() => import('@/master/pages/VisaoGeral'))
const Empresas = lazy(() => import('@/master/pages/Empresas'))
const EmpresaDetalhe = lazy(() => import('@/master/pages/EmpresaDetalhe'))
const Financeiro = lazy(() => import('@/master/pages/Financeiro'))
const Planos = lazy(() => import('@/master/pages/Planos'))
const Acessos = lazy(() => import('@/master/pages/Acessos'))
const Modelos = lazy(() => import('@/master/pages/Modelos'))

const FONTE_ID = 'master-fonte-instrument-sans'
const FONTE_URL =
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&display=swap'

/** Aplica o tema do console no <html> (vale também para portais) e carrega a fonte só aqui. */
function useAmbienteMaster() {
  useEffect(() => {
    document.documentElement.classList.add('master-shell')
    const tituloAnterior = document.title
    document.title = 'Console master'
    if (!document.getElementById(FONTE_ID)) {
      const link = document.createElement('link')
      link.id = FONTE_ID
      link.rel = 'stylesheet'
      link.href = FONTE_URL
      document.head.appendChild(link)
    }
    return () => {
      document.documentElement.classList.remove('master-shell')
      document.title = tituloAnterior
    }
  }, [])
}

function Carregando() {
  return <p className="px-8 py-10 text-sm text-[var(--m-ink-2)]">Carregando…</p>
}

export default function MasterApp() {
  useAmbienteMaster()
  return (
    <Routes>
      <Route element={<MasterLayout />}>
        <Route path="/master" element={<Suspense fallback={<Carregando />}><VisaoGeral /></Suspense>} />
        <Route path="/master/empresas" element={<Suspense fallback={<Carregando />}><Empresas /></Suspense>} />
        <Route path="/master/empresas/:id" element={<Suspense fallback={<Carregando />}><EmpresaDetalhe /></Suspense>} />
        <Route path="/master/financeiro" element={<Suspense fallback={<Carregando />}><Financeiro /></Suspense>} />
        <Route path="/master/planos" element={<Suspense fallback={<Carregando />}><Planos /></Suspense>} />
        <Route path="/master/modelos" element={<Suspense fallback={<Carregando />}><Modelos /></Suspense>} />
        <Route path="/master/acessos" element={<Suspense fallback={<Carregando />}><Acessos /></Suspense>} />
        <Route path="*" element={<Navigate to="/master" replace />} />
      </Route>
    </Routes>
  )
}
