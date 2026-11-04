import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
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
  ChevronRight,
  ChevronUp,
  Check,
} from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  query,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { rollbackCancelledOrderBenefits } from '../../utils/memberTier';
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
  { key: 'preparing', label: 'Chuẩn bị', Icon: ChefHat },
  { key: 'delivering', label: 'Đang giao', Icon: Truck },
  { key: 'completed', label: 'Đã xong', Icon: CheckCircle2 },
];

const SHIFT_LABELS: Record<ShiftType, { label: string; color: string; bg: string }> = {
  MORNING: { label: 'Ca Sáng (08:00 - 14:00)', color: colors.primary, bg: colors.primarySoft },
  EVENING: { label: 'Ca Tối (14:00 - 22:00)', color: colors.primary, bg: colors.primarySoft },
  FULL: { label: 'Full ca (08:00 - 22:00)', color: colors.primary, bg: colors.primarySoft },
  OFF: { label: 'Nghỉ hôm nay', color: colors.textSecondary, bg: colors.surfaceAlt },
};

const REJECT_REASONS = [
  'Hết nguyên liệu làm bánh',
  'Ngoài vùng giao hàng của chi nhánh',
  'Chi nhánh đang quá tải đơn',
  'Không liên lạc được với khách hàng',
  'Khách yêu cầu hủy đơn',
];

const PICKUP_INCIDENT_REASONS = [
  'Khách hàng không đến nhận bánh',
  'Gọi điện khách không nghe máy',
];

function getReasonsForOrder(order: Record<string, any> | null): string[] {
  if (!order) return REJECT_REASONS;
  if (order.status === 'PENDING' || order.status === 'PENDING_CONFIRMATION') {
    return REJECT_REASONS;
  }
  return PICKUP_INCIDENT_REASONS;
}

const DAY_KEYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * Kiểm tra nhân viên đang trong ca làm việc:
 * - Ca Sáng (08:00 - 14:00): nhận đơn từ 08:00 đến 14:00
 * - Ca Tối (14:00 - 22:00): nhận đơn từ 14:00 đến 22:30 (xử lý trọn các đơn khách đặt trước 22:00)
 * - Full ca (08:00 - 22:00): nhận đơn từ 08:00 đến 22:30
 * - Nghỉ (OFF): không nhận đơn
 */
