import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Info,
  X,
  Check,
  Banknote,
  Smartphone,
  MapPin,
  Store,
  Clock3,
  UserRound,
  Phone,
  Mail,
  NotebookPen,
  TicketPercent,
  ShoppingBag,
  ArrowRight,
  Plus,
  Minus,
} from 'lucide-react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';
import { triggerHaptic } from '../../utils/haptics';
import { findCoupon, useCatalog, useCoupons } from '../../services/catalog';
import { formatDeliveryTime, isDeliveryTimeAvailable } from '../../utils/deliveryTime';
import { StoreLocationModal } from '../../components/modals/StoreLocationModal';
import { DeliveryTimeModal } from '../../components/modals/DeliveryTimeModal';
import { CheckoutRow } from '../../components/checkout/CheckoutRow';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import {
  getSavedDeliveryAddress,
  saveDeliveryAddress,
  getSavedCustomerInfo,
  saveCustomerInfo,
} from '../../services/addressStorage';

import { styles, BRAND_RED } from '../../styles/checkout.styles';
import { formatCustomizationSummary } from '../../types/pizzaCustomization';
import { createPayosPayment } from '../../services/payosService';
import { createCashOrder } from '../../services/orderApi';
import { ahamoveEnabled, createAhamoveCod, deliveryCheckout, getDeliveryQuote, resumeAhamoveCod } from '../../services/deliveryService';
import type { DeliveryQuote } from '../../types/delivery';


// Payment Methods
const PAYMENT_METHODS = [
  { id: 'cash', name: 'Tiền mặt khi nhận hàng', subtext: 'Thanh toán bằng tiền mặt khi nhận món' },
  { id: 'payos', name: 'payOS', subtext: 'Chuyển khoản bằng mã QR • Cần đăng nhập' },
];

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

type ContactField = 'fullname' | 'phone' | 'email';
const normalizePhone = (value: string) => {
  const digits = value.replace(/[\s.-]/g, '').replace(/^\+?84/, '0');
  return digits.startsWith('0') ? digits : `0${digits}`;
};
const contactError = (field: ContactField, value: string) => {
  if (field === 'fullname') return value.trim() ? '' : 'Nhập họ tên người nhận.';
  if (field === 'phone') return /^0[35789]\d{8}$/.test(normalizePhone(value)) ? '' : 'Nhập số di động Việt Nam hợp lệ.';
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Kiểm tra lại địa chỉ email.';
};

