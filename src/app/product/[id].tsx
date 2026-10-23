import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, CheckCircle2 } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppInput } from '../../components/ui/AppInput';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { VariantSelector } from '../../components/product/VariantSelector';
import { AddonSelector } from '../../components/product/AddonSelector';
import { productService } from '../../services';
import { Product, ProductVariant } from '../../types/product';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);
  // toast removed

  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (id) {
      productService.getById(id).then((p) => {
        setProduct(p);
        if (p?.variants && p.variants.length > 0) {
          // Pre-select first variant as default
          setSelectedVariant(p.variants[0]);
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

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((i) => i !== addonId) : [...prev, addonId]
    );
  };

  // Calculate unit price = (variantPrice || basePrice) + addons
  const baseOrVariantPrice = selectedVariant ? selectedVariant.price : product.basePrice;
  const addonsTotal = selectedAddonIds.reduce((sum, aId) => {
    const addon = product.addons.find((a) => a.id === aId);
    return sum + (addon ? addon.price : 0);
  }, 0);
  const unitPrice = baseOrVariantPrice + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!product.isAvailable) return;

    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      Alert.alert('Vui lòng chọn kích cỡ', 'Bạn cần chọn kích cỡ trước khi thêm vào giỏ hàng.');
      return;
    }

    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      addonIds: selectedAddonIds,
      specialInstructions: specialInstructions.trim() || undefined,
      quantity,
    });

    // Directly navigate back to previous screen (menu/home)
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/menu');
    }
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
              onPress={() => toggleFavorite(product.id)}
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
                Thành phần chính:
              </AppText>
              <AppText variant="caption" color={colors.textPrimary} style={styles.ingredientsText}>
                {product.ingredients.join(' • ')}
              </AppText>
            </View>
          )}

          {/* Size Variant Selector */}
          {product.variants && product.variants.length > 0 && (
            <VariantSelector
              variants={product.variants}
              selectedId={selectedVariant?.id}
              onSelect={setSelectedVariant}
            />
          )}

          {/* Add-ons Selector */}
          {product.addons && product.addons.length > 0 && (
            <AddonSelector
              addons={product.addons}
              selectedIds={selectedAddonIds}
              onToggle={handleToggleAddon}
            />
          )}

          {/* Special Instructions Note */}
          <View style={styles.noteContainer}>
            <AppText variant="h3" style={styles.noteTitle}>
              Ghi chú cho bếp
            </AppText>
            <AppInput
              placeholder="Ví dụ: Ít cay, không lấy hành tây, tương ớt riêng..."
              value={specialInstructions}
              onChangeText={(text) => {
                if (text.length <= 200) {
                  setSpecialInstructions(text);
                }
              }}
              multiline
              numberOfLines={2}
              helperText={`${specialInstructions.length}/200 ký tự`}
            />
          </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: spacing['4xl'],
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.surfaceAlt,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -20,
  },
  title: {
    marginBottom: spacing.xs,
  },
  description: {
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  ingredientsBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  ingredientsText: {
    marginTop: 2,
  },
  noteContainer: {
    marginTop: spacing.md,
  },
  noteTitle: {
    marginBottom: spacing.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  toast: {
    position: 'absolute',
    bottom: 95,
    alignSelf: 'center',
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  toastText: {
    marginLeft: spacing.xs,
  },
});
