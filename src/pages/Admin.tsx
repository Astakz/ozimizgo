import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, FileText, Key, LogOut, Briefcase, Settings, PenTool } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminObjections from '@/components/admin/AdminObjections';
import AdminInviteCodes from '@/components/admin/AdminInviteCodes';
import AdminObjectionGenerator from '@/components/admin/AdminObjectionGenerator';

const Admin = () => {
  const { signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'users';

  return (
    <div className="min-h-screen bg-background">
      <header className="navy-gradient text-primary-foreground py-4 shadow-elevated">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-gold" />
            <h1 className="text-xl font-bold">Панель администратора</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/">На главную</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Пользователи</TabsTrigger>
            <TabsTrigger value="generator" className="gap-2"><PenTool className="w-4 h-4" /> Возражение</TabsTrigger>
            <TabsTrigger value="objections" className="gap-2"><FileText className="w-4 h-4" /> История</TabsTrigger>
            <TabsTrigger value="codes" className="gap-2"><Key className="w-4 h-4" /> Инвайт-коды</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>

          <TabsContent value="generator">
            <AdminObjectionGenerator />
          </TabsContent>

          <TabsContent value="objections">
            <AdminObjections />
          </TabsContent>

          <TabsContent value="codes">
            <AdminInviteCodes />
          </TabsContent>

          <TabsContent value="settings">
            <div className="text-center text-muted-foreground py-12">
              <Settings className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">Настройки</p>
              <p className="text-sm mt-1">Раздел в разработке</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
