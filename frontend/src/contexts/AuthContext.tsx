// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // لو مافي token — خلص loading على طول
    if (!token) {
      setLoading(false);
      return;
    }

    apiGet('/auth/me')
      .then(res => {
        const userData = res.data?.user || res.data;
        setUser(userData);
      })
      .catch(() => {
        // لو فشل — شيل الـ token وخلص
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