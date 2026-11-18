import { Eye, PencilLine } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AcessoMaster } from '@/hooks/useMaster'
import { Vazio } from '@/master/components/MasterUi'

function duracao(inicio: string, fim: string | null): string {
  if (!fim) return 'Em andamento'
  const min = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min`
}

/** Registro das entradas do master nas marcenarias (modo, início, duração). */
export function AcessosTabela({ acessos, mostrarEmpresa }: { acessos: AcessoMaster[]; mostrarEmpresa: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]">
      <Table>
        <TableHeader>
          <TableRow>
            {mostrarEmpresa ? <TableHead>Marcenaria</TableHead> : null}
            <TableHead>Modo</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Usuário</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {acessos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={mostrarEmpresa ? 5 : 4}><Vazio>Nenhuma entrada registrada.</Vazio></TableCell>
            </TableRow>
          ) : acessos.map((a) => (
            <TableRow key={a.id}>
              {mostrarEmpresa ? <TableCell className="font-medium">{a.empresa_nome}</TableCell> : null}
              <TableCell>
                {a.somente_leitura ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-[var(--m-leitura)]"><Eye className="h-4 w-4" aria-hidden /> Somente leitura</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--m-total)]"><PencilLine className="h-4 w-4" aria-hidden /> Acesso total</span>
                )}
              </TableCell>
              <TableCell className="m-num text-sm">{new Date(a.inicio).toLocaleString('pt-BR')}</TableCell>
              <TableCell className="m-num text-sm">{duracao(a.inicio, a.fim)}</TableCell>
              <TableCell className="text-sm text-[var(--m-ink-2)]">{a.usuario_email ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
