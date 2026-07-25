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
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    apiGet('/auth/me')
      .then((res: any) => {
        const userData = res.user || res.data?.user;
        setUser(userData);
      })
      .catch((err: any) => {
        // ✅ امسح التوكن فقط إذا كان السيرفر رفضه فعلاً (401)
        if (err?.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('authToken');
          setUser(null);
        } else {
          // Network/server issue — keeping token
          // لو null، التوكن لسه موجود والـ PrivateRoute رح يسمح بالمرور
        }
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