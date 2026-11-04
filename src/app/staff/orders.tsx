import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Phone,
  Search,
  Truck,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { staffOrderTime } from '../../utils/staff';
import {
  subscribeOrderOverrides,
  saveOrderOverride,
  compressImageForSync,
  subscribeStaffStoresMap,
  subscribeStaffSchedules,
  subscribeStoresConfig,
  getStaffShiftOnDate,
  DEFAULT_STORE_BRANCHES,
  type OrderDispatchOverride,
  type StaffCustomizationEntry,
  type StaffScheduleRecord,
  type SyncedStoreBranch,
  type ShiftType,
} from '../../services/storeSync';

const SHIFT_INFO: Record<ShiftType, { label: string; color: string; bg: string }> = {
  MORNING: { label: 'Ca Sáng (08:00 - 14:00)', color: colors.primary, bg: colors.primarySoft },
  EVENING: { label: 'Ca Tối (14:00 - 22:00)', color: colors.primary, bg: colors.primarySoft },
  FULL: { label: 'Full ca (08:00 - 22:00)', color: colors.primary, bg: colors.primarySoft },
  OFF: { label: 'Hôm nay nghỉ (OFF)', color: colors.textSecondary, bg: colors.surfaceAlt },
};

const STAFF_FAIL_REASONS = [
  'Gọi điện khách hàng không nghe máy',
  'Sai địa chỉ giao hàng',
];

