import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Clock,
  Phone,
  MapPin,
  Check,
  X,
  Search,
  Store,
  ChefHat,
  CheckCircle2,
  LogOut,
  Bike,
  User as UserIcon,
  Mail,
  BadgeCheck,
  Banknote,
  AlertCircle,
} from 'lucide-react-native';
import { db } from '../../services/firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/staffPortal.styles';
import { Chip } from '../../components/ui/Chip';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AppButton } from '../../components/ui/AppButton';

// Các lý do từ chối mẫu theo chuẩn F&B
const REJECT_REASONS = [
  'Hết nguyên liệu làm bánh',
  'Địa chỉ nằm ngoài bán kính giao hàng của quán',
  'Nhà bếp đang quá tải, không kịp phục vụ',
  'Không thể liên lạc được với khách hàng qua SĐT',
  'Khách hàng gọi điện yêu cầu hủy đơn',
  'Lý do khác (Nhập chi tiết bên dưới)',
];

// Thời gian dự kiến nấu mẫu
const PREP_TIME_OPTIONS = [
  { label: '15 phút', value: '15 phút' },
  { label: '20 phút', value: '20 phút' },
  { label: '30 phút', value: '30 phút' },
  { label: '45 phút', value: '45 phút' },
];

// Các nhóm đơn trong Tab 2 (Bếp & Giao nhận)
const KITCHEN_SECTIONS: { status: string; title: string; hint: string; color: string }[] = [
  { status: 'CONFIRMED', title: 'Chờ nấu', hint: 'Đã xác nhận, chờ bếp nhận đơn', color: colors.primary },
  { status: 'PREPARING', title: 'Đang nấu', hint: 'Nướng bánh & kiểm tra chất lượng', color: colors.warning },
  { status: 'READY', title: 'Sẵn sàng', hint: 'Đóng hộp, chờ giao shipper / khách', color: colors.success },
  { status: 'OUT_FOR_DELIVERY', title: 'Đang giao', hint: 'Shipper đang trên đường', color: colors.primary },
];

// Nhãn hiển thị vai trò trong hồ sơ nhân viên
const STAFF_ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Nhân viên cửa hàng',
  STORE_MANAGER: 'Quản lý cửa hàng',
  SUPER_ADMIN: 'Quản trị viên',
};

