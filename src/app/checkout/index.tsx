import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  MapPin,
  Map,
  XCircle,
} from 'lucide-react-native';
import Svg, { Path, Polygon, Circle } from 'react-native-svg';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { mockProducts } from '../../data/mockProducts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getItemLineUnitPrice } from '../../utils/calculateTotals';
import { triggerHaptic } from '../../utils/haptics';
import { searchVietnamAddresses, AddressSuggestion } from '../../services/addressService';

const BRAND_RED = '#CF4226';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

// Payment Methods
const PAYMENT_METHODS = [
  { id: 'cash', name: 'Tiền mặt', icon: 'cash', subtext: '' },
  { id: 'zalopay', name: 'ZaloPay', icon: 'zalopay', subtext: 'Trả sau giảm 35k - Nhập TRASAU35K' },
  { id: 'momo', name: 'Momo', icon: 'momo', subtext: '' },
  { id: 'card', name: 'ATM/VISA', icon: 'card', subtext: '' },
  { id: 'vnpay', name: 'VNPAY', icon: 'vnpay', subtext: '' },
  { id: 'applepay', name: 'Apple Pay', icon: 'applepay', subtext: '' },
];

/* SVG: GPS Crosshair Target Icon */
const CrosshairIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="7" stroke="#CF4226" strokeWidth={2} />
    <Circle cx="12" cy="12" r="2.5" fill="#CF4226" />
    <Path
      d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12"
      stroke="#CF4226"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

