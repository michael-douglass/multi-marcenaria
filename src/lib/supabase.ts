import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  (import.meta.env.VITE_SUPABASE_PROJECT_ID
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : undefined)

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const missing: string[] = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL (ou VITE_SUPABASE_PROJECT_ID)')
  if (!supabaseKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY)')

  throw new Error(
    `Variaveis do Supabase ausentes no build: ${missing.join(', ')}. Configure no painel da Vercel e faca novo redeploy.`,
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
