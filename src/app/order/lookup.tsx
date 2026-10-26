import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Info, Package } from 'lucide-react-native';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { styles, BRAND_RED } from '../../styles/orderLookup.styles';

export default function OrderLookupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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
    setSelectedOrder(null);

    try {
      const ordersCol = collection(db, 'orders');
      const cleanCode = rawQuery.replace(/^#/, '').toUpperCase();
      const foundOrders: any[] = [];

      // 1. Tìm chính xác theo mã đơn hàng
      const codeQuery = query(ordersCol, where('orderCode', '==', cleanCode));
      const codeSnapshot = await getDocs(codeQuery);
      codeSnapshot.forEach((doc) => {
        foundOrders.push({ id: doc.id, ...doc.data() });
      });

      // 2. Tìm theo số điện thoại (chỉ tìm bằng SĐT hoặc Mã đơn hàng, KHÔNG tìm theo tên hay gmail)
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
            if (!foundOrders.some((o) => o.id === doc.id)) {
              foundOrders.push({ id: doc.id, ...doc.data() });
            }
          });
        }
      }

      // Sắp xếp đơn mới nhất lên đầu
      foundOrders.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });

      if (foundOrders.length > 0) {
        triggerHaptic('success');
        setSelectedOrder(foundOrders[0]);
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
  // VIEW 1: TRANG CHI TIẾT ĐƠN HÀNG (GIỐNG HỆT SAU KHI ĐẶT HÀNG)
  // ==========================================================
  if (selectedOrder) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top Header Navigation */}
        <View style={styles.detailHeaderBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedOrder(null)}
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
            <Text style={styles.orderSuccessSubtitle}>Chúng tôi đang xác nhận</Text>
            <Text style={styles.orderSuccessSubtitle}>đơn hàng của bạn</Text>
            <Text style={styles.orderSuccessCode}>
              #{selectedOrder.orderCode || selectedOrder.id}
            </Text>
            <Text style={styles.orderSuccessDesc}>
              Chúng tôi đang xác nhận đơn hàng của bạn được thực hiện. Quá trình này sẽ nhanh thôi.
            </Text>
          </View>

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
              onPress={() => setSelectedOrder(null)}
            >
              <Text style={styles.secondaryActionText}>Tìm đơn hàng khác</Text>
            </TouchableOpacity>
          </View>

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Giao Đến</Text>
            <Text style={styles.infoDeliveryTime}>
              Thời gian nhận: {selectedOrder.deliveryTime || '10:30'}
            </Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.fullname || 'Khách hàng'}</Text>
            <Text style={styles.infoText}>{selectedOrder.customer?.phone || ''}</Text>
            <Text style={styles.infoText}>{selectedOrder.address || ''}</Text>
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
              {selectedOrder.createdAtFormatted || '26/10/2026'}
            </Text>

            {/* Product list */}
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

  // ==========================================================
  // VIEW 2: FORM NHẬP TÌM KIẾM ĐƠN HÀNG (THEO ĐÚNG HÌNH BẠN GỬI)
  // ==========================================================
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tìm đơn hàng khác</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}>
          {/* Input field */}
          <TextInput
            style={styles.input}
            placeholder="Nhập số điện thoại hoặc mã đơn hàng"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (hasSearched) setHasSearched(false);
            }}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
          />

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

          {/* Search Status / Empty State */}
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_RED} />
              <Text style={styles.loadingText}>Đang tra cứu dữ liệu đơn hàng...</Text>
            </View>
          ) : hasSearched && !selectedOrder ? (
            <View style={styles.emptyContainer}>
              <Package size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Không tìm thấy đơn hàng</Text>
              <Text style={styles.emptyDesc}>
                {`Không tìm thấy đơn hàng nào khớp với "${searchQuery}". Vui lòng kiểm tra lại chính xác số điện thoại hoặc mã đơn hàng (Ví dụ: #6X23DVAGVOO).`}
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

