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

export default function StaffOrdersScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  // Active Segment Tab: 1 = Chờ duyệt, 2 = Bếp & Giao, 3 = Đã xong (Lịch sử)
  const [activeTab, setActiveTab] = useState<'pending' | 'kitchen' | 'completed'>('pending');

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

  const handleLogout = () => {
    Alert.alert('Đăng xuất ca làm', 'Bạn có chắc chắn muốn đăng xuất khỏi ca làm việc?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(tabs)/home');
        },
      },
    ]);
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

            <View style={styles.topBarRightIcons}>
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
            <Clock size={15} color={activeTab === 'pending' ? colors.white : colors.textSecondary} />
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
            <ChefHat size={15} color={activeTab === 'kitchen' ? colors.white : colors.textSecondary} />
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
            <CheckCircle2 size={15} color={activeTab === 'completed' ? colors.white : colors.textSecondary} />
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
                                    : '#0284C7'
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
                                      : '#0284C7',
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

        {/* --- TAB 2: BẾP & GIAO NHẬN (TẠO SẴN CHO THÀNH VIÊN ĐƯỢC PHÂN CÔNG) --- */}
        {activeTab === 'kitchen' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.placeholderContainer}>
              <ChefHat size={48} color={colors.warning} />
              <Text style={styles.placeholderTitle}>
                Tab 2: Khu Vực Bếp & Giao Nhận
              </Text>
              <Text style={styles.placeholderDesc}>
                (Phần khung này đã được khởi tạo sẵn để thành viên phụ trách Bếp và Giao hàng dễ dàng tích hợp).
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.primary,
                  marginTop: 12,
                }}
              >
                Hiện có {kitchenOrders.length} đơn hàng trong quy trình Bếp & Giao
              </Text>
            </View>

            {kitchenOrders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderCodeText}>
                    #{order.orderCode || order.id.slice(0, 8)}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warning }}>
                    Trạng thái: {order.status}
                  </Text>
                </View>
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Khách: {order.customer?.fullname} • {order.customer?.phone}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                    Món: {order.items?.map((it: any) => `${it.quantity}x ${it.productName}`).join(', ')}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
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
      </View>
    </SafeAreaView>
  );
}
