import { showToast } from '@/lib/toast'

/**
 * Copia texto para a área de transferência e avisa o usuário.
 * Retorna true se a cópia deu certo.
 */
export async function copyText(
  text: string,
  successMessage = 'Copiado para a área de transferência',
): Promise<boolean> {
  const value = text.trim()
  if (!value) {
    showToast('Nada para copiar.', 'error')
    return false
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      showToast(successMessage)
      return true
    }
  } catch {
    // fallback abaixo
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) {
      showToast(successMessage)
      return true
    }
  } catch {
    // ignore
  }

  showToast('Não foi possível copiar. Selecione o texto e use Ctrl+C.', 'error')
  return false
}