export default function CheckoutScreen() {
  const { productsMap } = useCatalog();
  const coupons = useCoupons();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, isLoaded: cartLoaded, clearCart, promoCode, setPromoCode, fulfillmentType, setFulfillmentType, needCutlery } = useCart();
  const { user } = useAuth();

  // Address & Notes
  const [address, setAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('asap');
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  // Customer Information (Tự động điền nếu đã đăng nhập; để trống cho khách tự nhập)
  const [fullname, setFullname] = useState(user?.fullname || '');
  const [phone, setPhone] = useState(
    user?.phone ? normalizePhone(user.phone).slice(1) : ''
  );
  const [email, setEmail] = useState(user?.email || '');
  const [isEditingContact, setIsEditingContact] = useState(() => !user ||
    !!contactError('fullname', user.fullname) || !!contactError('phone', user.phone) || !!contactError('email', user.email));
  const [showEmail, setShowEmail] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [focusedField, setFocusedField] = useState<ContactField | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({});
  const fullnameInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const phoneInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const emailInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const showContactForm = !user || isEditingContact;
  const validateField = (field: ContactField, value: string) => {
    setFocusedField(null);
    setFieldErrors(previous => ({ ...previous, [field]: contactError(field, value) }));
  };

  useEffect(() => {
    let cancelled = false;
    // 1. Khôi phục địa chỉ đã lưu
    getSavedDeliveryAddress().then((saved) => {
      if (saved) setAddress(saved);
    });

    // 2. Khôi phục ghi chú & thông tin khách (chỉ lấy nếu là khách chưa đăng nhập và đã nhập trước đó)
    getSavedCustomerInfo().then((info) => {
      if (info && !cancelled) {
        if (info.deliveryNote) setDeliveryNote((prev) => prev || info.deliveryNote || '');
        if (!user) {
          if (info.fullname) setFullname((prev) => prev || info.fullname || '');
          if (info.phone) setPhone((prev) => prev || info.phone || '');
          if (info.email) setEmail((prev) => prev || info.email || '');
        }
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    setIsEditingContact(!user || !!contactError('fullname', user.fullname) ||
      !!contactError('phone', user.phone) || !!contactError('email', user.email));
    setFieldErrors({});
    setShowEmail(false);
    if (user) {
      setFullname(user.fullname || '');
      setPhone(
        user.phone ? normalizePhone(user.phone).slice(1) : ''
      );
      setEmail(user.email || '');
    } else {
      // Khi không có user (chưa đăng nhập hoặc vừa đăng xuất), xóa sạch thông tin để khách tự nhập mới
      setFullname('');
      setPhone('');
      setEmail('');
    }
  }, [user]);

  const handleUpdateFullname = (val: string) => {
    setFieldErrors(previous => previous.fullname ? { ...previous, fullname: contactError('fullname', val) } : previous);
    setFullname(val);
    if (!user) {
      saveCustomerInfo({ fullname: val });
    }
  };

  const handleUpdatePhone = (val: string) => {
    setFieldErrors(previous => previous.phone ? { ...previous, phone: contactError('phone', val) } : previous);
    setPhone(val);
    if (!user) {
      saveCustomerInfo({ phone: val });
    }
  };

  const handleUpdateEmail = (val: string) => {
    setFieldErrors(previous => previous.email ? { ...previous, email: contactError('email', val) } : previous);
    setEmail(val);
    if (!user) {
      saveCustomerInfo({ email: val });
    }
  };

  const validateContact = () => {
    const errors = {
      fullname: contactError('fullname', fullname),
      phone: contactError('phone', phone),
      email: contactError('email', email),
    };
    setFieldErrors(errors);
    const invalidField = (['fullname', 'phone', 'email'] as const).find(field => errors[field]);
    if (!invalidField) return true;
    setIsEditingContact(true);
    if (invalidField === 'email') setShowEmail(true);
    requestAnimationFrame(() => {
      const inputs = { fullname: fullnameInput, phone: phoneInput, email: emailInput };
      inputs[invalidField].current?.focus();
    });
    return false;
  };

  const handleUpdateDeliveryNote = (val: string) => {
    setDeliveryNote(val);
    saveCustomerInfo({ deliveryNote: val });
  };

  // Payment Method Modal & Selection
  const [selectedPaymentId, setSelectedPaymentId] = useState('cash');
  const [tempPaymentId, setTempPaymentId] = useState('cash');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Voucher Modal & Selection
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const selectedVoucher = (promoCode && findCoupon(coupons, promoCode)) || null;

  // Address Modal ('Tìm cửa hàng gần bạn nhất' / Nhập tay vị trí)
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  // Terms Agreement
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Order Confirmation State (When user clicks Đặt hàng)
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderCode, setOrderCode] = useState('6X23D93400J5');
  const [orderDateString, setOrderDateString] = useState('23/10/2026 02:58:50');
  const [confirmedOrderData, setConfirmedOrderData] = useState<{
    items: typeof items;
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    voucherDiscount: number;
    selectedVoucher: typeof selectedVoucher;
    total: number;
    earnedPoints: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Opened with an empty cart (e.g. a direct link): send the user to the menu. Placing an order also
  // empties the cart, so never redirect while submitting or once the confirmation is showing.
  // Only while this screen is in front: a paid payOS order empties the cart while its QR screen is on top,
  // and replacing the route from here would swap that success screen for the menu.
  useFocusEffect(useCallback(() => {
    if (cartLoaded && items.length === 0 && !isSubmitting && !orderConfirmed) router.replace('/(tabs)/menu');
  }, [cartLoaded, items.length, isSubmitting, orderConfirmed, router]));
  const [shippingQuote, setShippingQuote] = useState<{ value: DeliveryQuote; signature: string } | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const useAhamove = ahamoveEnabled && fulfillmentType === 'delivery';
  const shippingInput = {
    customer: { fullname, phone: normalizePhone(phone), email }, fulfillmentType: 'DELIVERY' as const,
    needCutlery, address, deliveryNote, items, paymentMethod: selectedPaymentId === 'payos' ? 'PAYOS' as const : 'COD' as const,
  };
  const shippingSignature = JSON.stringify([user?.id, deliveryCheckout(shippingInput), shippingInput.paymentMethod, promoCode]);
  const validQuote = shippingQuote?.signature === shippingSignature ? shippingQuote.value : null;

  // Totals Calculation
  const totals = calculateOrderTotals(items, productsMap,
    fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP', selectedVoucher);
  const { subtotal, discount: voucherDiscount } = totals;
  const deliveryFee = useAhamove ? validQuote?.pricing.deliveryFee ?? 0 : totals.deliveryFee;
  const total = useAhamove && validQuote ? validQuote.pricing.total : totals.total;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
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
    const voucher = findCoupon(coupons, code);
    if (!voucher) {
      Alert.alert('Mã không hợp lệ', 'Vui lòng kiểm tra lại mã giảm giá.');
      return;
    }
    if (subtotal < voucher.minSubtotal) {
      Alert.alert('Chưa đủ điều kiện', `Đơn hàng cần tối thiểu ${formatCurrency(voucher.minSubtotal)} để áp dụng mã.`);
      return;
    }
    setPromoCode(code);
    setVoucherModalVisible(false);
    triggerHaptic('success');
  };

  const handleOpenAddressModal = () => setAddressModalVisible(true);

  const handleGetShippingQuote = async () => {
    if (!user || user.isDemo) { router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } }); return; }
    if (!validateContact()) return;
    if (!address.trim()) { setAddressModalVisible(true); return; }
    if (promoCode) { setShippingError('Giao Ahamove thử nghiệm chưa hỗ trợ voucher. Vui lòng gỡ mã trước khi lấy phí.'); return; }
    setIsQuoting(true);
    setShippingError('');
    try {
      const previous = await resumeAhamoveCod();
      if (previous) {
        Alert.alert('Đơn trước đã được lưu', `Mã đơn ${previous.orderCode}. Bạn có thể xem trong Đơn hàng; giỏ hàng hiện tại vẫn được giữ.`);
        router.push('/order/tracking');
        return;
      }
      const value = await getDeliveryQuote(shippingInput);
      setShippingQuote({ value, signature: shippingSignature });
    } catch (error) { setShippingError(error instanceof Error ? error.message : 'Chưa thể lấy phí Ahamove.'); }
    finally { setIsQuoting(false); }
  };

  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    if (selectedPaymentId === 'payos' && (!user || user.isDemo)) {
      router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } });
      return;
    }

    if (!agreeTerms) {
      Alert.alert('Lưu ý', 'Vui lòng đồng ý với các điều khoản để tiếp tục đặt hàng.');
      return;
    }
    if (!validateContact()) return;
    if (fulfillmentType === 'delivery' && !address.trim()) {
      setAddressModalVisible(true);
      return;
    }
    const localPhone = normalizePhone(phone);
    if (!isDeliveryTimeAvailable(deliveryTime)) {
      setTimeModalVisible(true);
      Alert.alert('Khung giờ đã qua', 'Vui lòng chọn lại thời gian nhận món.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Giỏ hàng trống', 'Vui lòng chọn món trước khi đặt hàng.');
      return;
    }

    setIsSubmitting(true);

    if (useAhamove && (!validQuote || Date.parse(validQuote.expiresAt) <= Date.now() || promoCode || deliveryTime !== 'asap')) {
      setIsSubmitting(false);
      Alert.alert('Kiểm tra giao hàng', promoCode ? 'Vui lòng gỡ voucher để dùng Ahamove thử nghiệm.' :
        deliveryTime !== 'asap' ? 'Ahamove thử nghiệm chỉ hỗ trợ giao ngay. Vui lòng chọn Sớm nhất.' : 'Vui lòng lấy lại phí Ahamove trước khi đặt hàng.');
      return;
    }

    if (useAhamove && (!user || user.isDemo)) {
      setIsSubmitting(false);
      router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } });
      return;
    }

    if (useAhamove && selectedPaymentId === 'cash') {
      try {
        const result = await createAhamoveCod(validQuote!.id);
        clearCart();
        Alert.alert('Đã đặt hàng thử nghiệm', `Mã đơn ${result.orderCode}. Cửa hàng sẽ gọi tài xế khi món sẵn sàng.`);
        router.replace('/order/tracking');
      } catch (error) { Alert.alert('Chưa thể đặt hàng', error instanceof Error ? error.message : 'Vui lòng kiểm tra lại đơn.'); }
      finally { setIsSubmitting(false); }
      return;
    }

    if (selectedPaymentId === 'payos') {
      try {
        const payment = await createPayosPayment({
          customer: { fullname, phone: localPhone, email },
          fulfillmentType: fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP',
          needCutlery,
          address, items, promoCode: selectedVoucher?.code, paymentMethod: 'PAYOS', deliveryNote,
          ...(!useAhamove ? { deliveryTime: formatDeliveryTime(deliveryTime) } : {}),
          ...(useAhamove ? { deliveryQuoteId: validQuote!.id } : {}),
        });
        router.push({ pathname: '/checkout/payos', params: { orderId: payment.id } });
      } catch (err) {
        Alert.alert('Chưa thể thanh toán payOS', err instanceof Error ? err.message : 'Vui lòng thử lại sau.');
      } finally { setIsSubmitting(false); }
      return;
    }

    // Cash orders are priced and stored by the backend; the app never writes prices to Firestore.
    if (!user || user.isDemo) {
      setIsSubmitting(false);
      router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } });
      return;
    }
    let saved: { subtotal: number; discount: number; total: number };
    try {
      const result = await createCashOrder({
        customer: { fullname, phone: localPhone, email },
        fulfillmentType: fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP',
        needCutlery, address, deliveryNote, items, promoCode: selectedVoucher?.code, paymentMethod: 'COD',
      }, formatDeliveryTime(deliveryTime));
      setOrderCode(result.orderCode);
      saved = result;
    } catch (err) {
      Alert.alert('Chưa thể đặt hàng', err instanceof Error ? err.message : 'Đơn hàng chưa được lưu. Giỏ hàng của bạn vẫn được giữ nguyên, vui lòng thử lại.');
      return;
    } finally {
      setIsSubmitting(false);
    }

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

    // 1. Snapshot cart before clearing; amounts are what the backend stored (prices may have changed meanwhile).
    const orderSnapshot = {
      items: [...items],
      itemCount,
      subtotal: saved.subtotal,
      deliveryFee,
      voucherDiscount: saved.discount,
      selectedVoucher,
      total: saved.total,
      earnedPoints: Math.floor(saved.total / 10000),
    };
    setConfirmedOrderData(orderSnapshot);

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

          {/* Sofa Illustration with Pizza & Tomato (Khớp 100% Ảnh 2) */}
          <CouchIllustration width={320} height={160} />

          {/* Action Button: Về trang chủ (Khớp 100% Ảnh 2) */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => {
                clearCart();
                router.replace('/(tabs)/home');
              }}
            >
              <Text style={styles.primaryActionText}>Về trang chủ</Text>
            </TouchableOpacity>

            {!user && (
              <TouchableOpacity
                style={[styles.secondaryActionButton, { marginTop: 10 }]}
                activeOpacity={0.88}
                onPress={() => {
                  clearCart();
                  router.push('/order/lookup');
                }}
              >
                <Text style={styles.secondaryActionText}>Tìm & Theo dõi đơn hàng</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Card 1: Giao Đến */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{fulfillmentType === "delivery" ? "Giao đến" : "Nhận tại cửa hàng"}</Text>
            <Text style={styles.infoDeliveryTime}>Thời gian nhận: {formatDeliveryTime(deliveryTime)}</Text>
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
              Có {confirmedOrderData?.itemCount ?? itemCount} sản phẩm trong giỏ hàng của bạn
            </Text>
            <Text style={styles.orderTimestampText}>{orderDateString}</Text>

            {/* Product list */}
            {(confirmedOrderData?.items || items).map((item, idx) => {
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
                    {item.customization ? formatCustomizationSummary(item.customization).join(' • ') || variantName : variantName}
                  </Text>
                </View>
              );
            })}

            <View style={styles.pricingDivider} />

            {/* Price breakdown */}
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tạm tính</Text>
              <Text style={styles.pricingValue}>
                {formatCurrency(confirmedOrderData?.subtotal ?? subtotal)}
              </Text>
            </View>

            <View style={styles.pricingRow}>
              <View style={styles.infoLabelWrap}>
                <Text style={styles.pricingLabel}>Giảm giá thành viên</Text>
                <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pricingValue}>0 đ</Text>
            </View>

            {(confirmedOrderData?.selectedVoucher || selectedVoucher) &&
              (confirmedOrderData?.voucherDiscount ?? voucherDiscount) > 0 && (
                <View style={styles.pricingRow}>
                  <Text style={[styles.pricingLabel, { color: BRAND_RED }]}>
                    Giảm giá Voucher (
                    {confirmedOrderData?.selectedVoucher?.code || selectedVoucher?.code})
                  </Text>
                  <Text style={[styles.pricingValue, { color: BRAND_RED }]}>
                    -{formatCurrency(confirmedOrderData?.voucherDiscount ?? voucherDiscount)}
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
                    {confirmedOrderData?.earnedPoints ?? earnedPoints} điểm
                  </Text>{' '}
                  FPT Rewards
                </Text>
              </View>
              <Text style={styles.totalValue}>
                {formatCurrency(confirmedOrderData?.total ?? total)}
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

      <KeyboardAvoidingView style={styles.keyboardContainer}
        enabled={Platform.OS === 'ios'} behavior="padding" keyboardVerticalOffset={insets.top + 52}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.checkoutCard}>
          <CheckoutRow
            icon={fulfillmentType === 'delivery' ? <MapPin size={20} color="#5B6470" /> : <Store size={20} color="#5B6470" />}
            title={fulfillmentType === 'delivery' ? 'Giao đến' : 'Nhận tại cửa hàng'}
            subtitle={address || 'Chọn địa chỉ nhận món'}
            onPress={handleOpenAddressModal}
          />
          <View style={styles.cardDivider} />
          <CheckoutRow icon={<Clock3 size={20} color="#5B6470" />}
            title="Thời gian nhận" subtitle={useAhamove && deliveryTime === 'asap' ? 'Giao ngay khi món sẵn sàng' : formatDeliveryTime(deliveryTime)}
            onPress={() => setTimeModalVisible(true)} />
          <View style={styles.cardDivider} />
          {showNote ? (
            <View style={styles.optionalField}>
              <View style={styles.compactHeading}>
                <NotebookPen size={18} color="#6B7280" />
                <Text style={styles.fieldLabel}>Ghi chú giao nhận</Text>
                <TouchableOpacity style={styles.collapseAction} onPress={() => setShowNote(false)}
                  accessibilityRole="button" accessibilityLabel="Thu gọn ghi chú" accessibilityState={{ expanded: true }}>
                  <Minus size={18} color="#66707C" />
                </TouchableOpacity>
              </View>
              <TextInput style={styles.noteTextInput} value={deliveryNote} onChangeText={handleUpdateDeliveryNote}
                accessibilityLabel="Ghi chú giao nhận, không bắt buộc" placeholder="Tầng, số phòng…" placeholderTextColor="#9CA3AF"
                maxLength={200} multiline />
            </View>
          ) : (
            <TouchableOpacity style={styles.optionalAction} onPress={() => setShowNote(true)} accessibilityRole="button">
              <Plus size={17} color="#6B7280" />
              <Text style={styles.optionalActionText} numberOfLines={1}>{deliveryNote || "Thêm ghi chú"}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.checkoutCard, styles.contactCard]}>
          <View style={styles.cardHeading}>
            <UserRound size={19} color="#5B6470" />
            <Text style={styles.cardHeadingText}>Liên hệ</Text>
            {!!user && (
              <TouchableOpacity style={styles.contactEditButton} accessibilityRole="button"
                accessibilityLabel={showContactForm ? 'Xong, xác nhận thông tin liên hệ' : 'Sửa thông tin liên hệ'}
                accessibilityState={{ expanded: showContactForm }}
                onPress={() => {
                  if (showContactForm) {
                    if (validateContact()) setIsEditingContact(false);
                  } else {
                    setIsEditingContact(true);
                    setShowEmail(!!email);
                  }
                }}>
                <Text style={styles.contactEditText}>{showContactForm ? 'Xong' : 'Sửa'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {showContactForm ? (
          <>
          <View style={styles.contactField}>
            <Text style={styles.fieldLabel}>Họ tên</Text>
            <View style={[styles.contactInputRow, focusedField === 'fullname' && styles.inputFocused, !!fieldErrors.fullname && styles.inputInvalid]}>
              <UserRound size={17} color="#9CA3AF" accessible={false} />
              <TextInput ref={fullnameInput} style={styles.contactInput} onFocus={() => setFocusedField('fullname')}
                onBlur={() => validateField('fullname', fullname)} value={fullname} onChangeText={handleUpdateFullname}
                accessibilityLabel="Họ tên, bắt buộc" placeholder="Họ và tên" placeholderTextColor="#9CA3AF" autoComplete="name" returnKeyType="next" submitBehavior="submit"
                onSubmitEditing={() => phoneInput.current?.focus()} />
            </View>
            {!!fieldErrors.fullname && <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.fullname}</Text>}
          </View>
          <View style={styles.contactField}>
            <Text style={styles.fieldLabel}>Số điện thoại</Text>
            <View style={[styles.contactInputRow, focusedField === 'phone' && styles.inputFocused, !!fieldErrors.phone && styles.inputInvalid]}>
              <Phone size={17} color="#9CA3AF" accessible={false} />
              <Text style={styles.phonePrefix}>+84</Text>
              <TextInput ref={phoneInput} style={styles.contactInput} onFocus={() => setFocusedField('phone')}
                onBlur={() => validateField('phone', phone)} value={phone} onChangeText={handleUpdatePhone}
                accessibilityLabel="Số điện thoại, bắt buộc" keyboardType="phone-pad" autoComplete="tel-national"
                placeholder="9xx xxx xxx" placeholderTextColor="#9CA3AF" returnKeyType={showEmail ? "next" : "done"}
                onSubmitEditing={() => showEmail ? emailInput.current?.focus() : phoneInput.current?.blur()} />
            </View>
            {!!fieldErrors.phone && <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.phone}</Text>}
          </View>
          {showEmail ? (
            <View style={styles.contactField}>
              <View style={styles.optionalFieldHeading}>
                <Text style={styles.fieldLabel}>Email <Text style={styles.optionalLabel}>(không bắt buộc)</Text></Text>
                <TouchableOpacity style={styles.collapseAction} onPress={() => setShowEmail(false)}
                  accessibilityRole="button" accessibilityLabel="Thu gọn email" accessibilityState={{ expanded: true }}>
                  <Minus size={18} color="#66707C" />
                </TouchableOpacity>
              </View>
              <View style={[styles.contactInputRow, focusedField === 'email' && styles.inputFocused, !!fieldErrors.email && styles.inputInvalid]}>
                <Mail size={17} color="#9CA3AF" accessible={false} />
                <TextInput ref={emailInput} style={styles.contactInput} onFocus={() => setFocusedField('email')}
                onBlur={() => validateField('email', email)} value={email} onChangeText={handleUpdateEmail}
                  accessibilityLabel="Email, không bắt buộc" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                  placeholder="ten@email.com" placeholderTextColor="#9CA3AF" returnKeyType="done" />
              </View>
            {!!fieldErrors.email && <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.email}</Text>}
            </View>
          ) : (
            <TouchableOpacity style={styles.optionalAction} onPress={() => setShowEmail(true)} accessibilityRole="button">
              <Plus size={17} color="#6B7280" />
              <Text style={styles.optionalActionText} numberOfLines={1}>{email || "Thêm email"}</Text>
            </TouchableOpacity>
          )}
          </>
          ) : (
            <View style={styles.contactSummary}>
              <Text style={styles.contactName}>{fullname}</Text>
              <Text style={styles.contactDetail}>{normalizePhone(phone)}</Text>
              {!!email && <Text style={styles.contactDetail}>{email}</Text>}
            </View>
          )}
        </View>

        <View style={styles.checkoutCard}>
          <CheckoutRow
            icon={selectedPaymentId === 'payos' ? <Smartphone size={20} color="#5B6470" /> : <Banknote size={20} color="#5B6470" />}
            title={selectedPaymentId === 'payos' ? 'payOS' : 'Tiền mặt'}
            subtitle={selectedPaymentId === 'payos'
              ? (!user || user.isDemo ? 'Đăng nhập tài khoản thật để tạo mã QR' : 'Chuyển khoản bằng mã QR')
              : 'Khi nhận món'}
            onPress={handleOpenPaymentModal} />
          <View style={styles.cardDivider} />
          <CheckoutRow icon={<TicketPercent size={20} color="#5B6470" />} title="Mã giảm giá"
            badge={selectedVoucher?.code} badgeTone="accent" onPress={() => setVoucherModalVisible(true)} />
        </View>

        <View style={styles.checkoutCard}>
          <CheckoutRow icon={<ShoppingBag size={20} color="#5B6470" />} title="Đơn hàng"
            badge={`${itemCount} món`} onPress={() => router.navigate('/(tabs)/cart')} />
          <View style={styles.cardDivider} />
          <View style={styles.receiptDetails}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Muỗng nĩa nhựa</Text>
              <Text style={styles.pricingValue}>{needCutlery ? 'Có' : 'Không'}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tạm tính</Text>
              <Text style={styles.pricingValue}>{formatCurrency(subtotal)}</Text>
            </View>
            {useAhamove && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Phí giao Ahamove</Text>
                <Text style={styles.pricingValue}>{validQuote ? formatCurrency(deliveryFee) : 'Chưa có báo phí'}</Text>
              </View>
            )}
            {voucherDiscount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.savingsText}>Giảm giá</Text>
                <Text style={styles.savingsText}>−{formatCurrency(voucherDiscount)}</Text>
              </View>
            )}
            {selectedVoucher && subtotal < selectedVoucher.minSubtotal && (
              <Text style={styles.voucherWarning}>
                Mã {selectedVoucher.code} cần đơn từ {formatCurrency(selectedVoucher.minSubtotal)}.
              </Text>
            )}
          </View>
        </View>

        {useAhamove && (
          <View style={styles.checkoutCard}>
            <Text style={styles.cardHeadingText}>Ahamove • Thử nghiệm</Text>
            <Text style={styles.contactDetail}>Giao ngay khi món sẵn sàng • Cần đăng nhập • Chưa hỗ trợ voucher</Text>
            {validQuote && <>
              <Text style={styles.contactDetail}>Lấy món: {validQuote.pickupName}</Text>
              <Text style={styles.contactDetail}>{validQuote.pickupAddress}</Text>
              <Text style={styles.contactDetail}>Báo phí dùng đến {new Date(validQuote.expiresAt).toLocaleTimeString('vi-VN')}.</Text>
            </>}
            {!!shippingError && <Text style={styles.fieldError} accessibilityLiveRegion="polite">{shippingError}</Text>}
            <TouchableOpacity style={styles.optionalAction} onPress={handleGetShippingQuote} disabled={isQuoting || isSubmitting}
              accessibilityRole="button" accessibilityState={{ busy: isQuoting, disabled: isQuoting || isSubmitting }}>
              {isQuoting && <ActivityIndicator color={BRAND_RED} />}
              <Text style={styles.contactEditText}>{isQuoting ? 'Đang lấy phí…' : validQuote ? 'Lấy lại phí / Kiểm tra đơn vừa gửi' : 'Lấy phí / Kiểm tra đơn vừa gửi'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.consentRow} onPress={() => setAgreeTerms(!agreeTerms)}
          accessibilityRole="checkbox" accessibilityState={{ checked: agreeTerms }} activeOpacity={0.7}>
          <View style={[styles.termsSquare, agreeTerms && styles.termsSquareChecked]}>
            {agreeTerms && <Check size={13} color="#FFFFFF" strokeWidth={2.5} />}
          </View>
          <Text style={styles.consentText}>
            Tôi đồng ý với <Text style={styles.termsLink}>Điều khoản</Text> và tham gia FPT Rewards.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.checkoutFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerAmount}>
          <Text style={styles.footerLabel}>{useAhamove && !validQuote ? 'Tiền món • Chưa gồm phí giao' : 'Tổng thanh toán'}</Text>
          <Text style={styles.footerPrice}>{formatCurrency(total)}</Text>
        </View>
        <TouchableOpacity style={[styles.placeOrderButton, isSubmitting && { opacity: 0.65 }]}
          onPress={handlePlaceOrder} disabled={isSubmitting} activeOpacity={0.85}
          accessibilityRole="button" accessibilityLabel={selectedPaymentId === 'payos' ? 'Đặt đơn và thanh toán payOS' : 'Đặt hàng'}
          accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}>
          {isSubmitting ? <>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.orderBtnText}>{selectedPaymentId === 'payos' ? 'Đang tạo QR…' : 'Đang đặt hàng…'}</Text>
          </> : <>
            <Text style={styles.orderBtnText}>{selectedPaymentId === 'payos' ? 'Thanh toán' : 'Đặt hàng'}</Text>
            <ArrowRight size={18} color="#FFFFFF" accessible={false} />
          </>}
        </TouchableOpacity>
      </View>

      </KeyboardAvoidingView>

      {/* ======================================================== */}
      {/* MODAL: TÌM CỬA HÀNG GẦN BẠN NHẤT / NHẬP TAY ĐỊA CHỈ       */}
      {/* ======================================================== */}
      <StoreLocationModal
        visible={addressModalVisible}
        onClose={() => setAddressModalVisible(false)}
        currentAddress={address}
        initialFulfillment={fulfillmentType}
        redirectToMenuOnConfirm={false}
        onConfirmAddress={(addr, mode) => {
          setAddress(addr);
          saveDeliveryAddress(addr);
          setFulfillmentType(mode);
        }}
      />

      {/* ======================================================== */}
      {/* MODAL: CHỌN THỜI GIAN NHẬN HÀNG                           */}
      {/* ======================================================== */}
      <DeliveryTimeModal
        visible={timeModalVisible}
        onClose={() => setTimeModalVisible(false)}
        selectedTime={deliveryTime}
        onSelectTime={(time) => setDeliveryTime(time)}
      />

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

            {selectedVoucher ? (
              <View style={styles.whiteSectionBlock}>
                <Text style={styles.sectionHeaderTitle}>Đã áp dụng: {selectedVoucher.code}</Text>
                <Text style={styles.sectionSubTitle}>{selectedVoucher.description}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => setPromoCode('')} style={{ paddingVertical: 14 }}>
                  <Text style={{ color: BRAND_RED }}>Gỡ mã giảm giá</Text>
                </TouchableOpacity>
              </View>
            ) : <View style={styles.emptyVoucherArea}>
              <EmptyTicketIcon />
              <Text style={styles.emptyVoucherTitle}>Hiện không có mã giảm giá</Text>
              <Text style={styles.emptyVoucherSub}>
                Bạn có thể thử nhập mã: <Text style={{ fontWeight: '700' }}>FPT40</Text> hoặc{' '}
                <Text style={{ fontWeight: '700' }}>FREESHIP</Text>
              </Text>
            </View>}

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
