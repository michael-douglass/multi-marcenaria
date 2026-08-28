import { useState } from 'react';
import { Bell, Check, X, Clock, Calendar, TrendingUp, TrendingDown, CheckCircle2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePendingUsers } from '@/hooks/usePendingUsers';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { pendingUsers, pendingCount, approveUser, rejectUser } = usePendingUsers();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, 'admin' | 'vendedor' | 'nenhum'>>({});
  const [open, setOpen] = useState(false);

  const totalBadgeCount = pendingCount + unreadCount;

  const handleApprove = (userId: string) => {
    const role = selectedRoles[userId] || 'vendedor';
    approveUser.mutate({ userId, role });
  };

  const handleReject = (userId: string) => {
    rejectUser.mutate(userId);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'aula_marcada':
        return <Calendar className="h-4 w-4 text-primary" />;
      case 'venda_realizada':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'venda_perdida':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'vendedor_ausente':
        return <UserX className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationBgColor = (type: string, read: boolean) => {
    if (read) return 'bg-muted/50';
    switch (type) {
      case 'aula_marcada':
        return 'bg-primary/5 dark:bg-primary/10';
      case 'venda_realizada':
        return 'bg-success/5 dark:bg-success/10';
      case 'venda_perdida':
        return 'bg-destructive/5 dark:bg-destructive/10';
      case 'vendedor_ausente':
        return 'bg-amber-50 dark:bg-amber-900/20';
      default:
        return 'bg-background';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {totalBadgeCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white border-0"
            >
              {totalBadgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests" className="relative">
              Solicitações
              {pendingCount > 0 && (
                <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activities" className="relative">
              Atividades
              {unreadCount > 0 && (
                <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="m-0">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Solicitações de Acesso</h3>
              <Badge variant="secondary">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</Badge>
            </div>

            <ScrollArea className="h-[400px]">
              {pendingUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhuma solicitação pendente</p>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="p-4 space-y-3">
                      <div>
                        <p className="font-medium">{user.nome}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.telefone && (
                          <p className="text-sm text-muted-foreground">{user.telefone}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(user.criado_em), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedRoles[user.id] || 'vendedor'}
                          onValueChange={(value) => 
                            setSelectedRoles({ ...selectedRoles, [user.id]: value as any })
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecionar papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">ADMIN</SelectItem>
                            <SelectItem value="vendedor">VENDEDOR</SelectItem>
                            <SelectItem value="nenhum">NENHUM (Sem acesso)</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="icon"
                          variant="default"
                          onClick={() => handleApprove(user.id)}
                          disabled={approveUser.isPending}
                          title="Aprovar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleReject(user.id)}
                          disabled={rejectUser.isPending}
                          title="Recusar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activities" className="m-0">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Atividades</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</Badge>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsRead.mutate()}
                    disabled={markAllAsRead.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Marcar todas
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 space-y-2 cursor-pointer transition-colors hover:bg-muted/50",
                        getNotificationBgColor(notification.notification_type, notification.read)
                      )}
                      onClick={() => !notification.read && markAsRead.mutate(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.notification_type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className={cn(
                            "text-sm",
                            !notification.read && "font-semibold"
                          )}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
