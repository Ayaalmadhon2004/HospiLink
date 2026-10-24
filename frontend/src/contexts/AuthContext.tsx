// frontend/src/contexts/AuthContext.tsx
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import i18n from '../i18n';
import { apiGet } from '../services/api';
import { setSessionExpiredHandler } from '../services/sessionExpiry';
import { AuthContext, type AuthUser } from './authContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<AuthUser | null>(null);

  // Any 401 after sign-in means the session is gone: clear it once; PrivateRoute then redirects to /login.
  useEffect(
    () =>
      setSessionExpiredHandler(() => {
        if (!userRef.current) return;
        userRef.current = null;
        setUser(null);
        toast.error(i18n.t('auth.sessionExpired'), { id: 'session-expired' });
      }),
    [],
  );

  useEffect(() => {
    // الجلسة بتعتمد على كوكي httpOnly — بنسأل السيرفر مين المستخدم
    apiGet<{ user?: AuthUser; data?: { user?: AuthUser } }>('/auth/me')
      .then((res) => {
        userRef.current = res.data?.user || res.user || null;
        setUser(userRef.current);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

