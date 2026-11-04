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
  LogOut,
  BarChart2,
  Store,
  ChevronDown,
  ChevronUp,
  Check,
  FileText,
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
import {
  subscribeStoresConfig,
  subscribeStaffStoresMap,
  subscribeOrderOverrides,
  DEFAULT_STORE_BRANCHES,
  type SyncedStoreBranch,
  type OrderDispatchOverride,
} from '../../services/storeSync';

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function doesOrderBelongToStore(
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
  const dayOfWeek = (now.getDay() + 6) % 7;
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

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [assignedStoreId, setAssignedStoreId] = useState<string | null>(user?.storeId || null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    user?.storeId || DEFAULT_STORE_BRANCHES[0].id
  );
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [rawOrders, setRawOrders] = useState<Record<string, any>[]>([]);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});

  useEffect(() => {
    const unsubStaff = subscribeStaffStoresMap((map) => {
      if (user?.id && map[user.id]?.storeId) {
        setAssignedStoreId(map[user.id].storeId!);
        setSelectedStoreId(map[user.id].storeId!);
      } else if (user?.storeId) {
        setAssignedStoreId(user.storeId);
        setSelectedStoreId(user.storeId);
      }
    });
    return () => unsubStaff();
  }, [user?.id, user?.storeId]);

  useEffect(() => {
    const unsubStores = subscribeStoresConfig((state) => {
      const active = state.stores.filter((s) => s.isActive !== false);
      const list = active.length > 0 ? active : state.stores;
      if (list.length > 0) {
        setStoresList(list);
        setSelectedStoreId((prev) =>
          list.some((s) => s.id === prev) ? prev : list[0].id
        );
      }
    });
    return () => unsubStores();
  }, []);

  useEffect(() => {
    const unsubOverrides = subscribeOrderOverrides((map) => {
      setOrderOverrides(map);
    });
    return () => unsubOverrides();
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
          console.warn('Lỗi đọc realtime orders (Manager):', err.message);
        }
      );
    } catch (e) {
      console.warn('Không thể kết nối orders realtime (Manager):', e);
    }

    return () => {
      unsubscribeOrders();
    };
  }, []);

  const currentStore =
    storesList.find((s) => s.id === (assignedStoreId || selectedStoreId)) || storesList[0];

  const isTopAdminPreview =
    (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && !assignedStoreId;

  const now = new Date();

  let todayRevenue = 0;
  let todayCompletedCount = 0;
  let pendingOrdersCount = 0;
  const todayProdMap: Record<string, { name: string; count: number; revenue: number }> = {};

  const dailyRevenue = [0, 0, 0, 0, 0, 0, 0];

  let allTimeRevenue = 0;
  let allTimeCompletedCount = 0;
  let monthRevenue = 0;
  let cancelledOrdersCount = 0;
  const allTimeProdMap: Record<string, { name: string; count: number; revenue: number }> = {};

  rawOrders.forEach((raw) => {
    if (String(raw.orderCode || '').toUpperCase() === 'PF-X469QK') {
      return;
    }
    if (currentStore && !doesOrderBelongToStore(raw, currentStore, storesList)) {
      return;
    }

    const override = raw.id ? orderOverrides[raw.id] : undefined;
    const status = override?.status || raw.status;
    const total = Number(raw.totalAmount || raw.total || 0);
    const d = override?.updatedAtMs ? new Date(override.updatedAtMs) : parseOrderDate(raw);

    if (status === 'COMPLETED' || status === 'DELIVERED') {
      const isToday = isSameCalendarDay(d, now);
      const isThisWeek = isDateInCurrentWeek(d, now);
      const isThisMonth =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

      allTimeRevenue += total;
      allTimeCompletedCount++;
      if (isThisMonth) {
        monthRevenue += total;
      }

      if (isThisWeek) {
        const dayIdx = (d.getDay() + 6) % 7;
        if (dayIdx >= 0 && dayIdx < 7) {
          dailyRevenue[dayIdx] += total;
        }
      }

      if (isToday) {
        todayRevenue += total;
        todayCompletedCount++;
      }

      const items = raw.items || [];
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
    }
  });

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
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Quản lý?', [
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
        title="Tổng quan chi nhánh"
        subtitle={currentStore?.name || 'Quản lý cửa hàng Pizza FPT'}
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
        {/* Welcome & Quick Logout Card */}
        <View style={styles.welcomeCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <AppText variant="h3" color={colors.textPrimary}>
                Xin chào, {user?.fullname || 'Quản lý (Manager)'}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                Quản lý vận hành & doanh thu chi nhánh
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

        {/* Thông tin Chi nhánh đang phụ trách (nếu là Admin test thì cho bấm chọn đổi quán xem thử) */}
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
            activeOpacity={isTopAdminPreview ? 0.75 : 1}
            onPress={() => {
              if (isTopAdminPreview) {
                setStoreDropdownOpen((prev) => !prev);
              }
            }}
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
                  {isTopAdminPreview ? 'Chi nhánh đang test (Chế độ Admin xem thử)' : 'Chi nhánh phụ trách'}
                </AppText>
                <AppText variant="bodySemiBold" color={colors.textPrimary} numberOfLines={1}>
                  {currentStore?.name}
                </AppText>
              </View>
            </View>
            {isTopAdminPreview &&
              (storeDropdownOpen ? (
                <ChevronUp size={20} color={colors.primary} />
              ) : (
                <ChevronDown size={20} color={colors.textSecondary} />
              ))}
          </TouchableOpacity>

          {isTopAdminPreview && storeDropdownOpen && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              {storesList.map((st, idx) => {
                const isSelected = currentStore?.id === st.id;
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
                      borderTopWidth: idx > 0 ? 1 : 0,
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
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.replace('/manager/orders')}
            style={styles.statCard}
          >
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
            <AppText variant="small" color={colors.primary}>
              Bấm để xử lý đơn →
            </AppText>
          </TouchableOpacity>

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
              Doanh thu trong ngày tại {currentStore?.name} (Tự reset 00:00)
            </AppText>
          </View>
        </View>

        {/* Weekly Revenue Bar Chart */}
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

        {/* Top Selling Products Today */}
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
              Hôm nay chưa có đơn hoàn tất tại chi nhánh này.
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

        {/* Ô TỔNG KẾT DƯỚI CÙNG CỦA CHI NHÁNH */}
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
                  Tổng kết doanh thu chi nhánh
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  {summaryOpen
                    ? 'Bấm để thu gọn bảng tổng kết'
                    : 'Bấm vào đây khi cần xem tổng tích lũy của chi nhánh'}
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
                  Tổng doanh thu tích lũy ({currentStore?.name})
                </AppText>
                <AppText variant="price" color={colors.primary} style={{ marginTop: 4 }}>
                  {formatCurrency(allTimeRevenue)}
                </AppText>
                <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  Tổng cộng {allTimeCompletedCount} đơn giao thành công
                  {cancelledOrdersCount > 0 ? ` • ${cancelledOrdersCount} đơn đã hủy` : ''}
                </AppText>
              </View>

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
                    Tổng món bán chạy tại chi nhánh
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
    </SafeAreaView>
  );
}

