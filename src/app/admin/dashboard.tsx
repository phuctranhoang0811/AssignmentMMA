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
  Ticket,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  PackageCheck,
  ChevronRight,
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

          // No orders yet means zeros, not demo numbers.
          setStats((prev) => ({
            ...prev,
            totalRevenue: revenue,
            pendingOrdersCount: pendingCount,
            completedOrdersCount: completedCount,
          }));
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
            // An empty catalog is zero products, not the built-in demo list.
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
            <AppText variant="price" color={colors.success} style={styles.statValue} numberOfLines={1}>
              {formatCurrency(stats.totalRevenue)}
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
            <AppText variant="price" color={colors.warning} style={styles.statValue} numberOfLines={1}>
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
            <AppText variant="price" color={colors.primary} style={styles.statValue} numberOfLines={1}>
              {stats.activeProductsCount} món
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
            <AppText variant="price" color={colors.textPrimary} style={styles.statValue} numberOfLines={1}>
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
          {/* Module 1: Quản trị Thực đơn & Tồn kho */}
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
                  Thêm món, cập nhật giá bán, bật/tắt In-Stock & cấu hình Size/Đế.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Module 2: Giám sát Đơn hàng & Can thiệp */}
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
                  Giám Sát Đơn Hàng (Live Orders)
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Theo dõi đơn theo thời gian thực, can thiệp hủy đơn & hoàn tiền.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Module 3: Khuyến mãi & FPT Reward */}
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
                  Khuyến Mãi & FPT Reward
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Phát hành mã Voucher giảm giá & cấu hình tích điểm hạng thành viên.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Module 4: Quản lý Người dùng & Phân quyền */}
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
                  Quản Lý Tài Khoản & Phân Quyền
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Phân quyền Admin, Manager, Bếp, Rider & chặn tài khoản.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Giờ mở cửa và nhận đơn"
            onPress={() => router.push('/admin/store')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.warningSoft }]}>
                <ClipboardList size={24} color={colors.warning} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Giờ Mở Cửa & Nhận Đơn
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Đặt giờ mở cửa và tạm ngưng nhận đơn khi bếp quá tải.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Phản ánh của khách"
            onPress={() => router.push('/admin/issues')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.warningSoft }]}>
                <ClipboardList size={24} color={colors.warning} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Phản Ánh Của Khách
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Xử lý các vấn đề khách báo: thiếu món, giao trễ, món nguội.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Đối soát tài xế"
            onPress={() => router.push('/admin/riders')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.warningSoft }]}>
                <ClipboardList size={24} color={colors.warning} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Đối Soát Tài Xế
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Chốt tiền mặt tài xế đã thu và tiền công cần trả.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Nhật ký thao tác"
            onPress={() => router.push('/admin/audit')}
          >
            <View style={styles.moduleLeft}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.warningSoft }]}>
                <ClipboardList size={24} color={colors.warning} />
              </View>
              <View style={styles.moduleTextBox}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Nhật Ký Thao Tác
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Xem ai đã đổi giá, hoàn tiền, đổi quyền hay hủy đơn.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Module 5: Báo cáo Doanh thu & Thống kê */}
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
                  Báo Cáo Doanh Thu (BI & Thống Kê)
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Biểu đồ doanh thu theo ngày/tuần/tháng, chỉ số AOV & top 5 món bán chạy.
                </AppText>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
