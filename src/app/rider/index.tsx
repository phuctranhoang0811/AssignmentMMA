import React, { useCallback, useRef, useState } from 'react';
import { AppState, FlatList, Linking, Modal, Platform, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Bike, LogOut, MapPin, Package, Phone, Store, Wallet } from 'lucide-react-native';
import { AppButton } from '../../components/ui/AppButton';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { FAIL_REASON_LABELS, getRiderEarnings, listRiderOrders, riderFailOrder, riderOrderAction, type FailReason } from '../../services/orderApi';
import type { RiderEarnings, RiderOrder } from '../../types/order';
import { watchRiderOrders } from '../../services/payosService';
import { triggerHaptic } from '../../utils/haptics';
import { staffDeliveryTime, staffOrderTime } from '../../utils/staff';
import { formatCurrency } from '../../utils/formatCurrency';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/staffPortal.styles';

type Tab = 'available' | 'mine' | 'earnings';
type Action = 'accept' | 'release' | 'pickup' | 'deliver';
const TABS = [
  { key: 'available', title: 'Đơn chờ nhận', Icon: Package },
  { key: 'mine', title: 'Đơn của tôi', Icon: Bike },
  { key: 'earnings', title: 'Thu nhập', Icon: Wallet },
] as const;
const DONE_MESSAGE: Record<Action, string> = {
  accept: 'Đã nhận đơn. Khách được báo bạn đang tới lấy món.',
  release: 'Đã trả đơn về danh sách chờ.',
  pickup: 'Đã lấy món. Khách thấy đơn đang được giao.',
  deliver: 'Giao thành công!',
};

const openMap = (address: string) => {
  const query = encodeURIComponent(address);
  const url = Platform.OS === 'ios' ? `maps:?q=${query}` : `https://www.google.com/maps/search/?api=1&query=${query}`;
  return Linking.openURL(url);
};

