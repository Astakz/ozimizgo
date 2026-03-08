import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Copy } from 'lucide-react';

interface InviteCode {
  id: string;
  code: string;
  is_used: boolean;
  created_at: string;
  used_at: string | null;
}

export default function AdminInviteCodes() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invite_codes')
      .select('id, code, is_used, created_at, used_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      setCodes(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  };

  const createCode = async () => {
    if (!newCode.trim()) {
      toast({ title: 'Ошибка', description: 'Введите или сгенерируйте код', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('invite_codes').insert({ code: newCode.trim().toUpperCase() });
    if (error) {
      toast({ title: 'Ошибка', description: error.message.includes('unique') ? 'Такой код уже существует' : error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Инвайт-код создан' });
      setNewCode('');
      fetchCodes();
    }
    setCreating(false);
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from('invite_codes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Удалено' });
      setCodes(prev => prev.filter(c => c.id !== id));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Скопировано', description: code });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Создать инвайт-код</CardTitle>
          <CardDescription>Введите код вручную или сгенерируйте</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Код приглашения" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} className="font-mono tracking-wider" />
            <Button variant="outline" onClick={generateCode}>Генерировать</Button>
            <Button onClick={createCode} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Создать
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Список инвайт-кодов</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : codes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет инвайт-кодов</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="hidden sm:table-cell">Создан</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map(code => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono tracking-wider font-medium">{code.code}</TableCell>
                    <TableCell>
                      <Badge variant={code.is_used ? 'secondary' : 'default'}>
                        {code.is_used ? 'Использован' : 'Активен'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {new Date(code.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyCode(code.code)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCode(code.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
