import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Clock, MapPin, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function GerenciamentoUsoContent() {
  const [presenceDays, setPresenceDays] = useState(7);
  const [pontoDays, setPontoDays] = useState(7);

  // Fetch presence sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['admin-presence-sessions', presenceDays],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - presenceDays);

      const { data, error } = await supabase
        .from('CRM-multi-empresas>presence_sessions<')
        .select('*')
        .gte('started_at', cutoff.toISOString())
        .order('started_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const userIds = [...new Set((data || []).map(s => s.user_id))];
      if (userIds.length === 0) return [];

      const { data: users } = await supabase
        .from('CRM-multi-empresas>usuarios<')
        .select('id, nome, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      return (data || []).map(s => ({
        ...s,
        user_name: userMap.get(s.user_id)?.nome || 'Desconhecido',
        avatar_url: userMap.get(s.user_id)?.avatar_url || null,
      }));
    },
  });

  // Fetch ponto records
  const { data: pontos = [], isLoading: loadingPontos } = useQuery({
    queryKey: ['admin-ponto-registros', pontoDays],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - pontoDays);

      const { data, error } = await supabase
        .from('CRM-multi-empresas>ponto_registros<')
        .select('*')
        .gte('data_hora', cutoff.toISOString())
        .order('data_hora', { ascending: false })
        .limit(200);

      if (error) throw error;

      const userIds = [...new Set((data || []).map(p => p.user_id))];
      if (userIds.length === 0) return [];

      const { data: users } = await supabase
        .from('CRM-multi-empresas>usuarios<')
        .select('id, nome, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      return (data || []).map(p => ({
        ...p,
        user_name: userMap.get(p.user_id)?.nome || 'Desconhecido',
        avatar_url: userMap.get(p.user_id)?.avatar_url || null,
      }));
    },
  });

  const getDuration = (start: string, end: string | null) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const mins = differenceInMinutes(e, s);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) return `${hours}h ${remainingMins}min`;
    return `${remainingMins}min`;
  };

  const FilterButtons = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[7, 30].map(d => (
        <Button key={d} variant={value === d ? 'default' : 'outline'} size="sm" onClick={() => onChange(d)}>
          {d} dias
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Histórico de presença */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Histórico de Presença
          </CardTitle>
          <FilterButtons value={presenceDays} onChange={setPresenceDays} />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Endereço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSessions ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar user={{ name: s.user_name, avatarUrl: s.avatar_url || undefined }} size="sm" />
                          <span className="text-sm font-medium">{s.user_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(s.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.ended_at
                          ? format(new Date(s.ended_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : <Badge className="bg-emerald-500">Online</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{getDuration(s.started_at, s.ended_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {s.endereco || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Registros de ponto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Registros de Ponto
          </CardTitle>
          <FilterButtons value={pontoDays} onChange={setPontoDays} />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Endereço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPontos ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                  </TableRow>
                ) : pontos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell>
                  </TableRow>
                ) : (
                  pontos.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar user={{ name: p.user_name, avatarUrl: p.avatar_url || undefined }} size="sm" />
                          <span className="text-sm font-medium">{p.user_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.tipo === 'entrada' ? 'default' : 'secondary'}
                          className={p.tipo === 'entrada' ? 'bg-emerald-500' : ''}>
                          {p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(p.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {p.endereco || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
