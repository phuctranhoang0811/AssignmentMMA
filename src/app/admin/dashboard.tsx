import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  PackageCheck,
  LogOut,
  BarChart2,
} from 'lucide-react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminDashboard.styles';
import { formatCurrency } from '../../utils/formatCurrency';

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingOrdersCount: 0,
    activeProductsCount: 0,
    completedOrdersCount: 0,
  });
  const [dailyRevenue, setDailyRevenue] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number; revenue: number }[]>([]);

  useEffect(() => {
    let unsubscribeOrders = () => {};
    try {
      const qOrders = query(collection(db, 'orders'));
      unsubscribeOrders = onSnapshot(
        qOrders,
        (snapshot: any) => {
          let revenue = 0;
          let pendingCount = 0;
          let completedCount = 0;
          const daily = [0, 0, 0, 0, 0, 0, 0];
          const prodMap: Record<string, { name: string; count: number; revenue: number }> = {};

          snapshot.forEach((docSnap: any) => {
            const data = docSnap.data();
            const total = Number(data.totalAmount || data.total || 0);
            const status = data.status;

            if (status === 'COMPLETED' || status === 'DELIVERED') {
              revenue += total;
              completedCount++;

              const d = data.createdAt?.toDate?.()
                ? data.createdAt.toDate()
                : new Date(data.createdAt || Date.now());
              const dayIdx = (d.getDay() + 6) % 7;
              if (dayIdx >= 0 && dayIdx < 7) {
                daily[dayIdx] += total;
              }

              const items = data.items || [];
              items.forEach((it: any) => {
                const name = it.productName || it.name || 'Món ăn';
                const qty = Number(it.quantity || 1);
                const lineRev = Number(it.lineTotal || (it.unitPrice || it.price || 0) * qty);
                if (!prodMap[name]) {
                  prodMap[name] = { name, count: 0, revenue: 0 };
                }
                prodMap[name].count += qty;
                prodMap[name].revenue += lineRev;
              });
            } else if (status === 'PENDING' || status === 'PENDING_CONFIRMATION') {
              pendingCount++;
            }
          });

          setStats((prev) => ({
            ...prev,
            totalRevenue: revenue,
            pendingOrdersCount: pendingCount,
            completedOrdersCount: completedCount,
          }));
          setDailyRevenue(daily);
          setTopProducts(
            Object.values(prodMap)
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
          );
        },
        (err: any) => {
          console.warn('Lỗi đọc realtime orders:', err.message);
        }
      );
    } catch (e) {
      console.warn('Không thể kết nối orders realtime:', e);
    }

    let unsubscribeProducts = () => {};
    try {
      const qProducts = query(collection(db, 'products'));
      unsubscribeProducts = onSnapshot(
        qProducts,
        (snapshot: any) => {
          if (!snapshot.empty) {
            let active = 0;
            snapshot.forEach((docSnap: any) => {
              const p = docSnap.data();
              if (p.isAvailable !== false) {
                active++;
              }
            });
            setStats((prev) => ({ ...prev, activeProductsCount: active }));
          } else {
            setStats((prev) => ({ ...prev, activeProductsCount: 0 }));
          }
        },
        (err: any) => {
          console.warn('Lỗi đọc realtime products:', err.message);
        }
      );
    } catch (e) {
      console.warn('Không thể kết nối products realtime:', e);
    }

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      await logout?.();
      router.replace('/auth/login');
      return;
    }
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Admin?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout?.();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const maxDailyRev = Math.max(...dailyRevenue, 1);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Tổng quan"
        subtitle="Pizza FPT Admin"
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Minimalist Welcome & Quick Logout Card */}
        <View style={styles.welcomeCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <AppText variant="h3" color={colors.textPrimary}>
                Xin chào, {user?.fullname || 'Quản trị viên'}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                Bảng điều khiển quản lý cửa hàng
              </AppText>
            </View>
            {!!logout && (
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <LogOut size={16} color={colors.primary} />
                <AppText variant="captionSemiBold" color={colors.primary}>
                  Đăng xuất
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 4 Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Doanh thu
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.successSoft }]}>
                <TrendingUp size={20} color={colors.success} />
              </View>
            </View>
            <AppText variant="price" color={colors.success} style={styles.statValue} numberOfLines={1}>
              {formatCurrency(stats.totalRevenue)}
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Đơn hoàn tất
            </AppText>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Chờ duyệt
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Clock size={20} color={colors.warning} />
              </View>
            </View>
            <AppText variant="price" color={colors.warning} style={styles.statValue} numberOfLines={1}>
              {stats.pendingOrdersCount} đơn
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Đang chờ xử lý
            </AppText>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Món đang bán
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.primarySoft }]}>
                <PackageCheck size={20} color={colors.primary} />
              </View>
            </View>
            <AppText variant="price" color={colors.primary} style={styles.statValue} numberOfLines={1}>
              {stats.activeProductsCount} món
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Trạng thái mở bán
            </AppText>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Hoàn tất
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <CheckCircle size={20} color={colors.textSecondary} />
              </View>
            </View>
            <AppText variant="price" color={colors.textPrimary} style={styles.statValue} numberOfLines={1}>
              {stats.completedOrdersCount} đơn
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Giao thành công
            </AppText>
          </View>
        </View>

        {/* Minimalist Weekly Revenue Bar Chart */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={18} color={colors.primary} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Doanh thu theo thứ
              </AppText>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 110,
              paddingTop: 12,
            }}
          >
            {DAYS_OF_WEEK.map((day, idx) => {
              const rev = dailyRevenue[idx];
              const barHeight = Math.max(6, Math.round((rev / maxDailyRev) * 76));
              return (
                <View key={day} style={{ alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      width: 18,
                      height: barHeight,
                      borderRadius: 6,
                      backgroundColor: rev > 0 ? colors.primary : colors.border,
                    }}
                  />
                  <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 6 }}>
                    {day}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>

        {/* Minimalist Top Selling Products Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="cardTitle" color={colors.textPrimary} style={{ marginBottom: 12 }}>
            Món bán chạy nhất
          </AppText>

          {topProducts.length === 0 ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Chưa có dữ liệu đơn hoàn tất.
            </AppText>
          ) : (
            topProducts.map((item, idx) => (
              <View
                key={item.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: idx === 0 ? colors.primary : colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText variant="small" color={idx === 0 ? '#FFFFFF' : colors.textPrimary}>
                      {idx + 1}
                    </AppText>
                  </View>
                  <AppText variant="bodyMedium" color={colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
                    {item.name}
                  </AppText>
                </View>
                <AppText variant="captionSemiBold" color={colors.primary}>
                  {item.count} phần
                </AppText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
