import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Alert } from '../../utils/alert';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { AppInput } from '../../components/ui/AppInput';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { VariantSelector } from '../../components/product/VariantSelector';
import { AddonSelector } from '../../components/product/AddonSelector';
import { PizzaCustomizer } from '../../components/product/pizza/PizzaCustomizer';
import { ProductImage } from '../../components/product/ProductImage';
import { ProductCard } from '../../components/product/ProductCard';
import { formatCurrency } from '../../utils/formatCurrency';
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
import { useFavorites } from '../../state/FavoritesContext';
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
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Pizza Customization State
  const [pizzaCustomization, setPizzaCustomization] = useState<PizzaCustomizationState>({
    sizeId: 'small',
    crustId: 'classic-hand-tossed',
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
  const editingItem = items.find(item => item.lineId === lineId);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    if (id) {
      productService.getById(id).then((p) => {
        if (!active) return;
        setProduct(p);
        setNotFound(!p);
        if (p) {
          productService.list({ categoryId: p.categoryId, onlyAvailable: true })
            .then(list => { if (active) setRelated(list.filter(x => x.id !== p.id).slice(0, 6)); })
            .catch(() => {});
        }
        if (editingItem && p) {
          setSelectedVariant(p.variants?.find(v => v.id === editingItem.variantId) || null);
          setSelectedAddonIds(editingItem.addonIds);
          setSpecialInstructions(editingItem.specialInstructions || '');
          setQuantity(editingItem.quantity);
          if (editingItem.customization) setPizzaCustomization(editingItem.customization);
          return;
        }
        if (p?.variants && p.variants.length > 0) {
          // Pre-select first variant as default
          setSelectedVariant(p.variants[0]);
        }

        // Set initial default sauce based on pizza recipe if applicable
        if (p && isCustomizablePizza(p)) {
          let defaultSauceId = 'classic-tomato';
          const lowerName = p.name.toLowerCase();
          if (lowerName.includes('bbq')) {
            defaultSauceId = 'smoky-bbq';
          } else if (lowerName.includes('carbonara') || lowerName.includes('white') || lowerName.includes('hải sản')) {
            defaultSauceId = 'creamy-white';
          } else if (lowerName.includes('pesto')) {
            defaultSauceId = 'basil-pesto';
          }

          setPizzaCustomization((prev) => ({
            ...prev,
            sauceId: defaultSauceId,
            sizeId: (p.variants?.[0]?.id as PizzaSizeId) || 'small',
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

  const favorited = isFavorite(product.id);
  const isPizza = isCustomizablePizza(product);
  // Display-only facts already present in the menu data.
  const fromPrice = product.variants?.length ? Math.min(...product.variants.map(v => v.price)) : product.basePrice;
  // 'Popular' is the English tag for the same thing as isPopular; Set drops exact duplicates such as 'Mới'.
  const badges = [...new Set([
    ...(product.isNew ? ['Mới'] : []),
    ...(product.isSpicy ? ['🌶 Cay'] : []),
    ...(product.isPopular ? ['Phổ biến'] : []),
    ...(product.tags ?? []).filter(tag => !(tag === 'Popular' && product.isPopular)),
  ])];

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((i) => i !== addonId) : [...prev, addonId]
    );
  };

  // Calculate unit price:
  // For Pizza: variantPrice + customizationExtra
  // For other items: (variantPrice || basePrice) + addonsTotal
  const baseOrVariantPrice = selectedVariant ? selectedVariant.price : product.basePrice;
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

    const item = {
      productId: product.id,
      variantId: selectedVariant?.id,
      addonIds: isPizza ? [] : selectedAddonIds,
      specialInstructions: (isPizza ? pizzaCustomization.specialInstructions : specialInstructions)?.trim() || undefined,
      quantity,
      // The backend requires the builder's size to equal the chosen variant and the crust to fit that size.
      ...(fittedCustomization ? { customization: fittedCustomization } : {}),
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
    }
  };

  const handleToggleFavorite = () => {
    triggerHaptic('medium');
    toggleFavorite(product.id);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Image Section */}
        <View style={styles.imageContainer}>
          <ProductImage uri={product.image} style={styles.heroImage} iconSize={64} />

          {/* Floating Navigation Controls */}
          <SafeAreaView style={styles.floatingNav} edges={['top']}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.circleButton}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
            >
              <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleFavorite}
              style={styles.circleButton}
              accessibilityRole="button"
              accessibilityLabel={favorited ? 'Bỏ yêu thích' : 'Yêu thích'}
              accessibilityState={{ selected: favorited }}
            >
              <Heart
                size={22}
                color={favorited ? colors.primary : colors.textPrimary}
                fill={favorited ? colors.primary : 'transparent'}
              />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Content Details */}
        <View style={styles.bodyContent}>
          <AppText variant="h1" style={styles.title}>
            {product.name}
          </AppText>

          {badges.length > 0 && (
            <View style={styles.badgeRow}>
              {badges.map(tag => (
                <View key={tag} style={styles.badgeChip}>
                  <AppText variant="captionMedium" color={colors.primary}>{tag}</AppText>
                </View>
              ))}
            </View>
          )}

          <View style={styles.priceRow} accessibilityLabel={`Giá chỉ từ ${formatCurrency(fromPrice)}`}>
            <AppText variant="caption" color={colors.textSecondary}>{product.variants?.length > 1 ? 'Chỉ từ' : 'Giá'}</AppText>
            <AppText variant="h2" color={colors.primary} style={styles.priceValue}>{formatCurrency(fromPrice)}</AppText>
            {!!product.originalPrice && product.originalPrice > fromPrice && (
              <AppText variant="body" color={colors.textSecondary} style={styles.originalPrice}>
                {formatCurrency(product.originalPrice)}
              </AppText>
            )}
            {!!product.discountPercent && (
              <View style={styles.discountChip}>
                <AppText variant="captionMedium" color={colors.white}>-{product.discountPercent}%</AppText>
              </View>
            )}
          </View>
          {!!product.memberDiscountTag && (
            <AppText variant="captionMedium" color={colors.success} style={styles.memberNote}>
              🎁 {product.memberDiscountTag}
            </AppText>
          )}

          {!product.isAvailable && (
            <View style={styles.soldOutBox} accessibilityLiveRegion="polite">
              <AppText variant="bodyMedium" color={colors.warning}>Món này tạm hết. Bạn có thể chọn món khác bên dưới.</AppText>
            </View>
          )}

          <AppText variant="body" color={colors.textSecondary} style={styles.description}>
            {product.description}
          </AppText>

          {product.ingredients && product.ingredients.length > 0 && (
            <View style={styles.ingredientsBox}>
              <AppText variant="captionMedium" color={colors.textSecondary}>
                Thành phần công thức chuẩn:
              </AppText>
              <AppText variant="caption" color={colors.textPrimary} style={styles.ingredientsText}>
                {product.ingredients.join(' • ')}
              </AppText>
            </View>
          )}

          {/* PIZZA CUSTOMIZATION (5 GROUPS) FOR PIZZA ITEMS */}
          {isPizza && product.variants && product.variants.length > 0 ? (
            <PizzaCustomizer
              variants={product.variants}
              selectedVariant={selectedVariant}
              onSelectVariant={setSelectedVariant}
              customization={pizzaCustomization}
              onChangeCustomization={setPizzaCustomization}
              ingredients={product.ingredients}
            />
          ) : (
            <>
              {/* Standard Size Variant Selector for other items */}
              {product.variants && product.variants.length > 0 && (
                <VariantSelector
                  variants={product.variants}
                  selectedId={selectedVariant?.id}
                  onSelect={setSelectedVariant}
                />
              )}

              {/* Standard Add-ons Selector */}
              {product.addons && product.addons.length > 0 && (
                <AddonSelector
                  addons={product.addons}
                  selectedIds={selectedAddonIds}
                  onToggle={handleToggleAddon}
                />
              )}

              {/* Standard Special Instructions Note */}
              <View style={styles.noteContainer}>
                <AppText variant="h3" style={styles.noteTitle}>
                  Ghi chú cho bếp
                </AppText>
                <AppInput
                  placeholder="Ví dụ: Ít đá, không đường, tương ớt riêng..."
                  value={specialInstructions}
                  onChangeText={(text) => {
                    if (text.length <= 150) {
                      setSpecialInstructions(text);
                    }
                  }}
                  multiline
                  numberOfLines={2}
                  helperText={`${specialInstructions.length}/150 ký tự`}
                />
              </View>
            </>
          )}

          {/* Quantity Stepper */}
          <View style={styles.quantityRow}>
            <View>
              <AppText variant="bodyMedium">Số lượng</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Tối đa 20 phần mỗi lượt
              </AppText>
            </View>
            <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={20} />
          </View>
        </View>

        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <AppText variant="h3" style={styles.relatedTitle}>Món cùng loại</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
              {related.map(item => (
                <ProductCard key={item.id} product={item} layout="horizontal" style={styles.relatedCard} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* The hero runs under the status bar; once scrolled, keep the clock/battery off the text. */}
      <View pointerEvents="none" style={[styles.statusBarBackdrop, { height: insets.top }]} />

      <BottomActionBar
        title={lineId ? "Lưu thay đổi" : "Thêm vào giỏ"}
        price={totalPrice}
        priceLabel="Tổng cộng"
        onPress={handleAddToCart}
        disabled={!product.isAvailable}
      />
    </View>
  );
}
