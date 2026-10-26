import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search as SearchIcon, ArrowLeft, X, Clock, Flame } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { AppText } from '../components/ui/AppText';
import { styles } from '../styles/search.styles';
import { Chip } from '../components/ui/Chip';
import { ProductCard } from '../components/product/ProductCard';
import { EmptyState } from '../components/ui/EmptyState';
import { productService } from '../services';
import { Product } from '../types/product';

const popularKeywords = ['Margherita', 'Pepperoni', 'Mì Ý bò bằm', 'Sushi cá hồi', 'Trà đào', 'Phô mai'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Pizza phô mai',
    'Spaghetti Carbonara',
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setHasSearched(true);
        productService.list({ query: query.trim() }).then(setResults);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectKeyword = (keyword: string) => {
    setQuery(keyword);
    if (!recentSearches.includes(keyword)) {
      setRecentSearches((prev) => [keyword, ...prev.slice(0, 4)]);
    }
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header Search Bar */}
      <View style={styles.searchHeader}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.searchInputContainer}>
          <SearchIcon size={18} color={colors.textDisabled} style={styles.searchIcon} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên món, nguyên liệu..."
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} style={styles.clearButton}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* When no query is entered */}
      {!hasSearched && query.length === 0 ? (
        <View style={styles.suggestionsContainer}>
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Clock size={16} color={colors.textSecondary} />
                <AppText variant="captionMedium" color={colors.textSecondary} style={styles.sectionTitle}>
                  Tìm kiếm gần đây
                </AppText>
              </View>
              <View style={styles.chipsRow}>
                {recentSearches.map((item, idx) => (
                  <Chip
                    key={idx}
                    label={item}
                    onPress={() => handleSelectKeyword(item)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Flame size={16} color={colors.primary} />
              <AppText variant="captionMedium" color={colors.textSecondary} style={styles.sectionTitle}>
                Từ khóa phổ biến
              </AppText>
            </View>
            <View style={styles.chipsRow}>
              {popularKeywords.map((item, idx) => (
                <Chip
                  key={idx}
                  label={item}
                  onPress={() => handleSelectKeyword(item)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          title="Chưa tìm thấy món bạn muốn"
          description={`Không có kết quả nào cho "${query}". Hãy thử gõ từ khóa khác nhé!`}
          actionTitle="Xóa tìm kiếm"
          onAction={clearQuery}
        />
      ) : (
        <FlatList
          data={results}
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