export default function StaffOrdersScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.id;

  const [activeTab, setActiveTab] = useState<'delivering' | 'completed'>('delivering');
  const [searchQuery, setSearchQuery] = useState('');
  const [rawOrders, setRawOrders] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});
  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StaffScheduleRecord>>({});
  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);

  // Modal xem chi tiết đơn hàng khi bấm vào card
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Modal chụp ảnh xác nhận giao hàng
  const [completingOrder, setCompletingOrder] = useState<Record<string, any> | null>(null);
  const [proofImage, setProofImage] = useState<string>('');
  const [proofError, setProofError] = useState<string>('');
  const [submittingProof, setSubmittingProof] = useState(false);

  // Modal báo giao thất bại / khách không nhận
  const [failingOrder, setFailingOrder] = useState<Record<string, any> | null>(null);
  const [failReason, setFailReason] = useState<string>(STAFF_FAIL_REASONS[0]);
  const [submittingFail, setSubmittingFail] = useState(false);

  useEffect(() => {
    const unsubOverrides = subscribeOrderOverrides((map) => setOrderOverrides(map));
    const unsubStaff = subscribeStaffStoresMap((map) => setStaffMap(map));
    const unsubSchedules = subscribeStaffSchedules((map) => setSchedulesMap(map));
    const unsubStores = subscribeStoresConfig((state) => {
      if (state.stores?.length > 0) setStoresList(state.stores);
    });
    return () => {
      unsubOverrides();
      unsubStaff();
      unsubSchedules();
      unsubStores();
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'orders'),
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
    return () => unsub();
  }, [uid]);

  const myStaffEntry = uid ? staffMap[uid] : undefined;
  const effectiveStoreId = myStaffEntry?.storeId || user?.storeId;
  const matchedStore = storesList.find((s) => s.id === effectiveStoreId);
  const effectiveStoreName =
    myStaffEntry?.storeName || matchedStore?.name || user?.storeName || 'Pizza FPT';

  const todayShift: ShiftType = uid
    ? getStaffShiftOnDate(schedulesMap[uid], new Date())
    : 'MORNING';
  const shiftBadge = SHIFT_INFO[todayShift];

  // Chỉ lấy những đơn được Quản lý phân công cho nhân viên đang đăng nhập
  const myAssignedOrders = rawOrders
    .filter((raw) => String(raw.orderCode || '').toUpperCase() !== 'PF-X469QK')
    .map((raw) => {
      const ov = orderOverrides[raw.id];
      const status = String(ov?.status || raw.status || 'PENDING_CONFIRMATION');
      const assignedStaffId = String(
        ov?.assignedStaffId || raw.assignedStaffId || raw.rider?.uid || ''
      );
      const assignedStaffName = String(
        ov?.assignedStaffName || raw.assignedStaffName || raw.rider?.name || ''
      );
      const assignedStaffPhone = String(
        ov?.assignedStaffPhone || raw.assignedStaffPhone || raw.rider?.phone || ''
      );
      const deliveryProofImage = String(
        ov?.deliveryProofImage || raw.deliveryProofImage || ''
      );
      const cancelReason = String(ov?.cancelReason || raw.cancelReason || '');
      const deliveredAt = String(ov?.deliveredAt || raw.deliveredAt || '');
      const orderCode = String(raw.orderCode || String(raw.id).slice(-6).toUpperCase());
      const customerName = String(
        raw.customer?.fullname || raw.customerName || 'Khách hàng'
      );
      const customerPhone = String(raw.customer?.phone || raw.customerPhone || '');
      const address = String(raw.address || raw.deliveryAddress || '');
      const deliveryNote = String(raw.deliveryNote || raw.note || '').trim();
      const total = Number(raw.total || raw.totalAmount || 0);
      const paymentStatus = String(ov?.paymentStatus || raw.paymentStatus || 'UNPAID');
      const paymentMethod = String(raw.paymentMethod || 'cash');
      const items = Array.isArray(raw.items) ? raw.items : [];
      const createdAtMs = staffOrderTime(raw.createdAt) ?? 0;

      return {
        ...(raw as any),
        id: String(raw.id),
        orderCode,
        status,
        assignedStaffId,
        assignedStaffName,
        assignedStaffPhone,
        deliveryProofImage,
        cancelReason,
        deliveredAt,
        customerName,
        customerPhone,
        address,
        deliveryNote,
        total,
        paymentStatus,
        paymentMethod,
        items,
        createdAtMs,
      };
    })
    .filter((o) => {
      if (!uid) return false;
      const myPhone = String(myStaffEntry?.phone || user?.phone || '').trim();
      const matchedById = o.assignedStaffId && o.assignedStaffId === uid;
      const matchedByPhone =
        !o.assignedStaffId && myPhone && o.assignedStaffPhone === myPhone;
      return Boolean(matchedById || matchedByPhone);
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  const now = new Date();
  const startOfTodayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const isOrderToday = (o: { createdAtMs: number; deliveredAt?: string }) => {
    const deliveredMs = o.deliveredAt ? Date.parse(o.deliveredAt) : 0;
    const refMs = deliveredMs > 0 ? deliveredMs : o.createdAtMs;
    return !refMs || refMs >= startOfTodayMs;
  };

  const deliveringCount = myAssignedOrders.filter(
    (o) => o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY'
  ).length;
  const completedCount = myAssignedOrders.filter(
    (o) =>
      (o.status === 'COMPLETED' ||
        o.status === 'DELIVERED' ||
        o.status === 'CANCELLED' ||
        o.status === 'REJECTED') &&
      isOrderToday(o)
  ).length;

  const filteredOrders = myAssignedOrders.filter((o) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const match =
        o.orderCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (activeTab === 'delivering') {
      return o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY';
    }
    return (
      (o.status === 'COMPLETED' ||
        o.status === 'DELIVERED' ||
        o.status === 'CANCELLED' ||
        o.status === 'REJECTED') &&
      isOrderToday(o)
    );
  });

  const handleStartDelivery = async (order: Record<string, any>) => {
    setSelectedOrderId(null);
    const nowIso = new Date().toISOString();
    await saveOrderOverride(order.id, {
      status: 'OUT_FOR_DELIVERY',
    });
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'OUT_FOR_DELIVERY',
      statusHistory: arrayUnion({
        status: 'OUT_FOR_DELIVERY',
        at: nowIso,
        note: `Nhân viên ${user?.fullname || ''} đã nhận bánh và bắt đầu đi giao`.trim(),
      }),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    showToast({
      message: `Đã bắt đầu đi giao đơn #${order.orderCode} — Khách hàng đã thấy trạng thái Đang giao hàng!`,
      type: 'success',
    });
  };

  const handleOpenCompleteModal = (order: Record<string, any>) => {
    setCompletingOrder(order);
    setProofImage('');
    setProofError('');
  };

  const pickImageFromCamera = async () => {
    setProofError('');
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setProofError('Vui lòng cấp quyền truy cập Camera hoặc chọn ảnh từ thiết bị.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.35,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const dataUri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        const compressed = await compressImageForSync(dataUri);
        setProofImage(compressed);
      }
    } catch {
      setProofError('Thiết bị không mở được Camera, vui lòng bấm "Chọn ảnh từ máy".');
    }
  };

  const pickImageFromGallery = async () => {
    setProofError('');
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.35,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const dataUri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        const compressed = await compressImageForSync(dataUri);
        setProofImage(compressed);
      }
    } catch {
      setProofError('Không thể chọn ảnh, vui lòng thử lại.');
    }
  };

  const handleConfirmDeliveryComplete = async () => {
    if (!completingOrder) return;
    if (!proofImage) {
      const msg =
        'Bắt buộc phải chụp hoặc tải ảnh khách hàng lúc nhận bánh trước khi hoàn tất đơn!';
      setProofError(msg);
      showToast({ message: msg, type: 'error' });
      return;
    }

    setSubmittingProof(true);
    try {
      const nowIso = new Date().toISOString();
      const compactProof = await compressImageForSync(proofImage);
      await saveOrderOverride(completingOrder.id, {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        deliveryProofImage: compactProof,
        deliveredAt: nowIso,
      });
      await updateDoc(doc(db, 'orders', completingOrder.id), {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        ...(compactProof.length <= 250000 ? { deliveryProofImage: compactProof } : {}),
        deliveredAt: nowIso,
        statusHistory: arrayUnion({
          status: 'COMPLETED',
          at: nowIso,
          note: `Nhân viên ${user?.fullname || ''} đã giao hàng thành công (có ảnh xác nhận)`.trim(),
        }),
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      // Cộng điểm tích lũy cho khách hàng khi đơn giao hoàn tất
      const customerUid = String(completingOrder.userId || '');
      const pts =
        typeof completingOrder.earnedPoints === 'number'
          ? completingOrder.earnedPoints
          : Math.floor(Number(completingOrder.total || 0) / 10000);
      if (customerUid && pts > 0) {
        await updateDoc(doc(db, 'users', customerUid), {
          rewardPoints: increment(pts),
        }).catch(() => {});
      }

      showToast({
        message: `Đã xác nhận giao thành công đơn #${completingOrder.orderCode}!`,
        type: 'success',
      });
      setCompletingOrder(null);
      setSelectedOrderId(null);
      setProofImage('');
      setActiveTab('completed');
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleConfirmFailDelivery = async () => {
    if (!failingOrder) return;
    setSubmittingFail(true);
    try {
      const nowIso = new Date().toISOString();
      const targetOrder = failingOrder;
      await saveOrderOverride(targetOrder.id, {
        status: 'CANCELLED',
        cancelReason: failReason,
        incidentResolved: false,
        incidentReportedBy: `Nhân viên ${user?.fullname || ''}`.trim(),
        deliveredAt: nowIso,
      });
      await updateDoc(doc(db, 'orders', targetOrder.id), {
        status: 'CANCELLED',
        cancelReason: failReason,
        statusHistory: arrayUnion({
          status: 'CANCELLED',
          at: nowIso,
          note: `${failReason} (Báo bởi nhân viên ${user?.fullname || ''})`.trim(),
        }),
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      showToast({
        message: `Đã báo sự cố giao hàng đơn #${targetOrder.orderCode} về Quản lý & Admin!`,
        type: 'info',
      });
      setFailingOrder(null);
      setSelectedOrderId(null);
      setActiveTab('completed');
    } finally {
      setSubmittingFail(false);
    }
  };

  const selectedDetailOrder = selectedOrderId
    ? myAssignedOrders.find((o) => o.id === selectedOrderId) || null
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Đơn hàng giao của tôi"
        subtitle={`${effectiveStoreName} • ${shiftBadge.label}`}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        {/* Ô tìm kiếm đơn */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 42,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Search size={17} color={colors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm mã đơn, tên khách, SĐT, địa chỉ..."
            placeholderTextColor={colors.textDisabled}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 13.5,
              color: colors.textPrimary,
            }}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 2 Tab: Cần giao / Đã giao xong */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 6 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('delivering')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: activeTab === 'delivering' ? colors.primary : '#FFFFFF',
              borderWidth: 1,
              borderColor: activeTab === 'delivering' ? colors.primary : colors.border,
            }}
          >
            <Truck
              size={15}
              color={activeTab === 'delivering' ? '#FFFFFF' : colors.textSecondary}
            />
            <AppText
              variant="captionSemiBold"
              color={activeTab === 'delivering' ? '#FFFFFF' : colors.textSecondary}
            >
              Cần giao ({deliveringCount})
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('completed')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: activeTab === 'completed' ? colors.primary : '#FFFFFF',
              borderWidth: 1,
              borderColor: activeTab === 'completed' ? colors.primary : colors.border,
            }}
          >
            <CheckCircle2
              size={15}
              color={activeTab === 'completed' ? '#FFFFFF' : colors.textSecondary}
            />
            <AppText
              variant="captionSemiBold"
              color={activeTab === 'completed' ? '#FFFFFF' : colors.textSecondary}
            >
              Đã giao xong ({completedCount})
            </AppText>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
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
                {activeTab === 'delivering'
                  ? 'Chưa có đơn hàng nào cần giao'
                  : 'Chưa có đơn hàng nào đã giao xong'}
              </AppText>
              <AppText
                variant="small"
                color={colors.textSecondary}
                style={{ marginTop: 4, textAlign: 'center' }}
              >
                {activeTab === 'delivering'
                  ? 'Khi Quản lý chi nhánh phát đơn cho bạn, đơn hàng sẽ hiển thị ngay tại đây.'
                  : 'Các đơn bạn đã chụp ảnh giao thành công sẽ lưu tại đây.'}
              </AppText>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const isCompleted =
                order.status === 'COMPLETED' || order.status === 'DELIVERED';
              const isFailed =
                order.status === 'CANCELLED' || order.status === 'REJECTED';

              return (
                <TouchableOpacity
                  key={order.id}
                  activeOpacity={0.82}
                  onPress={() => setSelectedOrderId(order.id)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: isFailed ? '#FECACA' : colors.border,
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
                        backgroundColor: isCompleted
                          ? colors.surfaceAlt
                          : isFailed
                            ? colors.surfaceAlt
                            : colors.primarySoft,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      <AppText
                        variant="small"
                        color={
                          isCompleted
                            ? colors.textPrimary
                            : isFailed
                              ? colors.textSecondary
                              : colors.primary
                        }
                        style={{ fontWeight: '700' }}
                      >
                        {isCompleted
                          ? 'Đã giao'
                          : isFailed
                            ? 'Giao thất bại'
                            : order.status === 'READY'
                              ? 'Chờ nhận bánh'
                              : 'Đang đi giao'}
                      </AppText>
                    </View>
                  </View>

                  {/* Dòng 2: Tên khách + SĐT */}
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
                      {order.address}
                    </AppText>
                  </View>

                  {/* Dòng 4: Số món + Tổng tiền + Bấm xem chi tiết */}
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

      {/* MODAL CHI TIẾT ĐƠN HÀNG KHI BẤM VÀO CARD */}
      <Modal
        visible={!!selectedDetailOrder && !completingOrder && !failingOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrderId(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          {selectedDetailOrder && (
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
                <View>
                  <AppText variant="h3" color={colors.textPrimary}>
                    Chi tiết đơn #{selectedDetailOrder.orderCode}
                  </AppText>
                  <AppText variant="small" color={colors.textSecondary}>
                    {selectedDetailOrder.status === 'COMPLETED' ||
                    selectedDetailOrder.status === 'DELIVERED'
                      ? 'Đã giao hoàn tất'
                      : selectedDetailOrder.status === 'READY'
                        ? 'Quản lý vừa phân công — Bấm xác nhận nhận bánh để bắt đầu đi giao'
                        : 'Đang trên đường đi giao cho khách'}
                  </AppText>
                </View>
                <TouchableOpacity onPress={() => setSelectedOrderId(null)}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {/* Khách nhận + Gọi điện */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#F9FAFB',
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <AppText variant="bodySemiBold" color={colors.textPrimary}>
                      {selectedDetailOrder.customerName}
                    </AppText>
                    {!!selectedDetailOrder.customerPhone && (
                      <AppText variant="small" color={colors.textSecondary}>
                        SĐT: {selectedDetailOrder.customerPhone}
                      </AppText>
                    )}
                  </View>

                  {!!selectedDetailOrder.customerPhone && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        void Linking.openURL(
                          `tel:${selectedDetailOrder.customerPhone.replace(/[^\d+]/g, '')}`
                        ).catch(() => {
                          showToast({
                            message: 'Thiết bị chưa hỗ trợ gọi điện trực tiếp.',
                            type: 'error',
                          });
                        });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: colors.primarySoft,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      <Phone size={14} color={colors.primary} />
                      <AppText variant="captionSemiBold" color={colors.primary}>
                        Gọi khách
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>

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
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      Địa chỉ giao hàng
                    </AppText>
                    <AppText variant="small" color={colors.textPrimary} style={{ marginTop: 2 }}>
                      {selectedDetailOrder.address}
                    </AppText>
                    {!!selectedDetailOrder.deliveryNote && (
                      <AppText
                        variant="small"
                        color={colors.primary}
                        style={{ fontWeight: '700', marginTop: 5 }}
                      >
                        Ghi chú giao nhận: {selectedDetailOrder.deliveryNote}
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
                    Danh sách món ({selectedDetailOrder.items.length} món)
                  </AppText>
                  {selectedDetailOrder.items.map((it: any, idx: number) => {
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

                {/* Chi tiết tiền & Tổng thanh toán */}
                {(() => {
                  const itemsSum = selectedDetailOrder.items.reduce(
                    (sum: number, it: any) =>
                      sum +
                      Number(
                        it.lineTotal || (it.unitPrice || it.price || 0) * (it.quantity || 1)
                      ),
                    0
                  );
                  const orderSubtotal = Number(selectedDetailOrder.subtotal || itemsSum);
                  const orderDeliveryFee = Number(selectedDetailOrder.deliveryFee || 0);
                  const orderDiscount = Number(selectedDetailOrder.discount || 0);
                  const orderMemberDiscount = Number(selectedDetailOrder.memberDiscount || 0);
                  const orderVoucherCode = String(
                    selectedDetailOrder.voucherCode || selectedDetailOrder.promoCode || ''
                  ).trim();

                  return (
                    <View style={{ marginBottom: 10 }}>
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
                          {selectedDetailOrder.paymentMethod === 'payos'
                            ? 'Thanh toán chuyển khoản QR'
                            : 'Thu tiền mặt khi giao (COD)'}
                        </AppText>
                        <AppText variant="price" color={colors.primary}>
                          {formatCurrency(selectedDetailOrder.total)}
                        </AppText>
                      </View>
                    </View>
                  );
                })()}

                {/* Lý do giao thất bại nếu có */}
                {(selectedDetailOrder.status === 'CANCELLED' ||
                  selectedDetailOrder.status === 'REJECTED') &&
                  !!selectedDetailOrder.cancelReason && (
                    <View
                      style={{
                        backgroundColor: '#FEF2F2',
                        borderWidth: 1,
                        borderColor: '#FECACA',
                        borderRadius: 12,
                        padding: 10,
                        marginTop: 4,
                      }}
                    >
                      <AppText variant="captionSemiBold" color="#DC2626">
                        Lý do sự cố / không giao được:
                      </AppText>
                      <AppText variant="small" color="#991B1B" style={{ marginTop: 2 }}>
                        {selectedDetailOrder.cancelReason}
                      </AppText>
                    </View>
                  )}

                {/* Ảnh bằng chứng nếu đã giao */}
                {!!selectedDetailOrder.deliveryProofImage && (
                  <View
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 10,
                      marginTop: 4,
                    }}
                  >
                    <AppText
                      variant="captionSemiBold"
                      color={colors.textPrimary}
                      style={{ marginBottom: 6 }}
                    >
                      Ảnh xác nhận khách đã nhận hàng:
                    </AppText>
                    <Image
                      source={{ uri: selectedDetailOrder.deliveryProofImage }}
                      style={{
                        width: '100%',
                        height: 170,
                        borderRadius: 8,
                        backgroundColor: '#E5E7EB',
                      }}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </ScrollView>

              {/* Nút hành động */}
              {selectedDetailOrder.status === 'READY' ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => void handleStartDelivery(selectedDetailOrder)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: colors.primary,
                    paddingVertical: 13,
                    borderRadius: 12,
                  }}
                >
                  <Truck size={18} color="#FFFFFF" />
                  <AppText variant="captionSemiBold" color="#FFFFFF">
                    Xác nhận nhận bánh & Bắt đầu giao
                  </AppText>
                </TouchableOpacity>
              ) : selectedDetailOrder.status !== 'COMPLETED' &&
                selectedDetailOrder.status !== 'DELIVERED' &&
                selectedDetailOrder.status !== 'CANCELLED' &&
                selectedDetailOrder.status !== 'REJECTED' ? (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenCompleteModal(selectedDetailOrder)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: colors.primary,
                      paddingVertical: 13,
                      borderRadius: 12,
                    }}
                  >
                    <Camera size={18} color="#FFFFFF" />
                    <AppText variant="captionSemiBold" color="#FFFFFF">
                      Chụp ảnh & Xác nhận giao hoàn tất
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setFailingOrder(selectedDetailOrder);
                      setFailReason(STAFF_FAIL_REASONS[0]);
                    }}
                    style={{
                      paddingVertical: 11,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#FECACA',
                      backgroundColor: '#FEF2F2',
                      alignItems: 'center',
                    }}
                  >
                    <AppText variant="captionSemiBold" color="#DC2626">
                      Báo cáo sự cố
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppButton
                  title="Đóng"
                  variant="outline"
                  onPress={() => setSelectedOrderId(null)}
                />
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* MODAL CHỤP ẢNH XÁC NHẬN KHÁCH NHẬN HÀNG */}
      <Modal
        visible={!!completingOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setCompletingOrder(null)}
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
                  Xác nhận giao hàng
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  Đơn #{completingOrder?.orderCode} • Khách: {completingOrder?.customerName}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setCompletingOrder(null)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 12 }}>
              Vui lòng chụp ảnh (hoặc chọn ảnh) lúc khách hàng nhận bánh để làm bằng chứng giao hàng thành công:
            </AppText>

            {proofImage ? (
              <View style={{ marginBottom: 12 }}>
                <Image
                  source={{ uri: proofImage }}
                  style={{
                    width: '100%',
                    height: 190,
                    borderRadius: 12,
                    backgroundColor: '#F3F4F6',
                  }}
                  resizeMode="cover"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={pickImageFromCamera}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <Camera size={15} color={colors.textPrimary} />
                    <AppText variant="small" color={colors.textPrimary}>
                      Chụp lại
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={pickImageFromGallery}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <ImageIcon size={15} color={colors.textPrimary} />
                    <AppText variant="small" color={colors.textPrimary}>
                      Đổi ảnh khác
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View
                style={{
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: colors.primary,
                  backgroundColor: colors.primarySoft,
                  borderRadius: 14,
                  padding: 18,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Camera size={32} color={colors.primary} />
                <AppText
                  variant="bodySemiBold"
                  color={colors.textPrimary}
                  style={{ marginTop: 8 }}
                >
                  Chưa có ảnh xác nhận giao hàng
                </AppText>
                <AppText
                  variant="small"
                  color={colors.textSecondary}
                  style={{ textAlign: 'center', marginTop: 2, marginBottom: 14 }}
                >
                  Bắt buộc đính kèm 1 ảnh khách nhận hàng để hoàn tất đơn
                </AppText>

                <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={pickImageFromCamera}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: colors.primary,
                      paddingVertical: 11,
                      borderRadius: 10,
                    }}
                  >
                    <Camera size={16} color="#FFFFFF" />
                    <AppText variant="captionSemiBold" color="#FFFFFF">
                      Chụp ảnh
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={pickImageFromGallery}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: colors.primary,
                      paddingVertical: 11,
                      borderRadius: 10,
                    }}
                  >
                    <ImageIcon size={16} color={colors.primary} />
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      Chọn ảnh từ máy
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!!proofError && (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <AppText variant="small" color="#DC2626">
                  {proofError}
                </AppText>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <AppButton
                title="Hủy"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setCompletingOrder(null)}
              />
              <AppButton
                title="Hoàn tất giao hàng"
                style={{ flex: 1.5, opacity: proofImage ? 1 : 0.6 }}
                isLoading={submittingProof}
                onPress={handleConfirmDeliveryComplete}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL BÁO GIAO HÀNG THẤT BẠI / KHÁCH KHÔNG NHẬN */}
      <Modal
        visible={!!failingOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setFailingOrder(null)}
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
            <AppText variant="h3" color={colors.textPrimary} style={{ marginBottom: 4 }}>
              Báo cáo sự cố #{failingOrder?.orderCode}
            </AppText>
            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 12 }}>
              Chọn lý do sự cố (đơn sẽ không tính doanh thu và gửi báo cáo về Admin):
            </AppText>

            {STAFF_FAIL_REASONS.map((r) => {
              const active = failReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setFailReason(r)}
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
                onPress={() => setFailingOrder(null)}
              />
              <AppButton
                title="Gửi báo cáo"
                style={{ flex: 1.3 }}
                isLoading={submittingFail}
                onPress={handleConfirmFailDelivery}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
