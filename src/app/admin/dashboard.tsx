import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  LogOut,
  BarChart2,
  Store,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  FileText,
  AlertTriangle,
  X,
  Phone,
  MapPin,
} from 'lucide-react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminDashboard.styles';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  subscribeStoresConfig,
  subscribeOrderOverrides,
  saveOrderOverride,
  DEFAULT_STORE_BRANCHES,
  type SyncedStoreBranch,
  type OrderDispatchOverride,
} from '../../services/storeSync';

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function doesOrderMatchStore(
  orderData: Record<string, any>,
  targetStore: SyncedStoreBranch,
  allStores: SyncedStoreBranch[]
): boolean {
  const orderStoreId = orderData.storeId ? String(orderData.storeId) : '';
  const orderStoreName = orderData.storeName ? String(orderData.storeName) : '';
  const orderAddr = String(orderData.address || orderData.deliveryAddress || '');

  if (orderStoreId) {
    return orderStoreId === targetStore.id;
  }
  if (orderStoreName) {
    return orderStoreName === targetStore.name;
  }
  if (orderAddr && orderAddr.includes(targetStore.name)) {
    return true;
  }

  // Với các đơn cũ chưa gắn storeId, phân bổ theo khu vực địa chỉ (Hà Nội vs TP.HCM / quán mặc định)
  const addrLower = orderAddr.toLowerCase();
  const isOrderHanoi =
    addrLower.includes('hà nội') ||
    addrLower.includes('ba đình') ||
    addrLower.includes('liễu giai') ||
    addrLower.includes('cầu giấy') ||
    addrLower.includes('đống đa') ||
    addrLower.includes('hoàn kiếm');

  const storeAddrLower = `${targetStore.name} ${targetStore.address}`.toLowerCase();
  const isStoreHanoi =
    storeAddrLower.includes('hà nội') ||
    storeAddrLower.includes('ba đình') ||
    storeAddrLower.includes('liễu giai');

  if (isOrderHanoi && isStoreHanoi) {
    return true;
  }
  if (!isOrderHanoi && !isStoreHanoi) {
    const firstNonHanoi = allStores.find((s) => {
      const stLower = `${s.name} ${s.address}`.toLowerCase();
      return (
        !stLower.includes('hà nội') &&
        !stLower.includes('ba đình') &&
        !stLower.includes('liễu giai')
      );
    });
    return firstNonHanoi ? firstNonHanoi.id === targetStore.id : allStores[0]?.id === targetStore.id;
  }

  return false;
}

