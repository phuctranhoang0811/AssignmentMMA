import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  UtensilsCrossed,
  ChefHat,
  Ticket,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  PackageCheck,
  ChevronRight,
  ExternalLink,
  ClipboardList,
  BarChart2,
} from 'lucide-react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminDashboard.styles';
import { mockProducts } from '../../data/mockProducts';
import { initialMockOrders } from '../../data/mockOrders';
import { formatCurrency } from '../../utils/formatCurrency';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingOrdersCount: 0,
    activeProductsCount: 0,
    completedOrdersCount: 0,
  });

  useEffect(() => {
    // 1. Lắng nghe real-time từ collection 'orders'
    let unsubscribeOrders = () => { };
    try {
      const qOrders = query(collection(db, 'orders'));
      unsubscribeOrders = onSnapshot(
        qOrders,
        (snapshot: any) => {
          let revenue = 0;
          let pendingCount = 0;
          let completedCount = 0;

          if (!snapshot.empty) {
            snapshot.forEach((doc: any) => {
              const data = doc.data();
              const total = Number(data.totalAmount || data.total || 0);
              const status = data.status;

              if (status === 'COMPLETED' || status === 'DELIVERED') {
                revenue += total;
                completedCount++;
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
          } else {
            // Fallback từ initialMockOrders nếu Firestore trống
            const mockRev = initialMockOrders
              .filter((o: any) => o.status === 'COMPLETED')
              .reduce((sum: number, o: any) => sum + (o.total || 0), 0);
            const mockPending = initialMockOrders.filter(
              (o: any) => o.status === 'PENDING_CONFIRMATION'
            ).length;
            const mockCompleted = initialMockOrders.filter(
              (o: any) => o.status === 'COMPLETED'
            ).length;

            setStats((prev) => ({
              ...prev,
              totalRevenue: mockRev,
              pendingOrdersCount: mockPending,
              completedOrdersCount: mockCompleted,
            }));
          }
        },
        (err: any) => {
          console.warn('Lỗi đọc realtime orders:', err.message);
        }
      );
    } catch (e) {
      console.warn('Không thể kết nối orders realtime:', e);
    }

    // 2. Lắng nghe real-time từ collection 'products'
    let unsubscribeProducts = () => { };
    try {
      const qProducts = query(collection(db, 'products'));
      unsubscribeProducts = onSnapshot(
        qProducts,
        (snapshot: any) => {
          if (!snapshot.empty) {
            let active = 0;
            snapshot.forEach((doc: any) => {
              const p = doc.data();
              if (p.isAvailable !== false) {
                active++;
              }
            });
            setStats((prev) => ({ ...prev, activeProductsCount: active }));
          } else {
            // Fallback mockProducts
            setStats((prev) => ({
              ...prev,
              activeProductsCount: mockProducts.length,
            }));
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
    }, 800);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Quản Trị Hệ Thống"
        subtitle="Pizza FPT Manager Portal"
        showBack={true}
        onBack={() => router.replace('/(tabs)/profile')}
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
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeHeader}>
            <AppText variant="h3" color={colors.textPrimary}>
              Xin chào, {user?.fullname || 'Quản trị viên'}
            </AppText>
            <View style={styles.adminBadge}>
              <AppText variant="captionSemiBold" color={colors.primary}>
                {user?.role || 'SUPER_ADMIN'}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
            Hệ thống giám sát và quản lý vận hành chuỗi Pizza FPT theo tài liệu đặc tả System Flows.
          </AppText>
        </View>

        {/* Section Title */}
        <AppText variant="cardTitle" color={colors.textPrimary} style={styles.sectionTitle}>
          Chỉ số vận hành hôm nay (KPIs)
        </AppText>

        {/* 4 Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Card 1: Doanh thu */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Doanh thu
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.successSoft }]}>
                <TrendingUp size={20} color={colors.success} />
              </View>
            </View>
            <AppText variant="price" color={colors.success} style={styles.statValue}>
              {formatCurrency(stats.totalRevenue || 1250000)}
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Đã bao gồm đơn hoàn tất
            </AppText>
          </View>

          {/* Card 2: Đơn chờ duyệt */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Chờ duyệt
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Clock size={20} color={colors.warning} />
              </View>
            </View>
            <AppText variant="price" color={colors.warning} style={styles.statValue}>
              {stats.pendingOrdersCount} đơn
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Cần nhân viên xử lý
            </AppText>
          </View>

          {/* Card 3: Món đang bán */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Món đang bán
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.primarySoft }]}>
                <PackageCheck size={20} color={colors.primary} />
              </View>
            </View>
            <AppText variant="price" color={colors.primary} style={styles.statValue}>
              {stats.activeProductsCount || mockProducts.length} món
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Trạng thái In-Stock
            </AppText>
          </View>

          {/* Card 4: Đơn đã giao */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Hoàn tất
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <CheckCircle size={20} color={colors.textSecondary} />
              </View>
            </View>
            <AppText variant="price" color={colors.textPrimary} style={styles.statValue}>
              {stats.completedOrdersCount} đơn
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Giao thành công
            </AppText>
          </View>
        </View>

        {/* Section: Phân hệ Quản trị */}
        <AppText variant="cardTitle" color={colors.textPrimary} style={styles.sectionTitle}>
          Phân hệ Quản trị Chức năng (System Flows)
        </AppText>

        <View style={styles.modulesContainer}>
          {/* CỘT 1: QUẢN TRỊ THỰC ĐƠN (Mục 4.1) */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/products')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.primarySoft }]}>
                <UtensilsCrossed size={24} color={colors.primary} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Quản Trị Thực Đơn & Tồn Kho
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  CRUD món, cấu hình Size & Đế (Crust), bật/tắt In-Stock và giá bán.
                </AppText>
                <View style={[styles.moduleBadge, { backgroundColor: colors.primarySoft }]}>
                  <AppText variant="small" color={colors.primary}>
                    Cột 1: Thực đơn (Mục 4.1)
                  </AppText>
                </View>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* CỘT 2: GIÁM SÁT VẬN HÀNH (Mục 4.2) */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/orders')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.warningSoft }]}>
                <ClipboardList size={24} color={colors.warning} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Giám Sát Vận Hành (Live Orders)
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Theo dõi đơn thời gian thực, can thiệp hủy (Override) và hoàn tiền.
                </AppText>
                <View style={[styles.moduleBadge, { backgroundColor: colors.warningSoft }]}>
                  <AppText variant="small" color={colors.warning}>
                    Cột 2: Vận hành (Mục 4.2)
                  </AppText>
                </View>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* MÀN HÌNH BẾP LIÊN KẾT (Kitchen Demo) */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            onPress={() => router.push('/demo/staff-orders')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: '#F3E8FF' }]}>
                <ChefHat size={24} color="#7C3AED" />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Vận Hành Bếp & Giao Nhận (Staff)
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Màn hình dành cho đầu bếp nhận đơn, làm món và bàn giao shipper.
                </AppText>
                <View style={[styles.moduleBadge, { backgroundColor: '#F3E8FF' }]}>
                  <AppText variant="small" color="#7C3AED">
                    Vận hành Bếp & Shipper
                  </AppText>
                </View>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* CỘT 3.1: QUẢN LÝ VOUCHER & FPT REWARD (Mục 4.3) */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/promotions')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.successSoft }]}>
                <Ticket size={24} color={colors.success} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Quản Lý Voucher & FPT Reward
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Phát hành coupon giảm giá và cấu hình 4 hạng thành viên loyalty.
                </AppText>
                <View style={[styles.moduleBadge, { backgroundColor: colors.successSoft }]}>
                  <AppText variant="small" color={colors.success}>
                    Cột 3: Marketing (Mục 4.3)
                  </AppText>
                </View>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* CỘT 3.2: QUẢN LÝ USER & PHÂN QUYỀN (Mục 4.4) */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/users')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceAlt }]}>
                <Users size={24} color={colors.textPrimary} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Quản Lý User & Phân Quyền (RBAC)
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Cấp quyền Quản lý, Bếp, Shipper, Thu ngân & chặn (Blacklist).
                </AppText>
                <View style={[styles.moduleBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <AppText variant="small" color={colors.textSecondary}>
                    Cột 3: Nhân sự (Mục 4.4)
                  </AppText>
                </View>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* CỘT 3.3: PHÂN TÍCH DOANH THU & BI/REPORT (Mục 4.5) */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/reports')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.successSoft }]}>
                <BarChart2 size={24} color={colors.success} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Phân Tích Doanh Thu (BI/Report)
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Biểu đồ doanh thu theo ngày, AOV, tỷ lệ hủy & top 5 sản phẩm bán chạy.
                </AppText>
                <View style={[styles.moduleBadge, { backgroundColor: colors.successSoft }]}>
                  <AppText variant="small" color={colors.success}>
                    Cột 3: Báo cáo (Mục 4.5)
                  </AppText>
                </View>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity></View>
      </ScrollView>
    </SafeAreaView>
  );
}
