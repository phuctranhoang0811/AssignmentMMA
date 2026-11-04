import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  Sparkles,
  X,
  Plus,
  Trash2,
} from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../state/ToastContext';
import { productService } from '../../services';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminProducts.styles';
import { Product } from '../../types/product';
import { formatCurrency } from '../../utils/formatCurrency';
import { Alert } from '../../utils/alert';
import { triggerHaptic } from '../../utils/haptics';
import { reportAdminAction } from '../../services/orderApi';
import {
  isProductDiscounted,
  sortPopularProducts,
  ensureDefaultPopularRecommendations,
} from '../../utils/popularRecommendations';

const CATEGORY_TABS = [
  { id: 'all', name: 'Tất cả' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'starters', name: 'Khai vị' },
  { id: 'drinks', name: 'Thức uống' },
] as const;

const CAT_LABELS: Record<string, string> = {
  pizza: 'PIZZA NGUYÊN GIÁ',
  starters: 'KHAI VỊ',
  drinks: 'THỨC UỐNG',
};

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

export default function AdminRecommendationsScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Modal thêm món vào "Bạn sẽ thích"
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Lắng nghe 100% dữ liệu thật từ Firestore 'products' (không dùng mockProducts)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const list: (Product & { sortOrder?: number })[] = [];
        snapshot.forEach((d) => {
          if (d.id.startsWith('__')) return;
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || 'Món ăn',
            categoryId: data.categoryId || data.category || 'pizza',
            description: data.description || '',
            image: data.image || data.imageUrl || '',
            basePrice: Number(data.basePrice || data.price || 0),
            originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
            discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
            memberDiscountTag: data.memberDiscountTag || undefined,
            promoGroups: Array.isArray(data.promoGroups) ? data.promoGroups : undefined,
            isAvailable: data.isAvailable !== false,
            isPopular: Boolean(data.isPopular),
            isNew: Boolean(data.isNew),
            isSpicy: Boolean(data.isSpicy),
            variants: Array.isArray(data.variants) ? data.variants : [],
            addons: Array.isArray(data.addons) ? data.addons : [],
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 999,
          } as Product & { sortOrder?: number });
        });
        list.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setProducts(list);
        setLoading(false);
        void ensureDefaultPopularRecommendations(list);
      },
      (err) => {
        console.warn('Lỗi đọc products realtime:', err.message);
        setProducts([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Danh sách các món đang hiển thị trong "Bạn sẽ thích" (Pizza nguyên giá + Khai vị + Nước)
  const popularProducts = useMemo(() => {
    const raw = products.filter(
      (p) =>
        p.isPopular &&
        (p.categoryId !== 'pizza' || !isProductDiscounted(p))
    );
    return sortPopularProducts(raw);
  }, [products]);

  const countsByCategory = useMemo(() => {
    return {
      all: popularProducts.length,
      pizza: popularProducts.filter((p) => p.categoryId === 'pizza').length,
      starters: popularProducts.filter((p) => p.categoryId === 'starters').length,
      drinks: popularProducts.filter((p) => p.categoryId === 'drinks').length,
    };
  }, [popularProducts]);

  const displayedPopular = useMemo(() => {
    if (activeTab === 'all') return popularProducts;
    return popularProducts.filter((p) => p.categoryId === activeTab);
  }, [popularProducts, activeTab]);

  // Danh sách các món có thể thêm vào "Bạn sẽ thích":
  // - Chưa có trong "Bạn sẽ thích"
  // - Nếu là Pizza thì phải CHƯA có giảm giá (!isProductDiscounted)
  // - Thuộc 3 nhóm: pizza, starters, drinks
  const pickableProducts = useMemo(() => {
    return products
      .filter((p) => !p.isPopular)
      .filter((p) => ['pizza', 'starters', 'drinks'].includes(p.categoryId))
      .filter((p) => p.categoryId !== 'pizza' || !isProductDiscounted(p))
      .filter((p) => pickerCategory === 'all' || p.categoryId === pickerCategory)
      .filter((p) => !searchQuery.trim() || norm(p.name).includes(norm(searchQuery)));
  }, [products, pickerCategory, searchQuery]);

  const handleAddPopular = async (item: Product) => {
    if (item.categoryId === 'pizza' && isProductDiscounted(item)) {
      Alert.alert(
        'Món đã có giảm giá',
        'Chỉ được thêm các món Pizza nguyên giá (chưa thuộc nhóm ưu đãi) vào mục "Bạn sẽ thích".'
      );
      return;
    }
    setActionInProgressId(item.id);
    triggerHaptic('medium');
    try {
      await setDoc(
        doc(db, 'products', item.id),
        {
          isPopular: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      productService.invalidateCache?.();
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isPopular: true } : p))
      );
      void reportAdminAction('ADD_TO_RECOMMENDATIONS', item.name, {
        productId: item.id,
        categoryId: item.categoryId,
      });
      triggerHaptic('success');
      showToast({
        message: `Đã thêm "${item.name}" vào Bạn sẽ thích`,
        type: 'success',
      });
      setPickerVisible(false);
    } catch (e: any) {
      Alert.alert('Không thể thêm món', e?.message || 'Vui lòng thử lại.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRemovePopular = async (item: Product) => {
    setActionInProgressId(item.id);
    triggerHaptic('light');
    try {
      await setDoc(
        doc(db, 'products', item.id),
        {
          isPopular: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      productService.invalidateCache?.();
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isPopular: false } : p))
      );
      void reportAdminAction('REMOVE_FROM_RECOMMENDATIONS', item.name, {
        productId: item.id,
      });
      showToast({
        message: `Đã gỡ "${item.name}" khỏi Bạn sẽ thích`,
        type: 'info',
      });
    } catch (e: any) {
      Alert.alert('Không thể gỡ món', e?.message || 'Vui lòng thử lại.');
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Bạn Sẽ Thích"
        subtitle="Hiển thị đồng bộ tại Trang chủ & Giỏ hàng (3 Pizza nguyên giá · 3 Khai vị · 2 Nước)"
        showBack={true}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/admin/products'))}
      />

      {/* Thanh tab lọc theo danh mục (Tất cả / Pizza / Khai vị / Thức uống) */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 8,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {CATEGORY_TABS.map((t) => {
          const isActive = activeTab === t.id;
          const count = countsByCategory[t.id as keyof typeof countsByCategory] ?? 0;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.categoryPill,
                { flex: 1, paddingHorizontal: 6 },
                isActive && styles.categoryPillActive,
              ]}
              activeOpacity={0.7}
              onPress={() => setActiveTab(t.id)}
            >
              <AppText
                variant="captionMedium"
                color={isActive ? colors.white : colors.textPrimary}
                numberOfLines={1}
              >
                {`${t.name} (${count})`}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingTop: 12 }]}
        >
          {/* Khối tóm tắt gọn & nút + Thêm món */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={15} color={colors.primary} />
                <AppText variant="cardTitle" color={colors.textPrimary}>
                  {`Đang hiển thị ${popularProducts.length} món`}
                </AppText>
              </View>
              <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                {`${countsByCategory.pizza} Pizza nguyên giá · ${countsByCategory.starters} Khai vị · ${countsByCategory.drinks} Nước`}
              </AppText>
            </View>

            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.85}
              onPress={() => {
                setPickerCategory(activeTab === 'all' ? 'all' : activeTab);
                setSearchQuery('');
                setPickerVisible(true);
              }}
            >
              <Plus size={18} color={colors.white} />
              <AppText variant="captionSemiBold" color={colors.white}>
                Thêm món
              </AppText>
            </TouchableOpacity>
          </View>

          {/* Danh sách món đang nằm trong "Bạn sẽ thích" */}
          {displayedPopular.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                Chưa có món nào trong mục này. Bấm &quot;+ Thêm món&quot; để thêm ngay.
              </AppText>
            </View>
          ) : (
            displayedPopular.map((item) => {
              const isBusy = actionInProgressId === item.id;
              return (
                <View key={item.id} style={styles.productCard}>
                  <View style={styles.cardMainRow}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                    <View style={styles.productInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.categoryBadge}>
                          <AppText variant="small" color={colors.textSecondary} style={{ fontWeight: '700' }}>
                            {CAT_LABELS[item.categoryId] || item.categoryId.toUpperCase()}
                          </AppText>
                        </View>
                      </View>
                      <AppText variant="cardTitle" color={colors.textPrimary} numberOfLines={2}>
                        {item.name}
                      </AppText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AppText variant="price" color={colors.primary}>
                          {formatCurrency(item.basePrice)}
                        </AppText>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: colors.errorSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={isBusy}
                      onPress={() => handleRemovePopular(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Gỡ ${item.name} khỏi Bạn sẽ thích`}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Trash2 size={15} color={colors.error} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal chọn món từ Menu thật để thêm vào "Bạn sẽ thích" */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                Thêm vào &quot;Bạn sẽ thích&quot;
              </AppText>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 10 }}>
              Chỉ hiển thị món trong Menu chưa chọn (Pizza chỉ lấy các món chưa có giảm giá).
            </AppText>

            {/* Bộ lọc danh mục trong Modal */}
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                marginBottom: 10,
              }}
            >
              {CATEGORY_TABS.map((t) => {
                const isSelected = pickerCategory === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.categoryPill,
                      { flex: 1, paddingHorizontal: 4, height: 34 },
                      isSelected && styles.categoryPillActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setPickerCategory(t.id)}
                  >
                    <AppText
                      variant="small"
                      color={isSelected ? colors.white : colors.textPrimary}
                      style={{ fontWeight: '700' }}
                      numberOfLines={1}
                    >
                      {t.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Ô tìm kiếm không dấu */}
            <View style={[styles.searchInputWrap, { flex: 0, height: 42, marginBottom: 12 }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                placeholder="Tìm tên Pizza, Khai vị, Nước..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            >
              {pickableProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    Không còn món phù hợp để thêm.
                  </AppText>
                </View>
              ) : (
                pickableProducts.map((item) => {
                  const isBusy = actionInProgressId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.cardMainRow,
                        {
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                      activeOpacity={0.7}
                      disabled={isBusy}
                      onPress={() => handleAddPopular(item)}
                    >
                      <Image
                        source={{ uri: item.image }}
                        style={{ ...styles.productImage, width: 48, height: 48 }}
                        resizeMode="contain"
                      />
                      <View style={styles.productInfo}>
                        <AppText variant="cardTitle" color={colors.textPrimary} numberOfLines={1}>
                          {item.name}
                        </AppText>
                        <AppText variant="small" color={colors.textSecondary}>
                          {`${CAT_LABELS[item.categoryId] || item.categoryId} · ${formatCurrency(item.basePrice)}`}
                        </AppText>
                      </View>
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Plus size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
