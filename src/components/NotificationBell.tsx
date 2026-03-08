import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, MessageCircle, Briefcase, Star, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof MessageCircle> = {
  new_message: MessageCircle,
  case_response: Briefcase,
  new_review: Star,
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const items = (data || []) as unknown as Notification[];
    setNotifications(items);
    setUnreadCount(items.filter(n => !n.is_read).length);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'сейчас';
    if (diffMin < 60) return `${diffMin} мин`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ч`;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Уведомления</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={loading} className="text-xs h-7 gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Прочитать все
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Нет уведомлений</p>
            </div>
          ) : (
            notifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0",
                    !n.is_read && "bg-accent/5"
                  )}
                >
                  <div className={cn("mt-0.5 shrink-0 h-8 w-8 rounded-full flex items-center justify-center", !n.is_read ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm truncate", !n.is_read && "font-semibold")}>{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  </div>
                  {!n.is_read && <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-secondary" />}
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
