import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../state/AuthContext';

export function useAdminGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'STORE_MANAGER';

  useEffect(() => {
    if (!isLoading) {
      if (!user || !isAdmin) {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, isAdmin]);

  return {
    isAdmin,
    isLoading,
    user,
  };
}

