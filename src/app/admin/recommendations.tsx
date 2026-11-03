import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  Sparkles,
  X,
  Flame,
  Star,
  ShoppingBag,
  Medal,
} from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminRecommendations.styles';
import { Product } from '../../types/product';
import { mockProducts } from '../../data/mockProducts';
import { formatCurrency } from '../../utils/formatCurrency';
import { Alert } from '../../utils/alert';
import { triggerHaptic } from '../../utils/haptics';
import { reportAdminAction } from '../../services/orderApi';

interface ProductWithSales extends Product {
  soldCount: number;
  totalRevenue: number;
}

export default function AdminRecommendationsScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // 1. Lắng nghe real-time từ collection 'products'
  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Product[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              name: data.name || 'Món ăn',
              categoryId: data.categoryId || data.category || 'pizza',
              description: data.description || '',
              image:
                data.image ||
                data.imageUrl ||
                'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
              basePrice: Number(data.basePrice || data.price || 0),
              isAvailable: data.isAvailable !== false,
              isPopular: Boolean(data.isPopular),
              variants: data.variants || [],
              addons: data.addons || [],
            } as Product);
          });
          setProducts(list);
        } else {
          setProducts(mockProducts);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Lỗi đọc products realtime:', err.message);
        setProducts(mockProducts);
        setLoading(false);
      }
    );

    return () => unsubProducts();
  }, []);

  // 2. Lắng nghe real-time từ collection 'orders' để thống kê số lượng bán
  useEffect(() => {
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders')),
      (snapshot) => {
        const orderList: any[] = [];
        snapshot.forEach((d) => {
          orderList.push({ id: d.id, ...d.data() });
        });
        setOrders(orderList);
      },
      (err) => {
        console.warn('Lỗi đọc orders realtime:', err.message);
      }
    );

    return () => unsubOrders();
  }, []);

  // 3. Tính toán số lượng bán & sắp xếp giảm dần theo lượt mua
  const rankedProducts: ProductWithSales[] = useMemo(() => {
    const salesMap: Record<string, { count: number; revenue: number }> = {};

    orders.forEach((o) => {
      // Chỉ tính đơn hàng đã hoàn tất hoặc đã giao
      if (o.status === 'COMPLETED' || o.status === 'DELIVERED') {
        (o.items || []).forEach((item: any) => {
          const key = item.productId || item.id || item.productName || item.name;
          const qty = Number(item.quantity) || 1;
          const lineTotal = Number(item.lineTotal || (item.unitPrice || 0) * qty);

          if (!salesMap[key]) {
            salesMap[key] = { count: 0, revenue: 0 };
          }
          salesMap[key].count += qty;
          salesMap[key].revenue += lineTotal;

          // Cũng gán theo tên món nếu key là ID hoặc ngược lại
          if (item.name && item.productId && item.name !== item.productId) {
            if (!salesMap[item.name]) salesMap[item.name] = { count: 0, revenue: 0 };
            salesMap[item.name].count += qty;
            salesMap[item.name].revenue += lineTotal;
          }
        });
      }
    });

    const enriched = products.map((p) => {
      const stats = salesMap[p.id] || salesMap[p.name] || { count: 0, revenue: 0 };
      return {
        ...p,
        soldCount: stats.count,
        totalRevenue: stats.revenue,
      };
    });

    // Sắp xếp: Số lượng bán nhiều nhất lên đầu
    return enriched.sort((a, b) => {
      if (b.soldCount !== a.soldCount) {
        return b.soldCount - a.soldCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [products, orders]);

  // Bộ lọc tìm kiếm
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return rankedProducts;
    const queryLower = searchQuery.toLowerCase().trim();
    return rankedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.categoryId.toLowerCase().includes(queryLower)
    );
  }, [rankedProducts, searchQuery]);

  // Đếm số món đang được đưa vào mục "Bạn sẽ thích"
  const popularCount = useMemo(() => {
    return products.filter((p) => p.isPopular).length;
  }, [products]);

  // 4. Bật / Tắt trạng thái "Bạn sẽ thích" cho từng món
  const handleTogglePopular = async (product: ProductWithSales) => {
    const nextState = !product.isPopular;
    setActionInProgressId(product.id);
    triggerHaptic('medium');

    try {
      const docRef = doc(db, 'products', product.id);
      await updateDoc(docRef, {
        isPopular: nextState,
        updatedAt: serverTimestamp(),
      });

      void reportAdminAction(
        nextState ? 'ADD_TO_RECOMMENDATIONS' : 'REMOVE_FROM_RECOMMENDATIONS',
        product.name,
        { productId: product.id, isPopular: nextState }
      );

      triggerHaptic('success');
      Alert.alert(
        'Thành công',
        nextState
          ? `Đã thêm "${product.name}" vào mục "Bạn sẽ thích" của khách hàng.`
          : `Đã gỡ "${product.name}" khỏi mục "Bạn sẽ thích".`
      );
    } catch (error: any) {
      triggerHaptic('error');
      Alert.alert('Lỗi', error?.message || 'Không thể cập nhật trạng thái.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // 5. Thao tác nhanh: Áp dụng Top 3 hoặc Top 5 món bán chạy nhất
  const handleApplyTopBatch = (topN: number) => {
    const topItems = rankedProducts.slice(0, topN);
    if (topItems.length === 0) {
      Alert.alert('Thông báo', 'Chưa có sản phẩm nào để áp dụng.');
      return;
    }

    Alert.alert(
      'Xác nhận áp dụng',
      `Bạn có chắc chắn muốn đưa Top ${topN} món bán chạy nhất vào mục "Bạn sẽ thích" trên app khách hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý',
          style: 'default',
          onPress: async () => {
            triggerHaptic('medium');
            setLoading(true);
            try {
              const batch = writeBatch(db);
              const topIds = new Set(topItems.map((item) => item.id));

              // Đặt isPopular: true cho top N, giữ nguyên hoặc gỡ các món khác
              rankedProducts.forEach((p) => {
                const shouldBePopular = topIds.has(p.id);
                if (p.isPopular !== shouldBePopular) {
                  const pRef = doc(db, 'products', p.id);
                  batch.update(pRef, {
                    isPopular: shouldBePopular,
                    updatedAt: serverTimestamp(),
                  });
                }
              });

              await batch.commit();
              void reportAdminAction('APPLY_TOP_RECOMMENDATIONS', `Top ${topN} Products`, {
                count: topN,
              });

              triggerHaptic('success');
              Alert.alert(
                'Thành công',
                `Đã cập nhật Top ${topN} món bán chạy nhất vào mục "Bạn sẽ thích"!`
              );
            } catch (err: any) {
              triggerHaptic('error');
              Alert.alert('Lỗi', err?.message || 'Không thể cập nhật danh sách.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getRankBadgeStyle = (index: number) => {
    if (index === 0) return styles.rankGold;
    if (index === 1) return styles.rankSilver;
    if (index === 2) return styles.rankBronze;
    return null;
  };

  const renderRankBadgeContent = (index: number) => {
    if (index === 0) return <Medal size={16} color="#D97706" />;
    if (index === 1) return <Medal size={16} color="#4B5563" />;
    if (index === 2) return <Medal size={16} color="#B45309" />;
    return (
      <AppText variant="captionSemiBold" color={colors.textSecondary}>
        {`#${index + 1}`}
      </AppText>
    );
  };

  const renderProductItem = ({ item, index }: { item: ProductWithSales; index: number }) => {
    const isBusy = actionInProgressId === item.id;
    const isPopular = Boolean(item.isPopular);

    return (
      <View style={[styles.itemCard, isPopular && styles.itemCardHighlighted]}>
        <View style={styles.itemTopRow}>
          {/* Thứ hạng theo lượt mua */}
          <View style={[styles.rankBadge, getRankBadgeStyle(index)]}>
            {renderRankBadgeContent(index)}
          </View>

          {/* Ảnh món */}
          <Image
            source={{ uri: item.image }}
            style={styles.productImage}
            resizeMode="cover"
          />

          {/* Thông tin món */}
          <View style={styles.productInfo}>
            <View style={styles.titleRow}>
              <AppText
                variant="bodySemiBold"
                color={colors.textPrimary}
                numberOfLines={1}
                style={{ flex: 1, marginRight: 6 }}
              >
                {item.name}
              </AppText>
              {isPopular && (
                <Star
                  size={16}
                  color={colors.warning}
                  fill={colors.warning}
                  style={{ flexShrink: 0 }}
                />
              )}
            </View>

            <AppText variant="caption" color={colors.textSecondary}>
              Giá gốc: {formatCurrency(item.basePrice)}
            </AppText>

            <View style={styles.statsRow}>
              <View style={styles.salesBadge}>
                <Flame size={14} color={item.soldCount > 0 ? colors.primary : colors.textDisabled} />
                <AppText
                  variant="captionMedium"
                  color={item.soldCount > 0 ? colors.primary : colors.textSecondary}
                >
                  Đã bán: {item.soldCount} phần
                </AppText>
              </View>

              {!item.isAvailable && (
                <AppText variant="small" color={colors.error}>
                  (Tạm hết món)
                </AppText>
              )}
            </View>
          </View>
        </View>

        {/* Hàng hành động */}
        <View style={styles.cardActionRow}>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isPopular ? colors.success : colors.textDisabled },
              ]}
            />
            <AppText
              variant="captionMedium"
              color={isPopular ? colors.success : colors.textSecondary}
            >
              {isPopular ? 'Đang trong "Bạn sẽ thích"' : 'Chưa hiển thị'}
            </AppText>
          </View>

          <TouchableOpacity
            style={[styles.toggleBtn, isPopular && styles.removeBtn]}
            activeOpacity={0.8}
            disabled={isBusy}
            onPress={() => handleTogglePopular(item)}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={isPopular ? colors.textPrimary : colors.white} />
            ) : isPopular ? (
              <>
                <X size={15} color={colors.textSecondary} />
                <AppText variant="captionMedium" color={colors.textSecondary}>
                  Gỡ bỏ
                </AppText>
              </>
            ) : (
              <>
                <Sparkles size={15} color={colors.white} />
                <AppText variant="captionMedium" color={colors.white}>
                  {'Đưa vào "Bạn sẽ thích"'}
                </AppText>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Gợi Ý 'Bạn Sẽ Thích'"
        subtitle="Danh sách món được mua nhiều nhất"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Thẻ tóm tắt & Thao tác nhanh */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <AppText variant="cardTitle" color={colors.textPrimary}>
              Món đề xuất cho khách
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Sắp xếp theo số lượng mua từ cao đến thấp
            </AppText>
          </View>

          <View style={styles.badgePill}>
            <Sparkles size={15} color={colors.primary} />
            <AppText variant="captionMedium" color={colors.primary}>
              Đang chọn: {popularCount} món
            </AppText>
          </View>
        </View>

        {/* Nút thao tác nhanh theo Top */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            activeOpacity={0.7}
            onPress={() => handleApplyTopBatch(3)}
          >
            <Flame size={15} color={colors.primary} />
            <AppText variant="captionMedium" color={colors.primary}>
              Áp dụng Top 3
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionBtn}
            activeOpacity={0.7}
            onPress={() => handleApplyTopBatch(5)}
          >
            <Sparkles size={15} color={colors.primary} />
            <AppText variant="captionMedium" color={colors.primary}>
              Áp dụng Top 5
            </AppText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ô tìm kiếm món */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên món ăn..."
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Danh sách món */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="caption" color={colors.textSecondary}>
            Đang phân tích số lượng bán...
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 800);
              }}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShoppingBag size={42} color={colors.textDisabled} />
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                Không tìm thấy món ăn nào.
              </AppText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
