// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // الجلسة بتعتمد على كوكي httpOnly — بنسأل السيرفر مين المستخدم
    apiGet<{ user?: User; data?: { user?: User } }>('/auth/me')
      .then((res) => {
        setUser(res.user || res.data?.user || null);
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

// eslint-disable-next-line react-refresh/only-export-components -- hook must stay next to its provider; moving it would change every importer
export const useAuth = () => useContext(AuthContext);