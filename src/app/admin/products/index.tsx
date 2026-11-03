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
  Upload,
  ImageOff,
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
import { pickAndUploadImage } from '../../../services/imageUpload';

const CATEGORIES = [
  { id: 'all', name: 'Tất cả' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'starters', name: 'Khai vị' },
  { id: 'pasta', name: 'Mì Ý' },
  { id: 'drinks', name: 'Thức uống' },
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
  // Pizza: giá theo 3 cỡ Nhỏ/Vừa/Lớn (chỉ hiện khi danh mục = pizza)
  const [sizePrices, setSizePrices] = useState({ nho: '', vua: '', lon: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Chọn ảnh từ máy -> upload Firebase Storage -> nhận URL công khai
  const handlePickImage = async () => {
    setIsUploadingImage(true);
    try {
      const url = await pickAndUploadImage('products');
      if (url) setFormImage(url);
    } catch (e: any) {
      Alert.alert('Upload ảnh thất bại', e?.message || 'Vui lòng thử lại.');
    } finally {
      setIsUploadingImage(false);
    }
  };

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
    setSizePrices({ nho: '', vua: '', lon: '' });
    setFormImage(''); // để trống — admin tự upload ảnh
    setFormDesc('');
    setModalVisible(true);
  };

  // Mở modal Sửa món
  const handleOpenEditModal = (item: Product) => {
    setEditingProduct(item);
    setFormName(item.name);
    setFormPrice(String(item.basePrice));
    setFormCategory(item.categoryId);
    // nạp giá 3 cỡ từ variants cũ (khớp theo tên Nhỏ/Vừa/Lớn hoặc 7"/9"/12")
    const pick = (keys: string[]) =>
      item.variants?.find((v) => keys.some((k) => v.name.toLowerCase().includes(k)))?.price;
    setSizePrices({
      nho: String(pick(['nhỏ', '7"']) ?? item.basePrice),
      vua: String(pick(['vừa', '9"']) ?? item.basePrice),
      lon: String(pick(['lớn', '12"']) ?? item.basePrice),
    });
    setFormImage(item.image);
    setFormDesc(item.description);
    setModalVisible(true);
  };

  // Lưu món (Thêm mới hoặc Cập nhật)
  const handleSaveProduct = async () => {
    const isPizza = formCategory === 'pizza';

    if (!formName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên món');
      return;
    }

    const toPrice = (s: string) => Number(s.replace(/[^0-9]/g, ''));

    // Pizza: 3 cỡ Nhỏ/Vừa/Lớn với 3 mức giá — giá hiển thị = cỡ Vừa
    let priceNum: number;
    let variants: { id: string; name: string; price: number }[] = [];
    if (isPizza) {
      const nho = toPrice(sizePrices.nho);
      const vua = toPrice(sizePrices.vua);
      const lon = toPrice(sizePrices.lon);
      if (!nho || !vua || !lon) {
        Alert.alert('Lỗi', 'Pizza cần giá cho cả 3 cỡ Nhỏ, Vừa, Lớn');
        return;
      }
      priceNum = vua;
      variants = [
        { id: 'v1', name: 'Size Nhỏ (7")', price: nho },
        { id: 'v2', name: 'Size Vừa (9")', price: vua },
        { id: 'v3', name: 'Size Lớn (12")', price: lon },
      ];
    } else {
      priceNum = toPrice(formPrice);
      if (!priceNum || priceNum <= 0) {
        Alert.alert('Lỗi', 'Giá bán phải là số hợp lệ');
        return;
      }
    }
    const imageUrl = formImage.trim() || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500';

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Cập nhật sản phẩm hiện có
        const pRef = doc(db, 'products', editingProduct.id);
        await updateDoc(pRef, {
          name: formName.trim(),
          basePrice: priceNum,
          categoryId: formCategory,
          image: imageUrl,
          description: formDesc.trim(),
          ...(isPizza ? { variants } : {}),
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
          image: imageUrl,
          description: formDesc.trim(),
          isAvailable: true,
          // A variant price is the full selling price (see getItemLineUnitPrice), not a surcharge.
          variants: isPizza
            ? variants
            : [{ id: 'v1', name: 'Size Vừa (9")', price: priceNum }],
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
        title="Thực đơn"
        subtitle="Quản lý món ăn & nhóm khuyến mãi"
        showBack={false}
      />

      {/* Minimalist Segmented Navigation: Món gốc | Nhóm Ưu Đãi | Bạn sẽ thích */}
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center',
          }}
        >
          <AppText variant="captionSemiBold" color={colors.white}>
            Món lẻ gốc
          </AppText>
        </View>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
          }}
          activeOpacity={0.75}
          onPress={() => router.push('/admin/menu-groups')}
        >
          <AppText variant="captionSemiBold" color={colors.textPrimary}>
            Nhóm Ưu Đãi
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
          }}
          activeOpacity={0.75}
          onPress={() => router.push('/admin/recommendations')}
        >
          <AppText variant="captionSemiBold" color={colors.textPrimary}>
            Bạn sẽ thích
          </AppText>
        </TouchableOpacity>
      </View>

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
                      onPress={() => {
                        setFormCategory(cat.id);
                        // Chuyển sang Pizza: nếu chưa nhập giá 3 cỡ thì lấy giá đang có điền sẵn cho tiện
                        if (cat.id === 'pizza' && formPrice) {
                          setSizePrices((prev) =>
                            prev.nho || prev.vua || prev.lon ? prev : { nho: formPrice, vua: formPrice, lon: formPrice }
                          );
                        }
                      }}
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
                  Tên món ăn *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: Pizza Hải Sản Sốt Pesto"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {formCategory === 'pizza' ? (
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Giá 3 cỡ pizza (VNĐ) *
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {([
                      { key: 'nho', label: 'Nhỏ (7")' },
                      { key: 'vua', label: 'Vừa (9")' },
                      { key: 'lon', label: 'Lớn (12")' },
                    ] as const).map((s) => (
                      <View key={s.key} style={{ flex: 1 }}>
                        <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 4 }}>
                          {s.label}
                        </AppText>
                        <TextInput
                          style={styles.formInput}
                          placeholder="VD: 159000"
                          keyboardType="numeric"
                          value={sizePrices[s.key]}
                          onChangeText={(t) => setSizePrices((prev) => ({ ...prev, [s.key]: t }))}
                        />
                      </View>
                    ))}
                  </View>
                  <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 6 }}>
                    Khách chọn cỡ nào trên app sẽ tính đúng giá cỡ đó.
                  </AppText>
                </View>
              ) : (
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
              )}

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Hình ảnh món ăn
                </AppText>

                {/* Preview + nút upload */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {formImage ? (
                      <Image source={{ uri: formImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <ImageOff size={22} color={colors.textDisabled} />
                    )}
                  </View>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      backgroundColor: colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                    onPress={handlePickImage}
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Upload size={16} color={colors.primary} />
                        <AppText variant="captionSemiBold" color={colors.primary}>
                          {formImage ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy'}
                        </AppText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
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
