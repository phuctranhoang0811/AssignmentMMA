import React, { useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ViewStyle, Animated } from 'react-native';
import { router } from 'expo-router';
import { Plus, Heart } from 'lucide-react-native';
import { Product } from '../../types/product';
import { colors } from '../../theme/colors';
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

  const cardScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 24,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
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
    if (!product.isAvailable) return;

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
        activeOpacity={0.92}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          !product.isAvailable && styles.unavailableCard,
        ]}
      >
        <View style={isGrid ? styles.gridImageWrapper : styles.horizontalImageWrapper}>
          <Image
            source={{ uri: product.image }}
            style={styles.image}
            resizeMode="cover"
          />
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
              style={styles.title}
            >
              {product.name}
            </AppText>

            <AppText
              variant="caption"
              color={colors.textSecondary}
              numberOfLines={2}
              style={styles.description}
            >
              {product.description}
            </AppText>
          </View>

          <View style={styles.footer}>
            <PriceText amount={product.basePrice} size="md" />

            {product.isAvailable ? (
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
              <AppText variant="caption" color={colors.textDisabled}>
                Hết hàng
              </AppText>
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
    opacity: 0.65,
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
});
