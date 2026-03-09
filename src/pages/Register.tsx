import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [profession, setProfession] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !inviteCode.trim() || !profession) {
      toast({ title: t('common.error'), description: t('register.fillAll'), variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: t('common.error'), description: t('register.shortPassword'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data: valid, error: validateError } = await supabase.rpc('validate_invite_code', {
        invite_code_value: inviteCode.trim().toUpperCase(),
      });
      if (validateError) throw validateError;
      if (!valid) {
        toast({ title: t('common.error'), description: t('register.invalidInvite'), variant: 'destructive' });
        setLoading(false);
        return;
      }
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), invite_code: inviteCode.trim().toUpperCase(), profession } },
      });
      if (error) throw error;
      if (signUpData.user) {
        await supabase.rpc('use_invite_code', {
          invite_code_value: inviteCode.trim().toUpperCase(),
          used_by_user_id: signUpData.user.id,
        });
      }
      toast({ title: t('register.success'), description: t('register.successDesc') });
      navigate('/');
    } catch (err: any) {
      toast({ title: t('register.error'), description: err.message || t('common.tryLater'), variant: 'destructive' });
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
          <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
          <CardDescription>{t('register.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('register.name')}</Label>
              <Input id="name" placeholder={t('register.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('register.email')}</Label>
              <Input id="email" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('register.password')}</Label>
              <Input id="password" type="password" placeholder={t('register.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>{t('register.profession')}</Label>
              <Select value={profession} onValueChange={setProfession} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={t('register.professionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Юрист">{t('register.lawyer')}</SelectItem>
                  <SelectItem value="Адвокат">{t('register.advocate')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite">{t('register.inviteCode')}</Label>
              <Input id="invite" placeholder={t('register.invitePlaceholder')} value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} disabled={loading} className="font-mono tracking-wider" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('register.submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">{t('register.login')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
