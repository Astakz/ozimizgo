import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Trash2, Loader2, Search, UserCog, Eye } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  profession: string | null;
  specialization: string[] | null;
  invite_code: string | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

type TabFilter = 'clients' | 'lawyers';

const ROLE_LABELS: Record<string, string> = {
  user: 'Клиент',
  lawyer: 'Юрист/Адвокат',
  admin: 'Админ',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState<TabFilter>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    if (profilesRes.error) {
      toast({ title: 'Ошибка', description: profilesRes.error.message, variant: 'destructive' });
    } else {
      setUsers(profilesRes.data || []);
    }

    const roleMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r: UserRole) => { roleMap[r.user_id] = r.role; });
    setRoles(roleMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredUsers = users.filter(u => {
    const role = roles[u.user_id] || 'user';
    if (tabFilter === 'clients' && role === 'lawyer') return false;
    if (tabFilter === 'lawyers' && role !== 'lawyer') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (u.full_name || u.name || '').toLowerCase();
      const nick = (u.nickname || '').toLowerCase();
      const email = u.email.toLowerCase();
      if (!name.includes(q) && !nick.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const changeRole = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    // Delete existing role then insert new one
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert([{ user_id: userId, role: newRole as any }]);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Роль изменена' });
      setRoles(prev => ({ ...prev, [userId]: newRole }));
    }
    setChangingRole(null);
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Пользователь удалён' });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      setSelectedUser(null);
    }
  };

  const initials = (u: Profile) => (u.full_name || u.nickname || u.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Clients / Lawyers */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant={tabFilter === 'clients' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTabFilter('clients')}
          >
            Клиенты
          </Button>
          <Button
            variant={tabFilter === 'lawyers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTabFilter('lawyers')}
          >
            Юристы / Адвокаты
          </Button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {tabFilter === 'clients' ? 'Клиенты' : 'Юристы / Адвокаты'}
          </CardTitle>
          <CardDescription>{filteredUsers.length} найдено</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет пользователей</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead className="hidden md:table-cell">Дата</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => {
                    const role = roles[u.user_id] || 'user';
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url || ''} />
                              <AvatarFallback className="text-xs bg-muted">{initials(u)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{u.full_name || u.name || '—'}</p>
                              {u.nickname && <p className="text-xs text-muted-foreground">@{u.nickname}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Select
                            value={role}
                            onValueChange={(val) => changeRole(u.user_id, val)}
                            disabled={changingRole === u.user_id}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Клиент</SelectItem>
                              <SelectItem value="lawyer">Юрист</SelectItem>
                              <SelectItem value="admin">Админ</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString('ru-RU')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedUser(u)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteUser(u.user_id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-md">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatar_url || ''} />
                    <AvatarFallback>{initials(selectedUser)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedUser.full_name || selectedUser.name}</p>
                    {selectedUser.nickname && <p className="text-sm font-normal text-muted-foreground">@{selectedUser.nickname}</p>}
                  </div>
                </DialogTitle>
                <DialogDescription>{selectedUser.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Роль</span>
                  <Badge variant="secondary">{ROLE_LABELS[roles[selectedUser.user_id] || 'user']}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Профессия</span>
                  <span>{selectedUser.profession || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Инвайт-код</span>
                  <span className="font-mono">{selectedUser.invite_code || '—'}</span>
                </div>
                {selectedUser.specialization && selectedUser.specialization.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Специализация</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedUser.specialization.map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Дата регистрации</span>
                  <span>{new Date(selectedUser.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="destructive" size="sm" onClick={() => deleteUser(selectedUser.user_id)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Удалить
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
