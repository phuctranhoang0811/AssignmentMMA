import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, ChefHat, Clock, LogOut, Phone, Search, Store, X } from 'lucide-react-native';
import { AppButton } from '../../components/ui/AppButton';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { advanceStaffOrder, listStaffOrders, rejectStaffOrder, unassignRiderOrder, type StaffOrder } from '../../services/orderApi';
import { Alert } from '../../utils/alert';
import { watchStaffOrders } from '../../services/payosService';
import { triggerHaptic } from '../../utils/haptics';
import { updateDeliveryOrder } from '../../services/deliveryService';
import { deliveryStatusLabels } from '../../types/delivery';
import { canRejectStaffOrder, filterStaffOrders, isAdminRole, staffDeliveryTime, staffOrderAction, staffOrderTime, type StaffTab } from '../../utils/staff';
import { formatCurrency } from '../../utils/formatCurrency';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/staffPortal.styles';

const TABS = [
  { key: 'pending', title: 'Chờ duyệt', Icon: Clock },
  { key: 'kitchen', title: 'Bếp & Giao', Icon: ChefHat },
  { key: 'completed', title: 'Đã xong', Icon: CheckCircle2 },
] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang làm',
  READY: 'Sẵn sàng', OUT_FOR_DELIVERY: 'Đang giao', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
};
const REJECT_REASONS = ['Hết nguyên liệu làm bánh', 'Ngoài vùng giao hàng', 'Cửa hàng quá tải', 'Không liên lạc được khách', 'Khách yêu cầu hủy', 'Lý do khác'];

