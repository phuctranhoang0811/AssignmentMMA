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
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';
import { geocodeAddressStrict, geocodeAddress, getCoordinatesForAddress } from '../../services/addressService';
import { colors } from '../../theme/colors';
import { roadDistanceKm, type LatLng, type DeliveryFeeConfig } from '../../utils/deliveryFee';
import { triggerHaptic } from '../../utils/haptics';
import { findCoupon, useCatalog, useCoupons } from '../../services/catalog';
import { isCouponExpired } from '../../utils/coupons';
import { formatDeliveryTime, isDeliveryTimeAvailable } from '../../utils/deliveryTime';
import { StoreLocationModal } from '../../components/modals/StoreLocationModal';
import { DeliveryTimeModal } from '../../components/modals/DeliveryTimeModal';
import { CheckoutRow } from '../../components/checkout/CheckoutRow';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import {
  getSavedDeliveryAddress,
  saveDeliveryAddress,
  clearCustomerInfo,
} from '../../services/addressStorage';

import { styles, BRAND_RED } from '../../styles/checkout.styles';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { subscribeStoresConfig } from '../../services/storeSync';
import { fetchUserMemberStats } from '../../utils/memberTier';
import { formatCustomizationSummary } from '../../types/pizzaCustomization';
import { createPayosPayment, apiUrl } from '../../services/payosService';

import { ahamoveEnabled, createAhamoveCod, deliveryCheckout, getDeliveryQuote, resumeAhamoveCod } from '../../services/deliveryService';
import type { DeliveryQuote } from '../../types/delivery';
import { EmptyTicketIcon } from '../../components/ui/EmptyTicketIcon';
import { StoreClosedBanner } from '../../components/store/StoreClosedBanner';
import { useStoreStatus } from '../../services/storeSettings';
import { contactError, normalizePhone, type ContactField } from '../../utils/contact';
import { isAdminRole } from '../../utils/staff';

// Payment Methods
const PAYMENT_METHODS = [
  { id: 'cash', name: 'Tiền mặt khi nhận hàng', subtext: 'Thanh toán bằng tiền mặt khi nhận món' },
  { id: 'payos', name: 'payOS', subtext: 'Chuyển khoản bằng mã QR • Cần đăng nhập' },
];

