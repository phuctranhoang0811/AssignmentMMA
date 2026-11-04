import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Image, Text, TextInput } from 'react-native';
import { Alert } from '../../utils/alert';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Minus } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { formatCurrency } from '../../utils/formatCurrency';
import { getProductVariantOrBasePrice } from '../../utils/calculateTotals';
import { productService } from '../../services';
import { Product, ProductVariant } from '../../types/product';
import {
  PizzaCustomizationState,
  calculateCustomizationExtra,
  PizzaSizeId,
  isCustomizablePizza,
  PIZZA_CRUSTS,
} from '../../types/pizzaCustomization';

import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { hasPromptedMemberDiscount } from '../../utils/sessionFlags';
import { memberDiscountLabel } from '../../utils/memberDiscount';
import { useToast } from '../../state/ToastContext';
import { replaceCartItem } from '../../utils/cartOperations';
import { triggerHaptic } from '../../utils/haptics';
import { styles } from '../../styles/productDetail.styles';

function fitToSize(customization: PizzaCustomizationState, sizeId: PizzaSizeId): PizzaCustomizationState {
  const crust = PIZZA_CRUSTS.find(c => c.id === customization.crustId);
  return { ...customization, sizeId, crustId: crust?.supportedSizes.includes(sizeId) ? customization.crustId : 'classic-hand-tossed' };
}

