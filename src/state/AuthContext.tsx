import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoUser } from '../types/user';
import { authService } from '../services';
import { demoUser } from '../data/mockUsers';

interface AuthContextType {
  user: DemoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginDemo: (email?: string) => Promise<void>;
  registerDemo: (name: string, email: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, phone: string) => Promise<void>;
}

const AUTH_STORAGE_KEY = '@pizza_time_auth_v1';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          // Pre-populate with default demo user for frictionless testing if preferred
          setUser(demoUser);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const loginDemo = async (email: string = 'demo@pizzatime.local') => {
    setIsLoading(true);
    try {
      const u = await authService.login(email);
      setUser(u);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
  };

  const registerDemo = async (name: string, email: string, phone: string) => {
    setIsLoading(true);
    try {
      const u = await authService.register(name, email, phone);
      setUser(u);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const updateProfile = async (name: string, phone: string) => {
    if (!user) return;
    const updated = { ...user, fullname: name, phone };
    setUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginDemo,
        registerDemo,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
