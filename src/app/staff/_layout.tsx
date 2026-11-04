import React, { useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Truck, Calendar, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';
import { isManagerRole, isStaffRole } from '../../utils/staff';

const STAFF_TABS = [
  {
    key: 'orders',
    label: 'Đơn giao',
    route: '/staff/orders',
    match: (path: string) => path.includes('/staff/orders') || path === '/staff',
    Icon: Truck,
  },
  {
    key: 'schedule',
    label: 'Lịch làm việc',
    route: '/staff/schedule',
    match: (path: string) => path.includes('/staff/schedule'),
    Icon: Calendar,
  },
  {
    key: 'profile',
    label: 'Tôi',
    route: '/staff/profile',
    match: (path: string) => path.includes('/staff/profile'),
    Icon: UserRound,
  },
] as const;

export default function StaffLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

  const isStaff = isStaffRole(user?.role);
  const isManager = isManagerRole(user?.role);
  const isTopAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/(tabs)/home');
      } else if (isTopAdmin) {
        router.replace('/admin/dashboard');
      } else if (isManager) {
        router.replace('/manager/dashboard');
      } else if (!isStaff) {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, isStaff, isManager, isTopAdmin, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.pushState(null, '', window.location.href);
      const onPopState = (e: PopStateEvent) => {
        e.stopImmediatePropagation?.();
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', onPopState, true);
      return () => {
        sub.remove();
        window.removeEventListener('popstate', onPopState, true);
      };
    }

    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={layoutStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={layoutStyles.loadingText}>Đang kiểm tra quyền nhân viên...</Text>
      </View>
    );
  }

  if (!isStaff) {
    return null;
  }

  const isAndroid = Platform.OS === 'android';
  const tabBottomPadding = Math.max(insets.bottom, isAndroid ? 12 : 8);
  const tabHeight = 60 + tabBottomPadding;

  return (
    <View style={layoutStyles.root}>
      <View style={layoutStyles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="orders" options={{ headerShown: false }} />
          <Stack.Screen name="schedule" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
        </Stack>
      </View>

      <View
        style={[
          layoutStyles.tabBar,
          {
            height: tabHeight,
            paddingBottom: tabBottomPadding,
          },
        ]}
      >
        {STAFF_TABS.map((tab) => {
          const active = tab.match(pathname);
          const tint = active ? colors.primary : '#6B7280';
          const IconComp = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={layoutStyles.tabItem}
              activeOpacity={0.75}
              onPress={() => {
                if (!pathname.endsWith(tab.route)) {
                  router.replace(tab.route as any);
                }
              }}
            >
              <IconComp size={22} color={tint} strokeWidth={active ? 2.2 : 1.8} />
              <Text style={[layoutStyles.tabLabel, { color: tint }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: colors.textSecondary,
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
