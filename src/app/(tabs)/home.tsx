import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MapPin, Search, Tag, Flame, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { Chip } from '../../components/ui/Chip';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductSkeletonCard } from '../../components/ui/SkeletonCard';
import { productService } from '../../services';
import { Product, CategoryId } from '../../types/product';
import { mockCategories } from '../../data/mockCategories';

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (cat: CategoryId = selectedCategory) => {
    try {
      const list = await productService.list({
        categoryId: cat === 'all' ? undefined : cat,
      });
      setProducts(list);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(selectedCategory);
  }, [selectedCategory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(selectedCategory);
  };

  const bestSellers = products.filter((p) => p.isPopular || p.tags?.includes('Bestseller'));
  const recommended = products;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <Flame size={24} color={colors.primary} />
              <AppText variant="h2" color={colors.primary} style={styles.brandTitle}>
                Pizza Time
              </AppText>
            </View>
            <View style={styles.locationRow}>
              <MapPin size={14} color={colors.textSecondary} />
              <AppText variant="caption" color={colors.textSecondary} style={styles.locationText}>
                Giao đến • Quận 1, TP. Hồ Chí Minh
              </AppText>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/offers')}
            style={styles.promoIconButton}
          >
            <Tag size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar Trigger */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/search')}
          style={styles.searchBar}
        >
          <Search size={18} color={colors.textDisabled} />
          <AppText variant="body" color={colors.textDisabled} style={styles.searchPlaceholder}>
            Bạn muốn ăn gì hôm nay? (Pizza, Mì Ý, Sushi...)
          </AppText>
        </TouchableOpacity>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
            }}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Sparkles size={14} color={colors.white} />
              <AppText variant="captionMedium" color={colors.white} style={styles.heroBadgeText}>
                Tươi ngon mỗi ngày
              </AppText>
            </View>
            <AppText variant="h2" color={colors.white} style={styles.heroTitle}>
              Pizza nướng củi{'\n'}Nóng giòn tận nơi
            </AppText>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/menu')}
              style={styles.heroCta}
            >
              <AppText variant="button" color={colors.primary}>
                Đặt ngay
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Horizontal Chips */}
        <View style={styles.sectionHeader}>
          <AppText variant="h3">Danh mục món</AppText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {mockCategories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              selected={selectedCategory === cat.id}
              onPress={() => setSelectedCategory(cat.id)}
            />
          ))}
        </ScrollView>

        {/* Best Sellers */}
        <View style={styles.sectionHeader}>
          <AppText variant="h3">Món bán chạy nhất</AppText>
          <TouchableOpacity onPress={() => router.push('/(tabs)/menu')}>
            <AppText variant="captionMedium" color={colors.primary}>
              Xem tất cả
            </AppText>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.skeletonRow}>
            <ProductSkeletonCard style={{ width: 220, marginRight: spacing.md }} />
            <ProductSkeletonCard style={{ width: 220 }} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {bestSellers.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                layout="horizontal"
              />
            ))}
          </ScrollView>
        )}

        {/* Promo Banner Strip */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/offers')}
          style={styles.offerBannerStrip}
        >
          <View style={styles.offerLeft}>
            <Tag size={24} color={colors.primary} />
            <View style={styles.offerTextCol}>
              <AppText variant="bodyMedium" color={colors.primary}>
                Ưu đãi giảm 20% đơn từ 200k
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Mã: PIZZA20 • Nhấn để nhận voucher
              </AppText>
            </View>
          </View>
          <View style={styles.offerTag}>
            <AppText variant="captionMedium" color={colors.white}>
              DÙNG NGAY
            </AppText>
          </View>
        </TouchableOpacity>

        {/* Recommended For You */}
        <View style={styles.sectionHeader}>
          <AppText variant="h3">Gợi ý cho bạn</AppText>
        </View>

        {isLoading ? (
          <View style={styles.grid}>
            <ProductSkeletonCard style={{ width: '48%' }} />
            <ProductSkeletonCard style={{ width: '48%' }} />
          </View>
        ) : (
          <View style={styles.grid}>
            {recommended.map((product) => (
              <View key={product.id} style={styles.gridItem}>
                <ProductCard product={product} layout="grid" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    marginLeft: spacing.xs,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    marginLeft: 4,
  },
  promoIconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.base,
    height: 46,
    marginBottom: spacing.base,
  },
  searchPlaceholder: {
    marginLeft: spacing.sm,
  },
  heroBanner: {
    marginHorizontal: spacing.lg,
    height: 180,
    borderRadius: radius.card,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.xl,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23, 23, 23, 0.45)',
  },
  heroContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 74, 48, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroBadgeText: {
    marginLeft: 4,
  },
  heroTitle: {
    marginTop: 4,
  },
  heroCta: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  categoriesScroll: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  horizontalScroll: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    marginBottom: spacing.xl,
  },
  skeletonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  offerBannerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#FBDCD3',
    marginHorizontal: spacing.lg,
    padding: spacing.base,
    borderRadius: radius.card,
    marginBottom: spacing.xl,
  },
  offerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offerTextCol: {
    marginLeft: spacing.md,
  },
  offerTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  gridItem: {
    width: '48%',
  },
});