export default function StaffOrdersScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const uid = user?.id;
  const [activeTab, setActiveTab] = useState<StaffTab>('pending');
  const [fulfillment, setFulfillment] = useState('ALL');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<{ uid?: string; orders: StaffOrder[] }>({ orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ order: StaffOrder; kind: 'accept' | 'reject' } | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [logoutVisible, setLogoutVisible] = useState(false);
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const requestNumber = useRef(0);
  const pendingLoads = useRef(0);
  const actionInFlight = useRef(false);
  const allOrders = result.uid === uid ? result.orders : [];

  const load = useCallback(async () => {
    const number = ++requestNumber.current;
    if (!uid) return;
    pendingLoads.current++;
    setLoading(true);
    try {
      const orders = await listStaffOrders();
      if (currentUid.current !== uid || number !== requestNumber.current) return;
      setResult({ uid, orders });
      setError('');
    } catch (failure) {
      if (currentUid.current === uid && number === requestNumber.current) {
        setError(failure instanceof Error ? failure.message : 'Chưa thể tải đơn hàng.');
      }
    } finally {
      pendingLoads.current--;
      if (currentUid.current === uid && number === requestNumber.current) setLoading(false);
    }
  }, [uid]);

  useFocusEffect(useCallback(() => {
    void load();
    // Use the authenticated backend; Firestore clients cannot read or modify every customer's orders.
    // The socket delivers changes at once; the slow poll only covers a dropped connection.
    let stopSocket = () => {};
    try {
      stopSocket = watchStaffOrders(event => {
        if (event.kind === 'new') {
          triggerHaptic('success');
          showToast({ message: `Có đơn mới #${event.orderCode ?? ''}`.trim(), type: 'info' });
        }
        void load();
      }, () => { void load(); }, alert => {
        triggerHaptic('warning');
        const text = alert.kind === 'RIDER_NO_PICKUP' ? `Tài xế nhận đơn #${alert.orderCode} ${alert.waitedMinutes} phút vẫn chưa tới lấy món!`
          : alert.kind === 'RIDER_OVERDUE' ? `Đơn #${alert.orderCode} đã giao ${alert.waitedMinutes} phút chưa xong. Hãy liên hệ tài xế!`
          : `Đơn #${alert.orderCode} đã chờ ${alert.waitedMinutes} phút chưa được xác nhận!`;
        showToast({ message: text, type: 'error' });
      });
    } catch { /* No backend address configured: the poll below still works. */ }
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && pendingLoads.current === 0) void load();
    }, 60000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void load();
    });
    return () => {
      stopSocket();
      clearInterval(timer);
      subscription.remove();
      requestNumber.current++;
    };
  }, [load, showToast]));

  const run = async (order: StaffOrder, action: () => Promise<unknown>) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(order.id);
    try {
      await action();
      if (currentUid.current !== uid) return;
      setConfirmation(null);
      showToast({ message: `Đã cập nhật đơn #${order.orderCode}.`, type: 'success' });
      await load();
    } catch (failure) {
      if (currentUid.current === uid) {
        showToast({ message: failure instanceof Error ? failure.message : 'Thao tác chưa hoàn tất.', type: 'error' });
        await load();
      }
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  };
  const openReject = (order: StaffOrder) => {
    setReason(REJECT_REASONS[0]);
    setCustomReason('');
    setConfirmation({ order, kind: 'reject' });
  };
  const closeConfirmation = () => { if (!actionInFlight.current) setConfirmation(null); };
  const finalReason = reason === 'Lý do khác' ? customReason.trim() : reason;
  const confirm = () => {
    if (!confirmation || (confirmation.kind === 'reject' && !finalReason)) return;
    const { order, kind } = confirmation;
    void run(order, () => kind === 'accept' ? advanceStaffOrder(order.id) : rejectStaffOrder(order.id, finalReason));
  };
  const signOut = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy('logout');
    try {
      await logout();
      router.replace('/(tabs)/home');
    } catch {
      showToast({ message: 'Chưa thể đăng xuất. Vui lòng thử lại.', type: 'error' });
    } finally {
      actionInFlight.current = false;
      setBusy(null);
      setLogoutVisible(false);
    }
  };

  const renderOrder = ({ item: order }: { item: StaffOrder }) => {
    const action = staffOrderAction(order);
    const createdAt = staffOrderTime(order.createdAt);
    const elapsed = createdAt === undefined ? undefined : Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
    const urgent = order.status === 'PENDING_CONFIRMATION' && elapsed !== undefined && elapsed >= 5;
    const paid = order.paymentStatus === 'PAID' || order.paymentStatus === 'PAID_DEMO';
    return <View style={[styles.orderCard, urgent && styles.orderCardUrgent]}>
      <View style={styles.cardHeader}>
        <View style={styles.orderCodeCol}>
          <Text style={styles.orderCodeText}>#{order.orderCode}</Text>
          <Text style={styles.orderTimestampText}>{createdAt === undefined ? '' : new Date(createdAt).toLocaleString('vi-VN')}</Text>
        </View>
        <View>
          <Text style={styles.itemSubDetails}>{STATUS_LABEL[order.status] ?? order.status}</Text>
          {order.status === 'PENDING_CONFIRMATION' && elapsed !== undefined &&
            <Text style={[styles.timerText, { color: urgent ? colors.error : colors.textSecondary }]}>Chờ {elapsed} phút</Text>}
        </View>
      </View>
      <View style={styles.customerBox}>
        <View style={styles.customerRow}>
          <Text style={[styles.customerName, { flex: 1 }]}>{order.customer?.fullname || 'Khách hàng'}</Text>
          {!!order.customer?.phone && <TouchableOpacity style={styles.callBtn} accessibilityRole="button"
            accessibilityLabel={`Gọi khách ${order.customer.phone}`} onPress={() => {
              void Linking.openURL(`tel:${order.customer.phone.replace(/[^\d+]/g, '')}`).catch(() => {
                showToast({ message: 'Thiết bị chưa hỗ trợ gọi điện.', type: 'error' });
              });
            }}>
            <Phone size={12} color={colors.success} /><Text style={styles.callBtnText}>{order.customer.phone}</Text>
          </TouchableOpacity>}
        </View>
        <Text style={styles.fulfillmentText}>{order.fulfillmentType === 'delivery' ? `Giao đến: ${order.address}` : 'Nhận tại cửa hàng'}</Text>
        {!!order.deliveryTime && <Text style={styles.itemSubDetails}>Hẹn: {staffDeliveryTime(order.deliveryTime)}</Text>}
        {!!order.deliveryNote && <Text style={styles.noteHighlightText}>Ghi chú giao: {order.deliveryNote}</Text>}
      </View>
      <View style={styles.itemsContainer}>
        {order.items?.map((item, index) => <View key={index} style={styles.itemRow}>
          <View style={styles.itemMain}>
            <Text style={styles.itemName}>{item.quantity} × {item.productName}</Text>
            <Text style={styles.itemSubDetails}>{[item.variantName, ...(item.addonNames ?? []),
              ...(Array.isArray(item.customizationSummary) ? item.customizationSummary : [item.customizationSummary])].filter(Boolean).join(' • ')}</Text>
            {!!item.note && <Text style={styles.noteHighlightText}>Ghi chú bếp: {item.note}</Text>}
          </View>
          {item.lineTotal !== undefined && <Text style={styles.itemPrice}>{formatCurrency(item.lineTotal)}</Text>}
        </View>)}
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.priceRow}>
          <Text style={[styles.paymentStatusText, { flex: 1, color: paid ? colors.success : colors.textSecondary }]}>
            {order.paymentName || order.paymentMethod || 'Tiền mặt'} • {order.paymentStatus === 'REFUND_PENDING'
              ? 'CHỜ HOÀN TIỀN' : paid ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN'}
          </Text>
          <Text style={styles.totalAmountText}>{formatCurrency(order.total)}</Text>
        </View>
        {!!order.delivery && <Text style={styles.fulfillmentText}>Ahamove: {deliveryStatusLabels[order.delivery.status]}</Text>}
        {!!order.rider && <Text style={styles.fulfillmentText}>Tài xế: {order.rider.name}{order.rider.phone ? ` • ${order.rider.phone}` : ''}</Text>}
        {!!action && <AppButton title={action} disabled={busy !== null} isLoading={busy === order.id}
          onPress={() => order.status === 'PENDING_CONFIRMATION' ? setConfirmation({ order, kind: 'accept' })
            : void run(order, () => advanceStaffOrder(order.id))} />}
        {order.delivery?.provider === 'AHAMOVE' && order.status === 'READY' && order.delivery.status === 'NOT_REQUESTED' &&
          <AppButton title="Gọi tài xế Ahamove" disabled={busy !== null} isLoading={busy === order.id}
            onPress={() => void run(order, () => updateDeliveryOrder(order.id, 'dispatch'))} />}
        {!!order.delivery?.providerOrderId && <AppButton title="Kiểm tra chuyến" variant="outline" disabled={busy !== null}
          onPress={() => void run(order, () => updateDeliveryOrder(order.id, 'refresh'))} />}
        {!!order.rider && (order.status === 'READY' || (order.status === 'OUT_FOR_DELIVERY' && isAdminRole(user?.role))) &&
          <AppButton title={order.status === 'READY' ? 'Gỡ tài xế' : 'Hủy chuyến giao'} variant="outline" disabled={busy !== null}
            onPress={() => order.status === 'READY' ? void run(order, () => unassignRiderOrder(order.id))
              : Alert.alert('Hủy chuyến giao?', `Đơn #${order.orderCode} sẽ bị hủy${order.paymentStatus === 'PAID' ? ' và chuyển vào hàng chờ hoàn tiền' : ''}. Tài xế vẫn được trả công chuyến này.`, [
                { text: 'Không', style: 'cancel' },
                { text: 'Hủy chuyến', style: 'destructive', onPress: () => { void run(order, () => unassignRiderOrder(order.id)); } },
              ])} />}
        {canRejectStaffOrder(order) && <AppButton title="Từ chối đơn" variant="ghost" disabled={busy !== null} onPress={() => openReject(order)} />}
      </View>
    </View>;
  };

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.storeBranchRow}><Store size={14} color={colors.primary} /><Text style={styles.storeBranchText}>Pizza FPT • Khu vực nhân viên</Text></View>
        <View style={styles.topBarRow}>
          <View style={styles.staffInfoCol}>
            <Text style={styles.staffNameText}>{user?.fullname}</Text>
            <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>VẬN HÀNH CA TRỰC</Text></View>
          </View>
          <View style={styles.topBarRightIcons}>
            <TouchableOpacity style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Về trang khách hàng" disabled={busy !== null} onPress={() => router.replace('/(tabs)/home')}>
              <ArrowLeft size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Đăng xuất" disabled={busy !== null} onPress={() => setLogoutVisible(true)}>
              <LogOut size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.tabContainer}>
        {TABS.map(({ key, title, Icon }) => <TouchableOpacity key={key} accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === key }} style={[styles.tabBtn, activeTab === key && styles.activeTabBtn]}
          onPress={() => setActiveTab(key)}>
          <Icon size={14} color={activeTab === key ? colors.white : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{title}</Text>
          <Text style={[styles.badgeText, activeTab === key && styles.activeBadgeText]}>{filterStaffOrders(allOrders, key).length}</Text>
        </TouchableOpacity>)}
      </View>
      <View style={styles.filterBar}>
        <View style={styles.searchBox}><Search size={16} color={colors.textSecondary} />
          <TextInput style={styles.searchInput} accessibilityLabel="Tìm đơn theo mã, tên hoặc số điện thoại" placeholder="Mã, tên, SĐT..." value={search} onChangeText={setSearch} />
        </View>
        {[['delivery', 'Giao'], ['takeaway', 'Tại quầy']].map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button"
          accessibilityState={{ selected: fulfillment === value }} style={[styles.filterChip, fulfillment === value && styles.activeFilterChip]}
          onPress={() => setFulfillment(fulfillment === value ? 'ALL' : value)}>
          <Text style={[styles.filterChipText, fulfillment === value && styles.activeFilterChipText]}>{label}</Text>
        </TouchableOpacity>)}
      </View>
      {!!error && <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ color: colors.error }} accessibilityLiveRegion="polite">{error}</Text>
        <AppButton title="Thử tải lại" size="sm" variant="outline" onPress={() => void load()} />
      </View>}
      <FlatList data={filterStaffOrders(allOrders, activeTab, fulfillment, search)} keyExtractor={order => order.id}
        contentContainerStyle={styles.scrollContent} renderItem={renderOrder} refreshing={loading} onRefresh={() => void load()}
        ListEmptyComponent={<View style={styles.emptyTabContainer}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.emptyTitle}>Không có đơn phù hợp.</Text>}
          <Text style={styles.emptyDesc}>Kéo xuống để tải lại. Danh sách tự cập nhật mỗi 15 giây khi mở màn hình.</Text>
        </View>} />
    </View>

    <Modal visible={confirmation !== null} transparent animationType="slide" onRequestClose={closeConfirmation}>
      <View style={styles.modalOverlay}><View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{confirmation?.kind === 'reject' ? 'Từ chối' : 'Xác nhận'} đơn #{confirmation?.order.orderCode}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng xác nhận" disabled={busy !== null} onPress={closeConfirmation}><X size={20} color={colors.textSecondary} /></TouchableOpacity>
        </View>
        {confirmation?.kind === 'reject' ? <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.itemSubDetails}>Đơn đã thanh toán sẽ được đánh dấu chờ hoàn tiền.</Text>
          {REJECT_REASONS.map(option => <TouchableOpacity key={option} accessibilityRole="radio" accessibilityState={{ checked: reason === option }}
            disabled={busy !== null} style={[styles.reasonOption, reason === option && styles.activeReasonOption]} onPress={() => setReason(option)}>
            <Text style={[styles.reasonText, reason === option && styles.activeReasonText]}>{option}</Text>
          </TouchableOpacity>)}
          {reason === 'Lý do khác' && <TextInput style={styles.customReasonInput} accessibilityLabel="Lý do từ chối" placeholder="Nhập lý do từ chối..." multiline maxLength={300} editable={busy === null} value={customReason} onChangeText={setCustomReason} />}
        </ScrollView> : <Text style={styles.fulfillmentText}>Đơn hàng sẽ được xác nhận và chuyển vào khu vực bếp.</Text>}
        <AppButton title={confirmation?.kind === 'reject' ? 'Xác nhận từ chối' : 'Xác nhận đơn'} variant={confirmation?.kind === 'reject' ? 'danger' : 'primary'}
          isLoading={busy !== null} disabled={busy !== null || (confirmation?.kind === 'reject' && !finalReason)} onPress={confirm} />
        <AppButton title="Quay lại" variant="ghost" disabled={busy !== null} onPress={closeConfirmation} />
      </View></View>
    </Modal>
    <Modal visible={logoutVisible} transparent animationType="fade" onRequestClose={() => { if (busy === null) setLogoutVisible(false); }}>
      <View style={styles.modalOverlay}><View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Đăng xuất ca làm?</Text>
        <AppButton title="Đăng xuất" variant="danger" isLoading={busy === 'logout'} disabled={busy !== null} onPress={() => void signOut()} />
        <AppButton title="Quay lại" variant="ghost" disabled={busy !== null} onPress={() => setLogoutVisible(false)} />
      </View></View>
    </Modal>
  </SafeAreaView>;
}
