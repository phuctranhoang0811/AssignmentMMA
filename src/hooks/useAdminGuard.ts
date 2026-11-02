import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../state/AuthContext';
import { isManagerRole } from '../utils/staff';

export function useAdminGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isTopAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const isManager = isManagerRole(user?.role);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/(tabs)/home');
      } else if (isManager) {
        router.replace('/manager/dashboard');
      } else if (!isTopAdmin) {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, isTopAdmin, isManager, router]);

  return {
    isAdmin: isTopAdmin,
    isManager,
    isLoading,
    user,
  };
}
