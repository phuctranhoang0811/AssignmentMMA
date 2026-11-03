import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  Clock,
  ChefHat,
  Truck,
  CheckCircle2,
  UserCheck,
  Phone,
  MapPin,
  Store,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { doesOrderBelongToStore } from './dashboard';
import {
  subscribeStoresConfig,
  subscribeStaffStoresMap,
  subscribeStaffSchedules,
  subscribeOrderOverrides,
  saveOrderOverride,
  getStaffShiftOnDate,
  DEFAULT_STORE_BRANCHES,
  type SyncedStoreBranch,
  type StaffCustomizationEntry,
  type StaffScheduleRecord,
  type OrderDispatchOverride,
  type ShiftType,
} from '../../services/storeSync';

type OrderFilterTab = 'pending' | 'preparing' | 'delivering' | 'completed';

const ORDER_TABS: { key: OrderFilterTab; label: string; Icon: any }[] = [
  { key: 'pending', label: 'Chờ duyệt', Icon: Clock },
  { key: 'preparing', label: 'Chuẩn bị & Phát giao', Icon: ChefHat },
  { key: 'delivering', label: 'Đang giao', Icon: Truck },
  { key: 'completed', label: 'Đã xong', Icon: CheckCircle2 },
];

const SHIFT_LABELS: Record<ShiftType, { label: string; color: string; bg: string }> = {
  MORNING: { label: 'Ca Sáng (08:00 - 14:00)', color: '#1D4ED8', bg: '#DBEAFE' },
  EVENING: { label: 'Ca Tối (14:00 - 22:00)', color: '#B45309', bg: '#FEF3C7' },
  FULL: { label: 'Full ca (08:00 - 22:00)', color: '#15803D', bg: '#DCFCE7' },
  OFF: { label: 'Nghỉ hôm nay', color: '#6B7280', bg: '#F3F4F6' },
};

const REJECT_REASONS = [
  'Hết nguyên liệu làm bánh',
  'Ngoài vùng giao hàng của chi nhánh',
  'Chi nhánh đang quá tải đơn',
  'Không liên lạc được với khách hàng',
  'Khách yêu cầu hủy đơn',
];

const DAY_KEYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

interface BranchStaffMember {
  id: string;
  fullname: string;
  email: string;
  phone: string;
  todayShift: ShiftType;
}

