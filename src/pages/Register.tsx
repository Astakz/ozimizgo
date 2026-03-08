import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [profession, setProfession] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim() || !inviteCode.trim()) {
      toast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Ошибка', description: 'Пароль должен содержать минимум 6 символов', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Validate invite code
      const { data: valid, error: validateError } = await supabase.rpc('validate_invite_code', {
        invite_code_value: inviteCode.trim().toUpperCase(),
      });

      if (validateError) throw validateError;
      if (!valid) {
        toast({ title: 'Ошибка', description: 'Неверный или уже использованный инвайт-код', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Sign up
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), invite_code: inviteCode.trim().toUpperCase() },
        },
      });

      if (error) throw error;

      // Mark invite code as used
      if (signUpData.user) {
        await supabase.rpc('use_invite_code', {
          invite_code_value: inviteCode.trim().toUpperCase(),
          used_by_user_id: signUpData.user.id,
        });
      }

      toast({ title: 'Успешно!', description: 'Аккаунт создан. Добро пожаловать!' });
      navigate('/');
    } catch (err: any) {
      toast({
        title: 'Ошибка регистрации',
        description: err.message || 'Попробуйте позже',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-elevated animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>Создайте аккаунт для работы с документами</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя и фамилия</Label>
              <Input id="name" placeholder="Иванов Иван" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite">Инвайт-код</Label>
              <Input
                id="invite"
                placeholder="Введите код приглашения"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                disabled={loading}
                className="font-mono tracking-wider"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Зарегистрироваться
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">Войти</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
