import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../state/AuthContext';
import { isAdminRole } from '../utils/staff';

export function useAdminGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isAdmin = isAdminRole(user?.role);

  useEffect(() => {
    if (!isLoading) {
      if (!user || !isAdmin) {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, isAdmin, router]);

  return {
    isAdmin,
    isLoading,
    user,
  };
}

