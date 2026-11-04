import React, { useState, useEffect, useMemo } from 'react';
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
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingBag,
  X,
  Check,
  PartyPopper,
} from 'lucide-react-native';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { triggerHaptic } from '../../utils/haptics';
import { formatCurrency } from '../../utils/formatCurrency';
import { hasPromptedFreeShip, setPromptedFreeShip } from '../../utils/sessionFlags';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';
import { geocodeAddressStrict, geocodeAddress, getCoordinatesForAddress } from '../../services/addressService';
import { roadDistanceKm, type LatLng, type DeliveryFeeConfig } from '../../utils/deliveryFee';
import { subscribeStoresConfig, DEFAULT_STORE_BRANCHES } from '../../services/storeSync';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StoreLocationModal } from '../../components/modals/StoreLocationModal';
import {
  checkHasChosenAddress,
  saveDeliveryAddress,
  getSavedDeliveryAddress,
} from '../../services/addressStorage';

import { styles, BRAND_RED } from '../../styles/cart.styles';
import { findCoupon, useCatalog, useCoupons } from '../../services/catalog';
import { isCouponExpired } from '../../utils/coupons';
import { fetchUserMemberStats } from '../../utils/memberTier';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { StoreClosedBanner } from '../../components/store/StoreClosedBanner';
import { useStoreStatus } from '../../services/storeSettings';
import { RecycleIcon } from '../../components/cart/RecycleIcon';
import { EmptyTicketIcon } from '../../components/ui/EmptyTicketIcon';
import { canEditCartProduct } from '../../utils/cartOperations';
import { CartItem } from '../../types/order';
import { Product } from '../../types/product';
import { formatCustomizationSummary } from '../../types/pizzaCustomization';
import {
  isProductDiscounted,
  sortPopularProducts,
  selectDefaultPopularIds,
} from '../../utils/popularRecommendations';

