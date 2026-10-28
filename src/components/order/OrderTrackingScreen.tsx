import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, Info } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import { styles, BRAND_RED } from '../../styles/orderTracking.styles';
import { FLOATING_CART_CLEARANCE } from '../../styles/tabsLayout.styles';
import { DeliveryDetails } from './DeliveryDetails';
import { OrderTimeline } from './OrderTimeline';
import { AppButton } from '../ui/AppButton';
import { cancelOrder } from '../../services/orderApi';

export default function OrderTrackingScreen({ historyOnly = false }: { historyOnly?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [result, setResult] = useState<{ owner?: string; orders: any[]; error: string; loading: boolean }>({ orders: [], error: '', loading: true });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'history'>(historyOnly ? 'history' : 'active');
  const [cancelling, setCancelling] = useState(false);
  // Demo/guest users have no Firebase session; Firestore rules would reject their query.
  const owner = user && !user.isDemo ? user.id : undefined;
  const orders = result.owner === owner ? result.orders : [];
  const error = result.owner === owner ? result.error : '';
  const isLoading = !!owner && (result.owner !== owner || result.loading);
  const selectedOrder = orders.find(order => order.id === selectedId);
  const visibleOrders = orders.filter(order => tab === 'history'
    ? ['COMPLETED', 'CANCELLED'].includes(order.status)
    : !['COMPLETED', 'CANCELLED'].includes(order.status));

  useEffect(() => {
    setSelectedId(null);
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
  }, [owner, attempt]);

  const onRefresh = () => setAttempt(previous => previous + 1);

  const confirmCancel = (id: string) => Alert.alert('Hủy đơn hàng?', 'Bạn chỉ có thể hủy khi cửa hàng chưa xác nhận đơn.', [
    { text: 'Không', style: 'cancel' },
    { text: 'Hủy đơn', style: 'destructive', onPress: async () => {
      setCancelling(true);
      // The list updates itself through onSnapshot.
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
        return 'Đang chuẩn bị món';
      case 'READY':
        return 'Món đã sẵn sàng';
      case 'OUT_FOR_DELIVERY':
        return 'Đang giao hàng';
      case 'COMPLETED':
        return 'Đã hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status || 'Đã đặt hàng';
    }
  };

  // ==========================================================
  // VIEW 1: TRANG CHI TIẾT ĐƠN HÀNG (GIỐNG HỆT ẢNH 2 & 3 CỦA BẠN)
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
            <Text style={styles.orderSuccessTitle}>
              Cảm ơn bạn {selectedOrder.customer?.fullname || user?.fullname || 'Khách hàng'}!
            </Text>
            <Text style={styles.orderSuccessSubtitle}>{getStatusText(selectedOrder.status)}</Text>
            <Text style={styles.orderSuccessCode}>
              #{selectedOrder.orderCode || selectedOrder.id}
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

          {/* Action Button: Về trang chủ (Khớp ảnh 2) */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => router.replace('/(tabs)/home')}
            >
              <Text style={styles.primaryActionText}>Về trang chủ</Text>
            </TouchableOpacity>
            {selectedOrder.status === 'PENDING_CONFIRMATION' && (
              <AppButton title="Hủy đơn" variant="outline" isLoading={cancelling} disabled={cancelling}
                onPress={() => confirmCancel(selectedOrder.id)} style={{ marginTop: 12 }} />
            )}
          </View>

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{selectedOrder.fulfillmentType?.toUpperCase() === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao đến'}</Text>
            <Text style={styles.infoDeliveryTime}>
              Thời gian nhận: {selectedOrder.deliveryTime || 'Chưa có thời gian dự kiến'}
            </Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.fullname || user?.fullname}</Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.phone || user?.phone}</Text>
            <Text style={styles.infoText}>{selectedOrder.address || ''}</Text>
            {typeof selectedOrder.needCutlery === 'boolean' && <Text style={styles.infoText}>
              Muỗng nĩa nhựa: {selectedOrder.needCutlery ? 'Có' : 'Không'}
            </Text>}
          </View>

          {selectedOrder.delivery?.provider === 'AHAMOVE' && <DeliveryDetails orderId={selectedOrder.id} delivery={selectedOrder.delivery} />}

          {/* Card 2: Phương thức thanh toán */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Phương thức thanh toán</Text>
            <Text style={styles.infoText}>
              {selectedOrder.paymentName || selectedOrder.paymentMethod || 'Tiền mặt'}
            </Text>
          </View>

          {/* Card 3: Chi tiết các món & Giá tiền (Khớp ảnh 3) */}
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
                    {Array.isArray(item.customizationSummary) && item.customizationSummary.length > 0
                      ? item.customizationSummary.join(' • ')
                      : item.variantName || 'Đế Truyền Thống'}
                  </Text>
                </View>
              ))}

            <View style={styles.pricingDivider} />

            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tạm tính</Text>
              <Text style={styles.pricingValue}>
                {formatCurrency(selectedOrder.subtotal || 0)}
              </Text>
            </View>

            <View style={styles.pricingRow}>
              <View style={styles.infoLabelWrap}>
                <Text style={styles.pricingLabel}>Giảm giá thành viên</Text>
                <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pricingValue}>0 đ</Text>
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
            <TouchableOpacity activeOpacity={0.7}>
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
  // VIEW 2: MÀN HÌNH THEO DÕI ĐƠN HÀNG (KHỚP 100% ẢNH 1 CỦA BẠN)
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

        <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>

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

      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 999, padding: 4 }}
        accessibilityRole="tablist">
        {([['active', 'Đang xử lý'], ['history', 'Lịch sử']] as const).map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: tab === key ? '#FFFFFF' : 'transparent' }}>
            <Text style={{ fontWeight: tab === key ? '700' : '500', color: tab === key ? BRAND_RED : '#6B7280' }}>{label}</Text>
          </TouchableOpacity>
        ))}
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
          <Text style={styles.emptyText}>{!owner ? 'Đăng nhập để xem đơn hàng của bạn' : tab === 'history' ? 'Chưa có đơn hàng hoàn thành hoặc đã hủy' : 'Không có đơn hàng đang xử lý'}</Text>
          <AppButton title={!owner ? 'Đăng nhập' : 'Đặt món ngay'} style={{ marginTop: 16, alignSelf: 'center', paddingHorizontal: 32 }}
            onPress={() => router.push(!owner ? '/auth/login' : '/(tabs)/menu')} />
        </View>
      ) : (
        <FlatList
          data={visibleOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            // Clear the floating cart shown on the Orders tab.
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
            // ========================================================
            // BẢN NHỎ NHỎ THEO DÕI ĐƠN HÀNG (CHUẨN 100% THEO ẢNH 1)
            // ========================================================
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
                <Text style={styles.cardLeftTime}>{item.deliveryTime || 'Chưa xác định'}</Text>
              </View>

              {/* Cột phải: Thông tin đơn hàng */}
              <View style={styles.cardRightCol}>
                {/* Dòng 1: Mã đơn & Tổng tiền */}
                <View style={styles.cardRightTopRow}>
                  <Text style={styles.cardOrderCode}>#{item.orderCode || item.id.slice(0, 8)}</Text>
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
                  {item.paymentName || item.paymentMethod || 'Tiền mặt'}{' '}
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