function parseOrderDate(orderData: Record<string, any>): Date {
  const raw = orderData.updatedAt || orderData.createdAt;
  if (!raw) return new Date();
  if (typeof raw?.toDate === 'function') {
    return raw.toDate();
  }
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    return new Date(raw.seconds * 1000);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isSameCalendarDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isDateInCurrentWeek(d: Date, now: Date): boolean {
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = T2, 6 = CN
  const mondayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayOfWeek,
    0,
    0,
    0,
    0
  );
  const nextMondayStart = new Date(
    mondayStart.getFullYear(),
    mondayStart.getMonth(),
    mondayStart.getDate() + 7,
    0,
    0,
    0,
    0
  );
  return d >= mondayStart && d < nextMondayStart;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(user?.storeId || 'ALL');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [rawOrders, setRawOrders] = useState<Record<string, any>[]>([]);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});

  useEffect(() => {
    const unsubOverrides = subscribeOrderOverrides((map) => {
      setOrderOverrides(map);
    });
    return () => unsubOverrides();
  }, []);

  useEffect(() => {
    if (user?.storeId) {
      setSelectedStoreId(user.storeId);
    }
  }, [user?.storeId]);

  useEffect(() => {
    const unsubStores = subscribeStoresConfig((state) => {
      const active = state.stores.filter((s) => s.isActive !== false);
      const list = active.length > 0 ? active : state.stores;
      if (list.length > 0) {
        setStoresList(list);
        setSelectedStoreId((prev) =>
          prev === 'ALL' || list.some((s) => s.id === prev) ? prev : 'ALL'
        );
      }
    });
    return () => unsubStores();
  }, []);

  useEffect(() => {
    let unsubscribeOrders = () => {};
    try {
      const qOrders = query(collection(db, 'orders'));
      unsubscribeOrders = onSnapshot(
        qOrders,
        (snapshot: any) => {
          const list: Record<string, any>[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          setRawOrders(list);
        },
        (err: any) => {
          console.warn('Lỗi đọc realtime orders:', err.message);
        }
      );
    } catch (e) {
      console.warn('Không thể kết nối orders realtime:', e);
    }

    return () => {
      unsubscribeOrders();
    };
  }, []);

  const selectedStore =
    selectedStoreId === 'ALL'
      ? null
      : storesList.find((s) => s.id === selectedStoreId) || null;

  const now = new Date();

  // Thống kê TRONG NGÀY HÔM NAY (tự động reset lúc 00:00 sang ngày mới)
  let todayRevenue = 0;
  let todayCompletedCount = 0;
  let pendingOrdersCount = 0;
  const todayProdMap: Record<string, { name: string; count: number; revenue: number }> = {};

  // Thống kê TUẦN HIỆN TẠI (biểu đồ T2 -> CN)
  const dailyRevenue = [0, 0, 0, 0, 0, 0, 0];

  // Thống kê TỔNG KẾT TÍCH LŨY (hiển thị trong Ô Tổng kết dưới cùng khi bấm mở)
  let allTimeRevenue = 0;
  let allTimeCompletedCount = 0;
  let monthRevenue = 0;
  let cancelledOrdersCount = 0;
  const allTimeProdMap: Record<string, { name: string; count: number; revenue: number }> = {};
  const storeBreakdownMap: Record<string, { name: string; count: number; revenue: number }> = {};
  const incidentOrders: Record<string, any>[] = [];

  storesList.forEach((st) => {
    storeBreakdownMap[st.id] = { name: st.name, count: 0, revenue: 0 };
  });

  rawOrders.forEach((data) => {
    if (String(data.orderCode || '').toUpperCase() === 'PF-X469QK') {
      return;
    }
    const ov = data.id ? orderOverrides[data.id] : undefined;
    const total = Number(data.totalAmount || data.total || 0);
    const status = ov?.status || data.status;
    const d = ov?.updatedAtMs ? new Date(ov.updatedAtMs) : parseOrderDate(data);

    // Tính doanh thu phân bổ từng quán cho Ô Tổng kết
    if (status === 'COMPLETED' || status === 'DELIVERED') {
      for (const st of storesList) {
        if (doesOrderMatchStore(data, st, storesList)) {
          if (!storeBreakdownMap[st.id]) {
            storeBreakdownMap[st.id] = { name: st.name, count: 0, revenue: 0 };
          }
          storeBreakdownMap[st.id].count += 1;
          storeBreakdownMap[st.id].revenue += total;
          break;
        }
      }
    }

    if (selectedStore && !doesOrderMatchStore(data, selectedStore, storesList)) {
      return;
    }

    if (status === 'COMPLETED' || status === 'DELIVERED') {
      const isToday = isSameCalendarDay(d, now);
      const isThisWeek = isDateInCurrentWeek(d, now);
      const isThisMonth =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

      // 1. Cộng vào Tổng kết tích lũy
      allTimeRevenue += total;
      allTimeCompletedCount++;
      if (isThisMonth) {
        monthRevenue += total;
      }

      // 2. Cộng vào Biểu đồ tuần hiện tại
      if (isThisWeek) {
        const dayIdx = (d.getDay() + 6) % 7;
        if (dayIdx >= 0 && dayIdx < 7) {
          dailyRevenue[dayIdx] += total;
        }
      }

      // 3. Cộng vào Thống kê trong ngày hôm nay (reset hằng ngày)
      if (isToday) {
        todayRevenue += total;
        todayCompletedCount++;
      }

      const items = data.items || [];
      items.forEach((it: any) => {
        const name = it.productName || it.name || 'Món ăn';
        const qty = Number(it.quantity || 1);
        const lineRev = Number(it.lineTotal || (it.unitPrice || it.price || 0) * qty);

        if (!allTimeProdMap[name]) {
          allTimeProdMap[name] = { name, count: 0, revenue: 0 };
        }
        allTimeProdMap[name].count += qty;
        allTimeProdMap[name].revenue += lineRev;

        if (isToday) {
          if (!todayProdMap[name]) {
            todayProdMap[name] = { name, count: 0, revenue: 0 };
          }
          todayProdMap[name].count += qty;
          todayProdMap[name].revenue += lineRev;
        }
      });
    } else if (status === 'PENDING' || status === 'PENDING_CONFIRMATION') {
      pendingOrdersCount++;
    } else if (status === 'CANCELLED' || status === 'REJECTED') {
      cancelledOrdersCount++;
      const matchedBranch =
        storesList.find((st) => doesOrderMatchStore(data, st, storesList)) || storesList[0];
      incidentOrders.push({
        ...data,
        id: String(data.id || ''),
        orderCode: String(data.orderCode || String(data.id || '').slice(-6).toUpperCase()),
        status,
        total,
        branchName: matchedBranch?.name || data.storeName || 'Pizza FPT',
        customerName: String(
          data.customer?.fullname || data.customerName || data.recipientName || 'Khách hàng'
        ),
        customerPhone: String(
          data.customer?.phone || data.customerPhone || data.recipientPhone || ''
        ),
        address: String(data.address || data.deliveryAddress || 'Nhận tại cửa hàng'),
        isPickup:
          data.fulfillmentType === 'takeaway' || data.fulfillmentType === 'PICKUP',
        cancelReason: String(
          ov?.cancelReason || data.cancelReason || 'Đơn bị hủy / từ chối'
        ),
        assignedStaffName: String(ov?.assignedStaffName || data.assignedStaffName || ''),
        assignedStaffPhone: String(ov?.assignedStaffPhone || data.assignedStaffPhone || ''),
        incidentResolved: Boolean(ov?.incidentResolved),
        incidentReportedBy: String(
          ov?.incidentReportedBy || (data.userId ? 'Chi nhánh / Khách hàng' : 'Chi nhánh')
        ),
        updatedAtDate: d,
        updatedAtMs: d.getTime(),
      });
    }
  });

  incidentOrders.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const unresolvedIncidentCount = incidentOrders.filter((o) => !o.incidentResolved).length;
  const selectedIncidentOrder = selectedIncidentId
    ? incidentOrders.find((o) => o.id === selectedIncidentId) || null
    : null;

  const topProducts = Object.values(todayProdMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const allTimeTopProducts = Object.values(allTimeProdMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
        subtitle={selectedStore ? selectedStore.name : 'Tất cả cơ sở Pizza FPT'}
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

        {/* Thanh Dropdown chọn Quán / Chi nhánh (bấm xổ xuống) */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: storeDropdownOpen ? colors.primary : colors.border,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setStoreDropdownOpen((prev) => !prev)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              paddingVertical: 13,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Store size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="small" color={colors.textSecondary}>
                  Cơ sở đang xem
                </AppText>
                <AppText variant="bodySemiBold" color={colors.textPrimary} numberOfLines={1}>
                  {selectedStore ? selectedStore.name : `Tất cả cơ sở (${storesList.length} quán)`}
                </AppText>
              </View>
            </View>
            {storeDropdownOpen ? (
              <ChevronUp size={20} color={colors.primary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {storeDropdownOpen && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              {!user?.storeId && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    setSelectedStoreId('ALL');
                    setStoreDropdownOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: selectedStoreId === 'ALL' ? colors.primarySoft : '#FFFFFF',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <AppText
                      variant="bodySemiBold"
                      color={selectedStoreId === 'ALL' ? colors.primary : colors.textPrimary}
                    >
                      Tất cả cơ sở ({storesList.length} quán)
                    </AppText>
                    <AppText variant="small" color={colors.textSecondary}>
                      Tổng hợp doanh thu & đơn hàng toàn hệ thống
                    </AppText>
                  </View>
                  {selectedStoreId === 'ALL' && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}

              {storesList
                .filter((st) => !user?.storeId || st.id === user.storeId)
                .map((st, idx) => {
                  const isSelected = selectedStoreId === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        setSelectedStoreId(st.id);
                        setStoreDropdownOpen(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderTopWidth: !user?.storeId || idx > 0 ? 1 : 0,
                        borderTopColor: colors.border,
                        backgroundColor: isSelected ? colors.primarySoft : '#FFFFFF',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <AppText
                          variant="bodySemiBold"
                          color={isSelected ? colors.primary : colors.textPrimary}
                        >
                          {st.name}
                        </AppText>
                        <AppText variant="small" color={colors.textSecondary} numberOfLines={1}>
                          {st.address}
                        </AppText>
                      </View>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </View>

        {/* Top 2 Stats (Chờ duyệt & Hoàn tất hôm nay) + Bottom Full-Width Stat (Doanh thu hôm nay) */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Chờ duyệt
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Clock size={20} color={colors.primary} />
              </View>
            </View>
            <AppText variant="price" color={colors.primary} style={styles.statValue} numberOfLines={1}>
              {pendingOrdersCount} đơn
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Đang chờ xử lý
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
              {todayCompletedCount} đơn
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Trong ngày hôm nay
            </AppText>
          </View>

          <View style={[styles.statCard, { flexBasis: '100%', width: '100%' }]}>
            <View style={styles.statHeader}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Doanh thu hôm nay
              </AppText>
              <View style={[styles.statIconWrap, { backgroundColor: colors.primarySoft }]}>
                <TrendingUp size={20} color={colors.primary} />
              </View>
            </View>
            <AppText variant="price" color={colors.primary} style={styles.statValue} numberOfLines={1}>
              {formatCurrency(todayRevenue)}
            </AppText>
            <AppText variant="small" color={colors.textSecondary} numberOfLines={1}>
              {selectedStore
                ? `Doanh thu hôm nay tại ${selectedStore.name}`
                : 'Doanh thu trong ngày (Tự reset lúc 00:00)'}
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
                Doanh thu theo thứ (Tuần này)
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

        {/* Minimalist Top Selling Products Card (Trong ngày) */}
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
          <AppText variant="cardTitle" color={colors.textPrimary} style={{ marginBottom: 12 }}>
            Món bán chạy trong ngày
          </AppText>

          {topProducts.length === 0 ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Hôm nay chưa có đơn hoàn tất tại cơ sở này.
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

        {/* Ô ĐƠN HÀNG GẶP SỰ CỐ / ĐÃ HỦY (Bấm vào để xem các card đơn sự cố -> bấm vào card để xem chi tiết) */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor:
              unresolvedIncidentCount > 0
                ? '#DC2626'
                : incidentsOpen
                  ? colors.primary
                  : colors.border,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIncidentsOpen((prev) => !prev)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: unresolvedIncidentCount > 0 ? '#FEE2E2' : colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle
                  size={19}
                  color={unresolvedIncidentCount > 0 ? '#DC2626' : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <AppText variant="cardTitle" color={colors.textPrimary}>
                    Đơn hàng gặp sự cố / Đã hủy
                  </AppText>
                  {unresolvedIncidentCount > 0 && (
                    <View
                      style={{
                        backgroundColor: '#DC2626',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                      }}
                    >
                      <AppText variant="small" color="#FFFFFF" style={{ fontWeight: '700' }}>
                        {unresolvedIncidentCount} cần kiểm tra
                      </AppText>
                    </View>
                  )}
                </View>
                <AppText variant="small" color={colors.textSecondary}>
                  {incidentOrders.length === 0
                    ? 'Hiện chưa có đơn hàng nào gặp sự cố hoặc bị hủy'
                    : incidentsOpen
                      ? 'Bấm vào từng thẻ đơn bên dưới để xem chi tiết & xử lý'
                      : `Có tổng cộng ${incidentOrders.length} đơn hủy/sự cố — Bấm để xem danh sách`}
                </AppText>
              </View>
            </View>
            {incidentsOpen ? (
              <ChevronUp size={20} color={colors.primary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {incidentsOpen && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                padding: 14,
                backgroundColor: colors.surface,
              }}
            >
              {incidentOrders.length === 0 ? (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 18,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="caption" color={colors.textSecondary}>
                    Không có đơn hàng nào gặp sự cố tại cơ sở này.
                  </AppText>
                </View>
              ) : (
                incidentOrders.map((inc) => (
                  <TouchableOpacity
                    key={inc.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedIncidentId(inc.id)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: inc.incidentResolved ? colors.border : '#FECACA',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <AppText variant="bodySemiBold" color={colors.textPrimary}>
                          Đơn #{inc.orderCode}
                        </AppText>
                        <AppText variant="small" color={colors.textSecondary} numberOfLines={1}>
                          • {inc.branchName}
                        </AppText>
                      </View>
                      <View
                        style={{
                          backgroundColor: inc.incidentResolved ? colors.surfaceAlt : colors.primarySoft,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          flexShrink: 0,
                        }}
                      >
                        <AppText
                          variant="small"
                          color={inc.incidentResolved ? colors.textSecondary : colors.primary}
                          style={{ fontWeight: '700' }}
                        >
                          {inc.incidentResolved ? 'Đã xử lý' : 'Cần kiểm tra'}
                        </AppText>
                      </View>
                    </View>

                    <AppText
                      variant="small"
                      color="#DC2626"
                      numberOfLines={2}
                      style={{ fontWeight: '700', marginBottom: 6 }}
                    >
                      Sự cố: {inc.cancelReason}
                    </AppText>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 6,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <AppText variant="small" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
                        Khách: {inc.customerName}
                        {inc.customerPhone ? ` • ${inc.customerPhone}` : ''}
                      </AppText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <AppText variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
                          Chi tiết
                        </AppText>
                        <ChevronRight size={14} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* Ô TỔNG KẾT DƯỚI CÙNG (Khi nào cần xem tổng tích lũy thì bấm vô) */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: summaryOpen ? colors.primary : colors.border,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setSummaryOpen((prev) => !prev)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  Tổng kết doanh thu & đơn hàng
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  {summaryOpen
                    ? 'Bấm để thu gọn bảng tổng kết'
                    : 'Bấm vào đây khi cần xem tổng tích lũy tất cả các ngày'}
                </AppText>
              </View>
            </View>
            {summaryOpen ? (
              <ChevronUp size={20} color={colors.primary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {summaryOpen && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                padding: 16,
                backgroundColor: colors.surface,
              }}
            >
              {/* Tổng doanh thu tích lũy nổi bật */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 12,
                }}
              >
                <AppText variant="small" color={colors.textSecondary}>
                  Tổng doanh thu tích lũy ({selectedStore ? selectedStore.name : 'Tất cả cơ sở'})
                </AppText>
                <AppText variant="price" color={colors.primary} style={{ marginTop: 4 }}>
                  {formatCurrency(allTimeRevenue)}
                </AppText>
                <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  Tổng cộng {allTimeCompletedCount} đơn giao thành công
                  {cancelledOrdersCount > 0 ? ` • ${cancelledOrdersCount} đơn đã hủy` : ''}
                </AppText>
              </View>

              {/* Doanh thu Tháng này & Trong ngày */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="small" color={colors.textSecondary}>
                    Doanh thu tháng này
                  </AppText>
                  <AppText variant="bodySemiBold" color={colors.textPrimary} style={{ marginTop: 4 }}>
                    {formatCurrency(monthRevenue)}
                  </AppText>
                  <AppText variant="small" color={colors.textSecondary}>
                    Tháng {now.getMonth() + 1}/{now.getFullYear()}
                  </AppText>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="small" color={colors.textSecondary}>
                    Doanh thu trong ngày
                  </AppText>
                  <AppText variant="bodySemiBold" color={colors.textPrimary} style={{ marginTop: 4 }}>
                    {formatCurrency(todayRevenue)}
                  </AppText>
                  <AppText variant="small" color={colors.textSecondary}>
                    {todayCompletedCount} đơn hoàn tất
                  </AppText>
                </View>
              </View>

              {/* Doanh thu theo từng cơ sở (hiển thị khi xem Tất cả cơ sở) */}
              {!selectedStore && storesList.length > 0 && (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 12,
                  }}
                >
                  <AppText variant="captionSemiBold" color={colors.textPrimary} style={{ marginBottom: 8 }}>
                    Phân bổ theo từng cơ sở
                  </AppText>
                  {storesList.map((st, idx) => {
                    const stStat = storeBreakdownMap[st.id] || { count: 0, revenue: 0 };
                    return (
                      <View
                        key={st.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 8,
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <AppText variant="bodyMedium" color={colors.textPrimary} numberOfLines={1}>
                            {st.name}
                          </AppText>
                          <AppText variant="small" color={colors.textSecondary}>
                            {stStat.count} đơn hoàn tất
                          </AppText>
                        </View>
                        <AppText variant="bodySemiBold" color={colors.primary}>
                          {formatCurrency(stStat.revenue)}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Top món bán chạy tích lũy */}
              {allTimeTopProducts.length > 0 && (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="captionSemiBold" color={colors.textPrimary} style={{ marginBottom: 8 }}>
                    Tổng món bán chạy tích lũy
                  </AppText>
                  {allTimeTopProducts.map((item, idx) => (
                    <View
                      key={item.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <AppText variant="small" color={colors.textPrimary} numberOfLines={1} style={{ flex: 1, paddingRight: 8 }}>
                        {idx + 1}. {item.name}
                      </AppText>
                      <AppText variant="small" color={colors.primary}>
                        {item.count} phần
                      </AppText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL XEM CHI TIẾT ĐƠN GẶP SỰ CỐ KHI BẤM VÀO CARD */}
      <Modal
        visible={!!selectedIncidentOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedIncidentId(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          {selectedIncidentOrder && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                maxHeight: '88%',
                width: '100%',
                maxWidth: 430,
                alignSelf: 'center',
              }}
            >
              {/* Header Modal */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText variant="h3" color={colors.textPrimary}>
                      Đơn sự cố #{selectedIncidentOrder.orderCode}
                    </AppText>
                    <View
                      style={{
                        backgroundColor: selectedIncidentOrder.incidentResolved
                          ? colors.surfaceAlt
                          : colors.primarySoft,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      <AppText
                        variant="small"
                        color={selectedIncidentOrder.incidentResolved ? colors.textSecondary : colors.primary}
                        style={{ fontWeight: '700' }}
                      >
                        {selectedIncidentOrder.incidentResolved ? 'Đã xử lý' : 'Cần kiểm tra'}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                    Chi nhánh: {selectedIncidentOrder.branchName} •{' '}
                    {selectedIncidentOrder.updatedAtDate?.toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </AppText>
                </View>
                <TouchableOpacity onPress={() => setSelectedIncidentId(null)}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {/* Hộp lý do sự cố */}
                <View
                  style={{
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FECACA',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <AppText variant="captionSemiBold" color="#DC2626">
                    Nguyên nhân sự cố / hủy đơn:
                  </AppText>
                  <AppText
                    variant="bodySemiBold"
                    color="#991B1B"
                    style={{ marginTop: 3 }}
                  >
                    {selectedIncidentOrder.cancelReason}
                  </AppText>
                  <AppText variant="small" color="#B91C1C" style={{ marginTop: 4 }}>
                    Ghi nhận từ: {selectedIncidentOrder.incidentReportedBy}
                  </AppText>
                </View>

                {/* Thông tin khách hàng */}
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <AppText variant="captionSemiBold" color={colors.textSecondary}>
                      Thông tin khách hàng
                    </AppText>
                    <View
                      style={{
                        backgroundColor: selectedIncidentOrder.userId ? colors.primarySoft : colors.surfaceAlt,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      <AppText
                        variant="small"
                        color={selectedIncidentOrder.userId ? colors.primary : colors.textSecondary}
                        style={{ fontWeight: '700' }}
                      >
                        {selectedIncidentOrder.userId
                          ? 'Tài khoản thành viên'
                          : 'Khách vãng lai'}
                      </AppText>
                    </View>
                  </View>

                  <AppText variant="bodySemiBold" color={colors.textPrimary}>
                    {selectedIncidentOrder.customerName}
                  </AppText>
                  {!!selectedIncidentOrder.customerPhone && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <Phone size={13} color={colors.primary} />
                      <AppText variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
                        SĐT khách: {selectedIncidentOrder.customerPhone}
                      </AppText>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6 }}>
                    <MapPin size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
                    <AppText variant="small" color={colors.textSecondary} style={{ flex: 1 }}>
                      {selectedIncidentOrder.isPickup
                        ? `Nhận tại quán (${selectedIncidentOrder.branchName})`
                        : selectedIncidentOrder.address}
                    </AppText>
                  </View>
                </View>

                {/* Thông tin Nhân viên giao hàng (nếu có) */}
                {!!selectedIncidentOrder.assignedStaffName && (
                  <View
                    style={{
                      backgroundColor: colors.primarySoft,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: '#FECACA',
                    }}
                  >
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      Nhân viên đi giao đơn này:
                    </AppText>
                    <AppText variant="bodySemiBold" color={colors.textPrimary} style={{ marginTop: 2 }}>
                      {selectedIncidentOrder.assignedStaffName}
                      {selectedIncidentOrder.assignedStaffPhone
                        ? ` • ${selectedIncidentOrder.assignedStaffPhone}`
                        : ''}
                    </AppText>
                  </View>
                )}

                {/* Danh sách món ăn */}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 10,
                    marginBottom: 10,
                  }}
                >
                  <AppText
                    variant="captionSemiBold"
                    color={colors.textSecondary}
                    style={{ marginBottom: 6 }}
                  >
                    Danh sách món ({(selectedIncidentOrder.items || []).length} món)
                  </AppText>
                  {(selectedIncidentOrder.items || []).map((it: any, idx: number) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 4,
                      }}
                    >
                      <AppText variant="small" color={colors.textPrimary} style={{ flex: 1 }}>
                        {it.quantity || 1}x {it.productName || it.name || 'Món ăn'}
                      </AppText>
                      <AppText variant="small" color={colors.textSecondary}>
                        {formatCurrency(
                          Number(
                            it.lineTotal ||
                              (it.unitPrice || it.price || 0) * (it.quantity || 1)
                          )
                        )}
                      </AppText>
                    </View>
                  ))}
                </View>

                {/* Tổng giá trị đơn */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="bodySemiBold" color={colors.textSecondary}>
                    Tổng giá trị đơn hàng
                  </AppText>
                  <AppText variant="price" color={colors.primary}>
                    {formatCurrency(selectedIncidentOrder.total)}
                  </AppText>
                </View>
              </ScrollView>

              {/* Nút hành động cho Admin */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <AppButton
                  title="Đóng"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setSelectedIncidentId(null)}
                />
                {!selectedIncidentOrder.incidentResolved && (
                  <AppButton
                    title="Đánh dấu đã giải quyết"
                    style={{ flex: 1.5 }}
                    onPress={async () => {
                      const targetId = selectedIncidentOrder.id;
                      const targetCode = selectedIncidentOrder.orderCode;
                      setSelectedIncidentId(null);
                      await saveOrderOverride(targetId, {
                        incidentResolved: true,
                        incidentResolvedAt: new Date().toISOString(),
                      });
                      showToast({
                        message: `Đã đánh dấu giải quyết xong sự cố đơn #${targetCode}!`,
                        type: 'success',
                      });
                    }}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