export default function ManagerOrdersScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [assignedStoreId, setAssignedStoreId] = useState<string | null>(user?.storeId || null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    user?.storeId || DEFAULT_STORE_BRANCHES[0].id
  );
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<OrderFilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [rawOrders, setRawOrders] = useState<Record<string, any>[]>([]);
  const [rawUsers, setRawUsers] = useState<Record<string, any>[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StaffScheduleRecord>>({});
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});

  // Modal phát đơn cho nhân viên đi giao
  const [dispatchOrder, setDispatchOrder] = useState<Record<string, any> | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);

  // Modal từ chối đơn
  const [rejectOrder, setRejectOrder] = useState<Record<string, any> | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASONS[0]);

  useEffect(() => {
    const unsubStores = subscribeStoresConfig((state) => {
      const active = state.stores.filter((s) => s.isActive !== false);
      const list = active.length > 0 ? active : state.stores;
      if (list.length > 0) {
        setStoresList(list);
        setSelectedStoreId((prev) => (list.some((s) => s.id === prev) ? prev : list[0].id));
      }
    });
    const unsubStaff = subscribeStaffStoresMap((map) => {
      setStaffMap(map);
      if (user?.id && map[user.id]?.storeId) {
        setAssignedStoreId(map[user.id].storeId!);
        setSelectedStoreId(map[user.id].storeId!);
      } else if (user?.storeId) {
        setAssignedStoreId(user.storeId);
        setSelectedStoreId(user.storeId);
      }
    });
    const unsubSchedules = subscribeStaffSchedules((map) => {
      setSchedulesMap(map);
    });
    const unsubOverrides = subscribeOrderOverrides((map) => {
      setOrderOverrides(map);
    });

    return () => {
      unsubStores();
      unsubStaff();
      unsubSchedules();
      unsubOverrides();
    };
  }, [user?.id, user?.storeId]);

  useEffect(() => {
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders')),
      (snap) => {
        const list: Record<string, any>[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRawOrders(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users')),
      (snap) => {
        const uList: Record<string, any>[] = [];
        snap.forEach((docSnap) => {
          uList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRawUsers(uList);
      },
      () => {}
    );

    return () => {
      unsubOrders();
      unsubUsers();
    };
  }, []);

  const currentStore =
    storesList.find((s) => s.id === (assignedStoreId || selectedStoreId)) || storesList[0];

  const isTopAdminPreview =
    (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && !assignedStoreId;

  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7] || 'T2';

  // Danh sách nhân viên thuộc chi nhánh này
  const branchStaffList: BranchStaffMember[] = rawUsers
    .filter((u) => {
      const custom = staffMap[u.id];
      if (custom?.deleted || u.role === 'BLACKLISTED' || u.role === 'ROLE_RIDER') return false;
      const isStaff = u.role === 'EMPLOYEE' || u.role === 'ROLE_KITCHEN';
      if (!isStaff) return false;
      const uStoreId = custom?.storeId !== undefined ? custom.storeId : u.storeId;
      if (uStoreId && currentStore) {
        return uStoreId === currentStore.id;
      }
      // Nếu nhân viên chưa gắn storeId cụ thể thì vẫn hiển thị để Manager có thể chọn
      return true;
    })
    .map((u) => {
      const custom = staffMap[u.id];
      const todayShift: ShiftType = getStaffShiftOnDate(schedulesMap[u.id], new Date());
      return {
        id: u.id,
        fullname: String(u.fullName || u.fullname || u.name || 'Nhân viên'),
        email: String(u.email || custom?.email || ''),
        phone: String(custom?.phone || u.phone || ''),
        todayShift,
      };
    })
    .sort((a, b) => {
      const aWorking = a.todayShift !== 'OFF' ? 0 : 1;
      const bWorking = b.todayShift !== 'OFF' ? 0 : 1;
      return aWorking - bWorking;
    });

  // Lọc đơn hàng của chi nhánh
  const branchOrders = rawOrders
    .filter((raw) => (currentStore ? doesOrderBelongToStore(raw, currentStore, storesList) : true))
    .map((raw) => {
      const override = orderOverrides[raw.id];
      const status = String(override?.status || raw.status || 'PENDING_CONFIRMATION');
      const orderCode = String(raw.orderCode || raw.id.slice(-6).toUpperCase());
      const customerName = String(
        raw.customer?.fullname || raw.customerName || raw.recipientName || 'Khách hàng'
      );
      const customerPhone = String(
        raw.customer?.phone || raw.customerPhone || raw.recipientPhone || ''
      );
      const address = String(raw.address || raw.deliveryAddress || 'Nhận tại cửa hàng');
      const total = Number(raw.totalAmount || raw.total || 0);
      const items = Array.isArray(raw.items) ? raw.items : [];
      const assignedStaffId = override?.assignedStaffId ?? raw.assignedStaffId ?? '';
      const assignedStaffName = override?.assignedStaffName ?? raw.assignedStaffName ?? '';
      const assignedStaffPhone = override?.assignedStaffPhone ?? raw.assignedStaffPhone ?? '';
      const cancelReason = override?.cancelReason ?? raw.cancelReason ?? '';
      const createdAtMs =
        typeof raw.createdAt?.toMillis === 'function'
          ? raw.createdAt.toMillis()
          : typeof raw.createdAt?.seconds === 'number'
            ? raw.createdAt.seconds * 1000
            : Date.parse(raw.createdAt) || 0;

      return {
        ...raw,
        id: String(raw.id),
        status,
        orderCode,
        customerName,
        customerPhone,
        address,
        total,
        items,
        assignedStaffId,
        assignedStaffName,
        assignedStaffPhone,
        cancelReason,
        createdAtMs,
      };
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  const counts = {
    pending: branchOrders.filter(
      (o) => o.status === 'PENDING' || o.status === 'PENDING_CONFIRMATION'
    ).length,
    preparing: branchOrders.filter(
      (o) => o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY'
    ).length,
    delivering: branchOrders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
    completed: branchOrders.filter(
      (o) =>
        o.status === 'COMPLETED' ||
        o.status === 'DELIVERED' ||
        o.status === 'CANCELLED' ||
        o.status === 'REJECTED'
    ).length,
  };

  const filteredOrders = branchOrders.filter((o) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchSearch =
        o.orderCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.assignedStaffName.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    if (activeTab === 'pending') {
      return o.status === 'PENDING' || o.status === 'PENDING_CONFIRMATION';
    }
    if (activeTab === 'preparing') {
      return o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY';
    }
    if (activeTab === 'delivering') {
      return o.status === 'OUT_FOR_DELIVERY';
    }
    return (
      o.status === 'COMPLETED' ||
      o.status === 'DELIVERED' ||
      o.status === 'CANCELLED' ||
      o.status === 'REJECTED'
    );
  });

  const handleApproveOrder = async (order: Record<string, any>) => {
    await saveOrderOverride(order.id, { status: 'PREPARING' });
    showToast({
      message: `Đã nhận đơn #${order.orderCode} chuyển xuống bếp chuẩn bị!`,
      type: 'success',
    });
  };

  const handleMarkReady = async (order: Record<string, any>) => {
    await saveOrderOverride(order.id, { status: 'READY' });
    showToast({
      message: `Đơn #${order.orderCode} đã làm xong, sẵn sàng phát cho nhân viên đi giao!`,
      type: 'success',
    });
  };

  const openDispatchModal = (order: Record<string, any>) => {
    setDispatchOrder(order);
    const defaultStaff =
      order.assignedStaffId ||
      branchStaffList.find((s) => s.todayShift !== 'OFF')?.id ||
      branchStaffList[0]?.id ||
      '';
    setSelectedStaffId(defaultStaff);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchOrder) return;
    const chosenStaff = branchStaffList.find((s) => s.id === selectedStaffId);
    if (!chosenStaff) {
      showToast({ message: 'Vui lòng chọn 1 nhân viên để phát đơn đi giao', type: 'error' });
      return;
    }
    setDispatching(true);
    try {
      await saveOrderOverride(dispatchOrder.id, {
        status: 'OUT_FOR_DELIVERY',
        assignedStaffId: chosenStaff.id,
        assignedStaffName: chosenStaff.fullname,
        assignedStaffPhone: chosenStaff.phone,
      });
      showToast({
        message: `Đã phát đơn #${dispatchOrder.orderCode} cho ${chosenStaff.fullname} đi giao!`,
        type: 'success',
      });
      setDispatchOrder(null);
      setActiveTab('delivering');
    } finally {
      setDispatching(false);
    }
  };

  const handleCompleteOrder = async (order: Record<string, any>) => {
    await saveOrderOverride(order.id, {
      status: 'COMPLETED',
      paymentStatus: 'PAID',
    });
    showToast({
      message: `Đơn #${order.orderCode} đã giao hoàn tất & cộng vào doanh thu hôm nay!`,
      type: 'success',
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectOrder) return;
    await saveOrderOverride(rejectOrder.id, {
      status: 'CANCELLED',
      cancelReason: rejectReason,
    });
    showToast({
      message: `Đã từ chối đơn #${rejectOrder.orderCode}`,
      type: 'info',
    });
    setRejectOrder(null);
  };

  const getStatusBadgeInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'PENDING_CONFIRMATION':
        return { label: 'Chờ duyệt', color: '#D97706', bg: '#FEF3C7' };
      case 'CONFIRMED':
      case 'PREPARING':
        return { label: 'Đang làm món', color: '#2563EB', bg: '#DBEAFE' };
      case 'READY':
        return { label: 'Chờ phát giao', color: '#7C3AED', bg: '#EDE9FE' };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Đang đi giao', color: '#EA580C', bg: '#FFEDD5' };
      case 'COMPLETED':
      case 'DELIVERED':
        return { label: 'Giao hoàn tất', color: '#15803D', bg: '#DCFCE7' };
      default:
        return { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Đơn hàng & Điều phối"
        subtitle={currentStore?.name || 'Chi nhánh Pizza FPT'}
        showBack={false}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        {/* Nếu là Admin xem thử thì cho chọn đổi chi nhánh */}
        {isTopAdminPreview && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              marginBottom: 10,
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
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Store size={16} color={colors.primary} />
                <AppText variant="captionSemiBold" color={colors.textPrimary} numberOfLines={1}>
                  Đang xem đơn của: {currentStore?.name}
                </AppText>
              </View>
              {storeDropdownOpen ? (
                <ChevronUp size={18} color={colors.primary} />
              ) : (
                <ChevronDown size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            {storeDropdownOpen && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                {storesList.map((st) => {
                  const isSel = currentStore?.id === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      onPress={() => {
                        setSelectedStoreId(st.id);
                        setStoreDropdownOpen(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: isSel ? colors.primarySoft : '#FFFFFF',
                      }}
                    >
                      <AppText
                        variant="captionSemiBold"
                        color={isSel ? colors.primary : colors.textPrimary}
                      >
                        {st.name}
                      </AppText>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Thanh tìm kiếm đơn hàng */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 10,
          }}
        >
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: colors.textPrimary }}
            placeholder="Tìm mã đơn, tên khách, SĐT, người giao..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 4 Tab trạng thái đơn */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
        >
          {ORDER_TABS.map((t) => {
            const active = activeTab === t.key;
            const count = counts[t.key];
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.75}
                onPress={() => setActiveTab(t.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primary : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <AppText
                  variant="captionSemiBold"
                  color={active ? '#FFFFFF' : colors.textSecondary}
                >
                  {t.label} ({count})
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredOrders.length === 0 ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 28,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="bodySemiBold" color={colors.textPrimary}>
                Không có đơn hàng nào ở mục này
              </AppText>
              <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 4 }}>
                Các đơn hàng của {currentStore?.name} sẽ hiển thị realtime tại đây.
              </AppText>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const badge = getStatusBadgeInfo(order.status);
              return (
                <View
                  key={order.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {/* Header đơn: Mã đơn + Trạng thái */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <View>
                      <AppText variant="cardTitle" color={colors.textPrimary}>
                        Đơn #{order.orderCode}
                      </AppText>
                      <AppText variant="small" color={colors.textSecondary}>
                        {order.customerName}{' '}
                        {order.customerPhone ? `• ${order.customerPhone}` : ''}
                      </AppText>
                    </View>
                    <View
                      style={{
                        backgroundColor: badge.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      <AppText variant="small" color={badge.color} style={{ fontWeight: '700' }}>
                        {badge.label}
                      </AppText>
                    </View>
                  </View>

                  {/* Địa chỉ giao */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 6,
                      backgroundColor: colors.surface,
                      padding: 10,
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  >
                    <MapPin size={15} color={colors.primary} style={{ marginTop: 2 }} />
                    <AppText variant="small" color={colors.textPrimary} style={{ flex: 1 }}>
                      {order.address}
                    </AppText>
                  </View>

                  {/* Danh sách món trong đơn */}
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 8,
                      marginBottom: 10,
                    }}
                  >
                    {order.items.map((it: any, idx: number) => (
                      <View
                        key={idx}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          paddingVertical: 3,
                        }}
                      >
                        <AppText variant="small" color={colors.textPrimary} style={{ flex: 1 }}>
                          {it.quantity || 1}x {it.productName || it.name || 'Món ăn'}
                        </AppText>
                        <AppText variant="small" color={colors.textSecondary}>
                          {formatCurrency(
                            Number(it.lineTotal || (it.unitPrice || it.price || 0) * (it.quantity || 1))
                          )}
                        </AppText>
                      </View>
                    ))}
                  </View>

                  {/* Nếu đã phân công nhân viên đi giao -> Hiển thị rõ */}
                  {!!order.assignedStaffName && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#ECFDF5',
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <UserCheck size={16} color="#059669" />
                        <View style={{ flex: 1 }}>
                          <AppText variant="captionSemiBold" color="#065F46">
                            Nhân viên giao: {order.assignedStaffName}
                          </AppText>
                          {!!order.assignedStaffPhone && (
                            <AppText variant="small" color="#047857">
                              SĐT: {order.assignedStaffPhone}
                            </AppText>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Tổng tiền */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <AppText variant="small" color={colors.textSecondary}>
                      Tổng thanh toán
                    </AppText>
                    <AppText variant="price" color={colors.primary}>
                      {formatCurrency(order.total)}
                    </AppText>
                  </View>

                  {/* Nút thao tác theo từng bước của Manager */}
                  {(order.status === 'PENDING' || order.status === 'PENDING_CONFIRMATION') && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => {
                          setRejectOrder(order);
                          setRejectReason(REJECT_REASONS[0]);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 11,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: '#FCA5A5',
                          backgroundColor: '#FEF2F2',
                          alignItems: 'center',
                        }}
                      >
                        <AppText variant="captionSemiBold" color="#DC2626">
                          Từ chối
                        </AppText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleApproveOrder(order)}
                        style={{
                          flex: 2,
                          paddingVertical: 11,
                          borderRadius: 10,
                          backgroundColor: colors.primary,
                          alignItems: 'center',
                        }}
                      >
                        <AppText variant="captionSemiBold" color="#FFFFFF">
                          Duyệt nhận đơn
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(order.status === 'CONFIRMED' ||
                    order.status === 'PREPARING' ||
                    order.status === 'READY') && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {order.status !== 'READY' && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleMarkReady(order)}
                          style={{
                            flex: 1,
                            paddingVertical: 11,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceAlt,
                            alignItems: 'center',
                          }}
                        >
                          <AppText variant="captionSemiBold" color={colors.textPrimary}>
                            Món đã xong
                          </AppText>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openDispatchModal(order)}
                        style={{
                          flex: 1.5,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingVertical: 11,
                          borderRadius: 10,
                          backgroundColor: colors.primary,
                        }}
                      >
                        <Truck size={16} color="#FFFFFF" />
                        <AppText variant="captionSemiBold" color="#FFFFFF">
                          Phát cho nhân viên đi giao
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.status === 'OUT_FOR_DELIVERY' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => openDispatchModal(order)}
                        style={{
                          flex: 1,
                          paddingVertical: 11,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceAlt,
                          alignItems: 'center',
                        }}
                      >
                        <AppText variant="captionSemiBold" color={colors.textPrimary}>
                          Đổi người giao
                        </AppText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleCompleteOrder(order)}
                        style={{
                          flex: 1.5,
                          paddingVertical: 11,
                          borderRadius: 10,
                          backgroundColor: '#16A34A',
                          alignItems: 'center',
                        }}
                      >
                        <AppText variant="captionSemiBold" color="#FFFFFF">
                          Xác nhận giao hoàn tất
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* MODAL PHÁT ĐƠN CHO NHÂN VIÊN TRONG QUÁN ĐI GIAO */}
      <Modal
        visible={!!dispatchOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setDispatchOrder(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: '82%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <AppText variant="h3" color={colors.textPrimary}>
                  Phát đơn cho Nhân viên giao
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  Đơn #{dispatchOrder?.orderCode} • {currentStore?.name}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setDispatchOrder(null)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 12 }}>
              Chọn nhân viên trong chi nhánh để đi giao đơn này (ưu tiên nhân viên đang trong ca làm hôm nay - {todayKey}):
            </AppText>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {branchStaffList.length === 0 ? (
                <View
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                  }}
                >
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    Chưa có nhân viên nào thuộc chi nhánh này.
                  </AppText>
                </View>
              ) : (
                branchStaffList.map((staff) => {
                  const isSelected = selectedStaffId === staff.id;
                  const shiftInfo = SHIFT_LABELS[staff.todayShift];
                  return (
                    <TouchableOpacity
                      key={staff.id}
                      activeOpacity={0.75}
                      onPress={() => setSelectedStaffId(staff.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 13,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primarySoft : '#FFFFFF',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <AppText
                          variant="bodySemiBold"
                          color={isSelected ? colors.primary : colors.textPrimary}
                        >
                          {staff.fullname}
                        </AppText>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 3,
                            flexWrap: 'wrap',
                          }}
                        >
                          {!!staff.phone && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Phone size={12} color={colors.textSecondary} />
                              <AppText variant="small" color={colors.textSecondary}>
                                {staff.phone}
                              </AppText>
                            </View>
                          )}
                          <View
                            style={{
                              backgroundColor: shiftInfo.bg,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <AppText variant="small" color={shiftInfo.color}>
                              {shiftInfo.label}
                            </AppText>
                          </View>
                        </View>
                      </View>
                      {isSelected && <Check size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <AppButton
                title="Hủy"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setDispatchOrder(null)}
              />
              <AppButton
                title="Xác nhận phát đơn"
                style={{ flex: 1.5 }}
                isLoading={dispatching}
                onPress={handleConfirmDispatch}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL TỪ CHỐI ĐƠN */}
      <Modal
        visible={!!rejectOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectOrder(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
            }}
          >
            <AppText variant="h3" color={colors.textPrimary} style={{ marginBottom: 6 }}>
              Từ chối đơn #{rejectOrder?.orderCode}
            </AppText>
            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 12 }}>
              Chọn lý do từ chối đơn hàng:
            </AppText>

            {REJECT_REASONS.map((r) => {
              const active = rejectReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRejectReason(r)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    marginBottom: 6,
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <AppText
                    variant="bodyMedium"
                    color={active ? colors.primary : colors.textPrimary}
                  >
                    {r}
                  </AppText>
                  {active && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <AppButton
                title="Đóng"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setRejectOrder(null)}
              />
              <AppButton
                title="Từ chối đơn"
                style={{ flex: 1 }}
                onPress={handleConfirmReject}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