function isStaffEligibleForDispatch(shift: ShiftType, now: Date): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (shift === 'MORNING') {
    return mins >= 8 * 60 && mins < 14 * 60;
  }
  if (shift === 'EVENING') {
    return mins >= 14 * 60 && mins <= 22 * 60 + 30;
  }
  if (shift === 'FULL') {
    return mins >= 8 * 60 && mins <= 22 * 60 + 30;
  }
  return false;
}

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

  // Modal xem chi tiết đơn hàng khi bấm vào card
  const [selectedDetailOrderId, setSelectedDetailOrderId] = useState<string | null>(null);

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
          const d = docSnap.data();
          if (String(d?.orderCode || '').toUpperCase() === 'PF-X469QK') {
            void deleteDoc(doc(db, 'orders', docSnap.id)).catch(() => { });
            return;
          }
          list.push({ id: docSnap.id, ...d });
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
      () => { }
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

  const combinedUsers = (() => {
    const byId = new Map<string, Record<string, any>>();
    rawUsers.forEach((u) => byId.set(String(u.id), u));
    Object.entries(staffMap).forEach(([uid, m]) => {
      if (!m || m.deleted || byId.has(uid)) return;
      byId.set(uid, {
        id: uid,
        fullName: m.fullName || 'Nhân viên',
        email: m.email || '',
        phone: m.phone || '',
        role: m.role || 'EMPLOYEE',
        storeId: m.storeId || undefined,
        storeName: m.storeName || undefined,
      });
    });
    return Array.from(byId.values());
  })();

  // Danh sách nhân viên thuộc chi nhánh này
  const allBranchStaffToday: BranchStaffMember[] = combinedUsers
    .filter((u) => {
      const custom = staffMap[u.id];
      const effRole = custom?.role || u.role;
      if (custom?.deleted || effRole === 'BLACKLISTED' || effRole === 'ROLE_RIDER') return false;
      const isStaff = effRole === 'EMPLOYEE' || effRole === 'ROLE_KITCHEN';
      if (!isStaff) return false;
      const uStoreId = custom?.storeId !== undefined ? custom.storeId : u.storeId;
      const uStoreName = custom?.storeName || u.storeName || '';
      if (currentStore) {
        if (uStoreId && uStoreId === currentStore.id) return true;
        if (uStoreName && uStoreName === currentStore.name) return true;
        if (uStoreId || uStoreName) return false;
      }
      // Nếu nhân viên chưa gắn storeId cụ thể thì vẫn hiển thị để Manager có thể chọn
      return true;
    })
    .map((u) => {
      const custom = staffMap[u.id];
      const todayShift: ShiftType = getStaffShiftOnDate(schedulesMap[u.id], new Date());
      return {
        id: u.id,
        fullname: String(custom?.fullName || u.fullName || u.fullname || u.name || 'Nhân viên'),
        email: String(u.email || custom?.email || ''),
        phone: String(custom?.phone || u.phone || ''),
        todayShift,
      };
    });

  // Ưu tiên nhân viên đúng khung giờ ca hiện tại; nếu ngoài giờ nhưng còn đơn tồn thì hiển thị các nhân viên có ca làm việc hôm nay (khác OFF)
  const branchStaffList: BranchStaffMember[] = (() => {
    const nowTime = new Date();
    const inCurrentShift = allBranchStaffToday.filter((s) =>
      isStaffEligibleForDispatch(s.todayShift, nowTime)
    );
    if (inCurrentShift.length > 0) return inCurrentShift;
    return allBranchStaffToday.filter((s) => s.todayShift !== 'OFF');
  })();

  // Lọc đơn hàng của chi nhánh
  const branchOrders = rawOrders
    .filter(
      (raw) =>
        String(raw.orderCode || '').toUpperCase() !== 'PF-X469QK' &&
        (currentStore ? doesOrderBelongToStore(raw, currentStore, storesList) : true)
    )
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
      const deliveryNote = String(raw.deliveryNote || raw.note || '').trim();
      const total = Number(raw.totalAmount || raw.total || 0);
      const items = Array.isArray(raw.items) ? raw.items : [];
      const assignedStaffId = override?.assignedStaffId ?? raw.assignedStaffId ?? '';
      const assignedStaffName = override?.assignedStaffName ?? raw.assignedStaffName ?? '';
      const assignedStaffPhone = override?.assignedStaffPhone ?? raw.assignedStaffPhone ?? '';
      const cancelReason = override?.cancelReason ?? raw.cancelReason ?? '';
      const deliveryProofImage = override?.deliveryProofImage ?? raw.deliveryProofImage ?? '';
      const createdAtMs =
        typeof raw.createdAt?.toMillis === 'function'
          ? raw.createdAt.toMillis()
          : typeof raw.createdAt?.seconds === 'number'
            ? raw.createdAt.seconds * 1000
            : Date.parse(raw.createdAt) || 0;

      const isPickup =
        raw.fulfillmentType === 'takeaway' || raw.fulfillmentType === 'PICKUP';

      return {
        ...(raw as any),
        id: String(raw.id),
        status,
        isPickup,
        orderCode,
        customerName,
        customerPhone,
        address,
        deliveryNote,
        total,
        items,
        assignedStaffId,
        assignedStaffName,
        assignedStaffPhone,
        cancelReason,
        deliveryProofImage,
        createdAtMs,
      };
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  const now = new Date();
  const startOfTodayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const isOrderToday = (o: { createdAtMs: number }) =>
    !o.createdAtMs || o.createdAtMs >= startOfTodayMs;

  const counts = {
    pending: branchOrders.filter(
      (o) => o.status === 'PENDING' || o.status === 'PENDING_CONFIRMATION'
    ).length,
    preparing: branchOrders.filter(
      (o) =>
        o.status === 'CONFIRMED' ||
        o.status === 'PREPARING' ||
        (o.status === 'READY' && !o.assignedStaffId)
    ).length,
    delivering: branchOrders.filter(
      (o) =>
        o.status === 'OUT_FOR_DELIVERY' ||
        (o.status === 'READY' && !!o.assignedStaffId)
    ).length,
    completed: branchOrders.filter(
      (o) =>
        (o.status === 'COMPLETED' ||
          o.status === 'DELIVERED' ||
          o.status === 'CANCELLED' ||
          o.status === 'REJECTED') &&
        isOrderToday(o)
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
      return (
        o.status === 'CONFIRMED' ||
        o.status === 'PREPARING' ||
        (o.status === 'READY' && !o.assignedStaffId)
      );
    }
    if (activeTab === 'delivering') {
      return (
        o.status === 'OUT_FOR_DELIVERY' ||
        (o.status === 'READY' && !!o.assignedStaffId)
      );
    }
    return (
      (o.status === 'COMPLETED' ||
        o.status === 'DELIVERED' ||
        o.status === 'CANCELLED' ||
        o.status === 'REJECTED') &&
      isOrderToday(o)
    );
  });

  const handleApproveOrder = async (order: Record<string, any>) => {
    setSelectedDetailOrderId(null);
    const nowIso = new Date().toISOString();
    await saveOrderOverride(order.id, { status: 'PREPARING' });
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'PREPARING',
      statusHistory: arrayUnion({
        status: 'PREPARING',
        at: nowIso,
        note: 'Quản lý chi nhánh đã duyệt đơn và chuyển xuống bếp chuẩn bị',
      }),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    showToast({
      message: `Đã nhận đơn #${order.orderCode} chuyển xuống bếp chuẩn bị!`,
      type: 'success',
    });
  };

  const handleMarkReady = async (order: Record<string, any>) => {
    const nowIso = new Date().toISOString();
    await saveOrderOverride(order.id, { status: 'READY' });
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'READY',
      statusHistory: arrayUnion({
        status: 'READY',
        at: nowIso,
        note: order.isPickup
          ? 'Món ăn đã chuẩn bị xong, sẵn sàng giao tại quầy'
          : 'Món ăn đã chuẩn bị xong, sẵn sàng phát cho nhân viên đi giao',
      }),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    showToast({
      message: order.isPickup
        ? `Đơn #${order.orderCode} đã làm xong, sẵn sàng giao cho khách tại quầy!`
        : `Đơn #${order.orderCode} đã làm xong, sẵn sàng phát cho nhân viên đi giao!`,
      type: 'success',
    });
  };

  const handleCompletePickupOrder = async (order: Record<string, any>) => {
    if (order.status !== 'READY') {
      showToast({
        message: 'Vui lòng bấm "Món đã xong" xác nhận bếp đã chuẩn bị xong trước khi hoàn tất đơn!',
        type: 'error',
      });
      return;
    }
    setSelectedDetailOrderId(null);
    const nowIso = new Date().toISOString();
    await saveOrderOverride(order.id, {
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      deliveredAt: nowIso,
    });
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      deliveredAt: nowIso,
      statusHistory: arrayUnion({
        status: 'COMPLETED',
        at: nowIso,
        note: 'Khách hàng đã nhận bánh tại cửa hàng',
      }),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    // Cộng điểm tích lũy cho khách hàng khi đơn hoàn tất
    const customerUid = String(order.userId || '');
    const pts =
      typeof order.earnedPoints === 'number'
        ? order.earnedPoints
        : Math.floor(Number(order.total || 0) / 10000);
    if (customerUid && pts > 0) {
      await updateDoc(doc(db, 'users', customerUid), {
        rewardPoints: increment(pts),
      }).catch(() => {});
    }

    showToast({
      message: `Khách đã nhận đơn #${order.orderCode} tại cửa hàng — Hoàn tất đơn!`,
      type: 'success',
    });
  };

  const openDispatchModal = (order: Record<string, any>) => {
    if (order.status === 'OUT_FOR_DELIVERY') {
      showToast({
        message: 'Nhân viên đã nhận bánh và đang trên đường giao, không thể đổi người giao!',
        type: 'error',
      });
      return;
    }
    if (order.status !== 'READY') {
      showToast({
        message: 'Vui lòng bấm "Món đã xong" xác nhận bếp đã chuẩn bị xong trước khi phát đơn đi giao!',
        type: 'error',
      });
      return;
    }
    setDispatchOrder(order);
    const defaultStaff =
      (order.assignedStaffId && branchStaffList.some((s) => s.id === order.assignedStaffId)
        ? order.assignedStaffId
        : '') ||
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
    const targetOrder = dispatchOrder;
    setDispatching(true);
    try {
      setDispatchOrder(null);
      setSelectedDetailOrderId(null);
      await saveOrderOverride(targetOrder.id, {
        status: 'READY',
        assignedStaffId: chosenStaff.id,
        assignedStaffName: chosenStaff.fullname,
        assignedStaffPhone: chosenStaff.phone,
      });
      await updateDoc(doc(db, 'orders', targetOrder.id), {
        status: 'READY',
        assignedStaffId: chosenStaff.id,
        assignedStaffName: chosenStaff.fullname,
        assignedStaffPhone: chosenStaff.phone,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      showToast({
        message: `Đã phân công đơn #${targetOrder.orderCode} cho ${chosenStaff.fullname} — Chờ nhân viên xác nhận bắt đầu giao!`,
        type: 'success',
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectOrder) return;
    const targetOrder = rejectOrder;
    const nowIso = new Date().toISOString();
    setRejectOrder(null);
    setSelectedDetailOrderId(null);
    await saveOrderOverride(targetOrder.id, {
      status: 'CANCELLED',
      cancelReason: rejectReason,
      incidentResolved: false,
      incidentReportedBy: `Quản lý (${currentStore?.name || 'Chi nhánh'})`,
    });
    await updateDoc(doc(db, 'orders', targetOrder.id), {
      status: 'CANCELLED',
      cancelReason: rejectReason,
      statusHistory: arrayUnion({
        status: 'CANCELLED',
        at: nowIso,
        note: `${rejectReason} (Xác nhận bởi Quản lý ${currentStore?.name || 'Chi nhánh'})`,
      }),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    // Chỉ hoàn lại Quà của tôi / Điểm đổi quà / Voucher khi đơn bị từ chối ở bước Chờ duyệt (bếp chưa làm bánh)
    if (targetOrder.status === 'PENDING' || targetOrder.status === 'PENDING_CONFIRMATION') {
      await rollbackCancelledOrderBenefits(targetOrder);
    }
    showToast({
      message: `Đã ghi nhận hủy / sự cố đơn #${targetOrder.orderCode} và báo về Admin!`,
      type: 'info',
    });
  };

  const getStatusBadgeInfo = (status: string, assignedStaffId?: string) => {
    switch (status) {
      case 'PENDING':
      case 'PENDING_CONFIRMATION':
        return { label: 'Chờ duyệt', color: colors.primary, bg: colors.primarySoft };
      case 'CONFIRMED':
      case 'PREPARING':
        return { label: 'Đang làm món', color: colors.primary, bg: colors.primarySoft };
      case 'READY':
        if (assignedStaffId) {
          return { label: 'Chờ NV nhận giao', color: colors.primary, bg: colors.primarySoft };
        }
        return { label: 'Chờ phát giao', color: colors.primary, bg: colors.primarySoft };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Đang đi giao', color: colors.primary, bg: colors.primarySoft };
      case 'COMPLETED':
      case 'DELIVERED':
        return { label: 'Giao hoàn tất', color: colors.textPrimary, bg: colors.surfaceAlt };
      default:
        return { label: 'Đã hủy', color: colors.textSecondary, bg: colors.surfaceAlt };
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

        {/* 4 Tab trạng thái đơn (Hiển thị đủ cả 4 ô trên cùng 1 hàng, không bị khuất) */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
          {ORDER_TABS.map((t) => {
            const active = activeTab === t.key;
            const count = counts[t.key];
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.75}
                onPress={() => setActiveTab(t.key)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primary : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <AppText
                  variant="small"
                  color={active ? '#FFFFFF' : colors.textSecondary}
                  numberOfLines={1}
                  style={{ fontWeight: '700', fontSize: 11.5 }}
                >
                  {t.label} ({count})
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>
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
              const badge = getStatusBadgeInfo(order.status, order.assignedStaffId);
              return (
                <TouchableOpacity
                  key={order.id}
                  activeOpacity={0.82}
                  onPress={() => setSelectedDetailOrderId(order.id)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {/* Dòng 1: Mã đơn + Trạng thái */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AppText variant="cardTitle" color={colors.textPrimary}>
                        Đơn #{order.orderCode}
                      </AppText>
                      {!!order.createdAtMs && (
                        <AppText variant="small" color={colors.textSecondary}>
                          •{' '}
                          {new Date(order.createdAtMs).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </AppText>
                      )}
                    </View>
                    <View
                      style={{
                        backgroundColor: badge.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <AppText variant="small" color={badge.color} style={{ fontWeight: '700' }}>
                        {badge.label}
                      </AppText>
                    </View>
                  </View>

                  {/* Dòng 2: Khách hàng + SĐT */}
                  <AppText variant="bodySemiBold" color={colors.textPrimary} numberOfLines={1}>
                    {order.customerName}
                    {order.customerPhone ? ` • ${order.customerPhone}` : ''}
                  </AppText>

                  {/* Dòng 3: Địa chỉ ngắn gọn */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 4,
                    }}
                  >
                    <MapPin size={14} color={colors.primary} />
                    <AppText
                      variant="small"
                      color={colors.textSecondary}
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {order.isPickup ? 'Nhận tại cửa hàng • ' : ''}
                      {order.address}
                    </AppText>
                  </View>

                  {/* Dòng 4: Số món + Tổng tiền + Xem chi tiết */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AppText variant="small" color={colors.textSecondary}>
                        {order.items.length} món •
                      </AppText>
                      <AppText variant="bodySemiBold" color={colors.primary}>
                        {formatCurrency(order.total)}
                      </AppText>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <AppText variant="captionSemiBold" color={colors.primary}>
                        Xem chi tiết
                      </AppText>
                      <ChevronRight size={15} color={colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* MODAL CHI TIẾT ĐƠN HÀNG & NÚT THAO TÁC CỦA QUẢN LÝ */}
      <Modal
        visible={
          !!selectedDetailOrderId &&
          !dispatchOrder &&
          !rejectOrder &&
          branchOrders.some((o) => o.id === selectedDetailOrderId)
        }
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDetailOrderId(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          {(() => {
            const order = branchOrders.find((o) => o.id === selectedDetailOrderId);
            if (!order) return null;
            const badge = getStatusBadgeInfo(order.status, order.assignedStaffId);
            return (
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
                        Đơn #{order.orderCode}
                      </AppText>
                      <View
                        style={{
                          backgroundColor: badge.bg,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <AppText variant="small" color={badge.color} style={{ fontWeight: '700' }}>
                          {badge.label}
                        </AppText>
                      </View>
                    </View>
                    <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                      {order.customerName}
                      {order.customerPhone ? ` • ${order.customerPhone}` : ''}
                    </AppText>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedDetailOrderId(null)}>
                    <X size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {/* Địa chỉ giao + Ghi chú */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 8,
                      backgroundColor: colors.surface,
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 10,
                    }}
                  >
                    <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <AppText
                        variant="captionSemiBold"
                        color={colors.primary}
                      >
                        {order.isPickup ? 'Nhận tại cửa hàng (Mua mang về)' : 'Giao hàng tận nơi'}
                      </AppText>
                      <AppText variant="small" color={colors.textPrimary} style={{ marginTop: 2 }}>
                        {order.address}
                      </AppText>
                      {!!order.deliveryNote && (
                        <AppText
                          variant="small"
                          color={colors.primary}
                          style={{ fontWeight: '700', marginTop: 5 }}
                        >
                          Ghi chú giao nhận: {order.deliveryNote}
                        </AppText>
                      )}
                    </View>
                  </View>

                  {/* Danh sách món */}
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
                      Danh sách món ({order.items.length} món)
                    </AppText>
                    {order.items.map((it: any, idx: number) => {
                      const isPizzaItem =
                        String(it.productId || '').startsWith('PZ_') ||
                        String(it.productName || it.name || '')
                          .toLowerCase()
                          .includes('pizza') ||
                        (Array.isArray(it.customizationSummary) &&
                          it.customizationSummary.length > 0);
                      const cleanVariantName =
                        !isPizzaItem && it.variantName === 'Đế Truyền Thống'
                          ? ''
                          : it.variantName;
                      const optionText = [
                        cleanVariantName,
                        ...(it.addonNames ?? []),
                        ...(Array.isArray(it.customizationSummary)
                          ? it.customizationSummary
                          : [it.customizationSummary]),
                      ]
                        .filter(Boolean)
                        .filter((val, i, arr) => arr.indexOf(val) === i)
                        .join(' • ');
                      const itemNote = String(
                        it.note ||
                        it.specialInstructions ||
                        it.customization?.specialInstructions ||
                        ''
                      ).trim();
                      return (
                        <View
                          key={idx}
                          style={{
                            paddingVertical: 6,
                            borderTopWidth: idx > 0 ? 1 : 0,
                            borderTopColor: '#F3F4F6',
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                            }}
                          >
                            <AppText
                              variant="small"
                              color={colors.textPrimary}
                              style={{ flex: 1, fontWeight: '600', paddingRight: 8 }}
                            >
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
                          {!!optionText && (
                            <AppText
                              variant="small"
                              color={colors.textSecondary}
                              style={{ marginTop: 2 }}
                            >
                              {optionText}
                            </AppText>
                          )}
                          {!!itemNote && (
                            <AppText
                              variant="small"
                              color={colors.primary}
                              style={{ fontWeight: '700', marginTop: 2 }}
                            >
                              Ghi chú: {itemNote}
                            </AppText>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Nhân viên giao */}
                  {!!order.assignedStaffName && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: colors.primarySoft,
                        borderWidth: 1,
                        borderColor: '#FECACA',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <UserCheck size={16} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="captionSemiBold" color={colors.textPrimary}>
                            Nhân viên giao: {order.assignedStaffName}
                          </AppText>
                          {!!order.assignedStaffPhone && (
                            <AppText variant="small" color={colors.textSecondary}>
                              SĐT: {order.assignedStaffPhone}
                            </AppText>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Chi tiết tiền & Tổng thanh toán */}
                  {(() => {
                    const itemsSum = order.items.reduce(
                      (sum: number, it: any) =>
                        sum +
                        Number(
                          it.lineTotal || (it.unitPrice || it.price || 0) * (it.quantity || 1)
                        ),
                      0
                    );
                    const orderSubtotal = Number(order.subtotal || itemsSum);
                    const orderDeliveryFee = Number(order.deliveryFee || 0);
                    const orderDiscount = Number(order.discount || 0);
                    const orderMemberDiscount = Number(order.memberDiscount || 0);
                    const orderVoucherCode = String(order.voucherCode || order.promoCode || '').trim();

                    return (
                      <View style={{ marginBottom: 8 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 4,
                          }}
                        >
                          <AppText variant="small" color={colors.textSecondary}>
                            Tạm tính
                          </AppText>
                          <AppText variant="small" color={colors.textPrimary}>
                            {formatCurrency(orderSubtotal)}
                          </AppText>
                        </View>

                        {!order.isPickup && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <AppText variant="small" color={colors.textSecondary}>
                              Phí giao hàng
                            </AppText>
                            <AppText variant="small" color={colors.textPrimary}>
                              {orderDeliveryFee === 0
                                ? 'Miễn phí'
                                : formatCurrency(orderDeliveryFee)}
                            </AppText>
                          </View>
                        )}

                        {orderMemberDiscount > 0 && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <AppText variant="small" color={colors.primary}>
                              Giảm giá thành viên
                            </AppText>
                            <AppText variant="small" color={colors.primary} style={{ fontWeight: '600' }}>
                              -{formatCurrency(orderMemberDiscount)}
                            </AppText>
                          </View>
                        )}

                        {orderDiscount > 0 && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <AppText variant="small" color={colors.primary}>
                              Giảm giá{orderVoucherCode ? ` (${orderVoucherCode})` : ''}
                            </AppText>
                            <AppText variant="small" color={colors.primary} style={{ fontWeight: '600' }}>
                              -{formatCurrency(orderDiscount)}
                            </AppText>
                          </View>
                        )}

                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 6,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: '#F3F4F6',
                          }}
                        >
                          <AppText variant="bodySemiBold" color={colors.textSecondary}>
                            Tổng thanh toán
                          </AppText>
                          <AppText variant="price" color={colors.primary}>
                            {formatCurrency(order.total)}
                          </AppText>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Ảnh xác nhận giao hàng */}
                  {!!order.deliveryProofImage && (
                    <View
                      style={{
                        marginTop: 6,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <AppText variant="captionSemiBold" color={colors.textPrimary} style={{ marginBottom: 6 }}>
                        Ảnh xác nhận khách đã nhận hàng:
                      </AppText>
                      <Image
                        source={{ uri: order.deliveryProofImage }}
                        style={{
                          width: '100%',
                          height: 160,
                          borderRadius: 8,
                          backgroundColor: '#E5E7EB',
                        }}
                        resizeMode="cover"
                      />
                    </View>
                  )}
                </ScrollView>

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
                        paddingVertical: 12,
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
                        paddingVertical: 12,
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
                  (order.status === 'READY' && !order.assignedStaffId)) && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {order.status !== 'READY' && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleMarkReady(order)}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
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

                      {order.isPickup && order.status === 'READY' && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => {
                            const reasons = getReasonsForOrder(order);
                            setRejectOrder(order);
                            setRejectReason(reasons[0]);
                          }}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#FECACA',
                            backgroundColor: '#FEF2F2',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AppText variant="captionSemiBold" color="#DC2626">
                            Báo cáo sự cố
                          </AppText>
                        </TouchableOpacity>
                      )}

                      {order.isPickup ? (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            void handleCompletePickupOrder(order);
                            if (order.status === 'READY') {
                              setSelectedDetailOrderId(null);
                            }
                          }}
                          style={{
                            flex: 1.5,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 12,
                            borderRadius: 10,
                            backgroundColor: colors.primary,
                            opacity: order.status === 'READY' ? 1 : 0.6,
                          }}
                        >
                          <CheckCircle2 size={16} color="#FFFFFF" />
                          <AppText variant="captionSemiBold" color="#FFFFFF">
                            Khách đã nhận món
                          </AppText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => openDispatchModal(order)}
                          style={{
                            flex: 1.5,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 12,
                            borderRadius: 10,
                            backgroundColor: colors.primary,
                            opacity: order.status === 'READY' ? 1 : 0.6,
                          }}
                        >
                          <Truck size={16} color="#FFFFFF" />
                          <AppText variant="captionSemiBold" color="#FFFFFF">
                            Phát cho nhân viên đi giao
                          </AppText>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                {order.status === 'READY' && !!order.assignedStaffId && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => openDispatchModal(order)}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      backgroundColor: colors.primarySoft,
                      alignItems: 'center',
                    }}
                  >
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      Đổi người giao
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>
      </Modal>

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
              maxHeight: '85%',
              width: '100%',
              maxWidth: 430,
              alignSelf: 'center',
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
              Chọn nhân viên đang trong ca làm việc để đi giao đơn này ({todayKey}):
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
                  <AppText variant="bodyMedium" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                    Hiện chưa có nhân viên nào đang trong ca nhận đơn.
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
              width: '100%',
              maxWidth: 410,
              alignSelf: 'center',
            }}
          >
            <AppText variant="h3" color={colors.textPrimary} style={{ marginBottom: 6 }}>
              {rejectOrder?.status === 'PENDING' || rejectOrder?.status === 'PENDING_CONFIRMATION'
                ? `Từ chối đơn #${rejectOrder?.orderCode}`
                : `Báo cáo sự cố #${rejectOrder?.orderCode}`}
            </AppText>
            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 12 }}>
              Chọn lý do (đơn sẽ không tính vào doanh thu và gửi báo cáo về Admin):
            </AppText>

            {getReasonsForOrder(rejectOrder).map((r) => {
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
                    style={{ flex: 1, paddingRight: 8 }}
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
                title={
                  rejectOrder?.status === 'PENDING' || rejectOrder?.status === 'PENDING_CONFIRMATION'
                    ? 'Xác nhận từ chối'
                    : 'Gửi báo cáo'
                }
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
