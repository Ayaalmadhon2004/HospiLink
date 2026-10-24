// frontend/src/contexts/AuthContext.tsx
import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';
import { AuthContext, type AuthUser } from './authContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // الجلسة بتعتمد على كوكي httpOnly — بنسأل السيرفر مين المستخدم
    apiGet<{ user?: AuthUser; data?: { user?: AuthUser } }>('/auth/me')
      .then((res) => {
        setUser(res.data?.user || res.user || null);
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

