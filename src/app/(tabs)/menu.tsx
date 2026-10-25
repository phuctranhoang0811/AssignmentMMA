import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { Chip } from '../../components/ui/Chip';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductSkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { productService } from '../../services';
import { Product, CategoryId } from '../../types/product';
import { mockCategories } from '../../data/mockCategories';

type SortOption = 'popular' | 'price_asc' | 'price_desc';

export default function MenuScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [sortOption, setSortOption] = useState<SortOption>('popular');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await productService.list({
        categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
        sort: sortOption,
        onlyAvailable,
      });
      setProducts(data);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, sortOption, onlyAvailable]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const clearFilters = () => {
    setSelectedCategory('all');
    setSortOption('popular');
    setOnlyAvailable(false);
  };

  const hasActiveFilters = selectedCategory !== 'all' || sortOption !== 'popular' || onlyAvailable;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <AppText variant="h1">Thực đơn</AppText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/search')}
            style={styles.iconButton}
          >
            <Search size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowFilterModal(!showFilterModal)}
            style={[
              styles.iconButton,
              hasActiveFilters && styles.activeIconButton,
            ]}
          >
            <SlidersHorizontal
              size={20}
              color={hasActiveFilters ? colors.primary : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Options Bar */}
      {showFilterModal && (
        <View style={styles.filterDrawer}>
          <View style={styles.filterDrawerHeader}>
            <AppText variant="captionMedium" color={colors.textSecondary}>
              Sắp xếp & Lọc
            </AppText>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearFilters}>
                <AppText variant="captionMedium" color={colors.primary}>
                  Đặt lại
                </AppText>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterOptionsRow}>
            <Chip
              label="Phổ biến"
              selected={sortOption === 'popular'}
              onPress={() => setSortOption('popular')}
            />
            <Chip
              label="Giá: Thấp → Cao"
              selected={sortOption === 'price_asc'}
              onPress={() => setSortOption('price_asc')}
            />
            <Chip
              label="Giá: Cao → Thấp"
              selected={sortOption === 'price_desc'}
              onPress={() => setSortOption('price_desc')}
            />
          </View>
        </View>
      )}

      {/* Category Pills */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
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
      </View>

      {/* Product List */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonRow}>
            <ProductSkeletonCard style={{ width: '48%' }} />
            <ProductSkeletonCard style={{ width: '48%' }} />
          </View>
          <View style={styles.skeletonRow}>
            <ProductSkeletonCard style={{ width: '48%' }} />
            <ProductSkeletonCard style={{ width: '48%' }} />
          </View>
        </View>
      ) : products.length === 0 ? (
        <EmptyState
          title="Không tìm thấy món phù hợp"
          description="Hãy thử đổi bộ lọc hoặc chọn danh mục khác nhé!"
          actionTitle="Xóa bộ lọc"
          onAction={clearFilters}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} layout="grid" />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconButton: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterDrawer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoriesContainer: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  categoriesList: {
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing['4xl'],
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
  },
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
