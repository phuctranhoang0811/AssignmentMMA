import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Linking,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatCurrency } from '../../utils/formatCurrency';
import { estimatedWindow } from '../../utils/orderTime';
import { triggerHaptic } from '../../utils/haptics';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import { styles, BRAND_RED } from '../../styles/orderTracking.styles';
import { FLOATING_CART_CLEARANCE } from '../../styles/tabsLayout.styles';
import { DeliveryDetails } from './DeliveryDetails';
import { OrderTimeline } from './OrderTimeline';
import { OrderReviewCard } from './OrderReviewCard';
import { OrderIssueCard } from './OrderIssueCard';
import { OrderCancellationCard } from './OrderCancellationCard';
import { AppButton } from '../ui/AppButton';
import { cancelOrder } from '../../services/orderApi';

function formatExpectedTime(order: any): string {
  const raw = String(order?.deliveryTime ?? '').trim();
  if (/^\d{1,2}:\d{2}/.test(raw)) {
    return raw.slice(0, 5);
  }
  const createdSec = order?.createdAt?.seconds ?? order?.createdAt?._seconds;
  const baseMs = createdSec ? createdSec * 1000 : Date.parse(order?.createdAt) || 0;
  if (baseMs > 0) {
    const expected = new Date(baseMs + 30 * 60 * 1000);
    const hh = String(expected.getHours()).padStart(2, '0');
    const mm = String(expected.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return '10:30';
}

function formatPaymentLabel(order: any): string {
  if (order?.paymentName) return order.paymentName;
  const method = String(order?.paymentMethod ?? '').toUpperCase();
  if (!method || method === 'CASH' || method === 'COD') return 'Tiền mặt';
  if (method === 'PAYOS' || method === 'BANK_TRANSFER' || method === 'QR') return 'Chuyển khoản QR';
  return order.paymentMethod;
}

function getOrderTimestampMs(order: any): number {
  const createdAt = order?.createdAt;
  if (!createdAt) return 0;
  if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
  const sec = createdAt?.seconds ?? createdAt?._seconds;
  if (typeof sec === 'number') return sec * 1000;
  if (typeof createdAt === 'number') return createdAt;
  const parsed = Date.parse(String(createdAt));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isOrderFromToday(order: any, nowMs: number): boolean {
  const ts = getOrderTimestampMs(order);
  if (!ts) return false;
  const orderDate = new Date(ts);
  const today = new Date(nowMs);
  return (
    orderDate.getFullYear() === today.getFullYear() &&
    orderDate.getMonth() === today.getMonth() &&
    orderDate.getDate() === today.getDate()
  );
}

function isOrderFinished(order: any): boolean {
  const status = String(order?.status ?? '').toUpperCase();
  return ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(status);
}

export default function OrderTrackingScreen({ historyOnly = false }: { historyOnly?: boolean }) {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [result, setResult] = useState<{ owner?: string; orders: any[]; error: string; loading: boolean }>({ orders: [], error: '', loading: true });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const owner = user && !user.isDemo ? user.id : undefined;
  const orders = result.owner === owner ? result.orders : [];
  const error = result.owner === owner ? result.error : '';
  const isLoading = !!owner && (result.owner !== owner || result.loading);
  const visibleOrders = historyOnly
    ? orders.filter(order => isOrderFinished(order) || !isOrderFromToday(order, nowMs))
    : orders.filter(order => isOrderFromToday(order, nowMs) && !isOrderFinished(order));
  const selectedOrder = visibleOrders.find(order => order.id === selectedId);

  useEffect(() => {
    setSelectedId(orderId ?? null);
    setResult({ owner, orders: [], error: '', loading: !!owner });
    if (!owner) return;
    let active = true;
    const stop = onSnapshot(query(collection(db, 'orders'), where('userId', '==', owner)), snapshot => {
      if (!active) return;
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      const timestamp = (value: any) => value?.seconds ? value.seconds * 1000 : Date.parse(value) || 0;
      data.sort((a: any, b: any) => timestamp(b.createdAt) - timestamp(a.createdAt));
      setResult({ owner, orders: data, error: '', loading: false });
    }, () => {
      if (active) setResult({ owner, orders: [], error: 'Không thể tải đơn hàng. Vui lòng kiểm tra kết nối và thử lại.', loading: false });
    });
    return () => { active = false; stop(); };
  }, [owner, attempt, orderId]);

  const onRefresh = () => setAttempt(previous => previous + 1);

  const confirmCancel = (id: string) => Alert.alert('Hủy đơn hàng?', 'Bạn chỉ có thể hủy khi cửa hàng chưa xác nhận đơn.', [
    { text: 'Không', style: 'cancel' },
    { text: 'Hủy đơn', style: 'destructive', onPress: async () => {
      setCancelling(true);
      try { await cancelOrder(id); triggerHaptic('success'); }
      catch (failure) { Alert.alert('Chưa thể hủy đơn', failure instanceof Error ? failure.message : 'Vui lòng thử lại.'); }
      finally { setCancelling(false); }
    } },
  ]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING_CONFIRMATION':
        return 'Đã đặt hàng';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'PREPARING':
        return 'Đang chuẩn bị';
      case 'READY':
        return 'Đang chuẩn bị';
      case 'OUT_FOR_DELIVERY':
        return 'Đang giao hàng';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status || 'Đã đặt hàng';
    }
  };

  // ==========================================================
  // VIEW 1: TRANG CHI TIẾT ĐƠN HÀNG
  // ==========================================================
  if (selectedOrder) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setSelectedId(null)}
            accessibilityRole="button"
            accessibilityLabel="Quay lại danh sách đơn"
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={[
            styles.detailContent,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Message */}
          <View style={styles.orderSuccessHeader}>
            {!['COMPLETED', 'CANCELLED'].includes(selectedOrder.status) && <Text style={styles.orderSuccessTitle}>
              Cảm ơn bạn {selectedOrder.customer?.fullname || user?.fullname || 'Khách hàng'}!
            </Text>}
            <Text style={styles.orderSuccessSubtitle}>
              {selectedOrder.status === 'READY' && selectedOrder.rider ? 'Tài xế đang tới lấy món' : getStatusText(selectedOrder.status)}
            </Text>
            <Text style={styles.orderSuccessCode}>
              #{selectedOrder.orderCode || String(selectedOrder.id).slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.orderSuccessDesc}>
              {selectedOrder.status === 'CANCELLED' ? 'Đơn hàng đã được hủy.' : selectedOrder.status === 'COMPLETED' ? 'Cảm ơn bạn đã đặt món tại Pizza FPT.' : 'Trạng thái đơn hàng sẽ tự cập nhật tại đây.'}
            </Text>
          </View>

          {selectedOrder.status === 'CANCELLED' || !selectedOrder.status ? (
            <CouchIllustration width={320} height={160} />
          ) : (
            <View style={styles.infoCard}>
              <OrderTimeline
                status={selectedOrder.status}
                fulfillmentType={['takeaway', 'PICKUP'].includes(selectedOrder.fulfillmentType) ? 'PICKUP' : 'DELIVERY'}
                history={selectedOrder.statusHistory}
              />
            </View>
          )}

          {/* Action Button: Về trang chủ */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => router.replace('/(tabs)/home')}
            >
              <Text style={styles.primaryActionText}>Về trang chủ</Text>
            </TouchableOpacity>
            {selectedOrder.status !== 'PENDING_CONFIRMATION' && !['COMPLETED', 'CANCELLED'].includes(selectedOrder.status) && (
              <Text style={styles.orderSuccessDesc}>Cửa hàng đã nhận đơn nên không thể tự hủy. Vui lòng gọi tổng đài để được hỗ trợ.</Text>
            )}
            {selectedOrder.status === 'PENDING_CONFIRMATION' && (
              <AppButton title="Hủy đơn" variant="outline" isLoading={cancelling} disabled={cancelling}
                onPress={() => confirmCancel(selectedOrder.id)} style={{ marginTop: 12 }} />
            )}
          </View>

          <OrderCancellationCard order={selectedOrder} />
          {selectedOrder.status === 'COMPLETED' && <OrderReviewCard orderId={selectedOrder.id} rating={selectedOrder.rating} />}
          {['READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(selectedOrder.status) && <OrderIssueCard orderId={selectedOrder.id} />}

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{selectedOrder.fulfillmentType?.toUpperCase() === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao đến'}</Text>
            <Text style={styles.infoDeliveryTime}>
              Thời gian nhận: {estimatedWindow(selectedOrder)}
            </Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.fullname || user?.fullname}</Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.phone || user?.phone}</Text>
            <Text style={styles.infoText}>{selectedOrder.address || ''}</Text>
            {typeof selectedOrder.needCutlery === 'boolean' && <Text style={styles.infoText}>
              Muỗng nĩa nhựa: {selectedOrder.needCutlery ? 'Có' : 'Không'}
            </Text>}
          </View>

          {!!selectedOrder.rider && !['COMPLETED', 'CANCELLED'].includes(selectedOrder.status) && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Tài xế giao hàng</Text>
              <Text style={styles.infoText}>{selectedOrder.rider.name}</Text>
              <Text style={styles.infoText}>
                {selectedOrder.status === 'OUT_FOR_DELIVERY' ? 'Đã lấy món, đang trên đường tới bạn.' : 'Đã nhận đơn, đang tới cửa hàng lấy món.'}
              </Text>
              {!!selectedOrder.rider.phone && (
                <AppButton title={`Gọi tài xế ${selectedOrder.rider.phone}`} variant="outline" style={{ marginTop: 8 }}
                  onPress={() => void Linking.openURL(`tel:${String(selectedOrder.rider.phone).replace(/[^\d+]/g, '')}`).catch(() => {})} />
              )}
            </View>
          )}

          {selectedOrder.delivery?.provider === 'AHAMOVE' && <DeliveryDetails orderId={selectedOrder.id} delivery={selectedOrder.delivery} />}

          {/* Card 2: Phương thức thanh toán */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Phương thức thanh toán</Text>
            <Text style={styles.infoText}>
              {formatPaymentLabel(selectedOrder)}
            </Text>
          </View>

          {/* Card 3: Chi tiết các món & Giá tiền */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>
              Có {selectedOrder.itemCount || selectedOrder.items?.length || 1} sản phẩm trong giỏ hàng của bạn
            </Text>
            <Text style={styles.orderTimestampText}>
              {selectedOrder.createdAtFormatted || (selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString('vi-VN') : '')}
            </Text>

            {Array.isArray(selectedOrder.items) &&
              selectedOrder.items.map((item: any, idx: number) => (
                <View key={idx} style={styles.orderItemRow}>
                  <View style={styles.orderItemMainLine}>
                    <Text style={styles.orderItemName} numberOfLines={1}>
                      {item.productName || 'Sản phẩm'}
                    </Text>
                    <Text style={styles.orderItemQty}>{item.quantity || 1}</Text>
                    <Text style={styles.orderItemPrice}>
                      {formatCurrency(
                        item.lineTotal || (item.unitPrice * (item.quantity || 1)) || 0
                      )}
                    </Text>
                  </View>
                  <Text style={styles.orderItemOptions}>
                    {[item.variantName, ...(item.addonNames ?? []), ...(Array.isArray(item.customizationSummary)
                      ? item.customizationSummary : [item.customizationSummary])].filter(Boolean).join(' • ')}
                  </Text>
                  {!!item.note && <Text style={styles.orderItemOptions}>Ghi chú bếp: {item.note}</Text>}
                </View>
              ))}

            <View style={styles.pricingDivider} />

            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tạm tính</Text>
              <Text style={styles.pricingValue}>
                {formatCurrency(selectedOrder.subtotal || 0)}
              </Text>
            </View>

            {selectedOrder.discount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: BRAND_RED }]}>
                  Giảm giá Voucher ({selectedOrder.voucherCode || ''})
                </Text>
                <Text style={[styles.pricingValue, { color: BRAND_RED }]}>
                  -{formatCurrency(selectedOrder.discount)}
                </Text>
              </View>
            )}

            <View style={styles.pricingDivider} />

            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Phí giao hàng</Text>
              <Text style={styles.pricingValue}>
                {formatCurrency(selectedOrder.deliveryFee ?? 22000)}
              </Text>
            </View>

            <View style={styles.pricingDivider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Tổng cộng</Text>
                <Text style={styles.rewardPointsNote}>
                  Nhận{' '}
                  <Text style={{ fontWeight: '700', color: '#111827' }}>
                    {selectedOrder.earnedPoints || Math.floor((selectedOrder.total || 0) / 10000)} điểm
                  </Text>{' '}
                  FPT Rewards
                </Text>
              </View>
              <Text style={styles.totalValue}>
                {formatCurrency(selectedOrder.total || 0)}
              </Text>
            </View>
          </View>

          {/* Card 4: Tổng đài hỗ trợ */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Có câu hỏi về đơn hàng của bạn?</Text>
            <Text style={styles.contactSupportSubtitle}>Gọi đến Tổng đài Dịch vụ Khách hàng:</Text>
            <TouchableOpacity activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Gọi tổng đài 19001822"
              onPress={() => { void Linking.openURL('tel:19001822').catch(() => Alert.alert('Không thể gọi', 'Thiết bị chưa hỗ trợ gọi điện.')); }}>
              <Text style={styles.supportHotline}>19001822</Text>
            </TouchableOpacity>
            <Text style={styles.supportNotice}>
              Bạn có thể tự hủy đơn khi cửa hàng chưa xác nhận. Sau đó, vui lòng gọi tổng đài để thay đổi hoặc hủy đơn. Đơn đã thanh toán qua payOS sẽ được hoàn tiền khi bị hủy.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // VIEW 2: MÀN HÌNH THEO DÕI ĐƠN HÀNG (KHỚP 100% ẢNH MẪU)
  // ==========================================================
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header: < | Theo dõi đơn hàng | 🔍 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Theo dõi đơn hàng</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/order/lookup')}
          accessibilityRole="button"
          accessibilityLabel="Tra cứu đơn bằng số điện thoại"
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Search size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BRAND_RED} />
          <Text style={styles.loadingText}>Đang tải đơn hàng...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} accessibilityRole="button" style={{ padding: 16 }}>
            <Text style={{ color: BRAND_RED }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : visibleOrders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Bạn không có đơn hàng nào</Text>
        </View>
      ) : (
        <FlatList
          data={visibleOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom + 24, FLOATING_CART_CLEARANCE) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={BRAND_RED}
              colors={[BRAND_RED]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.orderCardBox}
              activeOpacity={0.88}
              onPress={() => {
                triggerHaptic('light');
                setSelectedId(item.id);
              }}
            >
              {/* Cột trái: Dự kiến giao hàng */}
              <View style={styles.cardLeftCol}>
                <Text style={styles.cardLeftLabel}>Dự kiến</Text>
                <Text style={styles.cardLeftLabel}>giao hàng</Text>
                <Text style={styles.cardLeftTime}>{formatExpectedTime(item)}</Text>
              </View>

              {/* Cột phải: Thông tin đơn hàng */}
              <View style={styles.cardRightCol}>
                {/* Dòng 1: Mã đơn & Tổng tiền */}
                <View style={styles.cardRightTopRow}>
                  <Text style={styles.cardOrderCode}>#{item.orderCode || String(item.id).slice(0, 8)}</Text>
                  <Text style={styles.cardOrderTotal}>{formatCurrency(item.total || 0)}</Text>
                </View>

                {/* Dòng 2: Trạng thái đơn */}
                <Text style={styles.cardOrderStatusText}>
                  {getStatusText(item.status)}
                </Text>

                {/* Dòng 3: Giao đến địa chỉ */}
                <Text style={styles.cardAddressText} numberOfLines={2}>
                  <Text style={styles.cardBoldPrefix}>Giao đến: </Text>
                  {item.address || 'Tại quán'}
                </Text>

                {/* Dòng 4: Phương thức thanh toán & Nút Chi tiết đỏ */}
                <Text style={styles.cardPaymentText} numberOfLines={1}>
                  <Text style={styles.cardBoldPrefix}>Phương thức thanh toán: </Text>
                  {formatPaymentLabel(item)}{' '}
                  <Text style={styles.cardDetailLink}>Chi tiết</Text>
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
