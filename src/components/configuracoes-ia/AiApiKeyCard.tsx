import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AiApiKeyFieldProps {
  id: string
  label: string
  configured: boolean
  placeholder?: string
  saving?: boolean
  clearing?: boolean
  onSave: (value: string) => Promise<void>
  onClear: () => Promise<void>
}

function AiApiKeyField({
  id,
  label,
  configured,
  placeholder = 'sk-...',
  saving,
  clearing,
  onSave,
  onClear,
}: AiApiKeyFieldProps) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const busy = Boolean(saving || clearing)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {label}
        </Label>
        <Badge variant={configured ? 'default' : 'secondary'}>
          {configured ? 'Configurada' : 'Vazia'}
        </Badge>
      </div>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={configured ? 'Digite uma nova chave para substituir' : placeholder}
          className="pr-10 font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar chave' : 'Mostrar chave'}
          disabled={busy}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !value.trim()}
          onClick={async () => {
            await onSave(value)
            setValue('')
            setShow(false)
          }}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar chave
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !configured}
          onClick={async () => {
            await onClear()
            setValue('')
            setShow(false)
          }}
        >
          {clearing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Remover chave
        </Button>
      </div>
    </div>
  )
}

interface AiApiKeyCardProps {
  title: string
  description: string
  children: ReactNode
  footerHint?: ReactNode
}

export function AiApiKeyCard({ title, description, children, footerHint }: AiApiKeyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        {footerHint ? <p className="text-xs text-muted-foreground">{footerHint}</p> : null}
      </CardContent>
    </Card>
  )
}

export { AiApiKeyField }

export function ConfiguracoesIaLink({ className }: { className?: string }) {
  return (
    <Link to="/configuracoes-ia" className={className ?? 'font-medium text-primary underline-offset-4 hover:underline'}>
      Configurações IA
    </Link>
  )
}
