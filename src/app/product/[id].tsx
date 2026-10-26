import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { AppInput } from '../../components/ui/AppInput';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { VariantSelector } from '../../components/product/VariantSelector';
import { AddonSelector } from '../../components/product/AddonSelector';
import { PizzaCustomizer } from '../../components/product/pizza/PizzaCustomizer';
import { productService } from '../../services';
import { Product, ProductVariant } from '../../types/product';
import {
  PizzaCustomizationState,
  calculateCustomizationExtra,
  PizzaSizeId,
} from '../../types/pizzaCustomization';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { useToast } from '../../state/ToastContext';
import { triggerHaptic } from '../../utils/haptics';
import { styles } from '../../styles/productDetail.styles';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
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

  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  useEffect(() => {
    if (id) {
      productService.getById(id).then((p) => {
        setProduct(p);
        if (p?.variants && p.variants.length > 0) {
          // Pre-select first variant as default
          setSelectedVariant(p.variants[0]);
        }

        // Set initial default sauce based on pizza recipe if applicable
        if (p?.categoryId === 'pizza') {
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
  }, [id]);

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
  const isPizza = product.categoryId === 'pizza';

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

  const unitPrice = isPizza
    ? baseOrVariantPrice + calculateCustomizationExtra(pizzaCustomization)
    : baseOrVariantPrice + addonsTotal;

  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!product.isAvailable) return;

    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      triggerHaptic('warning');
      Alert.alert('Vui lòng chọn kích cỡ', 'Bạn cần chọn kích cỡ trước khi thêm vào giỏ hàng.');
      return;
    }

    if (isPizza) {
      addItem({
        productId: product.id,
        variantId: selectedVariant?.id,
        addonIds: [],
        specialInstructions: pizzaCustomization.specialInstructions?.trim() || undefined,
        quantity,
        customization: pizzaCustomization,
      });
    } else {
      addItem({
        productId: product.id,
        variantId: selectedVariant?.id,
        addonIds: selectedAddonIds,
        specialInstructions: specialInstructions.trim() || undefined,
        quantity,
      });
    }

    triggerHaptic('success');
    showToast({
      message: `Đã thêm ${quantity}x ${product.name} vào giỏ hàng`,
      actionText: 'Xem giỏ',
      onAction: () => router.push('/(tabs)/cart'),
    });

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/menu');
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
          <Image source={{ uri: product.image }} style={styles.heroImage} resizeMode="cover" />

          {/* Floating Navigation Controls */}
          <SafeAreaView style={styles.floatingNav} edges={['top']}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.circleButton}
            >
              <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleFavorite}
              style={styles.circleButton}
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
      </ScrollView>

      <BottomActionBar
        title="Thêm vào giỏ"
        price={totalPrice}
        priceLabel="Tổng cộng"
        onPress={handleAddToCart}
        disabled={!product.isAvailable}
      />
    </View>
  );
}
