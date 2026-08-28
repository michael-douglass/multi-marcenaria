import { Logo } from '@/components/Logo'

interface CrmModuloPlaceholderProps {
  titulo: string
  descricao: string
}

export function CrmModuloPlaceholder({ titulo, descricao }: CrmModuloPlaceholderProps) {
  return (
    <div className="fade-in mx-auto max-w-xl py-10 text-center">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <h1 className="font-display text-2xl tracking-wide text-[#f2d892]">{titulo}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#edd9c4]">{descricao}</p>
      <p className="mt-4 text-xs text-[#b8957f]">
        O menu já respeita o seu perfil. O conteúdo desta tela entra no próximo épico da fusão.
      </p>
    </div>
  )
}
