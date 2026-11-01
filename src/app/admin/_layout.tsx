import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, LogOut } from 'lucide-react-native';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';

// Dải nhận diện khu vực Quản trị — hiện trên MỌI màn hình admin để nhìn phát biết ngay
// đây là trang quản lý (nền tối, viền vàng), không phải trang đặt hàng của khách.
function AdminModeBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const roleLabel =
    user?.role === 'STORE_MANAGER' ? 'Cửa hàng trưởng' : user?.role === 'ADMIN' ? 'Quản trị viên' : 'Super Admin';

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <View style={[barStyles.container, { paddingTop: insets.top + 8 }]}>
      <ShieldCheck size={16} color="#FBBF24" />
      <View style={barStyles.textCol}>
        <View style={barStyles.chip}>
          <Text style={barStyles.chipText}>KHU VỰC QUẢN TRỊ</Text>
        </View>
        <Text style={barStyles.hintText} numberOfLines={1}>
          {roleLabel} · Không phải trang đặt hàng
        </Text>
      </View>
      <TouchableOpacity style={barStyles.logoutBtn} activeOpacity={0.75} onPress={handleLogout}>
        <LogOut size={13} color="#FBBF24" />
        <Text style={barStyles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1220',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#FBBF24',
  },
  textCol: { flex: 1 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  logoutText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default function AdminLayout() {
  const { isAdmin, isLoading } = useAdminGuard();

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

  return (
    <View style={styles.shell}>
      <AdminModeBar />
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
