import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingBag,
  Info,
  X,
  Check,
} from 'lucide-react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { useCart } from '../../state/CartContext';
import { useToast } from '../../state/ToastContext';
import { triggerHaptic } from '../../utils/haptics';
import { mockProducts } from '../../data/mockProducts';
import { formatCurrency } from '../../utils/formatCurrency';
import { getItemLineUnitPrice } from '../../utils/calculateTotals';

const BRAND_RED = '#CF4226';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

// Recommendation items for "Bạn sẽ thích"
const RECOMMENDATIONS = [
  {
    id: 'PA002',
    name: 'Mỳ Ý Bò Bằm Xốt Cà Chua',
    description: 'Mì Ý với thịt bò bằm đậm đà thơm ngon chuẩn vị truyền thống.',
    price: 129000,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'PZ002',
    name: 'Pepperoni Pizza',
    description: 'Xúc xích Ý cay nhẹ phủ đầy lớp phô mai béo ngậy.',
    price: 159000,
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'PA001',
    name: 'Spaghetti Carbonara',
    description: 'Mì Ý sốt kem trứng béo ngậy kèm thịt xông khói giòn rụm.',
    price: 139000,
    image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=400&q=80',
  },
];

// Valid vouchers for test / live usage
const VALID_VOUCHERS: Record<
  string,
  { title: string; discountAmount: number; isFreeShip?: boolean; minSubtotal: number }
> = {
  PIZZAFPT: { title: 'Giảm 40.000 đ', discountAmount: 40000, minSubtotal: 100000 },
  FPT40: { title: 'Giảm 40.000 đ', discountAmount: 40000, minSubtotal: 200000 },
  FREESHIP: { title: 'Miễn phí giao hàng', discountAmount: 22000, isFreeShip: true, minSubtotal: 0 },
};

