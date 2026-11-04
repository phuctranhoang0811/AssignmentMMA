import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Info, XCircle } from 'lucide-react-native';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { styles, BRAND_RED } from '../../styles/orderLookup.styles';
import { subscribeOrderOverrides, type OrderDispatchOverride } from '../../services/storeSync';

function getStatusText(status?: string): string {
  switch (status) {
    case 'PREPARING':
      return 'Đang chuẩn bị';
    case 'READY':
      return 'Món đã xong';
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return 'Đang giao hàng';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
    case 'REJECTED':
      return 'Đã hủy';
    case 'PENDING_CONFIRMATION':
    case 'CONFIRMED':
    default:
      return 'Đã đặt hàng';
  }
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

function isOrderFromToday(order: any, nowMs: number = Date.now()): boolean {
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

export default function OrderLookupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundOrders, setFoundOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});

  useEffect(() => {
    const unsub = subscribeOrderOverrides((map) => {
      setOrderOverrides(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setFoundOrders((prev) => prev.filter((o) => isOrderFromToday(o, current)));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const mergedFoundOrders = foundOrders.map((order) => {
    const ov = orderOverrides[order.id];
    if (!ov) return order;
    const nextStatus = ov.status || order.status;
    const prevHistory = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
    if (ov.status && !prevHistory.some((h: any) => h?.status === ov.status)) {
      prevHistory.push({
        status: ov.status,
        at: ov.updatedAtMs ? new Date(ov.updatedAtMs).toISOString() : new Date().toISOString(),
      });
    }
    return {
      ...order,
      status: nextStatus,
      statusHistory: prevHistory,
      ...(ov.cancelReason ? { cancelReason: ov.cancelReason } : {}),
    };
  });

  const selectedOrder = selectedOrderId
    ? mergedFoundOrders.find((o) => o.id === selectedOrderId) || null
    : null;

  const handleSearch = async () => {
    const rawQuery = searchQuery.trim();
    if (!rawQuery) {
      Alert.alert('Vui lòng nhập thông tin', 'Hãy nhập số điện thoại hoặc mã đơn hàng để tìm kiếm.');
      return;
    }

    Keyboard.dismiss();
    triggerHaptic('light');
    setIsSearching(true);
    setHasSearched(true);
    setSelectedOrderId(null);

    try {
      const ordersCol = collection(db, 'orders');
      const cleanCode = rawQuery.replace(/^#/, '').toUpperCase();
      const matched: any[] = [];

      const currentNow = Date.now();

      // 1. Tìm chính xác theo mã đơn hàng (chỉ lấy đơn khách vãng lai !data.userId trong ngày hôm nay)
      const codeQuery = query(ordersCol, where('orderCode', '==', cleanCode));
      const codeSnapshot = await getDocs(codeQuery);
      codeSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.userId && isOrderFromToday(data, currentNow)) {
          matched.push({ id: doc.id, ...data });
        }
      });

      // 2. Tìm theo số điện thoại (chỉ lấy đơn khách vãng lai !data.userId trong ngày hôm nay)
      const cleanDigits = rawQuery.replace(/\D/g, '');
      if (cleanDigits.length >= 8) {
        const phoneVariations = new Set<string>();
        phoneVariations.add(rawQuery);
        phoneVariations.add(cleanDigits);
        phoneVariations.add(cleanDigits.startsWith('0') ? cleanDigits.slice(1) : '0' + cleanDigits);
        phoneVariations.add(cleanDigits.startsWith('84') ? cleanDigits.slice(2) : '84' + cleanDigits);
        phoneVariations.add(cleanDigits.startsWith('84') ? '0' + cleanDigits.slice(2) : cleanDigits);
        phoneVariations.add('+84' + (cleanDigits.startsWith('0') ? cleanDigits.slice(1) : cleanDigits));

        for (const phone of phoneVariations) {
          const phoneQuery = query(ordersCol, where('customer.phone', '==', phone));
          const phoneSnapshot = await getDocs(phoneQuery);
          phoneSnapshot.forEach((doc) => {
            const data = doc.data();
            if (
              !data.userId &&
              isOrderFromToday(data, currentNow) &&
              !matched.some((o) => o.id === doc.id)
            ) {
              matched.push({ id: doc.id, ...data });
            }
          });
        }
      }

      // Sắp xếp đơn mới nhất lên đầu
      matched.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });

      setFoundOrders(matched);
      if (matched.length > 0) {
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
      }
    } catch (error: any) {
      console.error('Lỗi tra cứu đơn hàng:', error);
      Alert.alert('Lỗi tra cứu', 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsSearching(false);
    }
  };

  // ==========================================================
  // VIEW 1: TRANG CHI TIẾT ĐƠN HÀNG (KHI BẤM VÀO Ô NHỎ)
  // ==========================================================
  if (selectedOrder) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top Header Navigation */}
        <View style={styles.detailHeaderBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedOrderId(null)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>Chi tiết đơn hàng</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.orderSuccessScroll,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Message */}
          <View style={styles.orderSuccessHeader}>
            <Text style={styles.orderSuccessTitle}>
              Cảm ơn bạn {selectedOrder.customer?.fullname || 'Khách hàng'}!
            </Text>
            <Text style={styles.orderSuccessSubtitle}>
              {getStatusText(selectedOrder.status)}
            </Text>
            <Text style={styles.orderSuccessCode}>
              #{selectedOrder.orderCode || selectedOrder.id}
            </Text>
            <Text style={styles.orderSuccessDesc}>
              {selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'DELIVERED'
                ? 'Đơn hàng đã được giao thành công. Cảm ơn bạn đã đặt món tại Pizza FPT!'
                : selectedOrder.status === 'CANCELLED' || selectedOrder.status === 'REJECTED'
                  ? 'Đơn hàng đã bị hủy.'
                  : 'Trạng thái đơn hàng của bạn đang được cập nhật trực tiếp tại đây.'}
            </Text>
          </View>

          {selectedOrder.status && selectedOrder.status !== 'CANCELLED' && (
            <View style={styles.infoCard}>
              <OrderTimeline
                status={selectedOrder.status}
                fulfillmentType={
                  ['takeaway', 'PICKUP'].includes(selectedOrder.fulfillmentType)
                    ? 'PICKUP'
                    : 'DELIVERY'
                }
                history={selectedOrder.statusHistory}
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => router.replace('/(tabs)/home')}
            >
              <Text style={styles.primaryActionText}>Về trang chủ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionButton}
              activeOpacity={0.88}
              onPress={() => setSelectedOrderId(null)}
            >
              <Text style={styles.secondaryActionText}>Tìm đơn hàng khác</Text>
            </TouchableOpacity>
          </View>

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>
              {['TAKEAWAY', 'PICKUP'].includes(String(selectedOrder.fulfillmentType || '').toUpperCase())
                ? 'Nhận tại cửa hàng'
                : 'Giao đến'}
            </Text>
            <Text style={styles.infoDeliveryTime}>
              Thời gian nhận: {selectedOrder.deliveryTime || 'Chưa có thời gian dự kiến'}
            </Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.fullname || 'Khách hàng'}</Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.phone || ''}</Text>
            <Text style={styles.infoText}>{selectedOrder.address || ''}</Text>
            {!!(selectedOrder.deliveryNote || selectedOrder.note) && (
              <Text style={[styles.infoText, { color: BRAND_RED, fontWeight: '600', marginTop: 4 }]}>
                Ghi chú giao nhận: {selectedOrder.deliveryNote || selectedOrder.note}
              </Text>
            )}
            {typeof selectedOrder.needCutlery === 'boolean' && (
              <Text style={styles.infoText}>
                Muỗng nĩa nhựa: {selectedOrder.needCutlery ? 'Có' : 'Không'}
              </Text>
            )}
          </View>

          {/* Card 2: Phương thức thanh toán */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Phương thức thanh toán</Text>
            <Text style={styles.infoText}>
              {selectedOrder.paymentName || selectedOrder.paymentMethod || 'Tiền mặt'}
            </Text>
          </View>

          {/* Card 3: Có X sản phẩm trong giỏ hàng của bạn */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>
              Có {selectedOrder.itemCount || selectedOrder.items?.length || 0} sản phẩm trong giỏ hàng của bạn
            </Text>
            <Text style={styles.orderTimestampText}>
              {selectedOrder.createdAtFormatted ||
                (selectedOrder.createdAt?.seconds
                  ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString('vi-VN')
                  : selectedOrder.createdAt
                  ? new Date(selectedOrder.createdAt).toLocaleString('vi-VN')
                  : '')}
            </Text>

            {/* Product list */}
            {Array.isArray(selectedOrder.items) &&
              selectedOrder.items.map((item: any, idx: number) => {
                const isPizzaItem =
                  String(item.productId || '').startsWith('PZ_') ||
                  String(item.productName || '').toLowerCase().includes('pizza') ||
                  (Array.isArray(item.customizationSummary) && item.customizationSummary.length > 0);
                const cleanVariantName =
                  !isPizzaItem && item.variantName === 'Đế Truyền Thống'
                    ? ''
                    : item.variantName;
                const optionText = [
                  cleanVariantName,
                  ...(item.addonNames ?? []),
                  ...(Array.isArray(item.customizationSummary)
                    ? item.customizationSummary
                    : [item.customizationSummary]),
                ]
                  .filter(Boolean)
                  .filter((val, i, arr) => arr.indexOf(val) === i)
                  .join(' • ');
                const itemNote = String(
                  item.note ||
                    item.specialInstructions ||
                    item.customization?.specialInstructions ||
                    ''
                ).trim();
                return (
                  <View key={idx} style={styles.orderItemRow}>
                    <View style={styles.orderItemMainLine}>
                      <Text style={styles.orderItemName} numberOfLines={1}>
                        {item.productName || 'Sản phẩm'}
                      </Text>
                      <Text style={styles.orderItemQty}>{item.quantity || 1}</Text>
                      <Text style={styles.orderItemPrice}>
                        {formatCurrency(
                          item.lineTotal || item.unitPrice * (item.quantity || 1) || 0
                        )}
                      </Text>
                    </View>
                    {!!optionText && (
                      <Text style={styles.orderItemOptions}>{optionText}</Text>
                    )}
                    {!!itemNote && (
                      <Text
                        style={[
                          styles.orderItemOptions,
                          { color: '#B45309', fontWeight: '600', marginTop: 2 },
                        ]}
                      >
                        Ghi chú: {itemNote}
                      </Text>
                    )}
                  </View>
                );
              })}

            <View style={styles.pricingDivider} />

            {/* Price breakdown */}
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
              <Text
                style={[
                  styles.pricingValue,
                  Number(selectedOrder.memberDiscount || 0) > 0 && { color: BRAND_RED },
                ]}
              >
                {Number(selectedOrder.memberDiscount || 0) > 0
                  ? `-${formatCurrency(Number(selectedOrder.memberDiscount || 0))}`
                  : '0 đ'}
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

            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Phí giao hàng</Text>
              <Text style={styles.pricingValue}>
                {(selectedOrder.deliveryFee ?? 0) === 0
                  ? 'Miễn phí'
                  : formatCurrency(selectedOrder.deliveryFee ?? 0)}
              </Text>
            </View>

            <View style={styles.pricingDivider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Tổng cộng</Text>
                {!!selectedOrder.userId &&
                  !['CANCELLED', 'REJECTED'].includes(
                    String(selectedOrder.status || '').toUpperCase()
                  ) && (
                    <Text style={styles.rewardPointsNote}>
                      Nhận{' '}
                      <Text style={{ fontWeight: '700', color: '#111827' }}>
                        {typeof selectedOrder.earnedPoints === 'number'
                          ? selectedOrder.earnedPoints
                          : Math.floor((selectedOrder.total || 0) / 10000)}{' '}
                        điểm
                      </Text>{' '}
                      FPT Rewards
                    </Text>
                  )}
              </View>
              <Text style={styles.totalValue}>
                {formatCurrency(selectedOrder.total || 0)}
              </Text>
            </View>
          </View>

          {/* Card 4: Có câu hỏi về đơn hàng của bạn? */}
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

  const showNotFoundError = hasSearched && !isSearching && foundOrders.length === 0;

  // ==========================================================
  // VIEW 2: FORM NHẬP TÌM KIẾM ĐƠN HÀNG (KHỚP HÌNH 2 & HÌNH 3)
  // ==========================================================
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/home');
              }
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tìm đơn hàng khác</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Input field */}
          <View
            style={[
              styles.inputWrapper,
              showNotFoundError && styles.inputWrapperError,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Nhập số điện thoại hoặc mã đơn hàng"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (hasSearched) {
                  setHasSearched(false);
                  setFoundOrders([]);
                }
              }}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setSearchQuery('');
                  setHasSearched(false);
                  setFoundOrders([]);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <XCircle size={18} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Error Text (Matching Screenshot 2) */}
          {showNotFoundError && (
            <Text style={styles.inlineErrorText}>
              Không tìm thấy thông tin đơn hàng của bạn.
            </Text>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.searchButton, isSearching && { opacity: 0.7 }]}
            onPress={handleSearch}
            disabled={isSearching}
            activeOpacity={0.88}
          >
            {isSearching ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>Tìm kiếm</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.88}
          >
            <Text style={styles.loginButtonText}>Đăng nhập để theo dõi đơn hàng</Text>
          </TouchableOpacity>

          {/* Search Status / Compact Order Cards */}
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_RED} />
              <Text style={styles.loadingText}>Đang tra cứu dữ liệu đơn hàng...</Text>
            </View>
          ) : hasSearched && mergedFoundOrders.length > 0 ? (
            <View style={styles.resultsList}>
              {mergedFoundOrders.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.orderCardBox}
                  activeOpacity={0.88}
                  onPress={() => {
                    triggerHaptic('light');
                    setSelectedOrderId(item.id);
                  }}
                >
                  {/* Cột trái: Dự kiến giao hàng */}
                  <View style={styles.cardLeftCol}>
                    <Text style={styles.cardLeftLabel}>Dự kiến</Text>
                    <Text style={styles.cardLeftLabel}>giao hàng</Text>
                    <Text style={styles.cardLeftTime}>
                      {item.deliveryTime && /^\d{1,2}:\d{2}/.test(item.deliveryTime)
                        ? item.deliveryTime.slice(0, 5)
                        : '10:30'}
                    </Text>
                  </View>

                  {/* Cột phải: Thông tin đơn hàng */}
                  <View style={styles.cardRightCol}>
                    <View style={styles.cardRightTopRow}>
                      <Text style={styles.cardOrderCode}>
                        #{item.orderCode || item.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <Text style={styles.cardOrderTotal}>
                        {formatCurrency(item.total || 0)}
                      </Text>
                    </View>

                    <Text style={styles.cardOrderStatusText}>
                      {getStatusText(item.status)}
                    </Text>

                    <Text style={styles.cardAddressText} numberOfLines={2}>
                      <Text style={styles.cardBoldPrefix}>Giao đến: </Text>
                      {item.address || 'Tại quán'}
                    </Text>

                    <Text style={styles.cardPaymentText} numberOfLines={1}>
                      <Text style={styles.cardBoldPrefix}>Phương thức thanh toán: </Text>
                      {item.paymentName || item.paymentMethod || 'Tiền mặt'}{' '}
                      <Text style={styles.cardDetailLink}>Chi tiết</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