/* SVG: Empty Voucher Ticket with Star */
const EmptyTicketIcon = () => (
  <Svg width={116} height={74} viewBox="0 0 116 74" fill="none">
    <Path
      d="M10 5 C5 5 0 10 0 15 L0 27 C6 27 10 31 10 37 C10 43 6 47 0 47 L0 59 C0 64 5 69 10 69 L106 69 C111 69 116 64 116 59 L116 47 C110 47 106 43 106 37 C106 31 110 27 116 27 L116 15 C116 10 111 5 106 5 Z"
      fill="#E6E8EE"
    />
    <Path
      d="M28 10 L28 64"
      stroke="#D5D9E2"
      strokeWidth={2}
      strokeDasharray="4 4"
    />
    <Polygon
      points="72,21 76,32 87,33 79,40 82,51 72,45 62,51 65,40 57,33 68,32"
      fill="#FFFFFF"
    />
  </Svg>
);

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user } = useAuth();

  // Address & Notes
  const [address, setAddress] = useState('29 Đường Lê Duẩn, Sai Gon, Ho Chi Minh, Vietnam');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryTime] = useState('10:30');

  // Customer Information (Tự động điền nếu đã đăng nhập, để trống cho khách tự nhập tay)
  const [fullname, setFullname] = useState(user?.fullname || '');
  const [phone, setPhone] = useState(
    user?.phone ? (user.phone.startsWith('0') ? user.phone.slice(1) : user.phone) : ''
  );
  const [email, setEmail] = useState(user?.email || '');

  useEffect(() => {
    if (user) {
      setFullname(user.fullname || '');
      setPhone(
        user.phone ? (user.phone.startsWith('0') ? user.phone.slice(1) : user.phone) : ''
      );
      setEmail(user.email || '');
    } else {
      setFullname('');
      setPhone('');
      setEmail('');
    }
  }, [user]);

  // Payment Method Modal & Selection
  const [selectedPaymentId, setSelectedPaymentId] = useState('cash');
  const [tempPaymentId, setTempPaymentId] = useState('cash');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Voucher Modal & Selection
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<{
    code: string;
    discountAmount: number;
    title: string;
  } | null>(null);

  // Address Modal ('Tìm cửa hàng gần bạn nhất' / Nhập tay vị trí)
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'takeaway'>('delivery');
  const [manualAddressInput, setManualAddressInput] = useState(address);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Debounced search for Vietnamese address autocomplete
  useEffect(() => {
    if (!addressModalVisible) {
      setAddressSuggestions([]);
      return;
    }
    const query = manualAddressInput.trim();
    if (query.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingAddress(true);
        const results = await searchVietnamAddresses(query);
        setAddressSuggestions(results);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [manualAddressInput, addressModalVisible]);

  // Terms Agreement
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Order Confirmation State (When user clicks Đặt hàng)
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderCode, setOrderCode] = useState('6X23D93400J5');
  const [orderDateString, setOrderDateString] = useState('23/10/2026 02:58:50');

  // Totals Calculation
  const subtotal = items.reduce((sum, item) => {
    const product = productsMap[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + unitPrice * qty;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const deliveryFee = 22000;
  const voucherDiscount = selectedVoucher?.discountAmount || 0;
  const total = Math.max(0, subtotal + deliveryFee - voucherDiscount);
  const earnedPoints = Math.floor(total / 10000);

  const selectedPayment = PAYMENT_METHODS.find((p) => p.id === selectedPaymentId);

  const handleOpenPaymentModal = () => {
    setTempPaymentId(selectedPaymentId);
    setPaymentModalVisible(true);
  };

  const handleConfirmPayment = () => {
    setSelectedPaymentId(tempPaymentId);
    setPaymentModalVisible(false);
  };

  const handleApplyVoucherCode = () => {
    const code = inputVoucherCode.trim().toUpperCase();
    if (code === 'PIZZAFPT' || code === 'FPT40') {
      setSelectedVoucher({ code, discountAmount: 40000, title: 'Giảm 40.000 đ' });
      Alert.alert('Áp dụng thành công', 'Đã giảm 40.000 đ vào đơn hàng!');
    } else if (code === 'FREESHIP') {
      setSelectedVoucher({ code, discountAmount: 22000, title: 'Miễn phí giao hàng' });
      Alert.alert('Áp dụng thành công', 'Đã miễn phí giao hàng!');
    } else {
      Alert.alert('Mã không hợp lệ', 'Vui lòng kiểm tra lại mã giảm giá.');
    }
  };

  const handleOpenAddressModal = () => {
    setManualAddressInput(address);
    setAddressModalVisible(true);
  };

  const handleSaveManualAddress = () => {
    if (manualAddressInput.trim()) {
      setAddress(manualAddressInput.trim());
    }
    setAddressModalVisible(false);
  };

  const handleChooseFromMap = () => {
    triggerHaptic('light');
    Alert.alert(
      'Chọn từ bản đồ',
      'Đã định vị thành công vị trí hiện tại của bạn tại TP. Hồ Chí Minh.',
      [
        {
          text: 'Xác nhận vị trí này',
          onPress: () => {
            setManualAddressInput(
              '29 Đường 48, Khu phố 6, P. Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh'
            );
            setAddressSuggestions([]);
          },
        },
        { text: 'Đóng', style: 'cancel' },
      ]
    );
  };

  const handlePlaceOrder = () => {
    if (!agreeTerms) {
      Alert.alert('Lưu ý', 'Vui lòng đồng ý với các điều khoản để tiếp tục đặt hàng.');
      return;
    }
    if (!fullname.trim() || !phone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ họ tên và số điện thoại.');
      return;
    }

    // Generate random code or standard order code like #6X23D93400J5
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generatedOrderCode = '6X23D' + rand;
    setOrderCode(generatedOrderCode);

    // Current timestamp format DD/MM/YYYY HH:mm:ss
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
    const dateFormatted =
      pad(now.getDate()) +
      '/' +
      pad(now.getMonth() + 1) +
      '/' +
      now.getFullYear() +
      ' ' +
      pad(now.getHours()) +
      ':' +
      pad(now.getMinutes()) +
      ':' +
      pad(now.getSeconds());
    setOrderDateString(dateFormatted);
    triggerHaptic('success');
    clearCart();

    // Switch to order confirmation screen
    setOrderConfirmed(true);
  };

  // ==========================================================
  // VIEW: ORDER CONFIRMATION SCREEN (REPLICATING SCREENSHOTS 1, 2, 3)
  // ==========================================================
  if (orderConfirmed) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.orderSuccessScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Message */}
          <View style={styles.orderSuccessHeader}>
            <Text style={styles.orderSuccessTitle}>Cảm ơn bạn {fullname}!</Text>
            <Text style={styles.orderSuccessSubtitle}>Chúng tôi đang xác nhận</Text>
            <Text style={styles.orderSuccessSubtitle}>đơn hàng của bạn</Text>
            <Text style={styles.orderSuccessCode}>#{orderCode}</Text>
            <Text style={styles.orderSuccessDesc}>
              Chúng tôi đang xác nhận đơn hàng của bạn được thực hiện. Quá trình này sẽ nhanh thôi.
            </Text>
          </View>

          {/* Membership Promotional Banner */}
          <View style={styles.promoBannerCard}>
            <View style={styles.promoBannerInner}>
              <View style={styles.promoHeaderBadge}>
                <Text style={styles.promoRoofIcon}>🍕</Text>
                <Text style={styles.promoBadgeText}>ĐĂNG KÝ THÀNH VIÊN</Text>
              </View>

              <Text style={styles.promoMainText}>NHẬN LIỀN</Text>
              <View style={styles.promoAmountWrap}>
                <Text style={styles.promoAmount}>80.000</Text>
                <Text style={styles.promoCurrency}>VND</Text>
              </View>
              <View style={styles.promoTimePill}>
                <Text style={styles.promoTimeText}>trong vòng 72h làm việc</Text>
              </View>

              {/* Pizza illustration preview */}
              <View style={styles.promoImagesRow}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500' }}
                  style={styles.promoPizzaImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => Alert.alert('Đăng ký thành viên', 'Tính năng đang được phát triển!')}
            >
              <Text style={styles.primaryActionText}>Đăng ký ngay để tận hưởng ưu đãi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionButton}
              activeOpacity={0.88}
              onPress={() => {
                clearCart();
                router.replace('/(tabs)/home');
              }}
            >
              <Text style={styles.secondaryActionText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Giao Đến</Text>
            <Text style={styles.infoDeliveryTime}>Thời gian nhận: {deliveryTime}</Text>
            <Text style={styles.infoText}>{fullname}</Text>
            <Text style={styles.infoText}>{phone}</Text>
            <Text style={styles.infoText}>{address}</Text>
          </View>

          {/* Card 2: Phương thức thanh toán */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Phương thức thanh toán</Text>
            <Text style={styles.infoText}>{selectedPayment?.name || 'Tiền mặt'}</Text>
          </View>

          {/* Card 3: Có X sản phẩm trong giỏ hàng của bạn */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>
              Có {itemCount} sản phẩm trong giỏ hàng của bạn
            </Text>
            <Text style={styles.orderTimestampText}>{orderDateString}</Text>

            {/* Product list */}
            {items.map((item, idx) => {
              const product = productsMap[item.productId];
              const unitPrice = getItemLineUnitPrice(item, product) || 0;
              const lineTotal = unitPrice * (Number(item.quantity) || 1);
              const variant = product?.variants?.find((v) => v.id === item.variantId);
              const variantName = variant?.name || 'Đế Truyền Thống';
              return (
                <View key={item.lineId || idx} style={styles.orderItemRow}>
                  <View style={styles.orderItemMainLine}>
                    <Text style={styles.orderItemName} numberOfLines={1}>
                      {product?.name || 'Sản phẩm'}
                    </Text>
                    <Text style={styles.orderItemQty}>{item.quantity}</Text>
                    <Text style={styles.orderItemPrice}>{formatCurrency(lineTotal)}</Text>
                  </View>
                  <Text style={styles.orderItemOptions}>
                    {variantName}
                  </Text>
                </View>
              );
            })}

            <View style={styles.pricingDivider} />

            {/* Price breakdown */}
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tạm tính</Text>
              <Text style={styles.pricingValue}>{formatCurrency(subtotal)}</Text>
            </View>

            <View style={styles.pricingRow}>
              <View style={styles.infoLabelWrap}>
                <Text style={styles.pricingLabel}>Giảm giá thành viên</Text>
                <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pricingValue}>0 đ</Text>
            </View>

            {selectedVoucher && voucherDiscount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: BRAND_RED }]}>
                  Giảm giá Voucher ({selectedVoucher.code})
                </Text>
                <Text style={[styles.pricingValue, { color: BRAND_RED }]}>
                  -{formatCurrency(voucherDiscount)}
                </Text>
              </View>
            )}

            <View style={styles.pricingRow}>
              <View style={styles.infoLabelWrap}>
                <Text style={styles.pricingLabel}>Phí giao hàng</Text>
                <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pricingValue}>{formatCurrency(deliveryFee)}</Text>
            </View>

            <View style={styles.pricingDivider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Tổng cộng</Text>
                <Text style={styles.rewardPointsNote}>
                  Nhận <Text style={{ fontWeight: '700', color: '#111827' }}>{earnedPoints} điểm</Text> Hut rewards
                </Text>
              </View>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
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
  // VIEW: CHECKOUT SCREEN
  // ==========================================================
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* HEADER: Back Arrow + Title */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* BLOCK 1: GIAO ĐẾN */}
        <View style={styles.whiteSectionBlock}>
          <TouchableOpacity
            style={styles.fieldRowClickable}
            onPress={handleOpenAddressModal}
            activeOpacity={0.7}
          >
            <View style={styles.fieldLeftWrap}>
              <Text style={styles.sectionHeaderTitle}>Giao đến</Text>
              <Text style={styles.addressSubtext} numberOfLines={2}>
                {address}
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.noteInputContainer}>
            <View style={styles.noteHeaderRow}>
              <Text style={styles.noteLabel}>Ghi chú</Text>
              <Text style={styles.noteCounter}>{deliveryNote.length}/200</Text>
            </View>
            <TextInput
              style={styles.noteTextInput}
              placeholder="Ghi chú cho giao hàng, ví dụ: tầng, phòng..."
              placeholderTextColor="#9CA3AF"
              maxLength={200}
              value={deliveryNote}
              onChangeText={setDeliveryNote}
            />
          </View>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 2: THỜI GIAN NHẬN */}
        <View style={styles.whiteSectionBlock}>
          <TouchableOpacity
            style={styles.fieldRowClickable}
            onPress={() =>
              Alert.alert('Thời gian nhận hàng', 'Đơn hàng sẽ được giao trong khoảng 30 phút tới!')
            }
            activeOpacity={0.7}
          >
            <Text style={styles.sectionHeaderTitle}>Thời gian nhận</Text>
            <View style={styles.rowRightBadge}>
              <Text style={styles.timeValueText}>{deliveryTime}</Text>
              <ChevronRight size={20} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 3: NGƯỜI ĐẶT HÀNG */}
        <View style={styles.whiteSectionBlock}>
          <Text style={styles.sectionHeaderTitle}>Người đặt hàng</Text>
          <Text style={styles.sectionSubTitle}>
            Thông tin được dùng để tích lũy điểm thành viên
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Họ và tên</Text>
            <TextInput
              style={styles.textInputFull}
              value={fullname}
              onChangeText={setFullname}
              placeholder="Nhập họ và tên"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBadge}>
                <Text style={styles.countryCodeText}>+84</Text>
              </View>
              <TextInput
                style={styles.phoneTextInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInputFull}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="Nhập địa chỉ email"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 4: PHƯƠNG THỨC THANH TOÁN */}
        <View style={styles.whiteSectionBlock}>
          <TouchableOpacity
            style={styles.fieldRowClickable}
            onPress={handleOpenPaymentModal}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionHeaderTitle}>Phương thức thanh toán</Text>
            <View style={styles.rowRightBadge}>
              <Text style={styles.paymentMethodValue}>
                {selectedPayment?.name || 'Tiền mặt'}
              </Text>
              <ChevronRight size={20} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 5: VOUCHER */}
        <View style={styles.whiteSectionBlock}>
          <TouchableOpacity
            style={styles.fieldRowClickable}
            onPress={() => setVoucherModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionHeaderTitle}>Voucher</Text>
            <View style={styles.rowRightBadge}>
              <Text
                style={[
                  styles.voucherActionHint,
                  selectedVoucher && { color: BRAND_RED, fontWeight: '700' },
                ]}
              >
                {selectedVoucher ? selectedVoucher.code : 'Nhập hoặc chọn voucher của bạn'}
              </Text>
              <ChevronRight size={20} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 6: GIỎ HÀNG CỦA TÔI -> Navigate back to /cart */}
        <View style={styles.whiteSectionBlock}>
          <TouchableOpacity
            style={styles.cartBlockRow}
            onPress={() => router.push('/(tabs)/cart')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeaderTitle}>Giỏ hàng của tôi</Text>
              <Text style={styles.cartCountSubtext}>
                Có {itemCount} sản phẩm trong giỏ hàng của bạn
              </Text>
            </View>
            <ChevronRight size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 7: TỔNG KẾT CHI PHÍ */}
        <View style={styles.whiteSectionBlock}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Tạm tính</Text>
            <Text style={styles.pricingValue}>{formatCurrency(subtotal)}</Text>
          </View>

          <View style={styles.pricingRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={styles.pricingLabel}>Giảm giá thành viên</Text>
              <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.pricingValue}>0 đ</Text>
          </View>

          {selectedVoucher && voucherDiscount > 0 && (
            <View style={styles.pricingRow}>
              <Text style={[styles.pricingLabel, { color: BRAND_RED }]}>
                Giảm giá Voucher ({selectedVoucher.code})
              </Text>
              <Text style={[styles.pricingValue, { color: BRAND_RED }]}>
                -{formatCurrency(selectedVoucher.discountAmount)}
              </Text>
            </View>
          )}

          <View style={styles.pricingRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={styles.pricingLabel}>Phí giao hàng</Text>
              <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.pricingValue}>{formatCurrency(deliveryFee)}</Text>
          </View>

          <View style={styles.pricingDivider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Tổng cộng</Text>
              <Text style={styles.rewardPointsNote}>
                Nhận <Text style={{ fontWeight: '700', color: '#111827' }}>{earnedPoints} điểm</Text> Hut rewards
              </Text>
            </View>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 8: TERMS & CONDITIONS */}
        <View style={styles.termsSection}>
          <TouchableOpacity
            style={styles.termsCheckboxRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.termsSquare, agreeTerms && styles.termsSquareChecked]}>
              {agreeTerms && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.termsText}>
              Tôi đồng ý với{' '}
              <Text style={styles.termsLink}>các điều khoản và điều kiện</Text> và tham gia{' '}
              <Text style={styles.termsLink}>chương trình thành viên FPT Rewards</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* BOTTOM STICKY BUTTON: 'Đặt hàng' */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.orderBtn}
          onPress={handlePlaceOrder}
          activeOpacity={0.88}
        >
          <Text style={styles.orderBtnText}>Đặt hàng</Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* MODAL: TÌM CỬA HÀNG GẦN BẠN NHẤT / NHẬP TAY ĐỊA CHỈ       */}
      {/* ======================================================== */}
      <Modal
        visible={addressModalVisible}
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <SafeAreaView style={styles.modalFullContainer} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.addressModalHeader}>
            <TouchableOpacity
              style={styles.addressModalBackBtn}
              onPress={() => setAddressModalVisible(false)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronLeft size={28} color="#111827" strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.addressModalTitle}>Tìm cửa hàng gần bạn nhất</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={styles.modalBodyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Subtitle */}
            <Text style={styles.addressModalSubtitle}>
              Nhập địa chỉ của bạn để xem các ưu đãi, phiếu giảm giá và khuyến mại tại địa phương.
            </Text>

            {/* Fulfillment Mode Radio */}
            <View style={styles.fulfillmentRadioGroup}>
              <TouchableOpacity
                style={styles.fulfillmentRadioItem}
                onPress={() => setFulfillmentType('delivery')}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioCircle,
                    fulfillmentType === 'delivery' && styles.radioCircleActive,
                  ]}
                >
                  {fulfillmentType === 'delivery' && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.fulfillmentText}>Giao hàng tới</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fulfillmentRadioItem}
                onPress={() => setFulfillmentType('takeaway')}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioCircle,
                    fulfillmentType === 'takeaway' && styles.radioCircleActive,
                  ]}
                >
                  {fulfillmentType === 'takeaway' && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.fulfillmentText}>Mua mang về</Text>
              </TouchableOpacity>
            </View>

            {/* Section: Vị trí của tôi */}
            <Text style={styles.myLocationSectionTitle}>Vị trí của tôi</Text>

            {/* Address Search Bar */}
            <View style={styles.addressSearchBox}>
              <View style={styles.crosshairBadge}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="7" stroke="#FFFFFF" strokeWidth={2} />
                  <Circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
                  <Path
                    d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>

              <TextInput
                style={styles.addressSearchInput}
                value={manualAddressInput}
                onChangeText={setManualAddressInput}
                placeholder="Nhập địa chỉ của bạn"
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
                autoCorrect={false}
              />

              {manualAddressInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setManualAddressInput('');
                    setAddressSuggestions([]);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.clearInputBtn}
                >
                  <XCircle size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Autocomplete Suggestions Dropdown */}
            {addressSuggestions.length > 0 && (
              <View style={styles.suggestionsCard}>
                {addressSuggestions.map((item, index) => (
                  <TouchableOpacity
                    key={item.id || index}
                    style={[
                      styles.suggestionRowItem,
                      index === addressSuggestions.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    activeOpacity={0.65}
                    onPress={() => {
                      triggerHaptic('light');
                      setManualAddressInput(item.fullAddress);
                      setAddressSuggestions([]);
                    }}
                  >
                    <View style={styles.suggestionPinBox}>
                      <MapPin size={22} color="#1E2024" strokeWidth={1.8} />
                    </View>
                    <View style={styles.suggestionTextCol}>
                      <Text style={styles.suggestionTitleText} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.suggestionSubText} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action: Chọn từ bản đồ */}
            <TouchableOpacity
              style={styles.chooseFromMapBtn}
              activeOpacity={0.7}
              onPress={handleChooseFromMap}
            >
              <Map size={22} color={BRAND_RED} strokeWidth={2} />
              <Text style={styles.chooseFromMapText}>Chọn từ bản đồ</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Confirm Button */}
          <View style={styles.modalBottomBar}>
            <TouchableOpacity
              style={styles.confirmAddressBtn}
              onPress={handleSaveManualAddress}
              activeOpacity={0.88}
            >
              <Text style={styles.confirmAddressBtnText}>Bắt đầu đặt hàng</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: PHƯƠNG THỨC THANH TOÁN                             */}
      {/* ======================================================== */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPaymentModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.paymentModalBox}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Phương thức thanh toán</Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentOptionsList}>
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = tempPaymentId === pm.id;
                return (
                  <TouchableOpacity
                    key={pm.id}
                    style={styles.paymentOptionRow}
                    onPress={() => setTempPaymentId(pm.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleActive,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>

                    <View style={styles.pmIconWrap}>
                      {pm.id === 'cash' ? (
                        <Banknote size={20} color="#059669" />
                      ) : pm.id === 'card' ? (
                        <CreditCard size={20} color="#2563EB" />
                      ) : (
                        <Smartphone size={20} color={BRAND_RED} />
                      )}
                    </View>

                    <View style={styles.pmTextWrap}>
                      <Text style={styles.pmName}>{pm.name}</Text>
                      {pm.subtext ? (
                        <Text style={styles.pmSubtext}>{pm.subtext}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.applyPaymentBtn}
              onPress={handleConfirmPayment}
              activeOpacity={0.88}
            >
              <Text style={styles.applyPaymentBtnText}>Áp dụng</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: MÃ GIẢM GIÁ (Voucher)                              */}
      {/* ======================================================== */}
      <Modal
        visible={voucherModalVisible}
        animationType="slide"
        onRequestClose={() => setVoucherModalVisible(false)}
      >
        <SafeAreaView style={styles.modalFullContainer} edges={['top', 'bottom']}>
          <View style={styles.voucherHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setVoucherModalVisible(false)}
              activeOpacity={0.7}
            >
              <ChevronLeft size={26} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.voucherHeaderTitle}>Mã giảm giá</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.voucherBody}>
            <View style={styles.voucherInputRow}>
              <TextInput
                style={styles.voucherTextInput}
                placeholder="Nhập mã voucher (vd: FPT40, FREESHIP)"
                placeholderTextColor="#9CA3AF"
                value={inputVoucherCode}
                onChangeText={setInputVoucherCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[
                  styles.voucherApplyBtn,
                  inputVoucherCode.trim().length > 0 && styles.voucherApplyBtnActive,
                ]}
                onPress={handleApplyVoucherCode}
                disabled={inputVoucherCode.trim().length === 0}
              >
                <Text
                  style={[
                    styles.voucherApplyText,
                    inputVoucherCode.trim().length > 0 && styles.voucherApplyTextActive,
                  ]}
                >
                  Áp dụng
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.emptyVoucherArea}>
              <EmptyTicketIcon />
              <Text style={styles.emptyVoucherTitle}>Hiện không có mã giảm giá</Text>
              <Text style={styles.emptyVoucherSub}>
                Bạn có thể thử nhập mã: <Text style={{ fontWeight: '700' }}>FPT40</Text> hoặc{' '}
                <Text style={{ fontWeight: '700' }}>FREESHIP</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.voucherDoneBtn}
              onPress={() => setVoucherModalVisible(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.voucherDoneBtnText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    height: 52,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    width: 36,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  whiteSectionBlock: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionDividerGap: {
    height: 8,
    backgroundColor: '#F3F4F6',
  },
  fieldRowClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLeftWrap: {
    flex: 1,
    marginRight: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 10,
  },
  addressSubtext: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 19,
  },
  noteInputContainer: {
    marginTop: 12,
  },
  noteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  noteCounter: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noteTextInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  rowRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  formGroup: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
    fontWeight: '500',
  },
  textInputFull: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeBadge: {
    backgroundColor: '#E5E7EB',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  phoneTextInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  paymentMethodValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  voucherActionHint: {
    fontSize: 14,
    color: BRAND_RED,
    fontWeight: '500',
  },
  cartBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartCountSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
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
  termsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  termsCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  termsSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  termsSquareChecked: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  termsLink: {
    color: '#111827',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  orderBtn: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ORDER SUCCESS SCREEN STYLES (MATCHING SCREENSHOTS 1, 2, 3) */
  orderSuccessScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
  },
  orderSuccessHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  orderSuccessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  orderSuccessSubtitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  orderSuccessCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 4,
  },
  orderSuccessDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  promoBannerCard: {
    backgroundColor: '#BC1924',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#9E131C',
  },
  promoBannerInner: {
    padding: 16,
    alignItems: 'center',
  },
  promoHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8C1019',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  promoRoofIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  promoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  promoMainText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  promoAmountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  promoAmount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  promoCurrency: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 6,
  },
  promoTimePill: {
    backgroundColor: '#8C1019',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 12,
  },
  promoTimeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  promoImagesRow: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoPizzaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  actionButtonsContainer: {
    marginBottom: 16,
  },
  primaryActionButton: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BRAND_RED,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_RED,
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
    lineHeight: 20,
    marginTop: 2,
  },
  orderTimestampText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  orderItemRow: {
    marginVertical: 6,
  },
  orderItemMainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  orderItemQty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    width: 24,
    textAlign: 'center',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  orderItemOptions: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  contactSupportSubtitle: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  supportHotline: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_RED,
    marginVertical: 4,
  },
  supportNotice: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 4,
  },

  /* MANUAL ADDRESS MODAL */
  modalFullContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  addressModalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  addressModalBackBtn: {
    padding: 2,
  },
  addressModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalBodyScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  addressModalSubtitle: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 14,
    marginBottom: 16,
  },
  fulfillmentRadioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fulfillmentRadioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 28,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioCircleActive: {
    borderColor: BRAND_RED,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_RED,
  },
  fulfillmentText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  myLocationSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  addressSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 3,
    marginBottom: 8,
  },
  crosshairBadge: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressSearchInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearInputBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  suggestionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionPinBox: {
    marginRight: 12,
  },
  suggestionTextCol: {
    flex: 1,
  },
  suggestionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  suggestionSubText: {
    fontSize: 12.5,
    color: '#6B7280',
  },
  chooseFromMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  chooseFromMapText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_RED,
    marginLeft: 8,
  },
  modalBottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  confirmAddressBtn: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmAddressBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* PAYMENT MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paymentModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 420,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  paymentModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 4,
  },
  paymentOptionsList: {
    marginBottom: 16,
  },
  paymentOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  pmIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pmTextWrap: {
    flex: 1,
  },
  pmName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  pmSubtext: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  applyPaymentBtn: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  applyPaymentBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* VOUCHER MODAL */
  voucherHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  voucherHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  voucherBody: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voucherTextInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  voucherApplyBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherApplyBtnActive: {
    backgroundColor: BRAND_RED,
  },
  voucherApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  voucherApplyTextActive: {
    color: '#FFFFFF',
  },
  emptyVoucherArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyVoucherTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  emptyVoucherSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  voucherDoneBtn: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  voucherDoneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
