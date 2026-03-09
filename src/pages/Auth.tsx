import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const Auth = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="flex justify-end">
          <div className="bg-primary rounded-lg p-1">
            <LanguageSwitcher variant="header" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary flex items-center justify-center">
            <Scale className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('auth.welcome')}</h1>
          <p className="text-muted-foreground">{t('auth.system')}</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{t('auth.choose')}</CardTitle>
            <CardDescription>{t('auth.chooseDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Button asChild className="w-full h-12 text-base" variant="default">
              <Link to="/login" className="gap-3">
                <LogIn className="w-5 h-5" />
                {t('auth.login')}
              </Link>
            </Button>
            <Button asChild className="w-full h-12 text-base" variant="outline">
              <Link to="/register" className="gap-3">
                <UserPlus className="w-5 h-5" />
                {t('auth.register')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