export default function ProductDetailScreen() {
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId?: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Pizza Customization State (mặc định cỡ Nhỏ + Đế Giòn Xốp chuẩn ảnh 4)
  const [pizzaCustomization, setPizzaCustomization] = useState<PizzaCustomizationState>({
    sizeId: 'small',
    crustId: 'thick-pan',
    sauceId: 'classic-tomato',
    hasExtraSauce: false,
    toppings: [],
    spiceLevel: 'none',
    bakingPreference: 'standard',
    cutPreference: '6-slices',
    removedIngredients: [],
    specialInstructions: '',
  });

  const insets = useSafeAreaInsets();
  const { items, addItem, updateItem } = useCart();
  const { user, isAuthenticated } = useAuth();
  const isMember = Boolean(isAuthenticated && user && !user.isDemo);
  const editingItem = items.find(item => item.lineId === lineId);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    if (id) {
      productService.getById(id).then((p) => {
        if (!active) return;
        setProduct(p);
        setNotFound(!p);
        if (editingItem && p) {
          setSelectedVariant(p.variants?.find(v => v.id === editingItem.variantId) || null);
          setSelectedAddonIds(editingItem.addonIds);
          const existingNote =
            editingItem.specialInstructions ||
            editingItem.customization?.specialInstructions ||
            '';
          setSpecialInstructions(existingNote);
          setQuantity(editingItem.quantity);
          if (editingItem.customization) {
            setPizzaCustomization({
              ...editingItem.customization,
              specialInstructions: existingNote,
            });
          }
          return;
        }
        if (p?.variants && p.variants.length > 0) {
          const smallVar = p.variants.find((v) => v.id === 'small') || p.variants[0];
          setSelectedVariant(smallVar);
        }

        if (p && isCustomizablePizza(p)) {
          const defaultSize = (p.variants?.find((v) => v.id === 'small')?.id ||
            p.variants?.[0]?.id ||
            'small') as PizzaSizeId;
          setPizzaCustomization((prev) => ({
            ...prev,
            sauceId: 'classic-tomato',
            crustId: 'thick-pan',
            sizeId: defaultSize,
          }));
        }
      });
    }
    return () => { active = false; };
  }, [id, lineId, editingItem]);

  if (notFound) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <AppText variant="body" color={colors.textSecondary}>
            Món này không còn trong thực đơn.
          </AppText>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/menu')} accessibilityRole="button" style={{ padding: 16 }}>
            <AppText variant="bodyMedium" color={colors.primary}>Xem thực đơn</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <AppText variant="body" color={colors.textSecondary}>
            Đang tải thông tin món ăn...
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const isPizza = isCustomizablePizza(product);
  const displayVariants = (product.variants || []).map((v) => ({
    ...v,
    price: getProductVariantOrBasePrice(product, v.id, isMember),
  }));

  // Calculate unit price:
  // For Pizza: variantPrice + customizationExtra
  // For other items: (variantPrice || basePrice) + addonsTotal
  const baseOrVariantPrice = getProductVariantOrBasePrice(product, selectedVariant?.id, isMember);
  const addonsTotal = selectedAddonIds.reduce((sum, aId) => {
    const addon = product.addons.find((a) => a.id === aId);
    return sum + (addon ? addon.price : 0);
  }, 0);

  // Price and cart item use the same size-aligned customization, so the shown total matches the cart.
  const fittedCustomization = isPizza && selectedVariant ? fitToSize(pizzaCustomization, selectedVariant.id as PizzaSizeId) : undefined;
  const unitPrice = isPizza
    ? baseOrVariantPrice + calculateCustomizationExtra(fittedCustomization ?? pizzaCustomization)
    : baseOrVariantPrice + addonsTotal;

  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    if (lineId && !editingItem) {
      Alert.alert('Món không còn trong giỏ', 'Vui lòng quay lại giỏ hàng để kiểm tra.');
      return;
    }
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      triggerHaptic('warning');
      Alert.alert('Vui lòng chọn kích cỡ', 'Bạn cần chọn kích cỡ trước khi thêm vào giỏ hàng.');
      return;
    }

    const cleanNote =
      (specialInstructions || pizzaCustomization.specialInstructions || '').trim() || undefined;
    const finalCustomization = fittedCustomization
      ? { ...fittedCustomization, specialInstructions: cleanNote }
      : undefined;

    const item = {
      productId: product.id,
      variantId: selectedVariant?.id,
      addonIds: isPizza ? [] : selectedAddonIds,
      specialInstructions: cleanNote,
      quantity,
      // The backend requires the builder's size to equal the chosen variant and the crust to fit that size.
      ...(finalCustomization ? { customization: finalCustomization } : {}),
    };
    if (lineId) {
      if (replaceCartItem(items, lineId, item) === items) {
        Alert.alert('Vượt giới hạn số lượng', 'Cấu hình này đã có trong giỏ. Tổng số lượng tối đa là 20 phần.');
        return;
      }
      updateItem(lineId, item);
    } else addItem(item);

    triggerHaptic('success');
    showToast({
      message: lineId ? 'Đã lưu thay đổi món' : `Đã thêm ${quantity}x ${product.name} vào giỏ hàng`,
      actionText: 'Xem giỏ',
      onAction: () => router.navigate('/(tabs)/cart'),
    });
    if (lineId) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/cart');
    } else {
      const isMemberDiscount =
        product.categoryId === 'cheese_party' ||
        product.categoryId === 'member_deals' ||
        product.categoryId === 'hot_deals' ||
        (product.promoGroups || []).some((g) =>
          ['cheese_party', 'member_deals', 'hot_deals'].includes(g)
        ) ||
        !!memberDiscountLabel(product) ||
        (!!product.originalPrice && product.originalPrice > product.basePrice);

      const shouldPrompt = !isMember && isMemberDiscount && !hasPromptedMemberDiscount();

      router.replace({
        pathname: '/(tabs)/menu',
        params: shouldPrompt ? { promptMemberDiscount: '1' } : undefined,
      });
    }
  };

  // Giao diện Chi tiết chuẩn mẫu Pizza Hut cho cả Món lẻ (Khai vị/Nước) và Pizza (chọn Kích thước + Đế viền)
  const orderedPizzaVariants = (() => {
    const order = ['medium', 'large', 'small'];
    const byId = new Map(displayVariants.map((v) => [v.id, v]));
    if (order.every((id) => byId.has(id))) {
      return order.map((id) => byId.get(id)!);
    }
    return displayVariants;
  })();

  const getShortSizeLabel = (v?: ProductVariant | null) => {
    if (!v) return 'Nhỏ';
    const lower = `${v.id} ${v.name}`.toLowerCase();
    if (lower.includes('medium') || lower.includes('vừa') || lower.includes('9"')) return 'Vừa';
    if (lower.includes('large') || lower.includes('lớn') || lower.includes('12"')) return 'Lớn';
    return 'Nhỏ';
  };

  const selectedSizeShort = getShortSizeLabel(selectedVariant);
  const pizzaCrustOptions = PIZZA_CRUSTS.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
      {/* Header: <  Chi tiết */}
      <View
        style={{
          height: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          backgroundColor: '#FFFFFF',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' }}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ChevronLeft size={26} color="#111827" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Chi tiết</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hình ảnh sản phẩm ở trên cùng trên nền trắng */}
        <View
          style={{
            width: '100%',
            height: 180,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            paddingVertical: isPizza ? 4 : 8,
          }}
        >
          <Image
            source={{ uri: product.image }}
            style={{
              width: isPizza ? '88%' : product.categoryId === 'starters' ? 230 : 175,
              height: 168,
              backgroundColor: '#FFFFFF',
            }}
            resizeMode="contain"
          />
        </View>

        {/* Tên món + Mô tả + Nhãn New / Cay */}
        <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
            {product.name}
          </Text>
          <Text style={{ fontSize: 14.5, color: '#374151', marginTop: 4, lineHeight: 21 }}>
            {product.description || product.name}
          </Text>
          {(product.isNew || product.isSpicy) && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
              }}
            >
              {product.isNew && (
                <View
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    New
                  </Text>
                </View>
              )}
              {product.isSpicy && <Text style={{ fontSize: 15 }}>🌶️</Text>}
            </View>
          )}
        </View>

        {/* Khu vực chọn Kích thước + Đế viền cho Pizza (chuẩn Ảnh 4) */}
        {displayVariants.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
            <Text
              style={{
                fontSize: 15.5,
                fontWeight: '700',
                color: '#111827',
                marginBottom: 10,
              }}
            >
              Kích thước
            </Text>

            <View
              style={{
                flexDirection: 'row',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 8,
                overflow: 'hidden',
                marginBottom: isPizza ? 20 : 4,
              }}
            >
              {orderedPizzaVariants.map((v, idx) => {
                const isSelected = selectedVariant?.id === v.id;
                const label = getShortSizeLabel(v);
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedVariant(v);
                      if (isPizza) {
                        setPizzaCustomization((prev) =>
                          fitToSize(prev, v.id as PizzaSizeId)
                        );
                      }
                    }}
                    style={{
                      flex: 1,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? colors.primary : '#FFFFFF',
                      borderLeftWidth: idx > 0 ? 1 : 0,
                      borderLeftColor: '#E5E7EB',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSelected ? '700' : '600',
                        color: isSelected ? '#FFFFFF' : '#111827',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isPizza && (
              <View>
                <Text
                  style={{
                    fontSize: 15.5,
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: 6,
                  }}
                >
                  Đế viền
                </Text>

                {pizzaCrustOptions.map((crust) => {
                  const isSelected = pizzaCustomization.crustId === crust.id;
                  const crustPrice = baseOrVariantPrice + crust.price;
                  return (
                    <TouchableOpacity
                      key={crust.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        triggerHaptic('light');
                        setPizzaCustomization((prev) => ({
                          ...prev,
                          crustId: crust.id,
                        }));
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 13,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: isSelected ? colors.primary : '#E5E7EB',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          {isSelected && (
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: colors.primary,
                              }}
                            />
                          )}
                        </View>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: '#111827',
                          }}
                        >
                          {crust.name}({selectedSizeShort})
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '500',
                          color: '#111827',
                        }}
                      >
                        {formatCurrency(crustPrice)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Đường kẻ phân cách */}
        <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />

        {/* Ô Ghi chú (không bắt buộc) 0/72 */}
        <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 15, color: '#111827' }}>
              <Text style={{ fontWeight: '700' }}>Ghi chú</Text> (không bắt buộc)
            </Text>
            <Text style={{ fontSize: 13.5, color: '#6B7280' }}>
              {specialInstructions.length}/72
            </Text>
          </View>

          <TextInput
            value={specialInstructions}
            onChangeText={(text) => {
              if (text.length <= 72) {
                setSpecialInstructions(text);
                setPizzaCustomization((prev) => ({
                  ...prev,
                  specialInstructions: text,
                }));
              }
            }}
            maxLength={72}
            placeholder="Chúng tôi sẽ làm hết sức để phục vụ bạn!"
            placeholderTextColor="#6B7280"
            style={{
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 14,
              fontSize: 14.5,
              color: '#111827',
              backgroundColor: '#FFFFFF',
            }}
          />
        </View>
      </ScrollView>

      {/* Thanh dưới đáy: [-] 1 [+] và Nút đỏ Thêm vào giỏ hàng • Giá */}
      <View
        style={{
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 14),
          backgroundColor: '#FFFFFF',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={quantity <= 1}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={{
              width: 42,
              height: 38,
              borderRadius: 8,
              backgroundColor: quantity <= 1 ? '#E5E7EB' : '#FFFFFF',
              borderWidth: quantity <= 1 ? 0 : 1,
              borderColor: '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Minus size={18} color={colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#111827',
              minWidth: 28,
              textAlign: 'center',
            }}
          >
            {quantity}
          </Text>

          <TouchableOpacity
            activeOpacity={0.75}
            disabled={quantity >= 20}
            onPress={() => setQuantity((q) => Math.min(20, q + 1))}
            style={{
              width: 42,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!product.isAvailable}
          onPress={handleAddToCart}
          style={{
            backgroundColor: product.isAvailable ? colors.primary : '#9CA3AF',
            height: 48,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            {lineId ? 'Lưu thay đổi' : 'Thêm vào giỏ hàng'}
          </Text>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
            }}
          />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            {formatCurrency(totalPrice)}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
