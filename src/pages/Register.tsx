import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Loader2, User, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState<'user' | 'lawyer'>('user');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: 'Ошибка', description: 'Заполните обязательные поля', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Ошибка', description: 'Пароль должен содержать минимум 6 символов', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // If invite code provided, validate it
      if (inviteCode.trim()) {
        const { data: valid, error: validateError } = await supabase.rpc('validate_invite_code', {
          invite_code_value: inviteCode.trim().toUpperCase(),
        });
        if (validateError) throw validateError;
        if (!valid) {
          toast({ title: 'Ошибка', description: 'Неверный или уже использованный инвайт-код', variant: 'destructive' });
          setLoading(false);
          return;
        }
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            invite_code: inviteCode.trim().toUpperCase() || '',
            role,
          },
        },
      });

      if (error) throw error;

      if (signUpData.user) {
        // Mark invite code as used if provided
        if (inviteCode.trim()) {
          await supabase.rpc('use_invite_code', {
            invite_code_value: inviteCode.trim().toUpperCase(),
            used_by_user_id: signUpData.user.id,
          });
        }

        if (role === 'lawyer') {
          await supabase.from('user_roles').update({ role: 'lawyer' }).eq('user_id', signUpData.user.id);
        }
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

            <div className="space-y-3">
              <Label>Тип аккаунта</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as 'user' | 'lawyer')} className="grid grid-cols-2 gap-3">
                <div>
                  <RadioGroupItem value="user" id="role-user" className="peer sr-only" />
                  <Label
                    htmlFor="role-user"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <User className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">Клиент</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="lawyer" id="role-lawyer" className="peer sr-only" />
                  <Label
                    htmlFor="role-lawyer"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Scale className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">Юрист / Адвокат</span>
                  </Label>
                </div>
              </RadioGroup>
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
