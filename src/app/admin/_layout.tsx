import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, BackHandler } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { LayoutDashboard, UtensilsCrossed, Ticket, Store, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

const ADMIN_TABS = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    route: '/admin/dashboard',
    match: (path: string) => path.includes('/admin/dashboard') || path.includes('/admin/reports') || path === '/admin',
    Icon: LayoutDashboard,
  },
  {
    key: 'products',
    label: 'Thực đơn',
    route: '/admin/products',
    match: (path: string) =>
      path.includes('/admin/products') ||
      path.includes('/admin/menu-groups') ||
      path.includes('/admin/recommendations'),
    Icon: UtensilsCrossed,
  },
  {
    key: 'promotions',
    label: 'Ưu đãi',
    route: '/admin/promotions',
    match: (path: string) => path.includes('/admin/promotions'),
    Icon: Ticket,
  },
  {
    key: 'store',
    label: 'Cửa hàng',
    route: '/admin/store',
    match: (path: string) => path.includes('/admin/store'),
    Icon: Store,
  },
  {
    key: 'users',
    label: 'Tài khoản',
    route: '/admin/users',
    match: (path: string) => path.includes('/admin/users'),
    Icon: Users,
  },
] as const;

export default function AdminLayout() {
  const { isAdmin, isLoading } = useAdminGuard();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Chặn nút Back vật lý / vuốt cạnh trái để không bị văng khỏi trang Admin khi chưa bấm Đăng xuất
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

  if (!isAdmin) {
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
          <Stack.Screen name="dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="products/index" options={{ headerShown: false }} />
          <Stack.Screen name="products/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="menu-groups" options={{ headerShown: false }} />
          <Stack.Screen name="promotions" options={{ headerShown: false }} />
          <Stack.Screen name="users" options={{ headerShown: false }} />
          <Stack.Screen name="orders" options={{ headerShown: false }} />
          <Stack.Screen name="reports" options={{ headerShown: false }} />
          <Stack.Screen name="recommendations" options={{ headerShown: false }} />
          <Stack.Screen name="store" options={{ headerShown: false }} />
          <Stack.Screen name="issues" options={{ headerShown: false }} />
          <Stack.Screen name="audit" options={{ headerShown: false }} />
          <Stack.Screen name="riders" options={{ headerShown: false }} />
        </Stack>
      </View>

      {/* Minimalist 4-Tab Bar for Admin (matching User Tab Bar style) */}
      <View
        style={[
          styles.tabBar,
          {
            height: tabHeight,
            paddingBottom: tabBottomPadding,
          },
        ]}
      >
        {ADMIN_TABS.map((tab) => {
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
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
