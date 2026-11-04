import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
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
  ShieldCheck,
} from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { styles } from '../../styles/profile.styles';
import { isRiderRole, isStaffRole } from '../../utils/staff';
import {
  fetchUserMemberStats,
  getMemberTierFromSpent,
  calculateMaturityDate,
  type MemberTierInfo,
} from '../../utils/memberTier';
import type { RedeemedGift } from '../../data/rewards';

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

// Crisp Vector Pizza Badge Icon on #CF4226 Member Card (1 slice = Cơ Bản, 2 = Vàng, 3 = VIP)
const MemberCardPizzaIcon = ({
  tier = 'vip',
  height = 32,
}: {
  tier?: 'basic' | 'gold' | 'vip';
  height?: number;
}) => {
  if (tier === 'basic') {
    return (
      <Svg width={28} height={height} viewBox="0 0 36 44" fill="none">
        <G transform="rotate(14 18 22)">
          <Path d="M4 5C11 2 25 2 32 5L30 9.5C24 7 12 7 6 9.5L4 5Z" fill="#FFFFFF" />
          <Path d="M6.2 11.2C12.2 8.8 23.8 8.8 29.8 11.2L18 41L6.2 11.2Z" fill="#FFFFFF" />
          <Path
            d="M18 14L19.3 18H23.5L20.1 20.4L21.4 24.4L18 22L14.6 24.4L15.9 20.4L12.5 18H16.7L18 14Z"
            fill="#CF4226"
          />
          <Path
            d="M18 26.5L18.8 29H21.4L19.3 30.5L20.1 33L18 31.5L15.9 33L16.7 30.5L14.6 29H17.2L18 26.5Z"
            fill="#CF4226"
          />
        </G>
      </Svg>
    );
  }

  if (tier === 'gold') {
    return (
      <Svg width={42} height={height} viewBox="0 0 56 44" fill="none">
        <G transform="translate(2, 4) rotate(-24 18 32)">
          <Path d="M5 6C11 3.5 23 3.5 29 6L27.5 10C22 8 12 8 6.5 10L5 6Z" fill="#FFFFFF" />
          <Path d="M7 11.5C12 9.5 22 9.5 27 11.5L17 38L7 11.5Z" fill="#FFFFFF" />
          <Path
            d="M17 14.5L18.2 18.2H22L18.9 20.4L20.1 24.1L17 21.9L13.9 24.1L15.1 20.4L12 18.2H15.8L17 14.5Z"
            fill="#CF4226"
          />
          <Path
            d="M17 25.5L17.7 27.6H19.9L18.1 28.9L18.8 31L17 29.7L15.2 31L15.9 28.9L14.1 27.6H16.3L17 25.5Z"
            fill="#CF4226"
          />
        </G>
        <G transform="translate(18, 1) rotate(14 18 34)">
          <Path d="M4 5C11 2.2 25 2.2 32 5L30.2 9.5C24 7.2 12 7.2 5.8 9.5L4 5Z" fill="#FFFFFF" />
          <Path d="M6.2 11.2C12.2 9 23.8 9 29.8 11.2L18 40L6.2 11.2Z" fill="#FFFFFF" />
          <Path
            d="M18 14.5L19.3 18.5H23.5L20.1 21L21.4 25L18 22.5L14.6 25L15.9 21L12.5 18.5H16.7L18 14.5Z"
            fill="#CF4226"
          />
          <Path
            d="M18 26.5L18.8 28.9H21.3L19.3 30.4L20.1 32.8L18 31.3L15.9 32.8L16.7 30.4L14.7 28.9H17.2L18 26.5Z"
            fill="#CF4226"
          />
        </G>
      </Svg>
    );
  }

  // VIP: 3 Pizza Slices
  return (
    <Svg width={48} height={height} viewBox="0 0 64 44" fill="none">
      <G transform="translate(0, 6) rotate(-38 16 28)">
        <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill="#FFFFFF" />
        <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill="#FFFFFF" />
        <Path
          d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
          fill="#CF4226"
        />
      </G>
      <G transform="translate(17, 1)">
        <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill="#FFFFFF" />
        <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill="#FFFFFF" />
        <Path
          d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
          fill="#CF4226"
        />
      </G>
      <G transform="translate(32, 6) rotate(38 16 28)">
        <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill="#FFFFFF" />
        <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill="#FFFFFF" />
        <Path
          d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
          fill="#CF4226"
        />
      </G>
    </Svg>
  );
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();
  const [showQRModal, setShowQRModal] = useState(false);
  const [tierInfo, setTierInfo] = useState<MemberTierInfo>(() =>
    getMemberTierFromSpent(
      (user?.rewardPoints ?? 0) * 10000,
      user?.rewardPoints ?? 0,
      calculateMaturityDate()
    )
  );
  const [syncedPoints, setSyncedPoints] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const uid = user?.id;
      if (!uid || user?.isDemo) {
        setSyncedPoints(null);
        return;
      }

      Promise.all([
        fetchUserMemberStats(uid),
        getDoc(doc(db, 'users', uid)).catch(() => null),
      ])
        .then(([stats, userSnap]) => {
          if (!active) return;
          const data = userSnap?.exists() ? userSnap.data() : undefined;
          const redeemedGifts: RedeemedGift[] = Array.isArray(data?.redeemedGifts)
            ? data.redeemedGifts
            : [];
          const spentPoints = redeemedGifts.reduce(
            (sum, g) => sum + (Number(g.points) || 0),
            0
          );
          const netOrderPoints = Math.max(0, stats.earnedPointsFromOrders - spentPoints);
          const pts =
            typeof data?.rewardPoints === 'number'
              ? spentPoints > 0
                ? data.rewardPoints
                : Math.max(data.rewardPoints, netOrderPoints)
              : netOrderPoints;
          setSyncedPoints(pts);
          setTierInfo(stats);
        })
        .catch(() => {});

      return () => {
        active = false;
      };
    }, [user?.id, user?.isDemo, user?.rewardPoints])
  );

  const displayPoints =
    syncedPoints ?? Math.max(user?.rewardPoints ?? 0, tierInfo.earnedPointsFromOrders);

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
            {/* Membership Card (Đồng bộ 100% với trang FPT Rewards) */}
            <View style={styles.memberCard}>
              <View style={styles.memberCardTop}>
                <View style={styles.memberBadgeWrap}>
                  <MemberCardPizzaIcon tier={tierInfo.id} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberTier}>
                    {user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
                      ? 'Quản trị viên (Admin)'
                      : user?.role === 'STORE_MANAGER'
                      ? 'Quản lý Chi nhánh (Manager)'
                      : user?.role === 'EMPLOYEE'
                      ? 'Nhân viên (Staff)'
                      : tierInfo.cardTitle}
                  </Text>
                  <Text style={styles.memberExpiry}>
                    Ngày hết hạn {tierInfo.maturityDate}
                  </Text>
                </View>
              </View>

              <View style={styles.memberCardBottom}>
                <View style={styles.statCol}>
                  <Text style={styles.statNumber}>{displayPoints}</Text>
                  <Text style={styles.statUnit}> điểm</Text>
                </View>
                <View style={[styles.statCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.statNumber}>
                    {user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
                      ? '15%'
                      : `${tierInfo.discountPercent}%`}
                  </Text>
                  <Text style={styles.statUnit}> giảm giá</Text>
                </View>
              </View>
            </View>

            {/* Menu Group 1 */}
            <View style={styles.cardGroup}>
              {/* Bảng điều khiển Quản trị viên (Admin Portal) */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                <>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => router.replace('/admin/dashboard')}
                  >
                    <View style={styles.menuIconCol}>
                      <ShieldCheck size={22} color="#CF4226" strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.menuLabel, { color: '#CF4226', fontWeight: '700' }]}>
                      Bảng Quản trị Hệ thống (Admin)
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </>
              )}

              {/* Bảng điều khiển Quản lý Chi nhánh (Manager Portal) */}
              {user?.role === 'STORE_MANAGER' && (
                <>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => router.replace('/manager/dashboard')}
                  >
                    <View style={styles.menuIconCol}>
                      <ShieldCheck size={22} color="#CF4226" strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.menuLabel, { color: '#CF4226', fontWeight: '700' }]}>
                      Bảng Quản lý Chi nhánh (Manager)
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </>
              )}

              {/* Quản lý đơn bếp (dành riêng cho Admin / Employee) */}
              {isStaffRole(user?.role) && (
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
                      Quản lý đơn hàng (Nhân viên)
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </>
              )}

              {/* Email chưa xác minh: chưa đặt hàng hoặc đổi quà được */}
              {!!user && !user.isDemo && user.emailVerified === false && (
                <>
                  <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/auth/verify-email')}>
                    <View style={styles.menuIconCol}>
                      <Sparkles size={22} color="#CF4226" strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.menuLabel, { color: '#CF4226', fontWeight: '700' }]}>
                      Xác minh email để đặt hàng
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </>
              )}

              {/* Tài xế giao hàng (bên thứ ba, không thuộc nhân viên cửa hàng) */}
              {isRiderRole(user?.role) && (
                <>
                  <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/rider')}>
                    <View style={styles.menuIconCol}>
                      <Sparkles size={22} color="#CF4226" strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.menuLabel, { color: '#CF4226', fontWeight: '700' }]}>
                      Nhận đơn giao (Tài xế)
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
                onPress={() => router.push(isAuthenticated ? '/order/tracking' : '/order/lookup')}
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

              {user?.hasPassword !== false && !user?.isDemo && <>
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
              </>}
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
                onPress={() => router.push(isAuthenticated ? '/order/tracking' : '/order/lookup')}
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
