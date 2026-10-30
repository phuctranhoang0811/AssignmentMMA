import React, { useState, useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { ProductCard } from '../components/product/ProductCard';
import { EmptyState } from '../components/ui/EmptyState';
import { useFavorites } from '../state/FavoritesContext';
import { useCatalog } from '../services/catalog';
import { styles } from '../styles/favorites.styles';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { favoriteIds } = useFavorites();

  const { products } = useCatalog();
  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));

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
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
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