export default function RiderOrdersScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const uid = user?.id;
  const [tab, setTab] = useState<Tab>('available');
  const [result, setResult] = useState<{ uid?: string; orders: RiderOrder[] }>({ orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [earnings, setEarnings] = useState<RiderEarnings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeliver, setConfirmDeliver] = useState<RiderOrder | null>(null);
  const [failing, setFailing] = useState<RiderOrder | null>(null);
  const [failReason, setFailReason] = useState<FailReason>('CUSTOMER_UNREACHABLE');
  const [logoutVisible, setLogoutVisible] = useState(false);
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const requestNumber = useRef(0);
  const actionInFlight = useRef(false);
  const orders = result.uid === uid ? result.orders : [];
  const available = orders.filter(order => !order.mine);
  const mine = orders.filter(order => order.mine);

  const load = useCallback(async () => {
    const number = ++requestNumber.current;
    if (!uid) return;
    setLoading(true);
    try {
      // Earnings are secondary: if they fail to load, the orders still show.
      const [next, money] = await Promise.all([listRiderOrders(), getRiderEarnings().catch(() => null)]);
      if (currentUid.current !== uid || number !== requestNumber.current) return;
      setResult({ uid, orders: next });
      if (money) setEarnings(money);
      setError('');
    } catch (failure) {
      if (currentUid.current === uid && number === requestNumber.current) {
        setError(failure instanceof Error ? failure.message : 'Chưa thể tải đơn giao.');
      }
    } finally {
      if (currentUid.current === uid && number === requestNumber.current) setLoading(false);
    }
  }, [uid]);

  useFocusEffect(useCallback(() => {
    void load();
    // Riders' own live channel: a free order appearing, or one being taken, reloads the list.
    let stopSocket = () => {};
    try {
      stopSocket = watchRiderOrders(event => {
        if (event.available) {
          triggerHaptic('success');
          showToast({ message: 'Có đơn mới sẵn sàng để giao', type: 'info' });
        }
        void load();
      }, () => { void load(); });
    } catch { /* No backend address configured: the poll below still works. */ }
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => {
      stopSocket();
      clearInterval(timer);
      subscription.remove();
      requestNumber.current++;
    };
  }, [load, showToast]));

  const run = async (order: RiderOrder, action: Action) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(order.id);
    try {
      await riderOrderAction(order.id, action);
      if (currentUid.current !== uid) return;
      setConfirmDeliver(null);
      triggerHaptic('success');
      showToast({ message: DONE_MESSAGE[action], type: 'success' });
      if (action === 'accept') setTab('mine');
    } catch (failure) {
      if (currentUid.current === uid) showToast({ message: failure instanceof Error ? failure.message : 'Thao tác chưa hoàn tất.', type: 'error' });
    } finally {
      actionInFlight.current = false;
      setBusy(null);
      await load();
    }
  };

  const reportFailure = async () => {
    const order = failing;
    if (!order || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(order.id);
    try {
      await riderFailOrder(order.id, failReason);
      setFailing(null);
      showToast({ message: 'Đã báo giao thất bại. Cửa hàng sẽ xử lý đơn.', type: 'success' });
    } catch (failure) {
      showToast({ message: failure instanceof Error ? failure.message : 'Chưa báo được. Vui lòng thử lại.', type: 'error' });
    } finally {
      actionInFlight.current = false;
      setBusy(null);
      await load();
    }
  };

  const signOut = async () => {
    if (actionInFlight.current) return;
    setBusy('logout');
    try {
      await logout();
      router.replace('/(tabs)/home');
    } catch {
      showToast({ message: 'Chưa thể đăng xuất. Vui lòng thử lại.', type: 'error' });
    } finally {
      setBusy(null);
      setLogoutVisible(false);
    }
  };

  const renderOrder = ({ item: order }: { item: RiderOrder }) => {
    const createdAt = staffOrderTime(order.createdAt);
    const paid = order.paymentStatus === 'PAID';
    const pickedUp = order.status === 'OUT_FOR_DELIVERY';
    return <View style={styles.orderCard}>
      <View style={styles.cardHeader}>
        <View style={styles.orderCodeCol}>
          <Text style={styles.orderCodeText}>#{order.orderCode}</Text>
          <Text style={styles.orderTimestampText}>{createdAt === undefined ? '' : new Date(createdAt).toLocaleString('vi-VN')}</Text>
        </View>
        <Text style={styles.itemSubDetails}>{!order.mine ? 'Chờ tài xế' : pickedUp ? 'Đang giao' : 'Đang tới lấy món'}</Text>
      </View>
      <View style={styles.customerBox}>
        <View style={styles.customerRow}>
          <Text style={[styles.customerName, { flex: 1 }]}>{order.mine ? order.customer?.fullname || 'Khách hàng' : 'Khách hàng'}</Text>
          {/* Calling the customer only makes sense once the rider owns the order. */}
          {order.mine && !!order.customer?.phone && <TouchableOpacity style={styles.callBtn} accessibilityRole="button"
            accessibilityLabel={`Gọi khách ${order.customer?.phone}`} onPress={() => {
              void Linking.openURL(`tel:${order.customer?.phone.replace(/[^\d+]/g, '')}`).catch(() => {
                showToast({ message: 'Thiết bị chưa hỗ trợ gọi điện.', type: 'error' });
              });
            }}>
            <Phone size={12} color={colors.success} /><Text style={styles.callBtnText}>{order.customer.phone}</Text>
          </TouchableOpacity>}
        </View>
        <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Mở bản đồ tới ${order.address}`}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}
          onPress={() => void openMap(order.address).catch(() => showToast({ message: 'Chưa mở được bản đồ.', type: 'error' }))}>
          <MapPin size={14} color={colors.primary} style={{ marginTop: 2 }} />
          <Text style={[styles.fulfillmentText, { flex: 1, textDecorationLine: 'underline' }]}>{order.address}</Text>
        </TouchableOpacity>
        {order.mine && !!order.deliveryTime && <Text style={styles.itemSubDetails}>Hẹn: {staffDeliveryTime(order.deliveryTime)}</Text>}
        {order.mine && !!order.deliveryNote && <Text style={styles.noteHighlightText}>Ghi chú giao: {order.deliveryNote}</Text>}
        <Text style={styles.itemSubDetails}>{order.itemCount} món</Text>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.priceRow}>
          <Text style={[styles.paymentStatusText, { flex: 1, color: colors.success }]}>Tiền công: {formatCurrency(order.riderPay)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.paymentStatusText, { flex: 1, color: paid ? colors.success : colors.error }]}>
            {paid ? 'ĐÃ THANH TOÁN • không thu tiền' : 'THU HỘ KHI GIAO'}
          </Text>
          <Text style={styles.totalAmountText}>{formatCurrency(order.codAmount)}</Text>
        </View>
        {!order.mine && <AppButton title="Nhận đơn này" disabled={busy !== null} isLoading={busy === order.id}
          onPress={() => void run(order, 'accept')} />}
        {order.mine && !pickedUp && <>
          <AppButton title="Đã lấy món, bắt đầu giao" disabled={busy !== null} isLoading={busy === order.id}
            onPress={() => void run(order, 'pickup')} />
          <AppButton title="Trả đơn" variant="ghost" disabled={busy !== null} onPress={() => void run(order, 'release')} />
        </>}
        {pickedUp && <>
          <AppButton title="Giao thành công" disabled={busy !== null} isLoading={busy === order.id}
            onPress={() => setConfirmDeliver(order)} />
          <AppButton title="Giao thất bại" variant="ghost" disabled={busy !== null}
            onPress={() => { setFailReason('CUSTOMER_UNREACHABLE'); setFailing(order); }} />
        </>}
      </View>
    </View>;
  };

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.storeBranchRow}><Store size={14} color={colors.primary} /><Text style={styles.storeBranchText}>Cổng tài xế giao hàng</Text></View>
        <View style={styles.topBarRow}>
          <View style={styles.staffInfoCol}>
            <Text style={styles.staffNameText}>{user?.fullname}</Text>
            <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>TÀI XẾ</Text></View>
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
          accessibilityState={{ selected: tab === key }} style={[styles.tabBtn, tab === key && styles.activeTabBtn]} onPress={() => setTab(key)}>
          <Icon size={14} color={tab === key ? colors.white : colors.textSecondary} />
          <Text style={[styles.tabText, tab === key && styles.activeTabText]}>{title}</Text>
          {key !== 'earnings' && <Text style={[styles.badgeText, tab === key && styles.activeBadgeText]}>{(key === 'available' ? available : mine).length}</Text>}
        </TouchableOpacity>)}
      </View>
      {!!error && <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ color: colors.error }} accessibilityLiveRegion="polite">{error}</Text>
        <AppButton title="Thử tải lại" size="sm" variant="outline" onPress={() => void load()} />
      </View>}
      {tab === 'earnings' ? <FlatList data={earnings?.recent ?? []} keyExtractor={trip => trip.id} contentContainerStyle={styles.scrollContent}
        refreshing={loading} onRefresh={() => void load()}
        ListHeaderComponent={<View style={styles.orderCard}>
          <Text style={styles.orderCodeText}>{formatCurrency(earnings?.today ?? 0)}</Text>
          <Text style={styles.itemSubDetails}>Hôm nay</Text>
          <View style={styles.priceRow}><Text style={[styles.paymentStatusText, { flex: 1 }]}>Tuần này (từ thứ Hai)</Text><Text style={styles.totalAmountText}>{formatCurrency(earnings?.week ?? 0)}</Text></View>
          <View style={styles.priceRow}><Text style={[styles.paymentStatusText, { flex: 1 }]}>Tổng cộng • {earnings?.trips ?? 0} chuyến</Text><Text style={styles.totalAmountText}>{formatCurrency(earnings?.total ?? 0)}</Text></View>
          {!!earnings && earnings.unsettled.trips > 0 && <View style={{ marginTop: 8 }}>
            <Text style={styles.noteHighlightText}>Chưa đối soát với cửa hàng ({earnings.unsettled.trips} chuyến)</Text>
            <View style={styles.priceRow}><Text style={[styles.paymentStatusText, { flex: 1 }]}>Tiền công được nhận</Text><Text style={[styles.totalAmountText, { color: colors.success }]}>{formatCurrency(earnings.unsettled.earned)}</Text></View>
            <View style={styles.priceRow}><Text style={[styles.paymentStatusText, { flex: 1 }]}>Tiền mặt đang giữ</Text><Text style={[styles.totalAmountText, { color: colors.error }]}>{formatCurrency(earnings.unsettled.cash)}</Text></View>
            <Text style={styles.itemSubDetails}>
              {earnings.unsettled.cash >= earnings.unsettled.earned
                ? `Khi đối soát, bạn nộp lại cửa hàng ${formatCurrency(earnings.unsettled.cash - earnings.unsettled.earned)}.`
                : `Khi đối soát, cửa hàng trả bạn ${formatCurrency(earnings.unsettled.earned - earnings.unsettled.cash)}.`}
            </Text>
          </View>}
        </View>}
        renderItem={({ item: trip }) => <View style={styles.orderCard}>
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderCodeText}>#{trip.orderCode}</Text>
              <Text style={styles.itemSubDetails}>{trip.deliveredAt ? new Date(trip.deliveredAt).toLocaleString('vi-VN') : ''}{trip.distanceKm ? ` • ${trip.distanceKm} km` : ''}{trip.failed ? ' • Giao thất bại' : ''}</Text>
            </View>
            <Text style={[styles.totalAmountText, { color: colors.success }]}>+{formatCurrency(trip.earned)}</Text>
          </View>
        </View>}
        ListEmptyComponent={<View style={styles.emptyTabContainer}><Text style={styles.emptyTitle}>Chưa có chuyến nào hoàn tất.</Text></View>} />
      : <FlatList data={tab === 'available' ? available : mine} keyExtractor={order => order.id}
        contentContainerStyle={styles.scrollContent} renderItem={renderOrder} refreshing={loading} onRefresh={() => void load()}
        ListEmptyComponent={<View style={styles.emptyTabContainer}>
          {loading ? <ActivityIndicator color={colors.primary} />
            : <Text style={styles.emptyTitle}>{tab === 'available' ? 'Chưa có đơn nào sẵn sàng để giao.' : 'Bạn chưa nhận đơn nào.'}</Text>}
          <Text style={styles.emptyDesc}>Danh sách tự cập nhật khi bếp báo món sẵn sàng.</Text>
        </View>} />}
    </View>

    <Modal visible={confirmDeliver !== null} transparent animationType="slide" onRequestClose={() => { if (busy === null) setConfirmDeliver(null); }}>
      <View style={styles.modalOverlay}><View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Giao xong đơn #{confirmDeliver?.orderCode}?</Text>
        {!!confirmDeliver && confirmDeliver.codAmount > 0 &&
          <Text style={styles.fulfillmentText}>Nhớ thu {formatCurrency(confirmDeliver.codAmount)} tiền mặt từ khách.</Text>}
        <AppButton title="Xác nhận đã giao" isLoading={busy !== null} disabled={busy !== null}
          onPress={() => { if (confirmDeliver) void run(confirmDeliver, 'deliver'); }} />
        <AppButton title="Quay lại" variant="ghost" disabled={busy !== null} onPress={() => setConfirmDeliver(null)} />
      </View></View>
    </Modal>
    <Modal visible={failing !== null} transparent animationType="slide" onRequestClose={() => { if (busy === null) setFailing(null); }}>
      <View style={styles.modalOverlay}><View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Vì sao không giao được đơn #{failing?.orderCode}?</Text>
        {(Object.keys(FAIL_REASON_LABELS) as FailReason[]).map(key => <TouchableOpacity key={key} accessibilityRole="radio"
          accessibilityState={{ checked: failReason === key }} disabled={busy !== null}
          style={[styles.reasonOption, failReason === key && styles.activeReasonOption]} onPress={() => setFailReason(key)}>
          <Text style={[styles.reasonText, failReason === key && styles.activeReasonText]}>{FAIL_REASON_LABELS[key]}</Text>
        </TouchableOpacity>)}
        <Text style={styles.itemSubDetails}>Đơn sẽ bị hủy. Nếu khách không có lỗi, cửa hàng sẽ xem xét trả công chuyến này.</Text>
        <AppButton title="Xác nhận giao thất bại" variant="danger" isLoading={busy !== null} disabled={busy !== null} onPress={() => { void reportFailure(); }} />
        <AppButton title="Quay lại" variant="ghost" disabled={busy !== null} onPress={() => setFailing(null)} />
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
