import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import Svg, { Path, Polygon, Circle } from 'react-native-svg';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { mockProducts } from '../../data/mockProducts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getItemLineUnitPrice } from '../../utils/calculateTotals';
import { triggerHaptic } from '../../utils/haptics';
import { searchVietnamAddresses, AddressSuggestion } from '../../services/addressService';
import { StoreLocationModal } from '../../components/modals/StoreLocationModal';
import { DeliveryTimeModal } from '../../components/modals/DeliveryTimeModal';
import { CouchIllustration } from '../../components/ui/CouchIllustration';
import {
  getSavedDeliveryAddress,
  saveDeliveryAddress,
  getSavedCustomerInfo,
  saveCustomerInfo,
} from '../../services/addressStorage';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { styles, BRAND_RED } from '../../styles/checkout.styles';
import { formatCustomizationSummary } from '../../types/pizzaCustomization';

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
  const insets = useSafeAreaInsets();
  const { items, clearCart } = useCart();
  const { user } = useAuth();

  // Address & Notes
  const [address, setAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('10:30');
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  // Customer Information (Tự động điền nếu đã đăng nhập; để trống cho khách tự nhập)
  const [fullname, setFullname] = useState(user?.fullname || '');
  const [phone, setPhone] = useState(
    user?.phone ? (user.phone.startsWith('0') ? user.phone.slice(1) : user.phone) : ''
  );
  const [email, setEmail] = useState(user?.email || '');

  useEffect(() => {
    // 1. Khôi phục địa chỉ đã lưu
    getSavedDeliveryAddress().then((saved) => {
      if (saved) setAddress(saved);
    });

    // 2. Khôi phục ghi chú & thông tin khách (chỉ lấy nếu là khách chưa đăng nhập và đã nhập trước đó)
    getSavedCustomerInfo().then((info) => {
      if (info) {
        if (info.deliveryNote) setDeliveryNote((prev) => prev || info.deliveryNote || '');
        if (!user) {
          if (info.fullname) setFullname((prev) => prev || info.fullname || '');
          if (info.phone) setPhone((prev) => prev || info.phone || '');
          if (info.email) setEmail((prev) => prev || info.email || '');
        }
      }
    });
  }, [user]);

  useEffect(() => {
    if (user) {
      setFullname(user.fullname || '');
      setPhone(
        user.phone ? (user.phone.startsWith('0') ? user.phone.slice(1) : user.phone) : ''
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
    setFullname(val);
    if (!user) {
      saveCustomerInfo({ fullname: val });
    }
  };

  const handleUpdatePhone = (val: string) => {
    setPhone(val);
    if (!user) {
      saveCustomerInfo({ phone: val });
    }
  };

  const handleUpdateEmail = (val: string) => {
    setEmail(val);
    if (!user) {
      saveCustomerInfo({ email: val });
    }
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

  const handlePlaceOrder = async () => {
    if (isSubmitting) return;

    if (!agreeTerms) {
      Alert.alert('Lưu ý', 'Vui lòng đồng ý với các điều khoản để tiếp tục đặt hàng.');
      return;
    }
    if (!fullname.trim() || !phone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ họ tên và số điện thoại.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Giỏ hàng trống', 'Vui lòng chọn món trước khi đặt hàng.');
      return;
    }

    setIsSubmitting(true);

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

    // 1. Snapshot cart & pricing before clearing
    const orderSnapshot = {
      items: [...items],
      itemCount,
      subtotal,
      deliveryFee,
      voucherDiscount,
      selectedVoucher,
      total,
      earnedPoints,
    };
    setConfirmedOrderData(orderSnapshot);

    // 2. Format items snapshot for Firestore
    const firestoreItems = items.map((item) => {
      const product = productsMap[item.productId];
      const unitPrice = getItemLineUnitPrice(item, product) || 0;
      const lineTotal = unitPrice * (Number(item.quantity) || 1);
      const variant = product?.variants?.find((v) => v.id === item.variantId);
      const customSummary = item.customization ? formatCustomizationSummary(item.customization) : [];
      return {
        productId: item.productId,
        productName: product?.name || 'Sản phẩm',
        quantity: Number(item.quantity) || 1,
        unitPrice,
        lineTotal,
        variantName: variant?.name || 'Đế Truyền Thống',
        customizationSummary: customSummary,
        image: product?.image || '',
      };
    });

    // 3. Save order to Firebase Cloud Firestore (collection 'orders')
    try {
      await addDoc(collection(db, 'orders'), {
        orderCode: generatedOrderCode,
        createdAt: serverTimestamp(),
        createdAtFormatted: dateFormatted,
        userId: user?.id || null,
        customer: {
          fullname: fullname.trim(),
          phone: phone.trim(),
          email: email.trim() || user?.email || '',
        },
        deliveryTime: deliveryTime,
        fulfillmentType: fulfillmentType,
        address: address.trim(),
        deliveryNote: deliveryNote.trim(),
        paymentMethod: selectedPaymentId,
        paymentName: selectedPayment?.name || 'Tiền mặt',
        paymentStatus: selectedPaymentId === 'cash' ? 'UNPAID' : 'PAID_DEMO',
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
        voucherCode: selectedVoucher?.code || null,
        total,
        earnedPoints,
      });
      console.log('✅ Đã lưu đơn hàng lên Cloud Firestore thành công: #' + generatedOrderCode);
    } catch (err: any) {
      console.error('Lỗi khi ghi đơn hàng lên Firestore:', err);
    } finally {
      setIsSubmitting(false);
    }

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

            <View style={styles.pricingRow}>
              <View style={styles.infoLabelWrap}>
                <Text style={styles.pricingLabel}>Phí giao hàng</Text>
                <Info size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pricingValue}>
                {formatCurrency(confirmedOrderData?.deliveryFee ?? deliveryFee)}
              </Text>
            </View>

            <View style={styles.pricingDivider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Tổng cộng</Text>
                <Text style={styles.rewardPointsNote}>
                  Nhận{' '}
                  <Text style={{ fontWeight: '700', color: '#111827' }}>
                    {confirmedOrderData?.earnedPoints ?? earnedPoints} điểm
                  </Text>{' '}
                  Hut rewards
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
              <Text
                style={[
                  styles.addressSubtext,
                  !address && { color: '#CF4226', fontStyle: 'italic' },
                ]}
                numberOfLines={2}
              >
                {address || 'Vui lòng chọn địa chỉ nhận hàng'}
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
              onChangeText={handleUpdateDeliveryNote}
            />
          </View>
        </View>

        <View style={styles.sectionDividerGap} />

        {/* BLOCK 2: THỜI GIAN NHẬN */}
        <View style={styles.whiteSectionBlock}>
          <TouchableOpacity
            style={styles.fieldRowClickable}
            onPress={() => setTimeModalVisible(true)}
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
              onChangeText={handleUpdateFullname}
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
                onChangeText={handleUpdatePhone}
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
              onChangeText={handleUpdateEmail}
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
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.orderBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          activeOpacity={0.88}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.orderBtnText}>Đặt hàng</Text>
          )}
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
