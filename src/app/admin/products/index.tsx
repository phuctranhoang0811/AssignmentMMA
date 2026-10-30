import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  Plus,
  Edit2,
  X,
  Package,
  Trash2,
  ChevronRight,
} from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme/colors';
import { styles } from '../../../styles/adminProducts.styles';
import { Product } from '../../../types/product';
import { mockProducts } from '../../../data/mockProducts';
import { formatCurrency } from '../../../utils/formatCurrency';
import { reportAdminAction } from '../../../services/orderApi';

const CATEGORIES = [
  { id: 'all', name: 'Tất cả' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'starters', name: 'Khai vị' },
  { id: 'drinks', name: 'Thức uống' },
  { id: 'pasta', name: 'Mì Ý' },
  { id: 'sushi', name: 'Sushi' },
];

export default function AdminProductsScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State for Add / Quick Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState<any>('pizza');
  const [formImage, setFormImage] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Lắng nghe dữ liệu realtime từ collection 'products' trên Firestore
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snapshot: any) => {
        if (!snapshot.empty) {
          const list: Product[] = [];
          snapshot.forEach((d: any) => {
            const data = d.data();
            list.push({
              id: d.id,
              name: data.name || 'Món ăn',
              categoryId: data.categoryId || data.category || 'pizza',
              description: data.description || '',
              image: data.image || data.imageUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
              basePrice: Number(data.basePrice || data.price || 0),
              isAvailable: data.isAvailable !== false,
              variants: data.variants || [],
              addons: data.addons || [],
            } as Product);
          });
          setProducts(list);
        } else {
          // Fallback mockProducts nếu Firestore chưa có dữ liệu
          setProducts(mockProducts);
        }
        setLoading(false);
      },
      (err: any) => {
        console.warn('Lỗi Firestore onSnapshot products:', err.message);
        setProducts(mockProducts);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // 1. Công tắc Hết hàng tức thì (In-Stock / Out-of-Stock Toggle) - Mục 4.1
  const handleToggleStock = async (item: Product, newStatus: boolean) => {
    // Cập nhật optimistic local state ngay lập tức
    setProducts((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, isAvailable: newStatus } : p))
    );

    try {
      const productRef = doc(db, 'products', item.id);
      await updateDoc(productRef, {
        isAvailable: newStatus,
        updatedAt: serverTimestamp(),
      });
      void reportAdminAction('PRODUCT_STOCK_CHANGED', `products/${item.id}`, { name: item.name, isAvailable: newStatus });
    } catch (err: any) {
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isAvailable: item.isAvailable } : p))
      );
      Alert.alert('Chưa cập nhật được tình trạng món', err?.message || 'Vui lòng thử lại.');
    }
  };

  // Mở modal Thêm mới
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCategory('pizza');
    setFormImage('https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500');
    setFormDesc('');
    setModalVisible(true);
  };

  // Mở modal Sửa món
  const handleOpenEditModal = (item: Product) => {
    setEditingProduct(item);
    setFormName(item.name);
    setFormPrice(String(item.basePrice));
    setFormCategory(item.categoryId);
    setFormImage(item.image);
    setFormDesc(item.description);
    setModalVisible(true);
  };

  // Lưu món (Thêm mới hoặc Cập nhật)
  const handleSaveProduct = async () => {
    if (!formName.trim() || !formPrice.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên món và giá bán');
      return;
    }

    const priceNum = Number(formPrice.replace(/[^0-9]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Lỗi', 'Giá bán phải là số hợp lệ');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Cập nhật sản phẩm hiện có
        const pRef = doc(db, 'products', editingProduct.id);
        await updateDoc(pRef, {
          name: formName.trim(),
          basePrice: priceNum,
          categoryId: formCategory,
          image: formImage.trim() || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
          description: formDesc.trim(),
          updatedAt: serverTimestamp(),
        });
        void reportAdminAction('PRODUCT_UPDATED', `products/${editingProduct.id}`, { name: formName.trim(), basePrice: priceNum });
        Alert.alert('Thành công', 'Đã cập nhật thông tin món ăn');
      } else {
        // Thêm sản phẩm mới vào Firestore
        const created = await addDoc(collection(db, 'products'), {
          name: formName.trim(),
          basePrice: priceNum,
          categoryId: formCategory,
          image: formImage.trim() || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
          description: formDesc.trim(),
          isAvailable: true,
          // A variant price is the full selling price (see getItemLineUnitPrice), not a surcharge.
          variants: [
            { id: 'v1', name: 'Size Vừa (9")', price: priceNum },
            { id: 'v2', name: 'Size Lớn (12")', price: priceNum + 60000 },
          ],
          addons: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void reportAdminAction('PRODUCT_CREATED', `products/${created.id}`, { name: formName.trim(), basePrice: priceNum });
        Alert.alert('Thành công', 'Đã thêm món mới vào thực đơn');
      }

      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu món ăn');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa món
  const handleDeleteProduct = (item: Product) => {
    Alert.alert(
      'Xóa món',
      `Bạn có chắc chắn muốn xóa món "${item.name}" khỏi thực đơn?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', item.id));
              setProducts((prev) => prev.filter((p) => p.id !== item.id));
              void reportAdminAction('PRODUCT_DELETED', `products/${item.id}`, { name: item.name });
              Alert.alert('Thành công', 'Đã xóa món ăn khỏi thực đơn');
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message || 'Không thể xóa món ăn');
            }
          },
        },
      ]
    );
  };

  // Lọc sản phẩm theo Category và Search
  const filteredProducts = products.filter((p) => {
    const matchCat =
      selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Quản Trị Thực Đơn"
        subtitle="Công tắc In-Stock & Cập nhật giá bán"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Search & Add Row */}
      <View style={styles.headerRow}>
        <View style={styles.searchInputWrap}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Tìm tên món pizza, thức uống..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={handleOpenAddModal}
          accessibilityRole="button"
          accessibilityLabel="Thêm món mới"
        >
          <Plus size={18} color={colors.white} />
          <AppText variant="captionSemiBold" color={colors.white}>
            Thêm
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Category Pills Filter */}
      <View style={{ height: 56, justifyContent: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  isActive && styles.categoryPillActive,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <AppText
                  variant="captionMedium"
                  color={isActive ? colors.white : colors.textPrimary}
                >
                  {cat.name}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={40} color={colors.textDisabled} />
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                Không tìm thấy món ăn nào phù hợp
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const isStock = item.isAvailable !== false;
            return (
              <View style={styles.productCard}>
                {/* Clickable top row → navigates to /admin/products/[id] */}
                <TouchableOpacity
                  style={styles.cardMainRow}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/admin/products/${item.id}`)}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <View style={styles.categoryBadge}>
                      <AppText variant="small" color={colors.textSecondary}>
                        {item.categoryId.toUpperCase()}
                      </AppText>
                    </View>
                    <AppText variant="cardTitle" color={colors.textPrimary}>
                      {item.name}
                    </AppText>
                    <AppText variant="price" color={colors.primary}>
                      {formatCurrency(item.basePrice)}
                    </AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textDisabled} />
                </TouchableOpacity>

                {/* Stock Control Row - Mục 4.1 In-Stock Toggle */}
                <View style={styles.stockControlRow}>
                  <View style={styles.stockStatusLeft}>
                    <View
                      style={[
                        styles.stockIndicatorDot,
                        {
                          backgroundColor: isStock
                            ? colors.success
                            : colors.error,
                        },
                      ]}
                    />
                    <AppText
                      variant="captionMedium"
                      color={isStock ? colors.success : colors.error}
                    >
                      {isStock ? 'Đang bán' : 'Hết món'}
                    </AppText>
                  </View>

                  <View style={styles.actionBtnsRow}>
                    {/* Nút sửa nhanh */}
                    <TouchableOpacity
                      style={styles.editBtn}
                      activeOpacity={0.7}
                      onPress={() => handleOpenEditModal(item)}
                    >
                      <Edit2 size={14} color={colors.textPrimary} />
                      <AppText variant="small" color={colors.textPrimary}>
                        Sửa
                      </AppText>
                    </TouchableOpacity>

                    {/* Nút xóa */}
                    <TouchableOpacity
                      style={[styles.editBtn, { backgroundColor: colors.errorSoft }]}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteProduct(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa món ${item.name}`}
                    >
                      <Trash2 size={14} color={colors.error} />
                    </TouchableOpacity>

                    {/* Công tắc Toggle In-Stock */}
                    <Switch
                      value={isStock}
                      accessibilityLabel={`Đang bán ${item.name}`}
                      onValueChange={(val) => handleToggleStock(item, val)}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary,
                      }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal Thêm / Chỉnh Sửa Món */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                {editingProduct ? 'Chỉnh Sửa Món Ăn' : 'Thêm Món Ăn Mới'}
              </AppText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Tên món ăn *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: Pizza Hải Sản Sốt Pesto"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Giá bán gốc (VNĐ) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: 189000"
                  keyboardType="numeric"
                  value={formPrice}
                  onChangeText={setFormPrice}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Danh mục
                </AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryPill,
                        formCategory === cat.id && styles.categoryPillActive,
                      ]}
                      onPress={() => setFormCategory(cat.id)}
                    >
                      <AppText
                        variant="captionMedium"
                        color={
                          formCategory === cat.id
                            ? colors.white
                            : colors.textPrimary
                        }
                      >
                        {cat.name}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Đường dẫn hình ảnh (URL)
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="https://images.unsplash.com/..."
                  value={formImage}
                  onChangeText={setFormImage}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Mô tả món ăn
                </AppText>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  placeholder="Mô tả nguyên liệu, hương vị..."
                  multiline
                  numberOfLines={3}
                  value={formDesc}
                  onChangeText={setFormDesc}
                />
              </View>

              <View style={styles.formActions}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Hủy"
                    variant="outline"
                    onPress={() => setModalVisible(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Lưu món"
                    isLoading={isSubmitting}
                    onPress={handleSaveProduct}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
