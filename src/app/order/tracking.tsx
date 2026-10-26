import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, Info } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import { getSavedCustomerInfo } from '../../services/addressStorage';

const BRAND_RED = '#CF4226';

export default function OrderTrackingScreen() {
  const router = useRouter();
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

      // 1. Tìm theo userId
      if (user.id) {
        try {
          const userQuery = query(ordersCol, where('userId', '==', user.id));
          const snap = await getDocs(userQuery);
          snap.forEach((doc) => {
            foundOrders.push({ id: doc.id, ...doc.data() });
          });
        } catch {
          // Bỏ qua lỗi
        }
      }

      // 2. Tìm theo số điện thoại của user để không sót bất kỳ đơn nào
      const phoneSet = new Set<string>();
      if (user.phone) {
        phoneSet.add(user.phone);
        phoneSet.add(user.phone.startsWith('0') ? user.phone.slice(1) : '0' + user.phone);
        phoneSet.add(user.phone.startsWith('+84') ? user.phone.replace('+84', '0') : user.phone);
        phoneSet.add(user.phone.startsWith('+84') ? user.phone.replace('+84', '') : user.phone);
        phoneSet.add('84' + (user.phone.startsWith('0') ? user.phone.slice(1) : user.phone));
      }

      // Kiểm tra thêm SĐT đã lưu trong bộ nhớ máy
      try {
        const savedInfo = await getSavedCustomerInfo();
        if (savedInfo?.phone) {
          phoneSet.add(savedInfo.phone);
          phoneSet.add(savedInfo.phone.startsWith('0') ? savedInfo.phone.slice(1) : '0' + savedInfo.phone);
          phoneSet.add('84' + (savedInfo.phone.startsWith('0') ? savedInfo.phone.slice(1) : savedInfo.phone));
        }
      } catch {
        // Bỏ qua
      }

      for (const phone of phoneSet) {
        try {
          const phoneQuery = query(ordersCol, where('customer.phone', '==', phone));
          const phoneSnap = await getDocs(phoneQuery);
          phoneSnap.forEach((doc) => {
            if (!foundOrders.some((o) => o.id === doc.id)) {
              foundOrders.push({ id: doc.id, ...doc.data() });
            }
          });
        } catch {
          // Bỏ qua lỗi
        }
      }

      // 3. Tìm theo tên khách hàng nếu có
      if (user.fullname) {
        try {
          const nameQuery = query(ordersCol, where('customer.fullname', '==', user.fullname.trim()));
          const nameSnap = await getDocs(nameQuery);
          nameSnap.forEach((doc) => {
            if (!foundOrders.some((o) => o.id === doc.id)) {
              foundOrders.push({ id: doc.id, ...doc.data() });
            }
          });
        } catch {
          // Bỏ qua lỗi
        }
      }

      // 4. Tìm theo email nếu chưa có đơn nào
      if (foundOrders.length === 0 && user.email) {
        try {
          const emailQuery = query(ordersCol, where('customer.email', '==', user.email));
          const emailSnap = await getDocs(emailQuery);
          emailSnap.forEach((doc) => {
            if (!foundOrders.some((o) => o.id === doc.id)) {
              foundOrders.push({ id: doc.id, ...doc.data() });
            }
          });
        } catch {
          // Bỏ qua lỗi
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
          contentContainerStyle={styles.detailContent}
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
                    {item.variantName || 'Nhỏ, Đế Giòn Xốp(Nhỏ)'}
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
          contentContainerStyle={styles.listContainer}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '400',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    minHeight: '100%',
  },

  /* ======================================================== */
  /* BẢN NHỎ NHỎ (EXACT SAME AS PHOTO 1)                      */
  /* ======================================================== */
  orderCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLeftCol: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  cardLeftLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  cardLeftTime: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_RED,
    marginTop: 4,
    textAlign: 'center',
  },
  cardRightCol: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  cardRightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardOrderCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardOrderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardOrderStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 3,
  },
  cardAddressText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginTop: 3,
  },
  cardBoldPrefix: {
    fontWeight: '700',
    color: '#111827',
  },
  cardPaymentText: {
    fontSize: 13,
    color: '#374151',
    marginTop: 3,
  },
  cardDetailLink: {
    color: BRAND_RED,
    fontWeight: '600',
  },

  /* ======================================================== */
  /* TRANG CHI TIẾT (EXACT SAME AS PHOTOS 2 & 3)             */
  /* ======================================================== */
  detailScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  orderSuccessHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  orderSuccessTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  orderSuccessSubtitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 28,
  },
  orderSuccessCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 6,
  },
  orderSuccessDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  actionButtonsContainer: {
    marginVertical: 16,
  },
  primaryActionButton: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  infoDeliveryTime: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 20,
  },
  orderTimestampText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  orderItemRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderItemMainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  orderItemQty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 8,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  orderItemOptions: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rewardPointsNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  contactSupportSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 6,
  },
  supportHotline: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND_RED,
    marginBottom: 10,
  },
  supportNotice: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
});