export default function CheckoutScreen() {
  const { productsMap } = useCatalog();
  const coupons = useCoupons();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, isLoaded: cartLoaded, clearCart, promoCode, setPromoCode, fulfillmentType, setFulfillmentType, needCutlery } = useCart();
  const { user } = useAuth();
  const store = useStoreStatus();

  // Admin/Manager chỉ quản lý, không đặt hàng: chặn đường vào checkout (deep link/URL) và đưa về trang quản trị.
  useEffect(() => {
    if (isAdminRole(user?.role)) router.replace('/admin/dashboard');
  }, [user?.role, router]);

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
  const showContactForm = isEditingContact;
  const validateField = (field: ContactField, value: string) => {
    setFocusedField(null);
    setFieldErrors(previous => ({ ...previous, [field]: contactError(field, value) }));
  };

  useEffect(() => {
    let cancelled = false;
    setFieldErrors({});
    setShowEmail(false);

    // 1. Khôi phục địa chỉ đã lưu dưới local
    getSavedDeliveryAddress().then((saved) => {
      if (saved && !cancelled) setAddress(saved);
    });

    // 2. Chỉ tự động điền thông tin liên hệ khi ĐÃ ĐĂNG NHẬP tài khoản thật.
    // Nếu chưa đăng nhập (khách vãng lai), luôn để trống để khách tự nhập, tuyệt đối không lấy tên tài khoản cũ.
    if (user && !user.isDemo) {
      const nextName = user.fullname || '';
      const rawUserPhone = user.phone || '';
      const normPhone = normalizePhone(rawUserPhone);
      const nextPhone = normPhone ? normPhone.slice(1) : rawUserPhone;
      const nextEmail = user.email || '';
      setFullname(nextName);
      setPhone(nextPhone);
      setEmail(nextEmail);
      const hasErr =
        !nextName.trim() ||
        !nextPhone.trim() ||
        !!contactError('fullname', nextName) ||
        !!contactError('phone', nextPhone) ||
        !!contactError('email', nextEmail);
      setIsEditingContact(hasErr);
    } else {
      void clearCustomerInfo();
      setFullname('');
      setPhone('');
      setEmail('');
      setDeliveryNote('');
      setIsEditingContact(true);
    }

    return () => { cancelled = true; };
  }, [user]);

  const handleUpdateFullname = (val: string) => {
    setFieldErrors(previous => previous.fullname ? { ...previous, fullname: contactError('fullname', val) } : previous);
    setFullname(val);
  };

  const handleUpdatePhone = (val: string) => {
    setFieldErrors(previous => previous.phone ? { ...previous, phone: contactError('phone', val) } : previous);
    setPhone(val);
  };

  const handleUpdateEmail = (val: string) => {
    setFieldErrors(previous => previous.email ? { ...previous, email: contactError('email', val) } : previous);
    setEmail(val);
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
  };

  // Payment Method Modal & Selection
  const [selectedPaymentId, setSelectedPaymentId] = useState('cash');
  const [tempPaymentId, setTempPaymentId] = useState('cash');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Voucher Modal & Selection
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const selectedVoucher = (promoCode && findCoupon(coupons, promoCode)) || null;
  const availableVouchers = React.useMemo(
    () =>
      coupons.filter(
        (c) =>
          c &&
          !(c as any).deleted &&
          !isCouponExpired(c) &&
          !(c.usageLimit && (c.usedCount || 0) >= c.usageLimit)
      ),
    [coupons]
  );

  // Address Modal ('Tìm cửa hàng gần bạn nhất' / Nhập tay vị trí)
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [minDeliveryPopupVisible, setMinDeliveryPopupVisible] = useState(false);
  const [storeClosedPopupVisible, setStoreClosedPopupVisible] = useState(false);
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
    memberDiscount: number;
    voucherDiscount: number;
    selectedVoucher: typeof selectedVoucher;
    total: number;
    earnedPoints: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const [activeStorePoints, setActiveStorePoints] = useState<
    { id: string; name: string; address: string; lat: number; lng: number }[]
  >([
    {
      id: 'store-lieu-giai',
      name: 'Pizza FPT Liễu Giai (Signature)',
      address: '40 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội',
      lat: 21.0352,
      lng: 105.8138,
    },
    {
      id: 'store-thu-duc',
      name: 'Pizza FPT Hiệp Bình Chánh (Signature)',
      address: '240 Phạm Văn Đồng, Phường Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh',
      lat: 10.8291,
      lng: 106.7183,
    },
  ]);
  const [syncedDeliveryConfig, setSyncedDeliveryConfig] = useState<DeliveryFeeConfig | null>(null);
  const [syncedShippingEnabled, setSyncedShippingEnabled] = useState<boolean>(true);
  const [selectedDeliveryStoreId, setSelectedDeliveryStoreId] = useState<string | null>(null);
  useEffect(() => {
    const unsub = subscribeStoresConfig((state) => {
      const pts = state.stores
        .filter((data) => data && data.isActive !== false && data.name)
        .map((data, idx) => ({
          id: String(data.id || `store-${idx}`),
          name: String(data.name),
          address: String(data.address || ''),
          lat: typeof data.lat === 'number' ? data.lat : 10.8291,
          lng: typeof data.lng === 'number' ? data.lng : 106.7183,
        }));
      if (pts.length > 0) setActiveStorePoints(pts);
      setSyncedShippingEnabled(state.shippingEnabled !== false);
      if (state.delivery) {
        setSyncedDeliveryConfig(state.delivery);
      }
    });
    return () => unsub();
  }, []);
  const baseShippingRules: DeliveryFeeConfig = syncedDeliveryConfig || store.settings?.delivery || {
    storeLat: 10.8291,
    storeLng: 106.7183,
    baseKm: 3,
    baseFee: 0,
    perKm: 5000,
    maxKm: 15,
    freeOver: 300000,
    minDeliveryOrder: 50000,
  };
  const minDeliveryOrderAmount =
    fulfillmentType === 'delivery' ? (baseShippingRules.minDeliveryOrder ?? 50000) : 0;
  const shippingConfig: DeliveryFeeConfig | undefined =
    !useAhamove && fulfillmentType === 'delivery' && syncedShippingEnabled ? baseShippingRules : undefined;
  const [located, setLocated] = useState<{ address: string; point: LatLng | null } | null>(null);
  useEffect(() => {
    if (!shippingConfig || !address.trim()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      geocodeAddressStrict(address)
        .then(async (point) => { const resolved = point || (await geocodeAddress(address)); if (!cancelled) setLocated({ address, point: resolved }); })
        .catch(() => { if (!cancelled) setLocated({ address, point: null }); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [shippingConfig, address]);
  const deliveryPoint =
    shippingConfig && address.trim()
      ? located?.address === address && located.point
        ? located.point
        : getCoordinatesForAddress(address)
      : null;
  const assignedStore = React.useMemo(() => {
    if (activeStorePoints.length === 0) {
      return { id: 'store-lieu-giai', name: 'Pizza FPT Liễu Giai (Signature)', address: '', lat: 21.0352, lng: 105.8138 };
    }
    if (fulfillmentType === 'takeaway') {
      const matched = activeStorePoints.find(
        (s) => address.includes(s.name) || (s.address && address.includes(s.address))
      );
      return matched || activeStorePoints[0];
    }
    if (selectedDeliveryStoreId) {
      const explicit = activeStorePoints.find((s) => s.id === selectedDeliveryStoreId);
      if (explicit) return explicit;
    }
    if (deliveryPoint) {
      let nearest = activeStorePoints[0];
      let minDist = roadDistanceKm(nearest, deliveryPoint);
      for (const pt of activeStorePoints) {
        const d = roadDistanceKm(pt, deliveryPoint);
        if (d < minDist) {
          minDist = d;
          nearest = pt;
        }
      }
      return nearest;
    }
    return activeStorePoints[0];
  }, [activeStorePoints, fulfillmentType, address, deliveryPoint, selectedDeliveryStoreId]);
  const effectiveShippingConfig = React.useMemo(() => {
    if (!shippingConfig) return undefined;
    if (!deliveryPoint || activeStorePoints.length === 0) return shippingConfig;
    return {
      ...shippingConfig,
      storeLat: assignedStore.lat,
      storeLng: assignedStore.lng,
      maxKm: shippingConfig.maxKm || 15,
    };
  }, [shippingConfig, deliveryPoint, activeStorePoints.length, assignedStore]);
  const locating = !!shippingConfig && !!address.trim() && located?.address !== address;

  // Totals Calculation
  const [memberDiscountRate, setMemberDiscountRate] = useState(0);
  useEffect(() => {
    let active = true;
    if (user && !user.isDemo && user.id) {
      fetchUserMemberStats(user.id).then((stats) => {
        if (active) setMemberDiscountRate(stats.discountRate);
      });
    } else {
      setMemberDiscountRate(0);
    }
    return () => {
      active = false;
    };
  }, [user]);

  const isMember = !!user && !user.isDemo;
  const totals = calculateOrderTotals(items, productsMap,
    fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP', selectedVoucher, undefined,
    effectiveShippingConfig && deliveryPoint ? { config: effectiveShippingConfig, to: deliveryPoint } : undefined,
    isMember);
  const { subtotal, discount: baseVoucherDiscount } = totals;
  // Giảm giá thành viên (10% hạng Vàng / 15% hạng VIP cho món lẻ khi không dùng cùng lúc với voucher khuyến mãi)
  const singleItemsSubtotal = items.reduce((sum, item) => {
    const isRewardItem =
      Boolean((item as any)?.isRewardGift) ||
      String(item.specialInstructions || '').includes('Quà đổi điểm FPT Rewards');
    if (isRewardItem) return sum;
    const p = productsMap[item.productId];
    const isComboOrPromo =
      p?.categoryId === 'cheese_party' ||
      p?.categoryId === 'member_deals' ||
      p?.categoryId === 'hot_deals' ||
      (p?.promoGroups || []).some((g) => ['cheese_party', 'member_deals', 'hot_deals'].includes(g)) ||
      (!!p?.originalPrice && p.originalPrice > p.basePrice);
    if (isComboOrPromo) return sum;
    const unit = getItemLineUnitPrice(item, p, isMember) || 0;
    return sum + unit * (Number(item.quantity) || 1);
  }, 0);
  const hasActivePromoVoucher = Boolean(
    selectedVoucher && !selectedVoucher.freeShipping && subtotal >= selectedVoucher.minSubtotal
  );
  const memberDiscount =
    isMember && memberDiscountRate > 0 && !hasActivePromoVoucher
      ? Math.round(singleItemsSubtotal * memberDiscountRate)
      : 0;
  const subtotalAfterMember = Math.max(0, subtotal - memberDiscount);
  const voucherDiscount = (() => {
    if (!selectedVoucher || selectedVoucher.freeShipping) return 0;
    if (subtotalAfterMember < selectedVoucher.minSubtotal && subtotal < selectedVoucher.minSubtotal) {
      return 0;
    }
    if (selectedVoucher.discountType === 'PERCENT') {
      const pctVal = Math.round((subtotalAfterMember * selectedVoucher.value) / 100);
      const capped = selectedVoucher.maxDiscount
        ? Math.min(pctVal, selectedVoucher.maxDiscount)
        : pctVal;
      return Math.min(capped, subtotalAfterMember);
    }
    return Math.min(selectedVoucher.value, subtotalAfterMember);
  })();
  const deliveryFee = useAhamove ? validQuote?.pricing.deliveryFee ?? 0 : totals.deliveryFee;
  const total = Math.max(0, subtotalAfterMember - voucherDiscount + deliveryFee);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const earnedPoints = isMember ? Math.floor(total / 10000) : 0;

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
    if (Boolean(false) && (!user || user?.isDemo)) { router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } }); return; }
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
    if (!store.open) {
      triggerHaptic('warning');
      setStoreClosedPopupVisible(true);
      return;
    }
    if (selectedPaymentId === 'payos' && (!user || user.isDemo)) {
      router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } });
      return;
    }

    if (!agreeTerms) {
      Alert.alert('Lưu ý', 'Vui lòng đồng ý với các điều khoản để tiếp tục đặt hàng.');
      return;
    }
    if (!validateContact()) return;
    if (fulfillmentType === 'delivery' && !useAhamove && !syncedShippingEnabled) {
      triggerHaptic('warning');
      Alert.alert(
        'Tạm ngưng giao hàng',
        'Cửa hàng hiện đang tạm ngưng dịch vụ giao hàng tận nơi. Vui lòng chọn Nhận tại cửa hàng.'
      );
      return;
    }
    if (fulfillmentType === 'delivery' && minDeliveryOrderAmount > 0 && subtotal < minDeliveryOrderAmount) {
      triggerHaptic('warning');
      setMinDeliveryPopupVisible(true);
      return;
    }
    if (fulfillmentType === 'delivery' && !address.trim()) {
      setAddressModalVisible(true);
      return;
    }
    if (shippingConfig) {
      if (locating) { Alert.alert('Đang tính phí giao hàng', 'Vui lòng đợi giây lát rồi đặt hàng.'); return; }
      if (!deliveryPoint) { Alert.alert('Chưa xác định được vị trí', 'Vui lòng chọn lại địa chỉ giao hàng để tính phí ship.'); setAddressModalVisible(true); return; }
      if (totals.outOfRange) {
        Alert.alert('Ngoài vùng giao hàng', `Cửa hàng chỉ giao trong ${shippingConfig.maxKm} km. Vui lòng chọn địa chỉ gần hơn hoặc nhận tại cửa hàng.`);
        return;
      }
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
    const soldOutItem = items.find((it) => productsMap[it.productId]?.isAvailable === false);
    if (soldOutItem) {
      const soldOutName =
        productsMap[soldOutItem.productId]?.name || (soldOutItem as any).name || 'Sản phẩm';
      Alert.alert(
        'Món tạm hết hàng',
        `Món "${soldOutName}" hiện đã tạm hết hàng. Vui lòng quay lại giỏ hàng để cập nhật trước khi đặt đơn.`
      );
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
          ...(shippingConfig && deliveryPoint ? { deliveryLocation: deliveryPoint } : {}),
          ...(!useAhamove ? { deliveryTime: formatDeliveryTime(deliveryTime) } : {}),
          ...(useAhamove ? { deliveryQuoteId: validQuote!.id } : {}),
        });
        router.push({ pathname: '/checkout/payos', params: { orderId: payment.id } });
      } catch (err) {
        Alert.alert('Chưa thể thanh toán payOS', err instanceof Error ? err.message : 'Vui lòng thử lại sau.');
      } finally { setIsSubmitting(false); }
      return;
    }

    if (Boolean(false) && (!user || user?.isDemo)) {
      setIsSubmitting(false);
      router.push({ pathname: '/auth/login', params: { returnTo: 'checkout' } });
      return;
    }
    let saved: { subtotal: number; discount: number; deliveryFee?: number; total: number };
    try {
      {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let rand = '';
        for (let i = 0; i < 6; i++) {
          rand += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const generatedOrderCode = (user && !user.isDemo ? 'PF-' : '6X23D') + rand;
        setOrderCode(generatedOrderCode);
        saved = { subtotal, discount: voucherDiscount, deliveryFee, total };
        try {
          const firestoreItems = items.map((item) => {
            const product = productsMap[item.productId];
            const unitPrice = getItemLineUnitPrice(item, product, isMember) || 0;
            const lineTotal = unitPrice * (Number(item.quantity) || 1);
            const variant = product?.variants?.find((v) => v.id === item.variantId);
            const fallbackVariantName =
              item.variantId === 'small'
                ? 'Cỡ Nhỏ'
                : item.variantId === 'medium'
                  ? 'Cỡ Vừa'
                  : item.variantId === 'large'
                    ? 'Cỡ Lớn'
                    : '';
            const customSummary = item.customization ? formatCustomizationSummary(item.customization) : [];
            const addonNames = (item.addonIds || [])
              .map((id) => product?.addons?.find((a) => a.id === id)?.name)
              .filter(Boolean) as string[];
            const itemNote = (
              item.specialInstructions ||
              item.customization?.specialInstructions ||
              ''
            )
              .replace(/\s*\[(MIN|PTS):\d+\]/g, '')
              .trim();
            return {
              productId: item.productId,
              productName: product?.name || 'Sản phẩm',
              quantity: Number(item.quantity) || 1,
              unitPrice,
              lineTotal,
              variantName: variant?.name || fallbackVariantName,
              addonNames,
              customizationSummary: customSummary,
              note: itemNote,
              specialInstructions: itemNote,
              image: product?.image || '',
            };
          });
          const usedGiftIdsInOrder: string[] = [];
          let redeemedPointsTotal = 0;
          items.forEach((it) => {
            const rawNote = String(it.specialInstructions || '');
            const mGift = /Quà đổi điểm FPT Rewards \(([^)]+)\)/.exec(rawNote);
            if (mGift && mGift[1]) usedGiftIdsInOrder.push(mGift[1]);
            const mPts = /\[PTS:(\d+)\]/.exec(rawNote);
            if (mPts && mPts[1]) {
              redeemedPointsTotal += Number(mPts[1]) * (Number(it.quantity) || 1);
            }
          });

          await addDoc(collection(db, 'orders'), {
            orderCode: generatedOrderCode,
            createdAt: serverTimestamp(),
            userId: user && !user.isDemo ? user.id : null,
            needCutlery,
            customer: {
              fullname: fullname.trim(),
              phone: localPhone,
              email: email.trim(),
            },
            deliveryTime: formatDeliveryTime(deliveryTime),
            fulfillmentType,
            storeId: assignedStore.id,
            storeName: assignedStore.name,
            address: address.trim(),
            deliveryNote: deliveryNote.trim(),
            paymentMethod: selectedPaymentId,
            paymentName: selectedPayment?.name || 'Tiền mặt',
            paymentStatus: 'UNPAID',
            status: 'PENDING_CONFIRMATION',
            statusHistory: [
              {
                status: 'PENDING_CONFIRMATION',
                at: new Date().toISOString(),
                note: 'Khách hàng vừa đặt đơn',
              },
            ],
            items: firestoreItems,
            itemCount,
            subtotal,
            deliveryFee,
            discount: voucherDiscount,
            memberDiscount,
            voucherCode: selectedVoucher?.code || null,
            usedMemberGiftIds: usedGiftIdsInOrder,
            redeemedPointsTotal,
            total,
            earnedPoints,
          });
          if (selectedVoucher && selectedVoucher.code) {
            const voucherDocId = selectedVoucher.code.trim().toUpperCase();
            setDoc(
              doc(db, 'coupons', voucherDocId),
              {
                ...selectedVoucher,
                code: voucherDocId,
                usedCount: increment(1),
              },
              { merge: true }
            ).catch(() => {});
          }
          if (user && !user.isDemo && user.id) {
            if (usedGiftIdsInOrder.length > 0) {
              try {
                if (typeof window !== 'undefined' && window.localStorage) {
                  const key = `fpt_used_member_gifts_${user.id}`;
                  const raw = window.localStorage.getItem(key);
                  const prev: string[] = raw ? JSON.parse(raw) : [];
                  const merged = Array.from(new Set([...prev, ...usedGiftIdsInOrder]));
                  window.localStorage.setItem(key, JSON.stringify(merged));
                }
              } catch {}
              updateDoc(doc(db, 'users', user.id), {
                usedMemberGiftIds: arrayUnion(...usedGiftIdsInOrder),
              }).catch(() => {});
            }
          }
        } catch {}
      }
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

    // Lưu địa chỉ giao hàng xuống local storage
    if (address.trim()) {
      saveDeliveryAddress(address.trim());
    }

    const orderSnapshot = {
      items: [...items],
      itemCount,
      subtotal: saved.subtotal,
      deliveryFee: saved.deliveryFee ?? deliveryFee,
      memberDiscount,
      voucherDiscount: saved.discount,
      selectedVoucher,
      total: saved.total,
      earnedPoints: isMember ? Math.floor(saved.total / 10000) : 0,
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
            {!!deliveryNote.trim() && (
              <Text style={[styles.infoText, { color: BRAND_RED, fontWeight: '600', marginTop: 4 }]}>
                Ghi chú giao nhận: {deliveryNote.trim()}
              </Text>
            )}
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
              const unitPrice = getItemLineUnitPrice(item, product, isMember) || 0;
              const lineTotal = unitPrice * (Number(item.quantity) || 1);
              const variant = product?.variants?.find((v) => v.id === item.variantId);
              const customParts = item.customization
                ? formatCustomizationSummary(item.customization)
                : [];
              const addonParts = (item.addonIds || [])
                .map((id) => product?.addons?.find((a) => a.id === id)?.name)
                .filter(Boolean) as string[];
              const optionParts = [variant?.name, ...customParts, ...addonParts]
                .filter(Boolean)
                .filter((val, i, arr) => arr.indexOf(val) === i);
              const itemNote = (
                item.specialInstructions ||
                item.customization?.specialInstructions ||
                ''
              ).trim();
              return (
                <View key={item.lineId || idx} style={styles.orderItemRow}>
                  <View style={styles.orderItemMainLine}>
                    <Text style={styles.orderItemName} numberOfLines={1}>
                      {product?.name || 'Sản phẩm'}
                    </Text>
                    <Text style={styles.orderItemQty}>{item.quantity}</Text>
                    <Text style={styles.orderItemPrice}>{formatCurrency(lineTotal)}</Text>
                  </View>
                  {optionParts.length > 0 && (
                    <Text style={styles.orderItemOptions}>
                      {optionParts.join(' • ')}
                    </Text>
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
                {formatCurrency(confirmedOrderData?.subtotal ?? subtotal)}
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
                  (confirmedOrderData?.memberDiscount ?? memberDiscount) > 0 && {
                    color: BRAND_RED,
                  },
                ]}
              >
                {(confirmedOrderData?.memberDiscount ?? memberDiscount) > 0
                  ? `-${formatCurrency(confirmedOrderData?.memberDiscount ?? memberDiscount)}`
                  : '0 đ'}
              </Text>
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

            {fulfillmentType === 'delivery' && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Phí giao hàng</Text>
                <Text style={styles.pricingValue}>
                  {(confirmedOrderData?.deliveryFee ?? deliveryFee) === 0
                    ? 'Miễn phí'
                    : formatCurrency(confirmedOrderData?.deliveryFee ?? deliveryFee)}
                </Text>
              </View>
            )}
            <View style={styles.pricingDivider} />
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Tổng cộng</Text>
                {isMember && (
                  <Text style={styles.rewardPointsNote}>
                    Nhận{' '}
                    <Text style={{ fontWeight: '700', color: '#111827' }}>
                      {confirmedOrderData?.earnedPoints ?? earnedPoints} điểm
                    </Text>{' '}
                    FPT Rewards
                  </Text>
                )}
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
          onPress={() => router.replace('/(tabs)/cart')}
          activeOpacity={0.7}
        >
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={styles.placeholder} />
      </View>
      <StoreClosedBanner status={store} />

      <KeyboardAvoidingView style={styles.keyboardContainer}
        enabled={Platform.OS === 'ios'} behavior="padding" keyboardVerticalOffset={0}>
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
          {fulfillmentType === 'delivery' && assignedStore && (
            <>
              <View style={styles.cardDivider} />
              <CheckoutRow
                icon={<Store size={20} color="#5B6470" />}
                title="Chi nhánh giao hàng"
                subtitle={assignedStore.name}
                badge={activeStorePoints.length > 1 ? 'Đổi quán' : undefined}
                onPress={() => {
                  if (activeStorePoints.length <= 1) return;
                  triggerHaptic('light');
                  const currentIdx = activeStorePoints.findIndex((s) => s.id === assignedStore.id);
                  const nextStore = activeStorePoints[(currentIdx + 1) % activeStorePoints.length];
                  if (nextStore) setSelectedDeliveryStoreId(nextStore.id);
                }}
              />
            </>
          )}
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
            {(!!user || !showContactForm || (!!fullname.trim() && !!phone.trim())) && (
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
              <UserRound size={17} color="#9CA3AF" />
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
              <Phone size={17} color="#9CA3AF" />
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
                <Mail size={17} color="#9CA3AF" />
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
            badge={`${itemCount} món`} onPress={() => router.push({ pathname: '/(tabs)/cart', params: { from: 'checkout' } })} />
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
            {!useAhamove && fulfillmentType === 'delivery' && !shippingConfig && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Phí giao hàng</Text>
                <Text style={styles.pricingValue}>
                  {deliveryFee === 0 ? 'Miễn phí' : formatCurrency(deliveryFee)}
                </Text>
              </View>
            )}
            {!!shippingConfig && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>
                  Phí giao hàng{deliveryPoint && totals.deliveryDistanceKm !== undefined ? ` (${totals.deliveryDistanceKm} km)` : ''}
                </Text>
                <Text style={[styles.pricingValue, totals.outOfRange ? { color: colors.error } : null]}>
                  {locating ? 'Đang tính…' : !deliveryPoint ? 'Chọn địa chỉ để tính' : totals.outOfRange ? 'Ngoài vùng giao'
                    : deliveryFee === 0 ? 'Miễn phí' : formatCurrency(deliveryFee)}
                </Text>
              </View>
            )}
            {voucherDiscount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.savingsText}>Giảm giá</Text>
                <Text style={styles.savingsText}>−{formatCurrency(voucherDiscount)}</Text>
              </View>
            )}
            {memberDiscount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.savingsText}>
                  Giảm giá thành viên ({Math.round(memberDiscountRate * 100)}%)
                </Text>
                <Text style={styles.savingsText}>−{formatCurrency(memberDiscount)}</Text>
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
      </KeyboardAvoidingView>

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
            <ArrowRight size={18} color="#FFFFFF" />
          </>}
        </TouchableOpacity>
      </View>

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

          <View style={[styles.voucherBody, { justifyContent: 'flex-start' }]}>
            <View style={styles.voucherInputRow}>
              <TextInput
                style={styles.voucherTextInput}
                placeholder="Nhập mã giảm giá của bạn"
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

            <Text style={{ fontSize: 13.5, color: '#6B7280', marginTop: 14, marginBottom: 4 }}>
              Hoặc chọn mã giảm giá của bạn
            </Text>

            {availableVouchers.length > 0 ? (
              <ScrollView
                style={{ flex: 1, marginTop: 12 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
              >
                {availableVouchers.map((voucher) => {
                  const isSelected =
                    selectedVoucher?.code.toUpperCase() === voucher.code.toUpperCase();
                  const hasOtherSelected = !!selectedVoucher && !isSelected;
                  const canApply = subtotal >= (voucher.minSubtotal || 0);
                  const isDimmed = !canApply || hasOtherSelected;
                  const benefitLabel = voucher.freeShipping
                    ? 'Miễn phí giao hàng'
                    : voucher.discountType === 'PERCENT'
                    ? `Giảm ${voucher.value}%${
                        voucher.maxDiscount
                          ? ` (tối đa ${formatCurrency(voucher.maxDiscount)})`
                          : ''
                      }`
                    : `Giảm ${formatCurrency(voucher.value)}`;

                  return (
                    <TouchableOpacity
                      key={voucher.code}
                      activeOpacity={canApply || isSelected ? 0.8 : 1}
                      disabled={!canApply && !isSelected}
                      onPress={() => {
                        if (isSelected) {
                          setPromoCode('');
                          return;
                        }
                        if (!canApply) return;
                        setPromoCode(voucher.code);
                        triggerHaptic('success');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isSelected
                          ? '#FFF7F5'
                          : !canApply
                          ? '#F3F4F6'
                          : '#FFFFFF',
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1.5,
                        borderColor: isSelected ? BRAND_RED : '#E5E7EB',
                        borderLeftWidth: 4,
                        borderLeftColor: isSelected
                          ? BRAND_RED
                          : isDimmed
                          ? '#9CA3AF'
                          : BRAND_RED,
                        opacity: isSelected ? 1 : !canApply ? 0.45 : hasOtherSelected ? 0.55 : 1,
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 6,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: isSelected ? BRAND_RED : '#FEF2F2',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 5,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '800',
                                color: isSelected ? '#FFFFFF' : BRAND_RED,
                              }}
                            >
                              {voucher.code}
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: '#ECFDF5',
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '700',
                                color: '#047857',
                              }}
                            >
                              {benefitLabel}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={{
                            fontSize: 13.5,
                            fontWeight: '600',
                            color: '#1F2937',
                            marginBottom: 6,
                          }}
                        >
                          {voucher.description}
                        </Text>

                        {!!voucher.expiresAt && (
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            HSD: {voucher.expiresAt}
                          </Text>
                        )}
                      </View>

                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected
                            ? BRAND_RED
                            : !canApply
                            ? '#D1D5DB'
                            : '#9CA3AF',
                          backgroundColor: isSelected
                            ? BRAND_RED
                            : !canApply
                            ? '#E5E7EB'
                            : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              !selectedVoucher && (
                <View style={[styles.emptyVoucherArea, { flex: 1 }]}>
                  <EmptyTicketIcon />
                  <Text style={styles.emptyVoucherTitle}>Chưa có mã giảm giá</Text>
                  <Text style={styles.emptyVoucherSub}>
                    Thêm mã giảm giá có sẵn vào thanh nhập mã phía trên
                  </Text>
                </View>
              )
            )}

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

      {/* MODAL THÔNG BÁO CHƯA ĐỦ ĐIỀU KIỆN GIAO HÀNG */}
      <Modal
        visible={minDeliveryPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMinDeliveryPopupVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 22,
              paddingVertical: 24,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
              }}
            >
              Thông báo
            </Text>

            <View
              style={{
                width: 88,
                height: 2.5,
                backgroundColor: BRAND_RED,
                borderRadius: 2,
                marginTop: 8,
                marginBottom: 18,
              }}
            />

            <Text
              style={{
                fontSize: 15,
                color: '#1F2937',
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              Đợi đã! Bạn vui lòng mua thêm{' '}
              {formatCurrency(Math.max(0, minDeliveryOrderAmount - subtotal))} để đủ điều
              kiện giao hàng
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setMinDeliveryPopupVisible(false)}
              style={{
                width: '100%',
                marginTop: 22,
                paddingVertical: 13,
                borderRadius: 8,
                backgroundColor: BRAND_RED,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 15.5,
                  fontWeight: '600',
                }}
              >
                Xác nhận
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL THÔNG BÁO CỬA HÀNG ĐÓNG CỬA (SAU 22:00 - 08:00)     */}
      {/* ======================================================== */}
      <Modal
        visible={storeClosedPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStoreClosedPopupVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 22,
              paddingTop: 22,
              paddingBottom: 20,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
              }}
            >
              Thông báo
            </Text>

            <View
              style={{
                width: 88,
                height: 2.5,
                backgroundColor: BRAND_RED,
                borderRadius: 2,
                marginTop: 8,
                marginBottom: 18,
              }}
            />

            <Text
              style={{
                fontSize: 15,
                color: '#1F2937',
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              {store.message ||
                'Hiện tại cửa hàng đã đóng cửa (22:00 – 08:00). Vui lòng đặt hàng trong khung giờ hoạt động từ 08:00 đến 22:00.'}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setStoreClosedPopupVisible(false)}
              style={{
                width: '100%',
                marginTop: 22,
                paddingVertical: 13,
                borderRadius: 8,
                backgroundColor: BRAND_RED,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 15.5,
                  fontWeight: '600',
                }}
              >
                Xác nhận
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
