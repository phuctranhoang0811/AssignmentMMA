import React from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { isRiderRole } from '../../utils/staff';

export default function RiderLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={layoutStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={layoutStyles.loadingText}>Đang kiểm tra quyền tài xế...</Text>
      </View>
    );
  }

  const isRider = isRiderRole(user?.role);

  // Nếu chưa đăng nhập hoặc không phải nhân viên, hiển thị màn hình bảo vệ quyền truy cập (Route Guard)
  if (!isRider) {
    return (
      <View style={layoutStyles.guardContainer}>
        <View style={layoutStyles.iconBox}>
          <ShieldAlert size={48} color={colors.error} />
        </View>
        <Text style={layoutStyles.guardTitle}>Khu Vực Dành Cho Tài Xế</Text>
        <Text style={layoutStyles.guardDesc}>
          Màn hình này chỉ dành cho tài xế giao hàng đã được cấp quyền. Vui lòng đăng nhập bằng tài khoản tài xế để tiếp tục.
        </Text>

        <View style={layoutStyles.btnCol}>
          <TouchableOpacity
            style={layoutStyles.loginBtn}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/auth/login', params: { returnTo: 'rider' } })}
          >
            <LogIn size={18} color={colors.white} />
            <Text style={layoutStyles.loginBtnText}>Đăng nhập tài khoản Tài xế</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={layoutStyles.homeBtn}
            activeOpacity={0.8}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <ArrowLeft size={18} color={colors.textSecondary} />
            <Text style={layoutStyles.homeBtnText}>Quay về Trang chủ khách hàng</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

const layoutStyles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  guardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing['2xl'],
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  guardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  guardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  btnCol: {
    width: '100%',
    gap: 12,
  },
  loginBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: 8,
  },
  loginBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  homeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: 8,
  },
  homeBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
