import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  adminLoading: true,
  signOut: async () => {},
});

// Retry helper for transient mobile-Safari "Load failed" / network errors
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  const checkAdmin = async (userId: string) => {
    setAdminLoading(true);
    const res = await withRetry(async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (error) throw error;
      return data;
    });
    setIsAdmin(!!res);
    setAdminLoading(false);
  };

  const enforceBlock = async (userId: string): Promise<boolean> => {
    const data = await withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('blocked_until')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    });
    const until = data?.blocked_until ? new Date(data.blocked_until).getTime() : 0;
    if (until && until > Date.now()) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      if (typeof window !== 'undefined') {
        window.alert(`Аккаунт заблокирован. Осталось примерно ${mins} мин.`);
      }
      return true;
    }
    return false;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const uid = session.user.id;
          setAdminLoading(true);
          setTimeout(async () => {
            const blocked = await enforceBlock(uid);
            if (!blocked) checkAdmin(uid);
            else setAdminLoading(false);
          }, 0);
        } else {
          setIsAdmin(false);
          setAdminLoading(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const blocked = await enforceBlock(session.user.id);
        if (!blocked) await checkAdmin(session.user.id);
        else setAdminLoading(false);
      } else {
        setAdminLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, adminLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
