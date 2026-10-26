import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, Info } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import { styles, BRAND_RED } from '../../styles/orderTracking.styles';

export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchUserOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      const ordersCol = collection(db, 'orders');
      const foundOrders: any[] = [];

      // Chỉ lấy đơn hàng thuộc về chính tài khoản này (userId khớp chính xác)
      if (user.id) {
        try {
          const userQuery = query(ordersCol, where('userId', '==', user.id));
          const snap = await getDocs(userQuery);
          snap.forEach((doc) => {
            foundOrders.push({ id: doc.id, ...doc.data() });
          });
        } catch (err) {
          console.error('Lỗi tải đơn hàng của user:', err);
        }
      }

      // Sắp xếp đơn mới nhất lên đầu
      foundOrders.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });

      setOrders(foundOrders);
    } catch (err: any) {
      console.error('Lỗi lấy danh sách đơn của user:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserOrders();
  }, [fetchUserOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserOrders();
  };

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
            onPress={() => setSelectedOrder(null)}
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
            <Text style={styles.orderSuccessSubtitle}>Chúng tôi đang xác nhận</Text>
            <Text style={styles.orderSuccessSubtitle}>đơn hàng của bạn</Text>
            <Text style={styles.orderSuccessCode}>
              #{selectedOrder.orderCode || selectedOrder.id}
            </Text>
            <Text style={styles.orderSuccessDesc}>
              Chúng tôi đang xác nhận đơn hàng của bạn được thực hiện. Quá trình này sẽ nhanh thôi.
            </Text>
          </View>

          {/* Sofa Illustration with Pizza & Tomato (Khớp ảnh 2) */}
          <CouchIllustration width={320} height={160} />

          {/* Action Button: Về trang chủ (Khớp ảnh 2) */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => router.replace('/(tabs)/home')}
            >
              <Text style={styles.primaryActionText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Giao Đến</Text>
            <Text style={styles.infoDeliveryTime}>
              Thời gian nhận: {selectedOrder.deliveryTime || '10:30'}
            </Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.fullname || user?.fullname}</Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.phone || user?.phone}</Text>
            <Text style={styles.infoText}>{selectedOrder.address || ''}</Text>
          </View>

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
              {selectedOrder.createdAtFormatted || '26/10/2026 09:00:30'}
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

            <View style={styles.pricingRow}>
              <View style={styles.infoLabelWrap}>
                <Text style={styles.pricingLabel}>Phí giao hàng</Text>
                <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pricingValue}>
                {formatCurrency(selectedOrder.deliveryFee || 22000)}
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
                  Hut rewards
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
              Xin lưu ý: đơn hàng của bạn không thể được thay đổi hoặc hủy từ trang web. Vui lòng gọi cho chúng tôi. Nhân viên của chúng tôi có thể gọi cho bạn nếu cần làm rõ về đơn hàng của bạn.
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
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Theo dõi đơn hàng</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/order/lookup')}
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
      ) : orders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Bạn không có đơn hàng nào</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
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
                setSelectedOrder(item);
              }}
            >
              {/* Cột trái: Dự kiến giao hàng */}
              <View style={styles.cardLeftCol}>
                <Text style={styles.cardLeftLabel}>Dự kiến</Text>
                <Text style={styles.cardLeftLabel}>giao hàng</Text>
                <Text style={styles.cardLeftTime}>{item.deliveryTime || '10:30'}</Text>
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

