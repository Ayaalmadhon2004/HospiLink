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

// ✅ Default value مش null — object صحيح
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    // ✅ لو مافي token — خلص loading فوراً
    if (!token) {
      setLoading(false);
      return;
    }

    apiGet('/auth/me')
      .then((res: any) => {
        const userData = res.user || res.data?.user;
        setUser(userData);
      })
      .catch((err) => {
        console.error('Auth error:', err);
        localStorage.removeItem('token');
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

export const useAuth = () => useContext(AuthContext);