/* SVG: Green Recycling Emblem with Center Checkmark */
const RecycleIcon = () => (
  <Svg width={74} height={74} viewBox="0 0 100 100" fill="none">
    {/* Arrow 1: Top / Right */}
    <Path
      d="M38 18 L56 18 C66 18 74 26 74 36 L74 38 L82 32 L75 50 L60 37 L68 40 L68 36 C68 30 63 24 56 24 L38 24 Z"
      fill="#4ADE80"
    />
    {/* Arrow 2: Bottom / Right */}
    <Path
      d="M76 56 L67 73 C62 82 52 86 42 83 L39 82 L45 90 L27 88 L35 72 L37 80 L40 81 C47 83 54 80 58 73 L67 56 Z"
      fill="#4ADE80"
    />
    {/* Arrow 3: Left / Up */}
    <Path
      d="M30 68 L20 51 C15 42 17 32 25 25 L28 23 L22 17 L40 21 L34 39 L30 31 L27 34 C21 39 19 46 23 53 L33 70 Z"
      fill="#4ADE80"
    />
    {/* Center Checkmark */}
    <Path
      d="M45 52 L50 57 L59 45"
      stroke="#16A34A"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/* SVG: Empty Voucher Ticket with Star */
const EmptyTicketIcon = () => (
  <Svg width={116} height={74} viewBox="0 0 116 74" fill="none">
    {/* Ticket background with side notches */}
    <Path
      d="M10 5 C5 5 0 10 0 15 L0 27 C6 27 10 31 10 37 C10 43 6 47 0 47 L0 59 C0 64 5 69 10 69 L106 69 C111 69 116 64 116 59 L116 47 C110 47 106 43 106 37 C106 31 110 27 116 27 L116 15 C116 10 111 5 106 5 Z"
      fill="#E6E8EE"
    />
    {/* Vertical Dashed Notch Line */}
    <Path
      d="M28 10 L28 64"
      stroke="#D5D9E2"
      strokeWidth={2}
      strokeDasharray="4 4"
    />
    {/* White Star in Center */}
    <Polygon
      points="72,21 76,32 87,33 79,40 82,51 72,45 62,51 65,40 57,33 68,32"
      fill="#FFFFFF"
    />
  </Svg>
);

export default function CartScreen() {
  const router = useRouter();
  const { items, removeItem, addItem } = useCart();
  const { showToast } = useToast();

  // Cutlery state & modal (Image 2)
  const [needCutlery, setNeedCutlery] = useState(false);
  const [cutleryModalVisible, setCutleryModalVisible] = useState(false);
  const [cutleryChecked, setCutleryChecked] = useState(false);

  // Voucher screen state (Image 1)
  const [voucherScreenVisible, setVoucherScreenVisible] = useState(false);
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<{
    code: string;
    discountAmount: number;
    title: string;
    isFreeShip?: boolean;
  } | null>(null);

  // Calculate totals safely
  const subtotal = items.reduce((sum, item) => {
    const product = productsMap[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + unitPrice * qty;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  // Delivery fee logic
  const FREE_SHIPPING_THRESHOLD = 300000;
  const isFreeDelivery = subtotal >= FREE_SHIPPING_THRESHOLD || selectedVoucher?.isFreeShip;
  const baseDeliveryFee = isFreeDelivery || items.length === 0 ? 0 : 22000;
  const voucherDiscount = selectedVoucher?.isFreeShip ? 0 : (selectedVoucher?.discountAmount || 0);

  const total = Math.max(0, subtotal + baseDeliveryFee - voucherDiscount);
  const earnedPoints = Math.floor(total / 10000);

  const handleEditItem = (productId: string) => {
    router.push({
      pathname: '/product/[id]',
      params: { id: productId },
    });
  };

  const handleAddRecommendation = (rec: (typeof RECOMMENDATIONS)[0]) => {
    addItem({
      productId: rec.id,
      addonIds: [],
      quantity: 1,
    });
    triggerHaptic('success');
    showToast({ message: `Đã thêm ${rec.name} vào giỏ hàng`, type: 'success' });
  };

  // Open Cutlery Modal
  const handleOpenCutleryModal = () => {
    setCutleryChecked(needCutlery);
    setCutleryModalVisible(true);
  };

  // Apply Cutlery Selection
  const handleApplyCutlery = () => {
    setNeedCutlery(cutleryChecked);
    setCutleryModalVisible(false);
  };

  // Apply Voucher Code
  const handleApplyVoucherCode = () => {
    const code = inputVoucherCode.trim().toUpperCase();
    if (!code) return;

    const voucher = VALID_VOUCHERS[code];
    if (voucher) {
      if (subtotal < voucher.minSubtotal) {
        triggerHaptic('warning');
        showToast({
          message: `Đơn hàng cần tối thiểu ${formatCurrency(voucher.minSubtotal)} để áp dụng mã`,
          type: 'info',
        });
        return;
      }
      setSelectedVoucher({
        code,
        title: voucher.title,
        discountAmount: voucher.discountAmount,
        isFreeShip: voucher.isFreeShip,
      });
      triggerHaptic('success');
      showToast({ message: `Đã áp dụng mã ${code}: ${voucher.title}`, type: 'success' });
    } else {
      triggerHaptic('error');
      showToast({ message: 'Mã giảm giá không hợp lệ. Vui lòng kiểm tra lại!', type: 'error' });
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            activeOpacity={0.7}
          >
            <ChevronLeft size={26} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag size={56} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.emptySubtitle}>
            Hãy khám phá thực đơn đa dạng và chọn những món ăn hấp dẫn bạn nhé!
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.replace('/(tabs)/menu')}
            activeOpacity={0.8}
          >
            <Text style={styles.exploreButtonText}>Khám phá Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ======================================================== */}
      {/* HEADER: Back Arrow + Title "Giỏ hàng"                     */}
      {/* ======================================================== */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
          activeOpacity={0.7}
        >
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ backgroundColor: '#F4F5F7' }}
      >
        {/* ======================================================== */}
        {/* BLOCK 1: CART ITEMS (Full-width white block)              */}
        {/* ======================================================== */}
        <View style={styles.whiteSectionBlock}>
          <Text style={styles.cartCountHeading}>
            Có {itemCount} sản phẩm trong giỏ hàng của bạn
          </Text>

          {items.map((item, index) => {
            const product = productsMap[item.productId];
            const variant = product?.variants?.find((v) => v.id === item.variantId);

            const unitPrice = getItemLineUnitPrice(item, product) || (item as any).basePrice || 0;
            const lineTotal = unitPrice * (Number(item.quantity) || 1);

            const variantName = variant?.name || 'Đế Kéo Tay Truyền Thống(Nhỏ)';
            const isLast = index === items.length - 1;

            return (
              <View
                key={item.lineId}
                style={[styles.itemRow, !isLast && styles.itemRowBorder]}
              >
                {/* Product Thumbnail with badge */}
                <View style={styles.itemImageContainer}>
                  <Image
                    source={{
                      uri:
                        product?.image ||
                        (item as any).image ||
                        'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=400&q=80',
                    }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>GIÁ ƯU ĐÃI</Text>
                    <Text style={styles.discountBadgePercent}>-50%</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.itemDetails}>
                  <View style={styles.itemTopLine}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {product?.name || (item as any).name || 'Sản phẩm'}
                    </Text>
                    <Text style={styles.itemQuantity}>{item.quantity}</Text>
                  </View>

                  <Text style={styles.itemSubName} numberOfLines={1}>
                    {product?.name || (item as any).name || 'Sản phẩm'}
                  </Text>

                  <Text style={styles.itemOptions} numberOfLines={1}>
                    • {variantName}
                  </Text>

                  {/* Actions & Price */}
                  <View style={styles.itemBottomLine}>
                    <View style={styles.actionLinksRow}>
                      <TouchableOpacity
                        onPress={() => item.productId && handleEditItem(item.productId)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editActionText}>Sửa</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic('medium');
                          removeItem(item.lineId);
                          showToast({ message: 'Đã xóa món khỏi giỏ hàng', type: 'info' });
                        }}
                        activeOpacity={0.7}
                        style={{ marginLeft: 16 }}
                      >
                        <Text style={styles.deleteActionText}>Xóa</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.itemPriceText}>{formatCurrency(lineTotal)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* SECTION DIVIDER */}
        <View style={styles.sectionDividerGap} />

        {/* ======================================================== */}
        {/* BLOCK 2: "Bạn sẽ thích" (Horizontal Carousel)           */}
        {/* ======================================================== */}
        <View style={styles.whiteSectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bạn sẽ thích</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationsList}
          >
            {RECOMMENDATIONS.map((rec) => (
              <View key={rec.id} style={styles.recCard}>
                <Image
                  source={{ uri: rec.image }}
                  style={styles.recImage}
                  resizeMode="cover"
                />
                <View style={styles.recContent}>
                  <Text style={styles.recTitle} numberOfLines={1}>
                    {rec.name}
                  </Text>
                  <Text style={styles.recDescription} numberOfLines={2}>
                    {rec.description}
                  </Text>
                  <View style={styles.recBottomRow}>
                    <Text style={styles.recPrice}>{formatCurrency(rec.price)}</Text>
                    <TouchableOpacity
                      style={styles.recAddBtn}
                      onPress={() => handleAddRecommendation(rec)}
                      activeOpacity={0.8}
                    >
                      <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* SECTION DIVIDER */}
        <View style={styles.sectionDividerGap} />

        {/* ======================================================== */}
        {/* BLOCK 3: VOUCHER ROW (Opens Mã giảm giá screen - Image 1)*/}
        {/* ======================================================== */}
        <TouchableOpacity
          style={styles.fullWidthOptionRow}
          onPress={() => setVoucherScreenVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.optionLabel}>Voucher</Text>
          <View style={styles.optionAction}>
            <Text style={styles.voucherActionText}>
              {selectedVoucher
                ? `Đã áp dụng: ${selectedVoucher.code}`
                : 'Nhập hoặc chọn voucher của bạn'}
            </Text>
            <ChevronRight size={18} color="#111827" strokeWidth={2} />
          </View>
        </TouchableOpacity>

        {/* SECTION DIVIDER */}
        <View style={styles.sectionDividerGap} />

        {/* ======================================================== */}
        {/* BLOCK 4: MUỖNG NĨA NHỰA ROW (Opens Modal - Image 2)      */}
        {/* ======================================================== */}
        <TouchableOpacity
          style={styles.fullWidthOptionRow}
          onPress={handleOpenCutleryModal}
          activeOpacity={0.7}
        >
          <Text style={styles.optionLabel}>Muỗng nĩa nhựa</Text>
          <View style={styles.optionAction}>
            <Text style={styles.cutleryActionText}>{needCutlery ? 'Có' : 'Không'}</Text>
            <ChevronRight size={18} color="#111827" strokeWidth={2} />
          </View>
        </TouchableOpacity>

        {/* SECTION DIVIDER */}
        <View style={styles.sectionDividerGap} />

        {/* ======================================================== */}
        {/* BLOCK 5: PRICING BREAKDOWN (White full-width block)      */}
        {/* ======================================================== */}
        <View style={styles.pricingSection}>
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
            <Text style={styles.pricingValue}>
              {baseDeliveryFee === 0 ? 'Miễn phí' : formatCurrency(baseDeliveryFee)}
            </Text>
          </View>

          <View style={styles.pricingDivider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Tổng cộng</Text>
              <Text style={styles.rewardPointsNote}>
                Nhận <Text style={{ fontWeight: '700', color: '#111827' }}>{earnedPoints} điểm</Text> FPT rewards
              </Text>
            </View>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ======================================================== */}
      {/* BOTTOM STICKY CHECKOUT BAR                               */}
      {/* ======================================================== */}
      <View style={styles.bottomBar}>
        {!isFreeDelivery && (
          <View style={styles.freeShipHintRow}>
            <Text style={styles.freeShipHintText}>
              🎉 Thêm <Text style={{ fontWeight: '700' }}>{formatCurrency(FREE_SHIPPING_THRESHOLD - subtotal)}</Text> để nhận <Text style={{ fontWeight: '700' }}>Miễn phí</Text> giao hàng
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/checkout')}
          activeOpacity={0.88}
        >
          <Text style={styles.checkoutBtnText}>Thanh toán</Text>
        </TouchableOpacity>

        {/* COMBO TRƯA COUNTDOWN BANNER */}
        <View style={styles.comboBanner}>
          <Text style={styles.comboBannerText}>COMBO TRƯA</Text>
          <Text style={styles.comboBannerSub}>kết thúc sau</Text>
          <View style={styles.timerBadge}>
            <Text style={styles.timerDigit}>0</Text>
          </View>
          <Text style={styles.timerColon}>:</Text>
          <View style={styles.timerBadge}>
            <Text style={styles.timerDigit}>37</Text>
          </View>
          <Text style={styles.timerColon}>:</Text>
          <View style={styles.timerBadge}>
            <Text style={styles.timerDigit}>14</Text>
          </View>
        </View>
      </View>

      {/* ======================================================== */}
      {/* MODAL 1: MÃ GIẢM GIÁ (EXACT REPLICA OF USER IMAGE 1)      */}
      {/* ======================================================== */}
      <Modal
        visible={voucherScreenVisible}
        animationType="slide"
        onRequestClose={() => setVoucherScreenVisible(false)}
      >
        <SafeAreaView style={styles.modalFullContainer} edges={['top', 'bottom']}>
          {/* Header: <  Mã giảm giá */}
          <View style={styles.voucherHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setVoucherScreenVisible(false)}
              activeOpacity={0.7}
            >
              <ChevronLeft size={26} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mã giảm giá</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.voucherBody}>
            {/* Input Row: Input + Button "Áp dụng" */}
            <View style={styles.voucherInputRow}>
              <TextInput
                style={styles.voucherInput}
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
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.voucherApplyBtnText,
                    inputVoucherCode.trim().length > 0 && styles.voucherApplyBtnTextActive,
                  ]}
                >
                  Áp dụng
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subtext: "Hoặc chọn mã giảm giá của bạn" */}
            <Text style={styles.voucherSubheading}>Hoặc chọn mã giảm giá của bạn</Text>

            {/* Selected Voucher Indicator (if any) */}
            {selectedVoucher && (
              <View style={styles.appliedVoucherBadge}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appliedVoucherCode}>Đã áp dụng: {selectedVoucher.code}</Text>
                  <Text style={styles.appliedVoucherTitle}>{selectedVoucher.title}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedVoucher(null)}
                  style={styles.removeVoucherBtn}
                >
                  <Text style={styles.removeVoucherText}>Gỡ bỏ</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Empty State Center: Ticket with star + "Chưa có mã giảm giá" */}
            {!selectedVoucher && (
              <View style={styles.emptyVoucherBox}>
                <EmptyTicketIcon />
                <Text style={styles.emptyVoucherTitle}>Chưa có mã giảm giá</Text>
                <Text style={styles.emptyVoucherSubtitle}>
                  Thêm mã giảm giá có sẵn vào thanh nhập mã phía trên
                </Text>

                {/* Helpful quick test chips */}
                <View style={styles.quickVouchersWrap}>
                  <Text style={styles.quickVouchersLabel}>Gợi ý mã dùng thử:</Text>
                  <View style={styles.chipsRow}>
                    {['PIZZAFPT', 'FPT40', 'FREESHIP'].map((code) => (
                      <TouchableOpacity
                        key={code}
                        style={styles.chipBtn}
                        onPress={() => setInputVoucherCode(code)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipText}>{code}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Sticky Bottom Button: "Xong" (Primary Brand Red) */}
          <View style={styles.voucherBottomBar}>
            <TouchableOpacity
              style={styles.voucherDoneBtn}
              onPress={() => setVoucherScreenVisible(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.voucherDoneBtnText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: MUỖNG NĨA NHỰA (EXACT REPLICA OF USER IMAGE 2)   */}
      {/* ======================================================== */}
      <Modal
        visible={cutleryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCutleryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCutleryModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.cutlerySheet}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header: Muỗng nĩa nhựa + X close */}
            <View style={styles.cutleryHeader}>
              <Text style={styles.cutleryTitle}>Muỗng nĩa nhựa</Text>
              <TouchableOpacity
                onPress={() => setCutleryModalVisible(false)}
                style={styles.cutleryCloseBtn}
              >
                <X size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Center Green Recycle Emblem */}
            <View style={styles.recycleIconWrap}>
              <RecycleIcon />
            </View>

            {/* Descriptive Content */}
            <Text style={styles.cutleryDescLine1}>
              Muỗng nĩa nhựa chỉ được cung cấp khi đơn hàng có các món sau:
            </Text>
            <Text style={styles.cutleryBullet}>
              • Salad, soup, mỳ ý, nui, cơm, các món đút lò, Xúc Xích Đức Xốt Tiêu Đen
            </Text>

            <Text style={styles.cutleryDescLine2}>
              Hãy chỉ yêu cầu muỗng nĩa nhựa khi thật sự cần thiết nhé. Cảm ơn bạn đã cùng Pizza FPT chung tay bảo vệ môi trường!
            </Text>

            {/* Checkbox: "Yêu cầu Muỗng nĩa nhựa" */}
            <TouchableOpacity
              style={styles.cutleryCheckboxRow}
              onPress={() => setCutleryChecked(!cutleryChecked)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkboxSquare,
                  cutleryChecked && styles.checkboxSquareChecked,
                ]}
              >
                {cutleryChecked && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.checkboxLabel}>Yêu cầu Muỗng nĩa nhựa</Text>
            </TouchableOpacity>

            {/* Red Button: "Áp dụng" */}
            <TouchableOpacity
              style={styles.cutleryApplyBtn}
              onPress={handleApplyCutlery}
              activeOpacity={0.88}
            >
              <Text style={styles.cutleryApplyBtnText}>Áp dụng</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    width: 36,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  /* White Section Blocks */
  whiteSectionBlock: {
    backgroundColor: '#FFFFFF',
  },
  sectionDividerGap: {
    height: 8,
    backgroundColor: '#F4F5F7',
  },

  /* Cart Count Heading */
  cartCountHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  /* Cart Items */
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemImageContainer: {
    position: 'relative',
    width: 76,
    height: 76,
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  discountBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: BRAND_RED,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 6,
  },
  discountBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discountBadgePercent: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  itemTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  itemQuantity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemSubName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  itemOptions: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  itemBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  actionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editActionText: {
    fontSize: 13.5,
    color: BRAND_RED,
    fontWeight: '600',
  },
  deleteActionText: {
    fontSize: 13.5,
    color: BRAND_RED,
    fontWeight: '600',
  },
  itemPriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  /* "Bạn sẽ thích" Section */
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  recommendationsList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 14,
  },
  recCard: {
    width: 290,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    alignItems: 'center',
  },
  recImage: {
    width: 78,
    height: 78,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  recContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  recTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  recDescription: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  recBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  recPrice: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  recAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Option Rows: Full-width matching Pizza Hut mockup */
  fullWidthOptionRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  optionAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voucherActionText: {
    fontSize: 14,
    color: BRAND_RED,
    fontWeight: '400',
    marginRight: 6,
  },
  cutleryActionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '400',
    marginRight: 6,
  },

  /* Pricing Breakdown */
  pricingSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
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
    fontWeight: '600',
    color: '#111827',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rewardPointsNote: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  /* Bottom Sticky Bar */
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  freeShipHintRow: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  freeShipHintText: {
    fontSize: 13,
    color: '#374151',
  },
  checkoutBtn: {
    backgroundColor: BRAND_RED,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  comboBanner: {
    backgroundColor: BRAND_RED,
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  comboBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  comboBannerSub: {
    color: '#FFFFFF',
    fontSize: 11,
    marginRight: 4,
  },
  timerBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  timerDigit: {
    color: BRAND_RED,
    fontSize: 12,
    fontWeight: '800',
  },
  timerColon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* ========================================================== */
  /* SCREEN: MÃ GIẢM GIÁ (IMAGE 1)                              */
  /* ========================================================== */
  modalFullContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  voucherHeader: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  voucherBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voucherInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  voucherApplyBtn: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: '#EAEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherApplyBtnActive: {
    backgroundColor: BRAND_RED,
  },
  voucherApplyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B3BC',
  },
  voucherApplyBtnTextActive: {
    color: '#FFFFFF',
  },
  voucherSubheading: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 20,
  },
  emptyVoucherBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyVoucherTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 18,
  },
  emptyVoucherSubtitle: {
    fontSize: 13.5,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  quickVouchersWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  quickVouchersLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND_RED,
  },
  appliedVoucherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  appliedVoucherCode: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_RED,
  },
  appliedVoucherTitle: {
    fontSize: 12.5,
    color: '#4B5563',
    marginTop: 2,
  },
  removeVoucherBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeVoucherText: {
    fontSize: 13,
    color: BRAND_RED,
    fontWeight: '600',
  },
  voucherBottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  voucherDoneBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ========================================================== */
  /* MODAL: MUỖNG NĨA NHỰA (IMAGE 2)                           */
  /* ========================================================== */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  cutlerySheet: {
    backgroundColor: '#FFFFFF',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  cutleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cutleryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cutleryCloseBtn: {
    padding: 4,
  },
  recycleIconWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  cutleryDescLine1: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  cutleryBullet: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginTop: 4,
    paddingLeft: 4,
  },
  cutleryDescLine2: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginTop: 14,
  },
  cutleryCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },
  cutleryApplyBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cutleryApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Empty Cart State */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: BRAND_RED,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
