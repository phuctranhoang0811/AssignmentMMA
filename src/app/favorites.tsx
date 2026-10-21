import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { ProductCard } from '../components/product/ProductCard';
import { EmptyState } from '../components/ui/EmptyState';
import { useFavorites } from '../state/FavoritesContext';
import { mockProducts } from '../data/mockProducts';

export default function FavoritesScreen() {
  const { favoriteIds } = useFavorites();

  const favoriteProducts = mockProducts.filter((p) => favoriteIds.includes(p.id));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Món ăn yêu thích" showBack />

      {favoriteProducts.length === 0 ? (
        <EmptyState
          icon={<Heart size={48} color={colors.primary} />}
          title="Chưa có món yêu thích nào"
          description="Hãy nhấn biểu tượng trái tim ở các món ăn ngon để lưu lại vào đây nhé!"
          actionTitle="Khám phá thực đơn"
          onAction={() => router.push('/(tabs)/menu')}
          style={{ flex: 1 }}
        />
      ) : (
        <FlatList
          data={favoriteProducts}
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
  },
});
