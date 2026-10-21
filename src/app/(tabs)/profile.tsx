import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  User,
  MapPin,
  Heart,
  Tag,
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  ChefHat,
  LogIn,
  UserPlus,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { useAuth } from '../../state/AuthContext';

export default function ProfileScreen() {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogoutConfirm = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi phiên demo không?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="h1">Tài khoản</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        {isAuthenticated && user ? (
          <View style={styles.userCard}>
            <View style={styles.avatarWrapper}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={32} color={colors.primary} />
                </View>
              )}
            </View>

            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <AppText variant="h3">{user.fullname}</AppText>
                <View style={styles.demoBadge}>
                  <AppText variant="captionMedium" color={colors.primary}>
                    Tài khoản Demo
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" color={colors.textSecondary}>
                {user.email}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {user.phone}
              </AppText>
            </View>
          </View>
        ) : (
          <View style={styles.guestCard}>
            <AppText variant="h3">Chào bạn!</AppText>
            <AppText variant="body" color={colors.textSecondary} style={{ marginVertical: spacing.xs }}>
              Đăng nhập để lưu danh sách địa chỉ và theo dõi đơn hàng của bạn thuận tiện hơn.
            </AppText>
            <View style={styles.guestBtnRow}>
              <AppButton
                title="Đăng nhập"
                size="sm"
                onPress={() => router.push('/auth/login')}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <AppButton
                title="Đăng ký"
                variant="outline"
                size="sm"
                onPress={() => router.push('/auth/register')}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* Menu Items Group 1: Account Features */}
        <View style={styles.section}>
          <AppText variant="captionMedium" color={colors.textSecondary} style={styles.sectionTitle}>
            Tùy chọn tài khoản
          </AppText>

          <View style={styles.menuGroup}>
            {isAuthenticated && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/profile/edit')}
                style={styles.menuItem}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.iconCircle}>
                    <User size={18} color={colors.textPrimary} />
                  </View>
                  <AppText variant="bodyMedium">Chỉnh sửa hồ sơ</AppText>
                </View>
                <ChevronRight size={18} color={colors.textDisabled} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/profile/addresses')}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconCircle}>
                  <MapPin size={18} color={colors.textPrimary} />
                </View>
                <AppText variant="bodyMedium">Sổ địa chỉ nhận hàng</AppText>
              </View>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/favorites')}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconCircle}>
                  <Heart size={18} color={colors.primary} />
                </View>
                <AppText variant="bodyMedium">Món ăn yêu thích</AppText>
              </View>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/offers')}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconCircle}>
                  <Tag size={18} color={colors.warning} />
                </View>
                <AppText variant="bodyMedium">Mã ưu đãi & Voucher</AppText>
              </View>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Items Group 2: Demo & System */}
        <View style={styles.section}>
          <AppText variant="captionMedium" color={colors.textSecondary} style={styles.sectionTitle}>
            Quản trị & Cài đặt hệ thống
          </AppText>

          <View style={styles.menuGroup}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/demo/staff-orders')}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                  <ChefHat size={18} color={colors.primary} />
                </View>
                <View>
                  <AppText variant="bodyMedium" color={colors.primary}>
                    Bếp & Giao hàng (Staff Demo)
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    Xác nhận và chuyển trạng thái đơn hàng
                  </AppText>
                </View>
              </View>
              <ChevronRight size={18} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/profile/settings')}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconCircle}>
                  <Settings size={18} color={colors.textPrimary} />
                </View>
                <AppText variant="bodyMedium">Cài đặt & Developer Demo</AppText>
              </View>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        {isAuthenticated && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLogoutConfirm}
            style={styles.logoutBtn}
          >
            <LogOut size={18} color={colors.error} />
            <AppText variant="bodyMedium" color={colors.error} style={{ marginLeft: spacing.sm }}>
              Đăng xuất
            </AppText>
          </TouchableOpacity>
        )}

        <AppText variant="caption" color={colors.textDisabled} align="center" style={styles.versionText}>
          Pizza Time Mobile v1.0.0 (Front-first Demo)
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  avatarWrapper: {
    marginRight: spacing.base,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  demoBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.xs,
    marginLeft: spacing.xs,
  },
  guestCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  guestBtnRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorSoft,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  versionText: {
    marginBottom: spacing.xl,
  },
});
