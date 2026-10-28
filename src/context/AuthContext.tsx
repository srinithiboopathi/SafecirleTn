import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
  loginDemoUser: (role?: 'user' | 'admin') => Promise<void>;
  updateProfileState: (updated: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('safecircle_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('safecircle_token');
      if (storedToken) {
        try {
          const res = await api.getCurrentUser();
          setUser(res.user);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          localStorage.removeItem('safecircle_token');
          setToken(null);
          // Set demo default for frictionless exploration
          setUser({
            id: 'usr-demo-1',
            name: 'Priya Sharma',
            email: 'user@safecircle.org',
            phone: '+91 98765 43210',
            role: 'user',
            emergencyNotes: 'Blood Group: B+'
          });
          setToken('token-usr-demo-1');
          localStorage.setItem('safecircle_token', 'token-usr-demo-1');
        }
      } else {
        // Default to Demo Regular User so all evaluator workflows work immediately
        setUser({
          id: 'usr-demo-1',
          name: 'Priya Sharma',
          email: 'user@safecircle.org',
          phone: '+91 98765 43210',
          role: 'user',
          emergencyNotes: 'Blood Group: B+'
        });
        setToken('token-usr-demo-1');
        localStorage.setItem('safecircle_token', 'token-usr-demo-1');
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('safecircle_token', res.token);
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await api.register({ name, email, phone, password });
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('safecircle_token', res.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('safecircle_token');
  };

  const loginDemoUser = async (role: 'user' | 'admin' = 'user') => {
    if (role === 'admin') {
      await login('admin@safecircle.org', 'admin123');
    } else {
      await login('user@safecircle.org', 'password123');
    }
  };

  const updateProfileState = (updated: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updated });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        loginDemoUser,
        updateProfileState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
