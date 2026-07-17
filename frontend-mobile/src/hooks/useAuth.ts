import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export type UserRole = 'admin' | 'employee';
export type UserStatus = 'pending' | 'active' | 'inactive';

export interface User {
  id: string;
  role: UserRole;
  status: UserStatus;
  name: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded: any = jwtDecode(token);
          setUser({
            id: decoded.sub,
            role: decoded.role || 'employee',
            status: decoded.status || 'active',
            name: decoded.name || 'משתמש'
          });
        } catch (e) {
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  return { user, isLoading };
}
