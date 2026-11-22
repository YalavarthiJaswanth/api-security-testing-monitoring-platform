import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('api_sentinel_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('api_sentinel_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('api_sentinel_token');
      if (storedToken) {
        try {
          const resp = await api.get('/auth/me');
          setUser(resp.data.user);
          localStorage.setItem('api_sentinel_user', JSON.stringify(resp.data.user));
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };
    verifySession();
  }, []);

  const login = async (emailOrUsername: string, password: string) => {
    const resp = await api.post('/auth/login', { emailOrUsername, password });
    const { token: receivedToken, user: receivedUser } = resp.data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem('api_sentinel_token', receivedToken);
    localStorage.setItem('api_sentinel_user', JSON.stringify(receivedUser));
  };

  const register = async (username: string, email: string, password: string, role?: string) => {
    const resp = await api.post('/auth/register', { username, email, password, role });
    const { token: receivedToken, user: receivedUser } = resp.data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem('api_sentinel_token', receivedToken);
    localStorage.setItem('api_sentinel_user', JSON.stringify(receivedUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('api_sentinel_token');
    localStorage.removeItem('api_sentinel_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
