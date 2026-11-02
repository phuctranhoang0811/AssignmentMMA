import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { LayoutDashboard, ClipboardList, Calendar, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import { isManagerRole } from '../../utils/staff';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

const MANAGER_TABS = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    route: '/manager/dashboard',
    match: (path: string) => path.includes('/manager/dashboard') || path === '/manager',
    Icon: LayoutDashboard,
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    route: '/manager/orders',
    match: (path: string) => path.includes('/manager/orders'),
    Icon: ClipboardList,
  },
  {
    key: 'schedule',
    label: 'Lịch làm việc',
    route: '/manager/schedule',
    match: (path: string) => path.includes('/manager/schedule'),
    Icon: Calendar,
  },
  {
    key: 'staff',
    label: 'Nhân viên',
    route: '/manager/staff',
    match: (path: string) => path.includes('/manager/staff'),
    Icon: Users,
  },
] as const;

export default function ManagerLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isManager = isManagerRole(user?.role);
  const isTopAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/(tabs)/home');
      } else if (isTopAdmin) {
        router.replace('/admin/dashboard');
      } else if (!isManager) {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, isManager, isTopAdmin, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.pushState(null, '', window.location.href);
      const onPopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', onPopState);
      return () => {
        sub.remove();
        window.removeEventListener('popstate', onPopState);
      };
    }

    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isManager) {
    return null;
  }

  const isAndroid = Platform.OS === 'android';
  const tabBottomPadding = Math.max(insets.bottom, isAndroid ? 12 : 8);
  const tabHeight = 60 + tabBottomPadding;

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="orders" options={{ headerShown: false }} />
          <Stack.Screen name="schedule" options={{ headerShown: false }} />
          <Stack.Screen name="staff" options={{ headerShown: false }} />
        </Stack>
      </View>

      <View
        style={[
          styles.tabBar,
          {
            height: tabHeight,
            paddingBottom: tabBottomPadding,
          },
        ]}
      >
        {MANAGER_TABS.map((tab) => {
          const active = tab.match(pathname);
          const tint = active ? colors.primary : '#6B7280';
          const IconComp = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              activeOpacity={0.75}
              onPress={() => {
                if (!pathname.endsWith(tab.route)) {
                  router.replace(tab.route as any);
                }
              }}
            >
              <IconComp size={22} color={tint} strokeWidth={active ? 2.2 : 1.8} />
              <Text style={[styles.tabLabel, { color: tint }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#ECECEC',
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});
