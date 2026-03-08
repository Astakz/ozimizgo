import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Loader2, User, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';

const SPECIALIZATIONS = [
  { value: 'criminal', label: 'Уголовные дела' },
  { value: 'civil', label: 'Гражданские дела' },
  { value: 'administrative', label: 'Административные дела' },
  { value: 'family', label: 'Семейное право' },
  { value: 'corporate', label: 'Корпоративное право' },
  { value: 'tax', label: 'Налоговое право' },
];

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState<'user' | 'lawyer'>('user');
  const [profession, setProfession] = useState<'lawyer' | 'advocate'>('lawyer');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const isLawyer = role === 'lawyer';

  const toggleSpec = (val: string) => {
    setSpecializations(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
    );
  };

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

    // Lawyers must provide invite code
    if (isLawyer && !inviteCode.trim()) {
      toast({ title: 'Ошибка', description: 'Для регистрации юриста/адвоката требуется инвайт-код', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Validate invite code for lawyers
      if (isLawyer && inviteCode.trim()) {
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

      const metaData: Record<string, string> = {
        name: name.trim(),
        nickname: nickname.trim(),
        invite_code: isLawyer ? inviteCode.trim().toUpperCase() : '',
        role: isLawyer ? 'lawyer' : 'user',
        profession: isLawyer ? (profession === 'advocate' ? 'Адвокат' : 'Юрист') : '',
      };

      if (isLawyer && specializations.length > 0) {
        metaData.specialization = specializations.join(',');
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: metaData },
      });

      if (error) throw error;

      if (signUpData.user) {
        // Mark invite code as used for lawyers
        if (isLawyer && inviteCode.trim()) {
          await supabase.rpc('use_invite_code', {
            invite_code_value: inviteCode.trim().toUpperCase(),
            used_by_user_id: signUpData.user.id,
          });
        }
      }

      toast({ title: 'Успешно!', description: 'Аккаунт создан. Добро пожаловать!' });
      navigate(isLawyer ? '/' : '/lawyers');
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-elevated animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>Создайте аккаунт для работы с платформой</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Role selection */}
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
                    <span className="text-xs text-muted-foreground mt-1">Без инвайт-кода</span>
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
                    <span className="text-xs text-muted-foreground mt-1">Нужен инвайт-код</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Имя и фамилия *</Label>
              <Input id="name" placeholder="Иванов Иван" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Никнейм</Label>
              <Input id="nickname" placeholder="ivan_law" value={nickname} onChange={(e) => setNickname(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль *</Label>
              <Input id="password" type="password" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>

            {/* Lawyer-specific fields */}
            {isLawyer && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="invite">Инвайт-код *</Label>
                  <Input
                    id="invite"
                    placeholder="Введите инвайт-код"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="font-mono tracking-wider"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Статус</Label>
                  <RadioGroup value={profession} onValueChange={(v) => setProfession(v as 'lawyer' | 'advocate')} className="grid grid-cols-2 gap-3">
                    <div>
                      <RadioGroupItem value="lawyer" id="prof-lawyer" className="peer sr-only" />
                      <Label htmlFor="prof-lawyer" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-sm">
                        Юрист
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="advocate" id="prof-advocate" className="peer sr-only" />
                      <Label htmlFor="prof-advocate" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-sm">
                        Адвокат
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Специализация</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPECIALIZATIONS.map((spec) => (
                      <label key={spec.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={specializations.includes(spec.value)}
                          onCheckedChange={() => toggleSpec(spec.value)}
                          disabled={loading}
                        />
                        {spec.label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!isLawyer && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                Как клиент вы сможете просматривать профили юристов и искать специалистов. Для доступа к остальным функциям потребуется инвайт-код.
              </p>
            )}

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
