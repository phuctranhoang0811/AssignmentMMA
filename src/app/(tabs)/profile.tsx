import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import {
  LogIn,
  UserPlus,
  MapPin,
  User as UserIcon,
  FileText,
  Lock,
  LogOut,
  X,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { styles } from '../../styles/profile.styles';

// Custom Pizza Reward Slice Badge Icon (exact match to user mockup)
const PizzaRewardIcon = ({ size = 22, color = '#1E2024' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 21L3 6a18 18 0 0 1 18 0L12 21z" />
    <Path d="M4.5 7.5a16 16 0 0 1 15 0" />
    <Circle cx="12" cy="11.5" r="1" fill={color} />
    <Circle cx="9.5" cy="14.5" r="0.75" fill={color} />
    <Circle cx="14.5" cy="14.5" r="0.75" fill={color} />
  </Svg>
);

// Custom Membership Badge Icon on Red Card
const CardBadgeIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 28 28" fill="none">
    {/* Fanned cards design */}
    <Path d="M6 21L12 5l5 2-6 16z" fill="rgba(255,255,255,0.3)" />
    <Path d="M12 5l6 1l4 15-7-2z" fill="rgba(255,255,255,0.5)" />
    <Path d="M9 19l4-12 5 2-4 12z" stroke="#FFFFFF" strokeWidth={1.6} fill="#CF4226" />
    <Circle cx="13" cy="11" r="1.2" fill="#FFFFFF" />
    <Circle cx="15.5" cy="14" r="1" fill="#FFFFFF" />
    <Circle cx="11.5" cy="14" r="1" fill="#FFFFFF" />
  </Svg>
);

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();
  const [showQRModal, setShowQRModal] = useState(false);

  const handleLogoutConfirm = async () => {
    if (Platform.OS === 'web') {
      await logout();
    } else {
      Alert.alert(
        'Đăng xuất',
        'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đăng xuất',
            style: 'destructive',
            onPress: async () => {
              await logout();
            },
          },
        ]
      );
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Xóa tài khoản',
      'Bạn có chắc chắn muốn xóa tài khoản? Mọi thông tin và điểm thưởng sẽ không thể khôi phục.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            await logout();
            Alert.alert('Thông báo', 'Đã tiếp nhận yêu cầu xóa tài khoản thành công.');
          },
        },
      ]
    );
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tài khoản</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isAuthenticated ? (
          /* ======================================================== */
          /* KHI ĐÃ ĐĂNG NHẬP (Authenticated View)                    */
          /* ======================================================== */
          <View>
            {/* Membership Card (Màu đỏ chủ đạo Pizza FPT) */}
            <View style={styles.memberCard}>
              <View style={styles.memberCardTop}>
                <View style={styles.memberBadgeWrap}>
                  <CardBadgeIcon />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberTier}>
                    {user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
                      ? 'Quản trị viên (Admin)'
                      : user?.role === 'EMPLOYEE'
                      ? 'Nhân viên (Staff)'
                      : 'Thành viên Thường'}
                  </Text>
                  <Text style={styles.memberExpiry}>Ngày hết hạn 30/11/2027</Text>
                </View>
              </View>

              <View style={styles.memberCardBottom}>
                <View style={styles.statCol}>
                  <Text style={styles.statNumber}>{user?.rewardPoints ?? 0}</Text>
                  <Text style={styles.statUnit}> điểm</Text>
                </View>
                <View style={[styles.statCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.statNumber}>
                    {user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ? '15%' : '0%'}
                  </Text>
                  <Text style={styles.statUnit}> giảm giá</Text>
                </View>
              </View>
            </View>

            {/* Button: Hiển thị mã QR */}
            <TouchableOpacity
              style={styles.qrOutlineBtn}
              activeOpacity={0.8}
              onPress={() => setShowQRModal(true)}
            >
              <Text style={styles.qrOutlineBtnText}>Hiển thị mã QR</Text>
            </TouchableOpacity>

            {/* Menu Group 1 */}
            <View style={styles.cardGroup}>
              {/* Quản lý đơn bếp (dành riêng cho Admin / Employee) */}
              {(user?.role === 'EMPLOYEE' ||
                user?.role === 'SUPER_ADMIN' ||
                user?.role === 'ADMIN') && (
                <>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => router.push('/staff/orders')}
                  >
                    <View style={styles.menuIconCol}>
                      <Sparkles size={22} color="#CF4226" strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.menuLabel, { color: '#CF4226', fontWeight: '700' }]}>
                      Quản lý đơn hàng (Khu Vực Nhân Viên)
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </>
              )}

              {/* Hồ sơ của tôi */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/profile/edit')}
              >
                <View style={styles.menuIconCol}>
                  <UserIcon size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Hồ sơ của tôi</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Theo dõi đơn hàng */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/order/tracking')}
              >
                <View style={styles.menuIconCol}>
                  <MapPin size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Theo dõi đơn hàng</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* FPT reward / Hut reward */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/rewards')}
              >
                <View style={styles.menuIconCol}>
                  <PizzaRewardIcon size={22} color="#1E2024" />
                </View>
                <Text style={styles.menuLabel}>FPT reward</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Lịch sử đơn hàng */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/orders')}
              >
                <View style={styles.menuIconCol}>
                  <FileText size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Lịch sử đơn hàng</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Đổi mật khẩu */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/profile/change-password')}
              >
                <View style={styles.menuIconCol}>
                  <Lock size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Đổi mật khẩu</Text>
              </TouchableOpacity>
            </View>

            {/* Menu Group 2: Đăng xuất */}
            <View style={styles.cardGroup}>
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={handleLogoutConfirm}
              >
                <View style={styles.menuIconCol}>
                  <LogOut size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>

            {/* Xóa tài khoản */}
            <TouchableOpacity
              style={styles.deleteAccountBtn}
              activeOpacity={0.6}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.deleteAccountText}>Xóa tài khoản</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ======================================================== */
          /* KHI CHƯA ĐĂNG NHẬP (Guest / Unauthenticated View)        */
          /* ======================================================== */
          <View>
            {/* Card 1: Đăng nhập & Đăng ký */}
            <View style={styles.cardGroup}>
              {/* Đăng nhập */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/auth/login')}
              >
                <View style={styles.menuIconCol}>
                  <LogIn size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Đăng nhập</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Đăng ký */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/auth/register')}
              >
                <View style={styles.menuIconCol}>
                  <UserPlus size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Đăng ký</Text>
              </TouchableOpacity>
            </View>

            {/* Card 2: Tiện ích chung */}
            <View style={styles.cardGroup}>
              {/* Theo dõi đơn hàng */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push('/order/lookup')}
              >
                <View style={styles.menuIconCol}>
                  <MapPin size={22} color="#1E2024" strokeWidth={1.8} />
                </View>
                <Text style={styles.menuLabel}>Theo dõi đơn hàng</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* FPT reward / Hut reward */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/auth/login',
                    params: { returnTo: 'profile' },
                  })
                }
              >
                <View style={styles.menuIconCol}>
                  <PizzaRewardIcon size={22} color="#1E2024" />
                </View>
                <Text style={styles.menuLabel}>FPT reward</Text>
              </TouchableOpacity>
            </View>

            {/* Footer Copyright */}
            <View style={styles.footer}>
              <Text style={styles.copyrightText}>
                Copyright © Pizza FPT Co., Ltd
              </Text>
              <Text style={styles.versionText}>Phiên bản: v3.1.10</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowQRModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowQRModal(false)}
            >
              <X size={20} color="#666666" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Mã Thành Viên</Text>
            <Text style={styles.modalSubtitle}>
              {user?.fullname || 'Khách hàng thân thiết'}
            </Text>

            {/* QR Code Canvas Mockup */}
            <View style={styles.qrContainer}>
              <Svg width={180} height={180} viewBox="0 0 180 180">
                <Rect x="0" y="0" width="180" height="180" fill="#FFFFFF" />
                {/* Outer corners */}
                <Rect x="15" y="15" width="45" height="45" fill="#CF4226" />
                <Rect x="23" y="23" width="29" height="29" fill="#FFFFFF" />
                <Rect x="29" y="29" width="17" height="17" fill="#CF4226" />

                <Rect x="120" y="15" width="45" height="45" fill="#CF4226" />
                <Rect x="128" y="23" width="29" height="29" fill="#FFFFFF" />
                <Rect x="134" y="29" width="17" height="17" fill="#CF4226" />

                <Rect x="15" y="120" width="45" height="45" fill="#CF4226" />
                <Rect x="23" y="128" width="29" height="29" fill="#FFFFFF" />
                <Rect x="29" y="134" width="17" height="17" fill="#CF4226" />

                {/* Pattern dots */}
                <Rect x="75" y="20" width="10" height="10" fill="#1E2024" />
                <Rect x="95" y="35" width="12" height="12" fill="#1E2024" />
                <Rect x="75" y="55" width="14" height="14" fill="#1E2024" />
                <Rect x="30" y="75" width="12" height="12" fill="#1E2024" />
                <Rect x="55" y="85" width="16" height="16" fill="#CF4226" />
                <Rect x="85" y="85" width="18" height="18" fill="#1E2024" />
                <Rect x="120" y="75" width="14" height="14" fill="#1E2024" />
                <Rect x="145" y="90" width="12" height="12" fill="#CF4226" />
                <Rect x="75" y="120" width="14" height="14" fill="#1E2024" />
                <Rect x="100" y="130" width="16" height="16" fill="#1E2024" />
                <Rect x="130" y="140" width="14" height="14" fill="#1E2024" />
              </Svg>
            </View>

            <Text style={styles.memberIdText}>
              {user?.phone ? 'FPT-' + user.phone.slice(-6) : 'FPT-889923'}
            </Text>

            <Text style={styles.modalInstruction}>
              Đưa mã này cho nhân viên thu ngân tại quầy Pizza FPT để tích điểm và áp dụng khuyến mãi
            </Text>

            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.modalActionBtnText}>Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

