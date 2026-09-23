import type { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { EmpresaProvider } from '@/contexts/EmpresaContext'
import { PageZoomProvider } from '@/contexts/PageZoomContext'
import { LeadAIAnalysisBackgroundProvider } from '@/contexts/LeadAIAnalysisBackgroundContext'
import { LeadAIRenderBackgroundProvider } from '@/contexts/LeadAIRenderBackgroundContext'
import { OrcamentosIaBackgroundProvider } from '@/contexts/OrcamentosIaBackgroundContext'
import { AppProvider as CrmUiProvider } from '@/contexts/AppContext'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

/** Empilha os contextos do CRM Selletos em volta das telas autenticadas. */
export function CrmSelletosProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <EmpresaProvider>
        <AuthProvider>
          <PageZoomProvider>
            <LeadAIAnalysisBackgroundProvider>
              <LeadAIRenderBackgroundProvider>
                <OrcamentosIaBackgroundProvider>
                  <CrmUiProvider>
                    {children}
                    <Toaster />
                    <Sonner />
                  </CrmUiProvider>
                </OrcamentosIaBackgroundProvider>
              </LeadAIRenderBackgroundProvider>
            </LeadAIAnalysisBackgroundProvider>
          </PageZoomProvider>
        </AuthProvider>
      </EmpresaProvider>
    </TooltipProvider>
  )
}
