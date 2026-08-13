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

import axiosClient from '../api/axiosClient';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      let token = localStorage.getItem('token');
      
      if (token) {
        try {
          let decoded: any = jwtDecode(token);
          
          // If token is expired, try to refresh it silently before giving up
          if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            try {
              const res = await axiosClient.post('/auth/refresh');
              token = res.data.access_token;
              if (token) {
                  localStorage.setItem('token', token);
                  decoded = jwtDecode(token);
              }
            } catch (err) {
              localStorage.removeItem('token');
              token = null;
            }
          }
          
          if (token) {
            setUser({
              id: decoded.sub,
              role: decoded.role || 'employee',
              status: decoded.status || 'active',
              name: decoded.name || 'משתמש'
            });
          } else {
            setUser(null);
          }
        } catch (e) {
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  return { user, isLoading };
}
