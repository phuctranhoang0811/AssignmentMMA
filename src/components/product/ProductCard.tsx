import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle, Animated } from 'react-native';
import { router } from 'expo-router';
import { Plus, Heart } from 'lucide-react-native';
import { Product } from '../../types/product';
import { colors } from '../../theme/colors';
import { ProductImage } from './ProductImage';
import { spacing, radius, shadows } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { PriceText } from '../ui/PriceText';
import { useFavorites } from '../../state/FavoritesContext';
import { useCart } from '../../state/CartContext';
import { useToast } from '../../state/ToastContext';
import { triggerHaptic } from '../../utils/haptics';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'horizontal';
  style?: ViewStyle;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  layout = 'grid',
  style,
}) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const favorited = isFavorite(product.id);
  const isSoldOut = product.isAvailable === false;

  const cardScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isSoldOut) return;
    Animated.spring(cardScale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 24,
    }).start();
  };

  const handlePressOut = () => {
    if (isSoldOut) return;
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (isSoldOut) return;
    router.push({
      pathname: '/product/[id]',
      params: { id: product.id },
    });
  };

  const handleFavoritePress = (e: any) => {
    e.stopPropagation?.();
    triggerHaptic('medium');
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.35,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
    toggleFavorite(product.id);
  };

  const handleAddPress = (e: any) => {
    e.stopPropagation?.();
    if (isSoldOut) return;

    if (product.variants && product.variants.length > 0) {
      handlePress();
      return;
    }

    addItem({
      productId: product.id,
      addonIds: [],
      quantity: 1,
    });
    triggerHaptic('success');
    showToast({
      message: `Đã thêm ${product.name} vào giỏ hàng`,
      actionText: 'Xem giỏ',
      onAction: () => router.push('/(tabs)/cart'),
    });
  };

  const isGrid = layout === 'grid';

  return (
    <Animated.View
      style={[
        { transform: [{ scale: cardScale }] },
        isGrid ? styles.gridCard : styles.horizontalCard,
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={isSoldOut ? 1 : 0.92}
        disabled={isSoldOut}
        onPress={handlePress}
        onPressIn={isSoldOut ? undefined : handlePressIn}
        onPressOut={isSoldOut ? undefined : handlePressOut}
        style={[
          styles.card,
          isSoldOut && styles.unavailableCard,
        ]}
      >
        <View style={isGrid ? styles.gridImageWrapper : styles.horizontalImageWrapper}>
          <ProductImage uri={product.image} style={styles.image} iconSize={32} />
          {isSoldOut && (
            <View style={styles.soldOutOverlay}>
              <View style={styles.soldOutBadge}>
                <AppText variant="captionMedium" color={colors.white} style={styles.soldOutBadgeText}>
                  HẾT MÓN
                </AppText>
              </View>
            </View>
          )}
          {product.tags && product.tags.length > 0 && (
            <View style={styles.badge}>
              <AppText variant="captionMedium" color={colors.white}>
                {product.tags[0]}
              </AppText>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleFavoritePress}
            style={styles.favoriteButton}
            accessibilityRole="button"
            accessibilityLabel={favorited ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}
            accessibilityState={{ selected: favorited }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart
                size={16}
                color={favorited ? colors.primary : colors.textSecondary}
                fill={favorited ? colors.primary : 'transparent'}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.infoArea}>
            <AppText
              variant="cardTitle"
              numberOfLines={1}
              style={[styles.title, isSoldOut && { color: colors.textDisabled }]}
            >
              {product.name}
            </AppText>

            <AppText
              variant="caption"
              color={isSoldOut ? colors.textDisabled : colors.textSecondary}
              numberOfLines={2}
              style={styles.description}
            >
              {product.description}
            </AppText>
          </View>

          <View style={styles.footer}>
            <PriceText amount={product.basePrice} size="md" />

            {!isSoldOut ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleAddPress}
                style={styles.addButton}
                accessibilityRole="button"
                accessibilityLabel={`Thêm ${product.name} vào giỏ`}
              >
                <Plus size={18} color={colors.white} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.addButton, { backgroundColor: '#D1D5DB' }]}>
                <Plus size={18} color={colors.white} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
    width: '100%',
  },
  gridCard: {
    width: '100%',
    marginBottom: spacing.base,
  },
  horizontalCard: {
    width: 220,
    marginRight: spacing.md,
  },
  unavailableCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  gridImageWrapper: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  horizontalImageWrapper: {
    width: '100%',
    height: 125,
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  infoArea: {
    minHeight: 62,
  },
  title: {
    marginBottom: 4,
  },
  description: {
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutBadge: {
    backgroundColor: 'rgba(31, 41, 55, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  soldOutBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