export default function CartScreen() {
  const { products, productsMap = {} } = useCatalog();
  const coupons = useCoupons();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const {
    items,
    removeItem,
    updateQuantity,
    promoCode,
    setPromoCode,
    fulfillmentType,
    setFulfillmentType,
    isLoaded,
    needCutlery,
    setNeedCutlery,
  } = useCart();
  const { showToast } = useToast();
  const store = useStoreStatus();
  const insets = useSafeAreaInsets();

  const inCartProductIds = useMemo(
    () => new Set(items.map((it) => it.productId)),
    [items]
  );

  const adminPopularProducts = useMemo(() => {
    const allList = products && products.length > 0 ? products : Object.values(productsMap);
    const popular = allList.filter(
      (p) =>
        p &&
        p.isPopular &&
        (p.categoryId !== 'pizza' || !isProductDiscounted(p))
    );
    if (popular.length > 0) {
      return sortPopularProducts(popular);
    }
    const fallbackIds = selectDefaultPopularIds(allList);
    return sortPopularProducts(allList.filter((p) => p && fallbackIds.has(p.id)));
  }, [products, productsMap]);

  const RECOMMENDATIONS = useMemo(() => {
    return adminPopularProducts.filter((p) => !inCartProductIds.has(p.id));
  }, [adminPopularProducts, inCartProductIds]);

  const hasAddedAllRecommendations = useMemo(() => {
    return adminPopularProducts.length > 0 && RECOMMENDATIONS.length === 0;
  }, [adminPopularProducts, RECOMMENDATIONS]);

  // Cutlery state & modal (Image 2)
  const [cutleryModalVisible, setCutleryModalVisible] = useState(false);
  const [cutleryChecked, setCutleryChecked] = useState(false);

  // Voucher screen state (Image 1)
  const [voucherScreenVisible, setVoucherScreenVisible] = useState(false);
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const selectedVoucher = (promoCode && findCoupon(coupons, promoCode)) || null;
  const setSelectedVoucher = (voucher: { code: string } | null) => setPromoCode(voucher?.code || '');
  const availableVouchers = useMemo(
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

  // Modal xác nhận xóa món
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  // Modal nhắc khách mua đủ mức freeship của Admin trước khi thanh toán (chỉ hỏi 1 lần trong 1 phiên)
  const [freeShipPromptVisible, setFreeShipPromptVisible] = useState(false);
  // Modal thông báo khi đơn giao hàng chưa đủ mức tối thiểu
  const [minDeliveryPopupVisible, setMinDeliveryPopupVisible] = useState(false);
  // Modal thông báo khi cửa hàng đóng cửa (sau 22:00 - trước 08:00)
  const [storeClosedPopupVisible, setStoreClosedPopupVisible] = useState(false);

  const { user } = useAuth();
  const mustSignIn = !user || user.isDemo;
  const isMember = !mustSignIn;

  const isItemRewardOrGift = (it: CartItem) =>
    Boolean((it as any)?.isRewardGift) ||
    String(it.specialInstructions || '').includes('Quà đổi điểm FPT Rewards');

  const isItemMemberGift = (it: CartItem) =>
    /Quà đổi điểm FPT Rewards \([^)]+\)/.test(String(it.specialInstructions || ''));

  const getMemberGiftMinRequired = (it: CartItem): number => {
    const m = /\[MIN:(\d+)\]/.exec(String(it.specialInstructions || ''));
    return m && m[1] ? Number(m[1]) : 280000;
  };

  const getRedeemedGiftPoints = (it: CartItem): number => {
    const m = /\[PTS:(\d+)\]/.exec(String(it.specialInstructions || ''));
    return m && m[1] ? Number(m[1]) : 0;
  };

  const targetDeleteItem = useMemo(
    () => (itemToDelete ? items.find((i) => i.lineId === itemToDelete) || null : null),
    [itemToDelete, items]
  );

  // Kiểm tra nếu xóa món này thì Quà của tôi (hoặc Voucher đang áp dụng) có bị mất điều kiện giá trị giỏ hàng tối thiểu hay không
  const invalidatedMemberGiftLineIds = useMemo(() => {
    if (!targetDeleteItem || isItemRewardOrGift(targetDeleteItem)) return [];
    const mustSignInNow = !user || user.isDemo;
    const isMemberNow = !mustSignInNow;
    const remainingPaidSubtotal = items.reduce((acc, it) => {
      if (it.lineId === targetDeleteItem.lineId) return acc;
      if (isItemRewardOrGift(it)) return acc;
      const prod = productsMap[it.productId];
      const uPrice = getItemLineUnitPrice(it, prod, isMemberNow);
      return acc + uPrice * (Number(it.quantity) || 1);
    }, 0);

    return items
      .filter(
        (it) =>
          it.lineId !== targetDeleteItem.lineId &&
          isItemMemberGift(it) &&
          remainingPaidSubtotal < getMemberGiftMinRequired(it)
      )
      .map((it) => it.lineId);
  }, [targetDeleteItem, items, productsMap, user]);

  const willInvalidateVoucherOnDelete = useMemo(() => {
    if (!targetDeleteItem || isItemRewardOrGift(targetDeleteItem) || !selectedVoucher) {
      return false;
    }
    const mustSignInNow = !user || user.isDemo;
    const isMemberNow = !mustSignInNow;
    const remainingPaidSubtotal = items.reduce((acc, it) => {
      if (it.lineId === targetDeleteItem.lineId) return acc;
      if (isItemRewardOrGift(it)) return acc;
      const prod = productsMap[it.productId];
      const uPrice = getItemLineUnitPrice(it, prod, isMemberNow);
      return acc + uPrice * (Number(it.quantity) || 1);
    }, 0);
    return remainingPaidSubtotal < (selectedVoucher.minSubtotal || 0);
  }, [targetDeleteItem, items, productsMap, user, selectedVoucher]);

  const deleteWillInvalidateOffer =
    invalidatedMemberGiftLineIds.length > 0 || willInvalidateVoucherOnDelete;

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      triggerHaptic('medium');
      const deletingObj = items.find((i) => i.lineId === itemToDelete);
      if (deletingObj && isItemRewardOrGift(deletingObj)) {
        const refundPts = getRedeemedGiftPoints(deletingObj) * (Number(deletingObj.quantity) || 1);
        if (refundPts > 0 && user && !user.isDemo && user.id) {
          const uid = user.id;
          getDoc(doc(db, 'users', uid))
            .then((uSnap) => {
              const uData = uSnap?.exists() ? uSnap.data() : undefined;
              const prevGifts: any[] = Array.isArray(uData?.redeemedGifts)
                ? [...uData.redeemedGifts]
                : [];
              let remainingToRefund = refundPts;
              const nextGifts = prevGifts.filter((g) => {
                const gPts = Number(g?.points || 0);
                if (remainingToRefund > 0 && gPts > 0 && gPts <= remainingToRefund) {
                  remainingToRefund -= gPts;
                  return false;
                }
                return true;
              });
              return updateDoc(doc(db, 'users', uid), {
                rewardPoints: increment(refundPts),
                redeemedGifts: nextGifts,
              });
            })
            .catch(() => {
              updateDoc(doc(db, 'users', uid), {
                rewardPoints: increment(refundPts),
              }).catch(() => {});
            });
        }
      }

      removeItem(itemToDelete);
      if (invalidatedMemberGiftLineIds.length > 0) {
        invalidatedMemberGiftLineIds.forEach((gLineId) => removeItem(gLineId));
      }
      if (willInvalidateVoucherOnDelete) {
        setSelectedVoucher(null);
      }
      setItemToDelete(null);
      showToast({
        message: deleteWillInvalidateOffer
          ? 'Đã cập nhật giỏ hàng và gỡ ưu đãi không còn đủ điều kiện'
          : 'Đã xóa món khỏi giỏ hàng',
        type: 'info',
      });
    }
  };

  const handleCancelDelete = () => {
    setItemToDelete(null);
  };

  // Address selection modal flow
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isProceeding, setIsProceeding] = useState(false);
  const [activeStorePoints, setActiveStorePoints] = useState(DEFAULT_STORE_BRANCHES);
  const [syncedDeliveryConfig, setSyncedDeliveryConfig] = useState<DeliveryFeeConfig | null>(null);
  const [syncedShippingEnabled, setSyncedShippingEnabled] = useState<boolean>(true);
  const [located, setLocated] = useState<{ address: string; point: LatLng | null } | null>(null);

  useFocusEffect(() => {
    getSavedDeliveryAddress().then((saved) => {
      if (saved) setDeliveryAddress(saved);
    });
  });

  useEffect(() => {
    const unsub = subscribeStoresConfig((state) => {
      const pts = state.stores.filter((d) => d && d.isActive !== false && d.name);
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
    maxKm: 20,
    freeOver: 300000,
    minDeliveryOrder: 50000,
  };
  const minDeliveryOrderAmount =
    fulfillmentType === 'delivery' ? (baseShippingRules.minDeliveryOrder ?? 50000) : 0;

  const shippingConfig: DeliveryFeeConfig | undefined =
    fulfillmentType === 'delivery' && syncedShippingEnabled ? baseShippingRules : undefined;

  useEffect(() => {
    if (!shippingConfig || !deliveryAddress.trim()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      geocodeAddressStrict(deliveryAddress)
        .then(async (point) => {
          const resolved = point || (await geocodeAddress(deliveryAddress));
          if (!cancelled) setLocated({ address: deliveryAddress, point: resolved });
        })
        .catch(() => {
          if (!cancelled) setLocated({ address: deliveryAddress, point: null });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shippingConfig, deliveryAddress]);

  const deliveryPoint =
    shippingConfig && deliveryAddress.trim()
      ? located?.address === deliveryAddress && located.point
        ? located.point
        : getCoordinatesForAddress(deliveryAddress)
      : null;

  const effectiveShippingConfig = useMemo(() => {
    if (!shippingConfig) return undefined;
    if (!deliveryPoint || activeStorePoints.length === 0) return shippingConfig;
    let nearest = activeStorePoints[0];
    let minDist = roadDistanceKm(nearest, deliveryPoint);
    for (const pt of activeStorePoints) {
      const d = roadDistanceKm(pt, deliveryPoint);
      if (d < minDist) {
        minDist = d;
        nearest = pt;
      }
    }
    return {
      ...shippingConfig,
      storeLat: nearest.lat,
      storeLng: nearest.lng,
      maxKm: shippingConfig.maxKm || 15,
    };
  }, [shippingConfig, deliveryPoint, activeStorePoints]);

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

  // Calculate totals safely (Khách vãng lai tính giá gốc; Thành viên tính giá ưu đãi)
  const subtotal = items.reduce((sum, item) => {
    const product = productsMap[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product, isMember) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + unitPrice * qty;
  }, 0);

  // Tự động gỡ Quà của tôi / Voucher nếu khách bấm "Sửa" món làm giảm tổng tiền giỏ hàng xuống dưới mức tối thiểu
  useEffect(() => {
    if (!isLoaded || Object.keys(productsMap).length === 0 || itemToDelete !== null) return;
    const invalidGiftLines = items.filter(
      (it) => isItemMemberGift(it) && subtotal < getMemberGiftMinRequired(it)
    );
    const invalidVoucher =
      Boolean(selectedVoucher) && subtotal < (selectedVoucher?.minSubtotal || 0);

    if (invalidGiftLines.length > 0 || invalidVoucher) {
      invalidGiftLines.forEach((it) => removeItem(it.lineId));
      if (invalidVoucher) {
        setPromoCode('');
      }
      showToast({
        message: 'Ưu đãi đã tự động gỡ do giỏ hàng không còn đủ giá trị tối thiểu',
        type: 'info',
      });
    }
  }, [isLoaded, productsMap, subtotal, items, selectedVoucher, itemToDelete]);

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

  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const totals = calculateOrderTotals(
    items,
    productsMap,
    fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP',
    selectedVoucher,
    undefined,
    effectiveShippingConfig && deliveryPoint
      ? { config: effectiveShippingConfig, to: deliveryPoint }
      : undefined,
    isMember
  );
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
  const total = Math.max(0, subtotalAfterMember - voucherDiscount + totals.deliveryFee);
  const earnedPoints = isMember ? Math.floor(total / 10000) : 0;
  const freeOverThreshold = shippingConfig?.freeOver ?? 0;
  const orderAfterDiscount = Math.max(0, subtotal - voucherDiscount - memberDiscount);

  const continueToCheckout = async () => {
    if (isProceeding) return;
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
    } finally {
      setIsProceeding(false);
    }
  };

  const handleProceedToCheckout = async () => {
    if (isProceeding) return;
    if (!store.open) {
      triggerHaptic('warning');
      setStoreClosedPopupVisible(true);
      return;
    }
    const soldOutItem = items.find((it) => productsMap[it.productId]?.isAvailable === false);
    if (soldOutItem) {
      const soldOutName =
        productsMap[soldOutItem.productId]?.name || (soldOutItem as any).name || 'Sản phẩm';
      triggerHaptic('warning');
      showToast({
        message: `Món "${soldOutName}" hiện đã tạm hết hàng. Vui lòng xóa khỏi giỏ trước khi thanh toán.`,
        type: 'error',
      });
      return;
    }
    if (false && mustSignIn) {
      router.push({ pathname: '/auth/login', params: { returnTo: 'cart-checkout' } });
      return;
    }
    if (fulfillmentType === 'delivery' && !syncedShippingEnabled) {
      triggerHaptic('warning');
      showToast({
        message: 'Cửa hàng hiện đang tạm ngưng giao hàng tận nơi. Vui lòng chuyển sang Nhận tại cửa hàng.',
        type: 'error',
      });
      return;
    }
    if (
      fulfillmentType === 'delivery' &&
      minDeliveryOrderAmount > 0 &&
      subtotal < minDeliveryOrderAmount
    ) {
      triggerHaptic('warning');
      setMinDeliveryPopupVisible(true);
      return;
    }
    if (
      !hasPromptedFreeShip() &&
      fulfillmentType === 'delivery' &&
      syncedShippingEnabled &&
      !!shippingConfig &&
      freeOverThreshold > 0 &&
      subtotal < freeOverThreshold &&
      totals.deliveryFee > 0
    ) {
      setPromptedFreeShip(true);
      triggerHaptic('light');
      setFreeShipPromptVisible(true);
      return;
    }
    await continueToCheckout();
  };

  const handleEditItem = (item: CartItem) => {
    if (!canEditCartProduct(productsMap[item.productId])) return;
    router.push({ pathname: '/product/[id]', params: { id: item.productId, lineId: item.lineId } });
  };

  const handleOpenRecommendationDetail = (rec: Product) => {
    if (rec.isAvailable === false) return;
    triggerHaptic('light');
    router.push({ pathname: '/product/[id]', params: { id: rec.id } });
  };

  const handleQuickAddRecommendation = (rec: Product, e?: any) => {
    e?.stopPropagation?.();
    if (rec.isAvailable === false) return;
    triggerHaptic('medium');
    router.push({ pathname: '/product/[id]', params: { id: rec.id } });
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

  const handleBackFromCart = () => {
    if (from === 'checkout' && items.length > 0) {
      router.replace('/checkout');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackFromCart}
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
          onPress={handleBackFromCart}
          activeOpacity={0.7}
        >
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
        <View style={styles.placeholder} />
      </View>
      <StoreClosedBanner status={store} />

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
            const fallbackVariantName =
              item.variantId === 'small'
                ? 'Cỡ Nhỏ'
                : item.variantId === 'medium'
                  ? 'Cỡ Vừa'
                  : item.variantId === 'large'
                    ? 'Cỡ Lớn'
                    : undefined;
            const isRewardItem =
              Boolean((item as any)?.isRewardGift) ||
              String(item.specialInstructions || '').includes('Quà đổi điểm FPT Rewards');

            const unitPrice = isRewardItem
              ? 0
              : getItemLineUnitPrice(item, product, isMember) || (item as any).basePrice || 0;
            const memberUnitPrice = isRewardItem
              ? 0
              : getItemLineUnitPrice(item, product, true) || unitPrice;
            const lineTotal = unitPrice * (Number(item.quantity) || 1);

            const itemNote = (
              item.specialInstructions ||
              item.customization?.specialInstructions ||
              ''
            ).trim();
            const options = [
              variant?.name || fallbackVariantName,
              ...(item.customization ? formatCustomizationSummary(item.customization) : []),
              ...item.addonIds.map(id => product?.addons?.find(addon => addon.id === id)?.name).filter(Boolean),
            ]
              .filter(Boolean)
              .filter((val, idx, arr) => arr.indexOf(val) === idx)
              .join(' • ');
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
                    <Text style={styles.itemQuantity}>{item.quantity}</Text>
                  </View>

                  {!!options && <Text style={styles.itemOptions} numberOfLines={3}>{options}</Text>}
                  {product?.isAvailable === false && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: BRAND_RED,
                        fontWeight: '700',
                        marginTop: 4,
                      }}
                    >
                      Tạm hết hàng — vui lòng xóa món này để tiếp tục
                    </Text>
                  )}
                  {!!itemNote && !isRewardItem && (
                    <Text
                      style={[
                        styles.itemOptions,
                        {
                          color: '#B45309',
                          fontWeight: '600',
                          marginTop: 2,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      Ghi chú: {itemNote}
                    </Text>
                  )}

                  {!isMember && !isRewardItem && memberUnitPrice < unitPrice && (
                    <Text style={{ fontSize: 12, color: BRAND_RED, fontWeight: '600', marginTop: 4 }}>
                      Giá gốc khách vãng lai (Đăng nhập chỉ còn {formatCurrency(memberUnitPrice * (Number(item.quantity) || 1))})
                    </Text>
                  )}

                  {/* Actions & Price */}
                  <View style={styles.itemBottomLine}>
                    <View style={styles.actionLinksRow}>
                      {isRewardItem ? (
                        <View style={styles.itemAction}>
                          <Text style={[styles.editActionText, { color: '#6B7280' }]}>
                            Khuyến mãi
                          </Text>
                        </View>
                      ) : (
                        canEditCartProduct(product) && (
                          <TouchableOpacity
                            accessibilityLabel={`Sửa ${product?.name || "món"}`}
                            accessibilityRole="button"
                            style={styles.itemAction}
                            onPress={() => handleEditItem(item)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.editActionText}>Sửa</Text>
                          </TouchableOpacity>
                        )
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

          {hasAddedAllRecommendations && (
            <View style={styles.allAddedCard}>
              <View style={styles.allAddedIconWrap}>
                <PartyPopper size={22} color={BRAND_RED} />
              </View>
              <View style={styles.allAddedTextWrap}>
                <Text style={styles.allAddedTitle}>Bạn đã chọn tất cả món gợi ý!</Text>
                <Text style={styles.allAddedSubtitle}>Toàn bộ món đề xuất đã nằm trong giỏ. Cùng kiểm tra và đặt hàng nhé </Text>
              </View>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationsList}
          >
            {RECOMMENDATIONS.map((rec) => {
              const isSoldOut = rec.isAvailable === false;
              return (
                <TouchableOpacity
                  key={rec.id}
                  style={styles.recCard}
                  activeOpacity={isSoldOut ? 1 : 0.88}
                  disabled={isSoldOut}
                  onPress={() => handleOpenRecommendationDetail(rec)}
                >
                  <View style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                    <Image
                      source={{ uri: rec.image }}
                      style={[styles.recImage, isSoldOut && { opacity: 0.85 }]}
                      resizeMode="contain"
                    />
                    {isSoldOut && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(17, 24, 39, 0.16)',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderRadius: 8,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: 'rgba(31, 41, 55, 0.88)',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.6)',
                          }}
                        >
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: 10,
                              fontWeight: '800',
                              letterSpacing: 0.4,
                            }}
                          >
                            HẾT MÓN
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.recContent}>
                    <Text
                      style={[styles.recTitle, isSoldOut && { color: '#4B5563' }]}
                      numberOfLines={1}
                    >
                      {rec.name}
                    </Text>
                    <Text
                      style={[styles.recDescription, isSoldOut && { color: '#6B7280' }]}
                      numberOfLines={2}
                    >
                      {rec.description}
                    </Text>
                    <View style={styles.recBottomRow}>
                      <Text style={[styles.recPrice, isSoldOut && { color: '#6B7280' }]}>
                        {rec.categoryId === 'pizza' || (rec.variants && rec.variants.length > 1)
                          ? 'Từ '
                          : ''}
                        {formatCurrency(rec.basePrice)}
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Thêm ${rec.name}`}
                        style={[
                          styles.recAddBtn,
                          isSoldOut && { backgroundColor: '#D1D5DB' },
                        ]}
                        disabled={isSoldOut}
                        onPress={(e) => handleQuickAddRecommendation(rec, e)}
                        activeOpacity={isSoldOut ? 1 : 0.8}
                      >
                        <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
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

          {memberDiscount > 0 && (
            <View style={styles.pricingRow}>
              <Text style={[styles.pricingLabel, { color: BRAND_RED }]}>
                Giảm giá thành viên ({Math.round(memberDiscountRate * 100)}%)
              </Text>
              <Text style={[styles.pricingValue, { color: BRAND_RED }]}>
                -{formatCurrency(memberDiscount)}
              </Text>
            </View>
          )}


          {fulfillmentType === 'delivery' && (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>
                Phí giao hàng{totals.deliveryDistanceKm ? ` (${totals.deliveryDistanceKm} km)` : ''}
              </Text>
              <Text style={styles.pricingValue}>
                {totals.deliveryFee === 0 ? 'Miễn phí' : formatCurrency(totals.deliveryFee)}
              </Text>
            </View>
          )}
          <View style={styles.pricingDivider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Tổng cộng</Text>
              {!mustSignIn && (
                <Text style={styles.rewardPointsNote}>
                  Điểm dự kiến: <Text style={{ fontWeight: '700', color: '#111827' }}>{earnedPoints} điểm</Text> FPT Rewards
                </Text>
              )}
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
            <Text style={styles.checkoutBtnText}>Thanh toán • {formatCurrency(total)}</Text>}
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

            {/* Danh sách mã giảm giá đồng bộ realtime từ Admin */}
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
                          setSelectedVoucher(null);
                          return;
                        }
                        if (!canApply) return;
                        setSelectedVoucher(voucher);
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
                <View style={styles.emptyVoucherBox}>
                  <EmptyTicketIcon />
                  <Text style={styles.emptyVoucherTitle}>Chưa có mã giảm giá</Text>
                  <Text style={styles.emptyVoucherSubtitle}>
                    Thêm mã giảm giá có sẵn vào thanh nhập mã phía trên
                  </Text>
                </View>
              )
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
      {/* MODAL 3: XÁC NHẬN XÓA MÓN / CẢNH BÁO MẤT ƯU ĐÃI           */}
      {/* ======================================================== */}
      <Modal
        visible={itemToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>
              {deleteWillInvalidateOffer ? 'Thông báo' : 'Xóa món'}
            </Text>
            <View style={styles.deleteModalRedLine} />
            <Text style={styles.deleteModalMessage}>
              {deleteWillInvalidateOffer
                ? 'Ưu đãi của bạn sẽ không được áp dụng nếu bạn thay đổi giá trị giỏ hàng. Bạn muốn tiếp tục thao tác này không?'
                : 'Bạn có muốn xóa món này không?'}
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
                <Text style={styles.deleteModalConfirmText}>
                  {deleteWillInvalidateOffer ? 'Tiếp tục' : 'Xác nhận'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: THÔNG BÁO ƯU ĐÃI MIỄN PHÍ GIAO HÀNG KHI THANH TOÁN */}
      {/* ======================================================== */}
      <Modal
        visible={freeShipPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFreeShipPromptVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Ưu đãi miễn phí giao hàng</Text>
            <View style={styles.deleteModalRedLine} />
            <Text style={styles.deleteModalMessage}>
              Đơn hàng từ {formatCurrency(freeOverThreshold)} trở lên sẽ được miễn phí giao hàng. Bạn có muốn chọn thêm món không?
            </Text>

            <View style={styles.deleteModalButtonsRow}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancelBtn]}
                onPress={() => {
                  setFreeShipPromptVisible(false);
                  void continueToCheckout();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalCancelText}>Thanh toán tiếp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalConfirmBtn]}
                onPress={() => {
                  triggerHaptic('light');
                  setFreeShipPromptVisible(false);
                  router.push('/(tabs)/menu');
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.deleteModalConfirmText}>Chấp nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: THÔNG BÁO CHƯA ĐỦ ĐIỀU KIỆN GIAO HÀNG           */}
      {/* ======================================================== */}
      <Modal
        visible={minDeliveryPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMinDeliveryPopupVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Thông báo</Text>
            <View style={styles.deleteModalRedLine} />
            <Text style={styles.deleteModalMessage}>
              Đợi đã! Bạn vui lòng mua thêm{' '}
              {formatCurrency(Math.max(0, minDeliveryOrderAmount - subtotal))} để đủ điều
              kiện giao hàng
            </Text>

            <TouchableOpacity
              style={{
                width: '100%',
                backgroundColor: BRAND_RED,
                borderRadius: 8,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 4,
              }}
              onPress={() => setMinDeliveryPopupVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteModalConfirmText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 6: THÔNG BÁO CỬA HÀNG ĐÓNG CỬA (SAU 22:00 - 08:00)  */}
      {/* ======================================================== */}
      <Modal
        visible={storeClosedPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStoreClosedPopupVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Thông báo</Text>
            <View style={styles.deleteModalRedLine} />
            <Text style={styles.deleteModalMessage}>
              {store.message ||
                'Hiện tại cửa hàng đã đóng cửa (22:00 – 08:00). Vui lòng đặt hàng trong khung giờ hoạt động từ 08:00 đến 22:00.'}
            </Text>

            <TouchableOpacity
              style={{
                width: '100%',
                backgroundColor: BRAND_RED,
                borderRadius: 8,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 4,
              }}
              onPress={() => setStoreClosedPopupVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteModalConfirmText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