export default function StaffOrdersScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  // Active Segment Tab: 1 = Chờ duyệt, 2 = Bếp & Giao, 3 = Đã xong (Lịch sử)
  const [activeTab, setActiveTab] = useState<'pending' | 'kitchen' | 'completed'>('pending');

  // Hồ sơ nhân viên
  const [profileVisible, setProfileVisible] = useState(false);

  // Modal Đăng xuất
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Trạng thái ca trực của quán: Đang nhận đơn hay Tạm dừng
  const [isAcceptingOrders, setIsAcceptingOrders] = useState(true);

  // Dữ liệu đơn hàng Firestore
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bộ lọc trong Tab 1
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'ALL' | 'DELIVERY' | 'PICKUP'>('ALL');

  // Modal Từ chối đơn
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedOrderForReject, setSelectedOrderForReject] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Modal Xác nhận đơn & Chọn giờ dự kiến
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [selectedOrderForAccept, setSelectedOrderForAccept] = useState<any | null>(null);
  const [selectedPrepTime, setSelectedPrepTime] = useState(PREP_TIME_OPTIONS[1].value); // Mặc định 20p
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  // Theo dõi số lượng đơn chờ trước đó để rung/thông báo khi có đơn mới
  const prevPendingCount = useRef<number>(0);

  // 1. KẾT NỐI REAL-TIME VỚI FIRESTORE (onSnapshot)
  useEffect(() => {
    setIsLoading(true);
    const ordersCol = collection(db, 'orders');

    // Lắng nghe tất cả đơn hàng thời gian thực
    const unsubscribe = onSnapshot(
      ordersCol,
      (snapshot) => {
        const ordersList: any[] = [];
        snapshot.forEach((docSnap) => {
          ordersList.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sắp xếp đơn mới nhất lên đầu
        ordersList.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return timeB - timeA;
        });

        // Đếm số lượng đơn chờ duyệt
        const currentPendingCount = ordersList.filter(
          (o) => o.status === 'PENDING_CONFIRMATION'
        ).length;

        // Nếu có đơn mới vừa vào ca trực, rung phản hồi xúc giác
        if (currentPendingCount > prevPendingCount.current && prevPendingCount.current > 0) {
          triggerHaptic('success');
          showToast({
            message: 'Có đơn hàng mới vừa đặt! Vui lòng kiểm tra và duyệt đơn.',
            type: 'info',
          });
        }
        prevPendingCount.current = currentPendingCount;

        setAllOrders(ordersList);
        setIsLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('[Staff Orders] Lỗi lắng nghe Firestore:', error);
        setIsLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // Phân nhóm đơn theo 3 Tab
  const pendingOrders = useMemo(
    () => allOrders.filter((o) => o.status === 'PENDING_CONFIRMATION'),
    [allOrders]
  );

  const kitchenOrders = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.status === 'CONFIRMED' ||
          o.status === 'PREPARING' ||
          o.status === 'READY' ||
          o.status === 'OUT_FOR_DELIVERY'
      ),
    [allOrders]
  );

  const completedOrders = useMemo(
    () =>
      allOrders.filter(
        (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
      ),
    [allOrders]
  );

  // Lọc danh sách Tab 1 (Chờ duyệt) theo từ khóa và loại hình
  const filteredPendingOrders = useMemo(() => {
    return pendingOrders.filter((order) => {
      // Lọc theo hình thức giao/nhận
      if (fulfillmentFilter !== 'ALL' && order.fulfillmentType !== fulfillmentFilter) {
        return false;
      }

      // Lọc theo từ khóa tìm kiếm (Mã đơn, Tên khách, SĐT)
      if (searchQuery.trim()) {
        const queryClean = searchQuery.trim().toLowerCase();
        const code = (order.orderCode || '').toLowerCase();
        const name = (order.customer?.fullname || '').toLowerCase();
        const phone = (order.customer?.phone || '').toLowerCase();

        return (
          code.includes(queryClean) ||
          name.includes(queryClean) ||
          phone.includes(queryClean)
        );
      }

      return true;
    });
  }, [pendingOrders, fulfillmentFilter, searchQuery]);

  // Tính thời gian chờ (phút) từ lúc tạo đơn
  const getElapsedMinutes = (order: any): number => {
    if (!order.createdAt?.seconds) return 0;
    const orderTime = order.createdAt.seconds * 1000;
    const now = Date.now();
    return Math.max(0, Math.floor((now - orderTime) / (1000 * 60)));
  };

  // Mở trình gọi điện thoại thoại cho khách
  const handleCallCustomer = (phone?: string) => {
    if (!phone) {
      Alert.alert('Không có SĐT', 'Đơn hàng này không có số điện thoại khách.');
      return;
    }
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  // Mở modal xác nhận duyệt đơn
  const handleOpenAcceptModal = (order: any) => {
    setSelectedOrderForAccept(order);
    setSelectedPrepTime(PREP_TIME_OPTIONS[1].value);
    setAcceptModalVisible(true);
  };

  // Thực hiện XÁC NHẬN ĐƠN (Chuyển sang CONFIRMED)
  const handleConfirmAccept = async () => {
    if (!selectedOrderForAccept) return;
    setIsSubmittingAccept(true);

    try {
      const orderRef = doc(db, 'orders', selectedOrderForAccept.id);
      const nowISO = new Date().toISOString();
      const staffName = user?.fullname || 'Nhân viên';

      await updateDoc(orderRef, {
        status: 'CONFIRMED',
        confirmedAt: serverTimestamp(),
        confirmedBy: staffName,
        estimatedPrepTime: selectedPrepTime,
        statusHistory: arrayUnion({
          status: 'CONFIRMED',
          at: nowISO,
          note: `Nhân viên ${staffName} đã xác nhận đơn. Thời gian chuẩn bị dự kiến: ${selectedPrepTime}.`,
        }),
      });

      triggerHaptic('success');
      showToast({
        message: `Đã xác nhận đơn #${selectedOrderForAccept.orderCode || ''} thành công!`,
        type: 'success',
      });
      setAcceptModalVisible(false);
      setSelectedOrderForAccept(null);
    } catch (err: any) {
      console.error('Lỗi khi duyệt đơn:', err);
      Alert.alert('Lỗi duyệt đơn', err.message || 'Không thể cập nhật trạng thái đơn.');
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  // Mở modal từ chối đơn
  const handleOpenRejectModal = (order: any) => {
    setSelectedOrderForReject(order);
    setSelectedReason(REJECT_REASONS[0]);
    setCustomReason('');
    setRejectModalVisible(true);
  };

  // Thực hiện TỪ CHỐI ĐƠN (Chuyển sang CANCELLED)
  const handleConfirmReject = async () => {
    if (!selectedOrderForReject) return;

    const finalReason =
      selectedReason === 'Lý do khác (Nhập chi tiết bên dưới)'
        ? customReason.trim() || 'Lý do vận hành từ cửa hàng'
        : selectedReason;

    setIsSubmittingReject(true);

    try {
      const orderRef = doc(db, 'orders', selectedOrderForReject.id);
      const nowISO = new Date().toISOString();
      const staffName = user?.fullname || 'Nhân viên';

      await updateDoc(orderRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledBy: staffName,
        cancelReason: finalReason,
        statusHistory: arrayUnion({
          status: 'CANCELLED',
          at: nowISO,
          note: `Đơn bị từ chối bởi ${staffName}. Lý do: ${finalReason}.`,
        }),
      });

      triggerHaptic('warning');
      showToast({
        message: `Đã từ chối đơn #${selectedOrderForReject.orderCode || ''}.`,
        type: 'info',
      });
      setRejectModalVisible(false);
      setSelectedOrderForReject(null);
    } catch (err: any) {
      console.error('Lỗi khi từ chối đơn:', err);
      Alert.alert('Lỗi hủy đơn', err.message || 'Không thể cập nhật trạng thái đơn.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // ==========================================================
  // TAB 2: BẾP & GIAO NHẬN
  // ==========================================================
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [kitchenFilter, setKitchenFilter] = useState<string>('ALL');

  const visibleKitchenOrders = kitchenOrders.filter(
    (o) => kitchenFilter === 'ALL' || o.status === kitchenFilter
  );

  // Vị trí của đơn trên thanh tiến trình (đơn lấy tại quầy không có bước "Đang giao")
  const getKitchenStepIndex = (order: any): number => {
    const isPickup = order.fulfillmentType === 'PICKUP';
    const order_ = isPickup
      ? ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']
      : ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
    return Math.max(0, order_.indexOf(order.status));
  };

  // Số phút đơn đã nằm ở bước hiện tại (tính từ mốc statusHistory gần nhất)
  const getMinutesInStage = (order: any): number => {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const last = history[history.length - 1]?.at;
    const t = last ? new Date(last).getTime() : (order.createdAt?.seconds || 0) * 1000;
    if (!t) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  };


  // Nút hành động tiếp theo cho từng trạng thái trong vòng đời bếp
  const getKitchenAction = (order: any): { label: string; next: string; note: string; hint: string } | null => {
    switch (order.status) {
      case 'CONFIRMED':
        return { label: 'Bắt đầu nấu', next: 'PREPARING', note: 'Bếp đã nhận đơn và bắt đầu chế biến.', hint: 'Nhận đơn và bắt đầu làm bánh' };
      case 'PREPARING':
        return {
          label: 'Món đã sẵn sàng',
          next: 'READY',
          hint: 'Nướng xong, đóng hộp kèm dụng cụ',
          note:
            order.fulfillmentType === 'PICKUP'
              ? 'Món đã làm xong, sẵn sàng tại quầy nhận.'
              : 'Món đã làm xong và được đóng gói kèm dụng cụ.',
        };
      case 'READY':
        return order.fulfillmentType === 'PICKUP'
          ? { label: 'Giao khách tại quầy', next: 'COMPLETED', note: 'Khách đã nhận món tại quầy.', hint: 'Gọi khách nhận món tại quầy' }
          : { label: 'Tài xế nhận giao', next: 'OUT_FOR_DELIVERY', note: 'Tài xế đã nhận đơn và đang đi giao.', hint: 'Bàn giao hộp bánh cho tài xế' };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Giao thành công', next: 'COMPLETED', note: 'Đơn đã được giao thành công cho khách.', hint: 'Xác nhận khách đã nhận hàng' };
      default:
        return null;
    }
  };

  const confirmDialog = (title: string, message: string, confirmText: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // Alert.alert không hiển thị trên web nên dùng window.confirm
      return Promise.resolve(window.confirm(`${title}\n${message}`));
    }
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: 'Quay lại', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ]);
    });
  };

  const showError = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Chuyển đơn sang bước kế tiếp trong Bếp & Giao
  const handleKitchenAdvance = async (order: any) => {
    if (busyOrderId) return;
    const action = getKitchenAction(order);
    if (!action) return;

    const isPaid = order.paymentStatus === 'PAID_DEMO' || order.paymentStatus === 'PAID';
    // Bước hoàn tất đơn COD: nhắc thu tiền mặt trước
    if (action.next === 'COMPLETED' && !isPaid && order.paymentMethod === 'COD') {
      const ok = await confirmDialog(
        'Thu tiền mặt (COD)',
        `Vui lòng thu ${formatCurrency(order.total || 0)} từ khách trước khi hoàn tất đơn.`,
        'Đã thu & hoàn tất'
      );
      if (!ok) return;
    }

    setBusyOrderId(order.id);
    try {
      const staffName = user?.fullname || 'Nhân viên';
      const update: Record<string, any> = {
        status: action.next,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: action.next,
          at: new Date().toISOString(),
          note: `${action.note} (Nhân viên: ${staffName})`,
        }),
      };
      if (action.next === 'PREPARING') update.preparingAt = serverTimestamp();
      if (action.next === 'READY') update.readyAt = serverTimestamp();
      if (action.next === 'OUT_FOR_DELIVERY') update.deliveringAt = serverTimestamp();
      if (action.next === 'COMPLETED') {
        update.completedAt = serverTimestamp();
        update.completedBy = staffName;
        if (!isPaid) update.paymentStatus = 'PAID_DEMO'; // đã thu tiền mặt
      }

      await updateDoc(doc(db, 'orders', order.id), update);
      triggerHaptic('success');
      showToast({
        message: `Đơn #${order.orderCode || ''}: ${action.label} ✓`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Lỗi cập nhật trạng thái đơn:', err);
      showError('Lỗi cập nhật đơn', err.message || 'Không thể cập nhật trạng thái đơn.');
    } finally {
      setBusyOrderId(null);
    }
  };

  // Hủy đơn đã xác nhận nhưng bếp chưa nấu (CONFIRMED)
  const handleKitchenCancel = async (order: any) => {
    if (busyOrderId) return;
    const ok = await confirmDialog(
      'Hủy đơn hàng',
      `Hủy đơn #${order.orderCode || ''}? Khách sẽ được thông báo.`,
      'Hủy đơn'
    );
    if (!ok) return;

    setBusyOrderId(order.id);
    try {
      const staffName = user?.fullname || 'Nhân viên';
      const isPaid = order.paymentStatus === 'PAID_DEMO' || order.paymentStatus === 'PAID';
      const reason = 'Bếp không thể thực hiện đơn sau khi xác nhận';
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledBy: staffName,
        cancelReason: reason,
        ...(isPaid ? { paymentStatus: 'REFUND_PENDING' } : {}),
        statusHistory: arrayUnion({
          status: 'CANCELLED',
          at: new Date().toISOString(),
          note: `Đơn bị hủy bởi ${staffName}. Lý do: ${reason}.`,
        }),
      });
      triggerHaptic('warning');
      showToast({ message: `Đã hủy đơn #${order.orderCode || ''}.`, type: 'info' });
    } catch (err: any) {
      console.error('Lỗi khi hủy đơn:', err);
      showError('Lỗi hủy đơn', err.message || 'Không thể hủy đơn.');
    } finally {
      setBusyOrderId(null);
    }
  };

  // Thống kê công việc của chính nhân viên đang đăng nhập
  const myStats = useMemo(() => {
    const me = user?.fullname;
    return {
      confirmed: me ? allOrders.filter((o) => o.confirmedBy === me).length : 0,
      completed: me ? allOrders.filter((o) => o.completedBy === me).length : 0,
    };
  }, [allOrders, user?.fullname]);

  const handleLogout = () => {
    triggerHaptic('light');
    setLogoutModalVisible(true);
  };

  const executeLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutModalVisible(false);
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Lỗi khi đăng xuất:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* ==================================================== */}
        {/* 1. TOP BAR (STAFF HEADER)                            */}
        {/* ==================================================== */}
        <View style={styles.topBar}>
          <View style={styles.storeBranchRow}>
            <Store size={13} color={colors.primary} />
            <Text style={styles.storeBranchText}>Pizza FPT • CN Khu Công Nghệ Cao</Text>
          </View>
          <Text style={styles.staffNameText}>
            {user?.fullname || 'Nhân Viên Cửa Hàng'}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>VẬN HÀNH CA TRỰC</Text>
          </View>

          {/* Hàng nút công tắc và hành động nằm dưới dòng VẬN HÀNH CA TRỰC */}
          <View style={styles.topBarActionsRow}>
            {/* Nút bật tắt trạng thái ca trực */}
            <TouchableOpacity
              style={[
                styles.statusToggleBtn,
                {
                  borderColor: isAcceptingOrders ? colors.success : colors.border,
                  backgroundColor: isAcceptingOrders ? colors.successSoft : colors.surfaceAlt,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic('light');
                setIsAcceptingOrders(!isAcceptingOrders);
              }}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isAcceptingOrders ? colors.success : colors.textDisabled },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isAcceptingOrders ? colors.success : colors.textSecondary },
                ]}
              >
                {isAcceptingOrders ? 'Đang nhận đơn' : 'Tạm dừng'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.topBarRightIcons, { flexDirection: 'row', gap: 8 }]}>
              {/* Nút Hồ sơ nhân viên */}
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('light');
                  setProfileVisible(true);
                }}
              >
                <UserIcon size={18} color={colors.primary} />
              </TouchableOpacity>

              {/* Nút Đăng xuất */}
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={handleLogout}
              >
                <LogOut size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ==================================================== */}
        {/* 2. THANH PHÂN NHÓM ĐƠN HÀNG (3 TABS)                 */}
        {/* ==================================================== */}
        <View style={styles.tabContainer}>
          {/* TAB 1: Chờ Duyệt (Phần của bạn) */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'pending' && styles.activeTabBtn]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              setActiveTab('pending');
            }}
          >
            <Clock size={15} color={activeTab === 'pending' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
              Chờ duyệt
            </Text>
            <View style={[styles.badgePill, activeTab === 'pending' && styles.activeBadgePill]}>
              <Text
                style={[styles.badgeText, activeTab === 'pending' && styles.activeBadgeText]}
              >
                {pendingOrders.length}
              </Text>
            </View>
          </TouchableOpacity>

          {/* TAB 2: Bếp & Giao (Tạo sẵn cho người được phân công) */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'kitchen' && styles.activeTabBtn]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              setActiveTab('kitchen');
            }}
          >
            <ChefHat size={15} color={activeTab === 'kitchen' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'kitchen' && styles.activeTabText]}>
              Bếp & Giao
            </Text>
            <View style={[styles.badgePill, activeTab === 'kitchen' && styles.activeBadgePill]}>
              <Text
                style={[styles.badgeText, activeTab === 'kitchen' && styles.activeBadgeText]}
              >
                {kitchenOrders.length}
              </Text>
            </View>
          </TouchableOpacity>

          {/* TAB 3: Đã Xong (Tạo sẵn cho người được phân công) */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'completed' && styles.activeTabBtn]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              setActiveTab('completed');
            }}
          >
            <CheckCircle2 size={15} color={activeTab === 'completed' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Đã xong
            </Text>
            <View style={[styles.badgePill, activeTab === 'completed' && styles.activeBadgePill]}>
              <Text
                style={[styles.badgeText, activeTab === 'completed' && styles.activeBadgeText]}
              >
                {completedOrders.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ==================================================== */}
        {/* 3. NỘI DUNG TỪNG TAB                                 */}
        {/* ==================================================== */}

        {/* --- TAB 1: CHỜ DUYỆT (PENDING_CONFIRMATION) --- */}
        {activeTab === 'pending' && (
          <View style={{ flex: 1 }}>
            {/* Thanh Tìm kiếm & Lọc */}
            <View style={styles.filterBar}>
              <View style={styles.searchBox}>
                <Search size={16} color={colors.textDisabled} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm mã đơn, tên hoặc SĐT..."
                  placeholderTextColor={colors.textDisabled}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  fulfillmentFilter === 'DELIVERY' && styles.activeFilterChip,
                ]}
                onPress={() =>
                  setFulfillmentFilter(fulfillmentFilter === 'DELIVERY' ? 'ALL' : 'DELIVERY')
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    fulfillmentFilter === 'DELIVERY' && styles.activeFilterChipText,
                  ]}
                >
                  Giao tận nơi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  fulfillmentFilter === 'PICKUP' && styles.activeFilterChip,
                ]}
                onPress={() =>
                  setFulfillmentFilter(fulfillmentFilter === 'PICKUP' ? 'ALL' : 'PICKUP')
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    fulfillmentFilter === 'PICKUP' && styles.activeFilterChipText,
                  ]}
                >
                  Tại quầy
                </Text>
              </TouchableOpacity>
            </View>

            {/* Danh sách đơn chờ duyệt */}
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => setRefreshing(true)}
                  tintColor={colors.primary}
                />
              }
            >
              {isLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 13 }}>
                    Đang đồng bộ đơn hàng từ Cloud Firestore...
                  </Text>
                </View>
              ) : filteredPendingOrders.length === 0 ? (
                <View style={styles.emptyTabContainer}>
                  <View style={styles.emptyIconBox}>
                    <Check size={32} color={colors.success} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.emptyTitle}>Không có đơn nào đang chờ duyệt</Text>
                  <Text style={styles.emptyDesc}>
                    {searchQuery
                      ? 'Không tìm thấy đơn hàng phù hợp với từ khóa.'
                      : 'Tuyệt vời! Toàn bộ đơn hàng mới đã được xử lý. Hệ thống đang tự động lắng nghe đơn mới.'}
                  </Text>
                </View>
              ) : (
                filteredPendingOrders.map((order) => {
                  const elapsedMinutes = getElapsedMinutes(order);
                  const isUrgent = elapsedMinutes >= 5;

                  return (
                    <View
                      key={order.id}
                      style={[styles.orderCard, isUrgent && styles.orderCardUrgent]}
                    >
                      {/* Card Header: Mã đơn (trên) + Bộ đếm thời gian (nằm dưới mã đơn) */}
                      <View style={styles.cardHeader}>
                        <View style={styles.orderCodeCol}>
                          <Text style={styles.orderCodeText}>
                            #{order.orderCode || order.id.slice(0, 8)}
                          </Text>
                          <View
                            style={[
                              styles.timerBadge,
                              isUrgent
                                ? styles.timerBadgeUrgent
                                : elapsedMinutes >= 3
                                  ? styles.timerBadgeWarning
                                  : styles.timerBadgeNormal,
                            ]}
                          >
                            <Clock
                              size={12}
                              color={
                                isUrgent
                                  ? colors.error
                                  : elapsedMinutes >= 3
                                    ? colors.warning
                                    : colors.primary
                              }
                            />
                            <Text
                              style={[
                                styles.timerText,
                                {
                                  color: isUrgent
                                    ? colors.error
                                    : elapsedMinutes >= 3
                                      ? colors.warning
                                      : colors.primary,
                                },
                              ]}
                            >
                              {elapsedMinutes === 0
                                ? 'Vừa xong'
                                : isUrgent
                                  ? `Chờ ${elapsedMinutes}p (Gấp!)`
                                  : `Chờ ${elapsedMinutes} phút`}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.orderTimestampText}>
                          {order.createdAtFormatted || 'Hôm nay'}
                        </Text>
                      </View>

                      {/* Thông tin Khách hàng & Địa chỉ */}
                      <View style={styles.customerBox}>
                        <View style={styles.customerRow}>
                          <Text style={styles.customerName}>
                            Khách: {order.customer?.fullname || 'Khách vãng lai'}
                          </Text>

                          {order.customer?.phone ? (
                            <TouchableOpacity
                              style={styles.callBtn}
                              activeOpacity={0.8}
                              onPress={() => handleCallCustomer(order.customer?.phone)}
                            >
                              <Phone size={12} color={colors.success} />
                              <Text style={styles.callBtnText}>
                                Gọi: {order.customer?.phone}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        <View style={styles.fulfillmentRow}>
                          {order.fulfillmentType === 'PICKUP' ? (
                            <>
                              <Store size={14} color={colors.primary} />
                              <Text style={[styles.fulfillmentText, { fontWeight: '700', color: colors.primary }]}>
                                Lấy tại quầy cửa hàng • Hẹn giờ: {order.deliveryTime || 'Càng sớm càng tốt'}
                              </Text>
                            </>
                          ) : (
                            <>
                              <MapPin size={14} color={colors.error} />
                              <Text style={styles.fulfillmentText}>
                                <Text style={{ fontWeight: '700' }}>Giao đến: </Text>
                                {order.address || 'Không rõ địa chỉ'}
                              </Text>
                            </>
                          )}
                        </View>

                        {/* Ghi chú giao hàng nếu có */}
                        {order.deliveryNote ? (
                          <View style={styles.noteHighlightBox}>
                            <Text style={styles.noteHighlightText}>
                              📝 Ghi chú giao: {order.deliveryNote}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Danh sách món ăn */}
                      <View style={styles.itemsContainer}>
                        {Array.isArray(order.items) &&
                          order.items.map((it: any, idx: number) => (
                            <View key={idx} style={styles.itemRow}>
                              <View style={styles.itemMain}>
                                <Text style={styles.itemName}>
                                  {it.quantity}x {it.productName}
                                </Text>

                                {/* Biến thể & Toppings */}
                                {(it.variantName || it.customizationSummary) && (
                                  <Text style={styles.itemSubDetails}>
                                    {[
                                      it.variantName,
                                      Array.isArray(it.customizationSummary)
                                        ? it.customizationSummary.join(', ')
                                        : it.customizationSummary,
                                    ]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </Text>
                                )}

                                {/* Ghi chú đặc biệt cho món */}
                                {it.note ? (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.warning,
                                      fontWeight: '600',
                                      marginTop: 2,
                                    }}
                                  >
                                    ⚠️ Ghi chú bếp: {it.note}
                                  </Text>
                                ) : null}
                              </View>

                              <Text style={styles.itemPrice}>
                                {formatCurrency(it.lineTotal || 0)}
                              </Text>
                            </View>
                          ))}
                      </View>

                      {/* Footer & Nút Tác Nghiệp Duyệt / Từ Chối */}
                      <View style={styles.cardFooter}>
                        {/* Hàng trên: Thông tin thanh toán & Tổng số tiền */}
                        <View style={styles.priceRow}>
                          <View
                            style={[
                              styles.paymentStatusBadge,
                              {
                                backgroundColor:
                                  order.paymentStatus === 'PAID_DEMO' || order.paymentStatus === 'PAID'
                                    ? colors.successSoft
                                    : colors.surfaceAlt,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.paymentStatusText,
                                {
                                  color:
                                    order.paymentStatus === 'PAID_DEMO' || order.paymentStatus === 'PAID'
                                      ? colors.success
                                      : colors.textSecondary,
                                },
                              ]}
                            >
                              {order.paymentName || order.paymentMethod || 'Tiền mặt'} •{' '}
                              {order.paymentStatus === 'PAID_DEMO' || order.paymentStatus === 'PAID'
                                ? 'ĐÃ THANH TOÁN'
                                : 'CHƯA TRẢ (COD)'}
                            </Text>
                          </View>
                          <Text style={styles.totalAmountText}>
                            {formatCurrency(order.total || 0)}
                          </Text>
                        </View>

                        {/* Hàng dưới: 2 Nút Từ Chối / Xác Nhận Đơn nằm DƯỚI số tiền */}
                        <View style={styles.actionBtnsRow}>
                          {/* Nút TỪ CHỐI */}
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            activeOpacity={0.8}
                            onPress={() => handleOpenRejectModal(order)}
                          >
                            <X size={15} color={colors.error} />
                            <Text style={styles.rejectBtnText}>Từ chối</Text>
                          </TouchableOpacity>

                          {/* Nút XÁC NHẬN ĐƠN */}
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            activeOpacity={0.85}
                            onPress={() => handleOpenAcceptModal(order)}
                          >
                            <Check size={16} color={colors.white} strokeWidth={2.5} />
                            <Text style={styles.acceptBtnText}>Xác nhận đơn</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* --- TAB 2: BẾP & GIAO NHẬN (CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY) --- */}
        {activeTab === 'kitchen' && (
          <View style={{ flex: 1 }}>
            {/* Bộ lọc nhanh theo giai đoạn (dùng Chip chung của app) */}
            <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Chip
                  label={`Tất cả (${kitchenOrders.length})`}
                  selected={kitchenFilter === 'ALL'}
                  onPress={() => setKitchenFilter('ALL')}
                />
                {KITCHEN_SECTIONS.map((s) => (
                  <Chip
                    key={s.status}
                    label={`${s.title} (${kitchenOrders.filter((o) => o.status === s.status).length})`}
                    selected={kitchenFilter === s.status}
                    onPress={() => setKitchenFilter(s.status)}
                  />
                ))}
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => setRefreshing(true)}
                  tintColor={colors.primary}
                />
              }
            >
              {isLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : visibleKitchenOrders.length === 0 ? (
                <View style={styles.emptyTabContainer}>
                  <View style={[styles.emptyIconBox, { backgroundColor: colors.primarySoft }]}>
                    <ChefHat size={32} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.emptyTitle}>Không có đơn nào ở mục này</Text>
                  <Text style={styles.emptyDesc}>
                    Đơn sẽ xuất hiện ở đây sau khi được duyệt ở tab Chờ duyệt.
                  </Text>
                </View>
              ) : (
                KITCHEN_SECTIONS.map((section) => {
                  const list = visibleKitchenOrders.filter((o) => o.status === section.status);
                  if (list.length === 0) return null;
                  return (
                    <View key={section.status} style={{ gap: 12 }}>
                      {/* Tiêu đề nhóm */}
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>
                          {section.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>
                          {list.length} đơn • {section.hint}
                        </Text>
                      </View>

                      {list.map((order) => {
                        const action = getKitchenAction(order);
                        const isBusy = busyOrderId === order.id;
                        const isPaid =
                          order.paymentStatus === 'PAID_DEMO' || order.paymentStatus === 'PAID';
                        const showCod = !isPaid && order.paymentMethod === 'COD';
                        const isPickup = order.fulfillmentType === 'PICKUP';
                        const steps = isPickup
                          ? ['Chờ nấu', 'Đang nấu', 'Sẵn sàng', 'Xong']
                          : ['Chờ nấu', 'Đang nấu', 'Sẵn sàng', 'Đang giao', 'Xong'];
                        const currentStep = getKitchenStepIndex(order);
                        const minutes = getMinutesInStage(order);

                        return (
                          <View key={order.id} style={styles.orderCard}>
                            {/* Hàng 1: Mã đơn + trạng thái */}
                            <View style={styles.cardHeader}>
                              <View style={styles.orderCodeCol}>
                                <Text style={styles.orderCodeText}>#{order.orderCode || order.id.slice(0, 8)}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  {isPickup ? (
                                    <Store size={13} color={colors.textSecondary} />
                                  ) : (
                                    <Bike size={13} color={colors.textSecondary} />
                                  )}
                                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                    {isPickup ? 'Lấy tại quầy' : 'Giao tận nơi'} •{' '}
                                    {minutes === 0 ? 'Vừa chuyển bước' : `${minutes} phút ở bước này`}
                                  </Text>
                                </View>
                              </View>
                              <StatusBadge status={order.status} />
                            </View>

                            {/* Hàng 2: Thanh tiến trình */}
                            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 14 }}>
                              {steps.map((label, i) => {
                                const done = i < currentStep;
                                const current = i === currentStep;
                                const lit = done || current;
                                return (
                                  <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                                      <View
                                        style={{
                                          flex: 1,
                                          height: 3,
                                          backgroundColor: i === 0 ? 'transparent' : lit ? section.color : colors.border,
                                        }}
                                      />
                                      <View
                                        style={{
                                          width: 18,
                                          height: 18,
                                          borderRadius: 9,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: lit ? section.color : colors.surface,
                                          borderWidth: 2,
                                          borderColor: lit ? section.color : colors.border,
                                        }}
                                      >
                                        {done ? <Check size={10} color={colors.white} strokeWidth={3.5} /> : null}
                                      </View>
                                      <View
                                        style={{
                                          flex: 1,
                                          height: 3,
                                          backgroundColor: i === steps.length - 1 ? 'transparent' : done ? section.color : colors.border,
                                        }}
                                      />
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        marginTop: 4,
                                        fontWeight: current ? '700' : '500',
                                        color: current ? section.color : colors.textSecondary,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {label}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>

                            {/* Hàng 3: Danh sách món */}
                            <View style={styles.itemsContainer}>
                              {Array.isArray(order.items) &&
                                order.items.map((it: any, idx: number) => (
                                  <View key={idx} style={{ flexDirection: 'row' }}>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary, width: 32 }}>
                                      {it.quantity}x
                                    </Text>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.itemName}>{it.productName}</Text>
                                      {(it.variantName || it.customizationSummary) && (
                                        <Text style={styles.itemSubDetails}>
                                          {[
                                            it.variantName,
                                            Array.isArray(it.customizationSummary)
                                              ? it.customizationSummary.join(', ')
                                              : it.customizationSummary,
                                          ]
                                            .filter(Boolean)
                                            .join(' • ')}
                                        </Text>
                                      )}
                                      {it.note ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                          <AlertCircle size={12} color={colors.warning} />
                                          <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600', flex: 1 }}>
                                            {it.note}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  </View>
                                ))}
                            </View>

                            {/* Hàng 4: Khách hàng & nơi nhận */}
                            <View style={styles.customerBox}>
                              <View style={styles.customerRow}>
                                <Text style={[styles.customerName, { flex: 1 }]} numberOfLines={1}>
                                  {order.customer?.fullname || 'Khách vãng lai'}
                                </Text>
                                {order.customer?.phone ? (
                                  <TouchableOpacity
                                    style={styles.callBtn}
                                    activeOpacity={0.8}
                                    onPress={() => handleCallCustomer(order.customer?.phone)}
                                  >
                                    <Phone size={12} color={colors.success} />
                                    <Text style={styles.callBtnText}>{order.customer?.phone}</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                              {!isPickup && (
                                <View style={styles.fulfillmentRow}>
                                  <MapPin size={14} color={colors.error} />
                                  <Text style={styles.fulfillmentText}>{order.address || 'Không rõ địa chỉ'}</Text>
                                </View>
                              )}
                              {order.deliveryNote ? (
                                <View style={styles.noteHighlightBox}>
                                  <Text style={styles.noteHighlightText}>Ghi chú giao: {order.deliveryNote}</Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Hàng 5: Thanh toán + hành động */}
                            <View style={styles.cardFooter}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: showCod ? colors.warningSoft : colors.successSoft,
                                  borderRadius: 12,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                  {showCod ? (
                                    <Banknote size={16} color={colors.warning} />
                                  ) : (
                                    <CheckCircle2 size={16} color={colors.success} />
                                  )}
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '700',
                                      color: showCod ? colors.warning : colors.success,
                                      flex: 1,
                                    }}
                                  >
                                    {showCod ? 'Thu tiền mặt khi giao' : 'Đã thanh toán, không thu tiền'}
                                  </Text>
                                </View>
                                <Text style={styles.totalAmountText}>{formatCurrency(order.total || 0)}</Text>
                              </View>

                              {action && (
                                <View style={{ gap: 8 }}>
                                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                    Tiếp theo: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{action.hint}</Text>
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {order.status === 'CONFIRMED' && (
                                      <View style={{ flex: 1 }}>
                                        <AppButton
                                          title="Hủy đơn"
                                          variant="outline"
                                          onPress={() => handleKitchenCancel(order)}
                                          disabled={isBusy}
                                          icon={<X size={16} color={colors.error} />}
                                          textStyle={{ color: colors.error }}
                                        />
                                      </View>
                                    )}
                                    <View style={{ flex: 2 }}>
                                      <AppButton
                                        title={action.label}
                                        onPress={() => handleKitchenAdvance(order)}
                                        isLoading={isBusy}
                                        disabled={isBusy}
                                        icon={<Check size={16} color={colors.white} strokeWidth={2.5} />}
                                      />
                                    </View>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* --- TAB 3: ĐÃ XONG (LỊCH SỬ CA TRỰC: COMPLETED & CANCELLED) --- */}
        {activeTab === 'completed' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.placeholderContainer}>
              <CheckCircle2 size={48} color={colors.success} />
              <Text style={styles.placeholderTitle}>
                Tab 3: Đã Xong (Lịch Sử Ca Trực)
              </Text>
              <Text style={styles.placeholderDesc}>
                Lưu trữ và theo dõi các đơn đã hoàn tất (COMPLETED) hoặc đơn đã hủy (CANCELLED) trong ca làm việc.
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.success,
                  marginTop: 12,
                }}
              >
                Hiện có {completedOrders.length} đơn đã kết thúc trong ca
              </Text>
            </View>

            {completedOrders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderCodeText}>
                    #{order.orderCode || order.id.slice(0, 8)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: order.status === 'COMPLETED' ? colors.success : colors.error,
                    }}
                  >
                    {order.status === 'COMPLETED' ? '✓ ĐÃ HOÀN TẤT' : '✕ ĐÃ HỦY'}
                  </Text>
                </View>
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Khách: {order.customer?.fullname || 'Khách vãng lai'} • {order.address || 'Tại quầy'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 4 }}>
                    Tổng: {formatCurrency(order.total || 0)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ==================================================== */}
        {/* MODAL HỒ SƠ NHÂN VIÊN                                */}
        {/* ==================================================== */}
        <Modal
          visible={profileVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setProfileVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Hồ sơ nhân viên</Text>
                <TouchableOpacity onPress={() => setProfileVisible(false)}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Ảnh đại diện + tên + vai trò */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  {user?.avatar ? (
                    <Image
                      source={{ uri: user.avatar }}
                      style={{ width: 84, height: 84, borderRadius: 42, marginBottom: 10 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 34, fontWeight: '800', color: colors.white }}>
                        {(user?.fullname || 'N').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                    {user?.fullname || 'Nhân viên cửa hàng'}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.successSoft,
                      borderRadius: 14,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      marginTop: 6,
                    }}
                  >
                    <BadgeCheck size={14} color={colors.success} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success, marginLeft: 5 }}>
                      {STAFF_ROLE_LABELS[user?.role || 'EMPLOYEE'] || user?.role || 'Nhân viên'}
                    </Text>
                  </View>
                </View>

                {/* Thống kê ca làm */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Đã duyệt', value: myStats.confirmed, color: colors.primary },
                    { label: 'Đã hoàn tất', value: myStats.completed, color: colors.success },
                    { label: 'Đang xử lý', value: kitchenOrders.length, color: colors.warning },
                  ].map((st) => (
                    <View
                      key={st.label}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <Text style={{ fontSize: 22, fontWeight: '900', color: st.color }}>{st.value}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{st.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Thông tin liên hệ */}
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14 }}>
                  {[
                    { icon: <Mail size={16} color={colors.textSecondary} />, label: 'Email', value: user?.email },
                    { icon: <Phone size={16} color={colors.textSecondary} />, label: 'Số điện thoại', value: user?.phone },
                    { icon: <Store size={16} color={colors.textSecondary} />, label: 'Chi nhánh', value: 'Pizza FPT • CN Khu Công Nghệ Cao' },
                    { icon: <UserIcon size={16} color={colors.textSecondary} />, label: 'Mã nhân viên', value: user?.id },
                  ].map((row, i) => (
                    <View
                      key={row.label}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      {row.icon}
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{row.label}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                          {row.value || 'Chưa cập nhật'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Đăng xuất */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setProfileVisible(false);
                    handleLogout();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 16,
                    paddingVertical: 13,
                    borderRadius: 12,
                    backgroundColor: colors.errorSoft,
                  }}
                >
                  <LogOut size={16} color={colors.error} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.error, marginLeft: 8 }}>
                    Đăng xuất ca làm
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* 4. MODAL XÁC NHẬN ĐƠN & CHỌN THỜI GIAN DỰ KIẾN       */}
        {/* ==================================================== */}
        <Modal
          visible={acceptModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAcceptModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Xác Nhận Đơn Hàng</Text>
                <TouchableOpacity onPress={() => setAcceptModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Đơn hàng #{selectedOrderForAccept?.orderCode} sẽ được chuyển ngay vào khu vực Bếp để làm bánh. Hãy chọn thời gian dự kiến nấu xong:
              </Text>

              {/* Grid các mốc thời gian */}
              <View style={styles.timeGrid}>
                {PREP_TIME_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.timeOption,
                      selectedPrepTime === opt.value && styles.activeTimeOption,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedPrepTime(opt.value)}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        selectedPrepTime === opt.value && styles.activeTimeOptionText,
                      ]}
                    >
                      ⏱️ {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.modalConfirmAcceptBtn,
                  isSubmittingAccept && { opacity: 0.7 },
                ]}
                activeOpacity={0.88}
                disabled={isSubmittingAccept}
                onPress={handleConfirmAccept}
              >
                {isSubmittingAccept ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmAcceptBtnText}>
                    Xác Nhận & Đẩy Xuống Bếp
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* 5. MODAL TỪ CHỐI ĐƠN & CHỌN LÝ DO                    */}
        {/* ==================================================== */}
        <Modal
          visible={rejectModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setRejectModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.error }]}>
                  Từ Chối Đơn Hàng #{selectedOrderForReject?.orderCode}
                </Text>
                <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                Vui lòng chọn lý do từ chối để hệ thống thông báo minh bạch cho khách hàng:
              </Text>

              <ScrollView style={{ maxHeight: 280 }}>
                {REJECT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonOption,
                        isSelected && styles.activeReasonOption,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedReason(reason)}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.activeRadioCircle,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text
                        style={[
                          styles.reasonText,
                          isSelected && styles.activeReasonText,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {selectedReason === 'Lý do khác (Nhập chi tiết bên dưới)' && (
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder="Nhập lý do cụ thể..."
                    placeholderTextColor={colors.textDisabled}
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                  />
                )}
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  activeOpacity={0.7}
                  onPress={() => setRejectModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmRejectBtn,
                    isSubmittingReject && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.88}
                  disabled={isSubmittingReject}
                  onPress={handleConfirmReject}
                >
                  {isSubmittingReject ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalConfirmRejectBtnText}>
                      Xác Nhận Hủy Đơn
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* MODAL XÁC NHẬN ĐĂNG XUẤT                              */}
        {/* ==================================================== */}
        <Modal
          visible={logoutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLogoutModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: 24 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <LogOut size={18} color={colors.error} />
                  </View>
                  <Text style={[styles.modalTitle, { color: colors.error }]}>Đăng Xuất Ca Làm</Text>
                </View>
                <TouchableOpacity onPress={() => setLogoutModalVisible(false)}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginVertical: 12 }}>
                Bạn có chắc chắn muốn đăng xuất khỏi ca làm việc hiện tại? Mọi trạng thái đơn hàng của cửa hàng đã được lưu trữ an toàn trên hệ thống.
              </Text>

              <View style={[styles.modalBtnRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  activeOpacity={0.7}
                  disabled={isLoggingOut}
                  onPress={() => setLogoutModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmRejectBtn,
                    { backgroundColor: colors.error },
                    isLoggingOut && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.88}
                  disabled={isLoggingOut}
                  onPress={executeLogout}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalConfirmRejectBtnText}>
                      Đăng Xuất
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}
