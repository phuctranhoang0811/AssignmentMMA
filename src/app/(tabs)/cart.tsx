import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingBag,
  X,
  Check,
} from 'lucide-react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { triggerHaptic } from '../../utils/haptics';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';
import { StoreLocationModal } from '../../components/modals/StoreLocationModal';
import {
  checkHasChosenAddress,
  saveDeliveryAddress,
  getSavedDeliveryAddress,
} from '../../services/addressStorage';

import { styles, BRAND_RED } from '../../styles/cart.styles';
import { findCoupon, useCatalog, useCoupons } from '../../services/catalog';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { canEditCartProduct } from '../../utils/cartOperations';
import { CartItem } from '../../types/order';
import { Product } from '../../types/product';
import { formatCustomizationSummary } from '../../types/pizzaCustomization';

// Recommendation items for "Bạn sẽ thích"
const RECOMMENDATION_IDS = ['PA002', 'PZ002', 'PA001'];

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
  const { productsMap } = useCatalog();
  const coupons = useCoupons();
  const RECOMMENDATIONS = RECOMMENDATION_IDS.map(id => productsMap[id]).filter(product => product?.isAvailable);
  const router = useRouter();
  const { items, removeItem, addItem, updateQuantity, promoCode, setPromoCode, fulfillmentType, setFulfillmentType,
    isLoaded, needCutlery, setNeedCutlery } = useCart();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  // Cutlery state & modal (Image 2)
  const [cutleryModalVisible, setCutleryModalVisible] = useState(false);
  const [cutleryChecked, setCutleryChecked] = useState(false);

  // Voucher screen state (Image 1)
  const [voucherScreenVisible, setVoucherScreenVisible] = useState(false);
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const selectedVoucher = (promoCode && findCoupon(coupons, promoCode)) || null;
  const setSelectedVoucher = (voucher: { code: string } | null) => setPromoCode(voucher?.code || '');

  // Modal xác nhận xóa món
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      triggerHaptic('medium');
      removeItem(itemToDelete);
      setItemToDelete(null);
      showToast({ message: 'Đã xóa món khỏi giỏ hàng', type: 'info' });
    }
  };

  const handleCancelDelete = () => {
    setItemToDelete(null);
  };

  // Address selection modal flow
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isProceeding, setIsProceeding] = useState(false);

  useEffect(() => {
    getSavedDeliveryAddress().then((saved) => {
      if (saved) setDeliveryAddress(saved);
    });
  }, []);

  const { user } = useAuth();
  // Ordering needs a real account; say so here instead of after the guest has filled in checkout.
  const mustSignIn = !user || user.isDemo;

  const handleProceedToCheckout = async () => {
    if (isProceeding) return;
    if (mustSignIn) {
      router.push({ pathname: '/auth/login', params: { returnTo: 'cart-checkout' } });
      return;
    }
    setIsProceeding(true);
    try {
    const hasChosen = await checkHasChosenAddress();
    if (!hasChosen) {
      // Khách chưa chọn địa chỉ ở trang chủ -> Hiện modal nhập địa chỉ
      setShowAddressModal(true);
    } else {
      // Khách đã chọn địa chỉ rồi -> Chuyển thẳng sang thanh toán
      router.push('/checkout');
    }
    } catch {
      showToast({ message: 'Chưa thể mở thanh toán. Vui lòng thử lại.', type: 'error' });
    } finally { setIsProceeding(false); }
  };

  // Calculate totals safely
  const subtotal = items.reduce((sum, item) => {
    const product = productsMap[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + unitPrice * qty;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const totals = calculateOrderTotals(items, productsMap, fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP', selectedVoucher);
  const { discount: voucherDiscount, total } = totals;
  const earnedPoints = Math.floor(total / 10000);

  const handleEditItem = (item: CartItem) => {
    if (!canEditCartProduct(productsMap[item.productId])) return;
    router.push({ pathname: '/product/[id]', params: { id: item.productId, lineId: item.lineId } });
  };

  const handleAddRecommendation = (rec: Product) => {
    if (rec.variants?.length) {
      router.push({ pathname: '/product/[id]', params: { id: rec.id } });
      return;
    }
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

    const voucher = findCoupon(coupons, code);
    if (voucher) {
      if (subtotal < voucher.minSubtotal) {
        triggerHaptic('warning');
        showToast({
          message: `Đơn hàng cần tối thiểu ${formatCurrency(voucher.minSubtotal)} để áp dụng mã`,
          type: 'info',
        });
        return;
      }
      setSelectedVoucher(voucher);
      triggerHaptic('success');
      showToast({ message: `Đã áp dụng mã ${code}: ${voucher.description}`, type: 'success' });
    } else {
      triggerHaptic('error');
      showToast({ message: 'Mã giảm giá không hợp lệ. Vui lòng kiểm tra lại!', type: 'error' });
    }
  };

  if (!isLoaded) {
    return <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.emptyContainer}>
        <ActivityIndicator color={BRAND_RED} />
        <Text style={styles.emptySubtitle}>Đang tải giỏ hàng…</Text>
      </View>
    </SafeAreaView>;
  }

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

            const options = [
              ...(item.customization ? formatCustomizationSummary(item.customization) : variant ? [variant.name] : []),
              ...item.addonIds.map(id => product?.addons?.find(addon => addon.id === id)?.name).filter(Boolean),
              item.specialInstructions,
            ].filter(Boolean).join(' • ');
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

                </View>

                {/* Details */}
                <View style={styles.itemDetails}>
                  <View style={styles.itemTopLine}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {product?.name || (item as any).name || 'Sản phẩm'}
                    </Text>
                  </View>

                  {!!options && <Text style={styles.itemOptions} numberOfLines={3}>{options}</Text>}

                  {/* Actions & Price */}
                  <View style={styles.itemBottomLine}>
                    <QuantityStepper value={item.quantity} onChange={value => updateQuantity(item.lineId, value)} />
                    <Text style={styles.itemPriceText}>{formatCurrency(lineTotal)}</Text>
                  </View>
                    <View style={styles.actionLinksRow}>
                      {canEditCartProduct(product) && (
                        <TouchableOpacity
                        accessibilityLabel={`Sửa ${product?.name || "món"}`}
                        accessibilityRole="button"
                        style={styles.itemAction}
                        onPress={() => handleEditItem(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editActionText}>Sửa</Text>
                      </TouchableOpacity>
                        )}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Xóa ${product?.name || 'món'} khỏi giỏ hàng`}
                        onPress={() => {
                          triggerHaptic('light');
                          setItemToDelete(item.lineId);
                        }}
                        activeOpacity={0.7}
                        style={styles.itemAction}
                      >
                        <Text style={styles.deleteActionText}>Xóa</Text>
                      </TouchableOpacity>
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
                    <Text style={styles.recPrice}>{rec.variants?.length ? 'Từ ' : ''}{formatCurrency(rec.basePrice)}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={rec.variants?.length ? `Chọn kích cỡ ${rec.name}` : `Thêm ${rec.name} vào giỏ hàng`}
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

          {selectedVoucher && subtotal < selectedVoucher.minSubtotal && (
            <Text style={{ color: BRAND_RED, marginBottom: 12 }}>
              Mã {selectedVoucher.code} cần đơn từ {formatCurrency(selectedVoucher.minSubtotal)}. Chưa áp dụng giảm giá.
            </Text>
          )}
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


          <View style={styles.pricingDivider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Tổng cộng</Text>
              <Text style={styles.rewardPointsNote}>
                Điểm dự kiến: <Text style={{ fontWeight: '700', color: '#111827' }}>{earnedPoints} điểm</Text> FPT Rewards
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
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={handleProceedToCheckout}
          disabled={isProceeding}
          accessibilityRole="button"
          accessibilityState={{ disabled: isProceeding, busy: isProceeding }}
          activeOpacity={0.88}
        >
          {isProceeding ? <ActivityIndicator color="#FFFFFF" /> :
            <Text style={styles.checkoutBtnText}>{mustSignIn ? 'Đăng nhập để thanh toán' : 'Thanh toán'} • {formatCurrency(total)}</Text>}
        </TouchableOpacity>
      </View>

      {/* Modal yêu cầu nhập địa chỉ nếu khách chưa chọn ở trang chủ */}
      <StoreLocationModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        currentAddress={deliveryAddress}
        redirectToMenuOnConfirm={false}
        initialFulfillment={fulfillmentType}
        onConfirmAddress={(addr, mode) => {
          setFulfillmentType(mode);
          saveDeliveryAddress(addr);
          setDeliveryAddress(addr);
          setShowAddressModal(false);
          router.push('/checkout');
        }}
      />

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
                  <Text style={styles.appliedVoucherTitle}>{selectedVoucher.description}</Text>
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

      {/* ======================================================== */}
      {/* MODAL 3: XÁC NHẬN XÓA MÓN (EXACT REPLICA CỦA ẢNH CHỤP)     */}
      {/* ======================================================== */}
      <Modal
        visible={itemToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Xóa món</Text>
            <View style={styles.deleteModalRedLine} />
            <Text style={styles.deleteModalMessage}>
              Bạn có muốn xóa món này không?
            </Text>

            <View style={styles.deleteModalButtonsRow}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancelBtn]}
                onPress={handleCancelDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalConfirmBtn]}
                onPress={handleConfirmDelete}
                activeOpacity={0.88}
              >
                <Text style={styles.deleteModalConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
