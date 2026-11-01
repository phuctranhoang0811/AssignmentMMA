import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, X, Trash2 } from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
// Alert từ react-native là no-op trên web -> dùng wrapper dùng confirm() của trình duyệt
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminProducts.styles';
import { Product } from '../../types/product';
import { mockProducts } from '../../data/mockProducts';
import { formatCurrency } from '../../utils/formatCurrency';
import { memberDiscountLabel } from '../../utils/memberDiscount';
import { reportAdminAction } from '../../services/orderApi';

// 3 nhóm promo hiển thị card trên trang chủ — mỗi nhóm có "đặc sản" riêng khi thêm món
const PROMO_GROUPS = [
  { id: 'cheese_party', name: 'Tiệc Cheese' },
  { id: 'member_deals', name: 'Thành Viên' },
  { id: 'hot_deals', name: 'Deal Hot 70%' },
];
const PROMO_IDS = PROMO_GROUPS.map((g) => g.id);

// Nhóm trả về khi món không còn promo nào (dữ liệu kiểu cũ bị "chuyển nhà" sang nhóm promo)
const FALLBACK_GROUP = 'pizza';

// Danh sách nhóm promo của một món = promoGroups mới + categoryId kiểu cũ (nếu từng là nhóm promo)
const groupsOf = (p: Product): string[] => {
  const set = new Set<string>(p.promoGroups || []);
  if (PROMO_IDS.includes(p.categoryId)) set.add(p.categoryId);
  return [...set];
};
const inGroup = (p: Product, g: string) => groupsOf(p).includes(g);

const CAT_NAMES: Record<string, string> = {
  cheese_party: 'Tiệc Cheese',
  member_deals: 'Thành Viên',
  hot_deals: 'Deal Hot',
  pizza: 'Pizza',
  starters: 'Khai vị',
  drinks: 'Thức uống',
  pasta: 'Mì Ý',
  sushi: 'Sushi',
};

const parseNumber = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export default function AdminMenuGroupsScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState('cheese_party');

  // Modal chọn món có sẵn để thêm vào nhóm
  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form đặc trưng theo nhóm (bấm món trong picker -> mở form này)
  const [pendingItem, setPendingItem] = useState<Product | null>(null);
  const [formValue, setFormValue] = useState(''); // member/hot/cheese: % giảm
  const [formNote, setFormNote] = useState(''); // cheese: điểm nhấn phô mai
  const [formNew, setFormNew] = useState(true); // cheese: badge New

  useEffect(() => {
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
              image: data.image || data.imageUrl || '',
              basePrice: Number(data.basePrice || data.price || 0),
              originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
              memberDiscountTag: data.memberDiscountTag || undefined,
              discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
              isNew: data.isNew === true,
              isAvailable: data.isAvailable !== false,
              variants: data.variants || [],
              addons: data.addons || [],
              promoGroups: Array.isArray(data.promoGroups) ? data.promoGroups : undefined,
            } as Product);
          });
          setProducts(list);
        } else {
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

  const groupName = PROMO_GROUPS.find((g) => g.id === group)?.name || group;
  const groupProducts = products.filter((p) => inGroup(p, group));

  // Điều kiện riêng của Tiệc Cheese: chỉ nhận món pizza / combo pizza
  const isPizzaOrCombo = (p: Product) => {
    const name = p.name.toLowerCase();
    return (
      p.categoryId === 'pizza' ||
      p.categoryId === 'cheese_party' || // dữ liệu cũ từng bị "chuyển nhà" vào nhóm
      name.includes('pizza') ||
      name.includes('combo') ||
      p.id.startsWith('CB') ||
      (p.tags || []).some((t) => t.toLowerCase().includes('combo'))
    );
  };

  // Món có sẵn chưa nằm trong nhóm hiện tại (Tiệc Cheese chỉ hiện pizza/combo)
  const pickableProducts = products
    .filter((p) => !inGroup(p, group))
    .filter((p) => (group === 'cheese_party' ? isPizzaOrCombo(p) : true))
    .filter(
      (p) =>
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const baseOf = (item: Product) => item.originalPrice || item.basePrice;

  // ---------- GHI FIRESTORE ----------

  const writeProduct = async (item: Product, extra: Record<string, any>) => {
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'products', item.id),
        {
          name: item.name,
          description: item.description || '',
          image: item.image || '',
          basePrice: item.basePrice,
          isAvailable: item.isAvailable !== false,
          variants: item.variants || [],
          addons: item.addons || [],
          ...extra,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    } catch (e: any) {
      Alert.alert('Chưa lưu được', e?.message || 'Vui lòng thử lại.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Bấm món trong picker -> mở form đặc trưng nhóm
  const handlePickItem = (item: Product) => {
    setPendingItem(item);
    setFormValue(group === 'hot_deals' ? '50' : group === 'member_deals' ? '15' : '');    setFormNote(group === 'cheese_party' ? 'X3 phô mai kéo sợi' : '');
    setFormNew(true);
  };

  // Tính payload "đặc sản" theo từng nhóm.
  // Nguyên tắc: KHÔNG đổi categoryId — món vẫn thuộc danh mục gốc (Pizza/Khai vị/Nước uống),
  // chỉ thêm nhãn promoGroups + ưu đãi riêng của nhóm.
  const buildGroupPayload = (item: Product): Record<string, any> | null => {
    const promoGroups = [...new Set([...groupsOf(item), group])];
    // Dữ liệu kiểu cũ từng bị "chuyển nhà" vào nhóm promo → trả món về danh mục gốc khi dán nhãn lại
    const migration: Record<string, any> = PROMO_IDS.includes(item.categoryId)
      ? { categoryId: FALLBACK_GROUP }
      : {};

    if (group === 'cheese_party') {
      const note = formNote.trim();
      const pct = parseNumber(formValue); // 0 = không giảm giá, chỉ dán nhãn
      if (formValue.trim() && (pct <= 0 || pct >= 100)) {
        Alert.alert('% giảm không hợp lệ', 'Tiệc Cheese chỉ nhận số giảm từ 1% đến 99% (để trống nếu không giảm giá).');
        return null;
      }
      const deal: Record<string, any> = {};
      if (pct > 0) {
        const original = baseOf(item);
        const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000; // làm tròn nghìn
        deal.originalPrice = original;
        deal.basePrice = salePrice;
        deal.discountPercent = pct;
        deal.memberDiscountTag = `Ưu đãi thành viên ${pct}%`;
      }
      return {
        ...migration,
        ...deal,
        promoGroups,
        isNew: formNew,
        description: note
          ? `${item.description ? item.description + ' · ' : ''}${note.toUpperCase()}`
          : item.description || '',
      };
    }

    if (group === 'member_deals') {
      const pct = parseNumber(formValue);
      const original = baseOf(item);
      if (pct <= 0 || pct >= 100) {
        Alert.alert('% giảm không hợp lệ', 'Ưu đãi thành viên chỉ nhận số giảm từ 1% đến 99%.');
        return null;
      }
      const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000; // làm tròn nghìn
      return {
        ...migration,
        promoGroups,
        originalPrice: original,
        basePrice: salePrice,
        memberDiscountTag: `Ưu đãi thành viên ${pct}%`,
      };
    }

    // hot_deals
    const pct = parseNumber(formValue);
    const original = baseOf(item);
    if (pct <= 0 || pct > 70) {
      Alert.alert('% giảm không hợp lệ', 'Deal Hot chỉ nhận số giảm từ 1% đến 70%.');
      return null;
    }
    const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000; // làm tròn nghìn
    return {
      ...migration,
      promoGroups,
      originalPrice: original,
      basePrice: salePrice,
      discountPercent: pct,
      memberDiscountTag: `GIẢM ${pct}%`,
    };
  };

  const handleConfirmAdd = async () => {
    if (!pendingItem) return;
    const payload = buildGroupPayload(pendingItem);
    if (!payload) return;

    const ok = await writeProduct(pendingItem, payload);
    if (!ok) return;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === pendingItem.id
          ? ({
              ...p,
              ...payload,
              memberDiscountTag: payload.memberDiscountTag ?? p.memberDiscountTag,
            } as Product)
          : p
      )
    );
    void reportAdminAction('PRODUCT_GROUP_CHANGED', `products/${pendingItem.id}`, {
      name: pendingItem.name,
      addPromoGroup: group,
      keptCategory: payload.categoryId ?? pendingItem.categoryId,
    });
    setPendingItem(null);
    setPickerVisible(false);
    setSearchQuery('');
  };

  // Bỏ món khỏi nhóm promo: chỉ gỡ NHÃN của nhóm đó.
  // Nếu món không còn nhóm promo nào khác mới gỡ luôn giá ưu đãi/badge, trả về giá gốc.
  const handleRemoveFromGroup = (item: Product) => {
    const remaining = groupsOf(item).filter((g) => g !== group);
    Alert.alert(
      'Bỏ khỏi nhóm',
      remaining.length
        ? `Bỏ nhãn ${groupName} của "${item.name}"? Món vẫn còn trong ${remaining.map((g) => CAT_NAMES[g] || g).join(', ')}.`
        : `Bỏ "${item.name}" khỏi ${groupName}? Giá ưu đãi & badge sẽ bị gỡ, món trở về giá gốc và vẫn nằm ở ${CAT_NAMES[item.categoryId] || item.categoryId}.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Bỏ',
          style: 'destructive',
          onPress: async () => {
            const cleanup: Record<string, any> = remaining.length
              ? {}
              : {
                  basePrice: baseOf(item),
                  originalPrice: deleteField(),
                  memberDiscountTag: deleteField(),
                  discountPercent: deleteField(),
                };
            // Dữ liệu kiểu cũ: món đang "sống" bằng categoryId promo → trả về danh mục gốc
            const migration: Record<string, any> = PROMO_IDS.includes(item.categoryId)
              ? { categoryId: FALLBACK_GROUP }
              : {};
            const payload = {
              ...migration,
              ...cleanup,
              promoGroups: remaining.length ? remaining : deleteField(),
            };
            const ok = await writeProduct(item, payload);
            if (ok) {
              setProducts((prev) =>
                prev.map((p) =>
                  p.id === item.id
                    ? ({
                        ...p,
                        ...migration,
                        ...(remaining.length
                          ? {}
                          : {
                              basePrice: baseOf(item),
                              originalPrice: undefined,
                              memberDiscountTag: undefined,
                              discountPercent: undefined,
                            }),
                        promoGroups: remaining.length ? remaining : undefined,
                      } as Product)
                    : p
                )
              );
              void reportAdminAction('PRODUCT_GROUP_CHANGED', `products/${item.id}`, {
                name: item.name,
                removePromoGroup: group,
                remainingGroups: remaining.join(','),
              });
            }
          },
        },
      ]
    );
  };

  // ---------- PREVIEW kết quả trên form ----------

  const previewLine = (() => {
    if (!pendingItem) return '';
    if (group === 'member_deals') {
      const pct = parseNumber(formValue);
      const original = baseOf(pendingItem);
      if (pct > 0 && pct < 100) {
        const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
        return `Giá bán tự tính: ${vnd(salePrice)} (giữ nguyên ${vnd(original)} gạch ngang) + badge "Ưu đãi thành viên ${pct}%"`;
      }
      return 'Nhập % giảm (1–99%)';
    }
    if (group === 'hot_deals') {
      const pct = parseNumber(formValue);
      const original = baseOf(pendingItem);
      if (pct > 0 && pct <= 70) {
        const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
        return `Giá bán: ${vnd(salePrice)} (giữ nguyên ${vnd(original)} gạch ngang) + badge "GIẢM ${pct}%"`;
      }
      return 'Nhập % giảm (1–70%)';
    }
    // cheese_party: điểm nhấn + badge New + (tùy chọn) % giảm tự tính giá
    const note = formNote.trim();
    const parts: string[] = [];
    if (note) parts.push(`Mô tả sẽ thêm "· ${note.toUpperCase()}"`);
    if (formNew) parts.push('badge New');
    const pct = parseNumber(formValue);
    if (formValue.trim() && (pct <= 0 || pct >= 100)) {
      parts.push('Nhập % giảm từ 1–99 hoặc để trống');
    } else if (pct > 0) {
      const original = baseOf(pendingItem);
      const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
      parts.push(`giá tự tính ${vnd(salePrice)} (gốc ${vnd(original)} gạch ngang) + badge "Ưu đãi thành viên ${pct}%"`);
    }
    return parts.length ? parts.join(' + ') : 'Chỉ dán nhãn nhóm, giữ nguyên món gốc';
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Thêm Món Vào Nhóm Promo"
        subtitle="Món giữ nguyên danh mục gốc — thêm vào đây chỉ là dán nhãn promo + ưu đãi riêng"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Chọn nhóm */}
      <View style={{ height: 56, justifyContent: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.categoryScroll}
        >
          {PROMO_GROUPS.map((g) => {
            const isActive = group === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                activeOpacity={0.7}
                onPress={() => { setGroup(g.id); setPendingItem(null); }}
              >
                <AppText variant="captionMedium" color={isActive ? colors.white : colors.textPrimary}>
                  {g.name}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Số món + nút thêm */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppText variant="bodyMedium" color={colors.textSecondary}>
            {loading ? 'Đang tải...' : `${groupProducts.length} món trong ${groupName}`}
          </AppText>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Thêm món vào ${groupName}`}
        >
          <Plus size={18} color={colors.white} />
          <AppText variant="captionSemiBold" color={colors.white}>
            Thêm món
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Danh sách món trong nhóm */}
      {!loading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {groupProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                {'Nhóm đang trống. Bấm "Thêm món" để gán món có sẵn vào đây.'}
              </AppText>
            </View>
          ) : (
            groupProducts.map((item) => (
              <View key={item.id} style={styles.productCard}>
                <View style={styles.cardMainRow}>
                  <Image source={{ uri: item.image }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <AppText variant="cardTitle" color={colors.textPrimary}>
                      {item.name}
                    </AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <AppText variant="price" color={colors.primary}>
                        {formatCurrency(item.basePrice)}
                      </AppText>
                      {!!item.originalPrice && item.originalPrice > item.basePrice && (
                        <AppText variant="small" color={colors.textSecondary} style={{ textDecorationLine: 'line-through' }}>
                          {formatCurrency(item.originalPrice)}
                        </AppText>
                      )}
                    </View>
                    {!!memberDiscountLabel(item) && (
                      <View style={{ alignSelf: 'flex-start', backgroundColor: '#DE3B2B', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 }}>
                        <AppText variant="small" color={colors.white}>
                          {memberDiscountLabel(item)}
                        </AppText>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.editBtn, { backgroundColor: colors.errorSoft }]}
                    activeOpacity={0.7}
                    onPress={() => handleRemoveFromGroup(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ ${item.name} khỏi ${groupName}`}
                  >
                    <Trash2 size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Bước 1: chọn món có sẵn (cùng 1 modal với form — tránh 2 modal chồng nhau trên web) */}
      <Modal
        visible={pickerVisible && !pendingItem}
        transparent
        animationType="slide"
        onRequestClose={() => { setPickerVisible(false); setPendingItem(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                Chọn món để thêm vào {groupName}
              </AppText>
              <TouchableOpacity onPress={() => { setPickerVisible(false); setPendingItem(null); }}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {group === 'cheese_party' && (
              <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 10 }}>
                ⚠️ Tiệc Cheese chỉ nhận món Pizza hoặc Combo Pizza.
              </AppText>
            )}

            <View style={styles.searchInputWrap}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                placeholder="Tìm món có sẵn..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {pickableProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    {group === 'cheese_party'
                      ? 'Hết list pizza/combo để thêm (hoặc trùng từ khóa tìm kiếm)'
                      : 'Không tìm thấy món phù hợp'}
                  </AppText>
                </View>
              ) : (
                pickableProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.cardMainRow}
                    activeOpacity={0.7}
                    onPress={() => handlePickItem(item)}
                  >
                    <Image source={{ uri: item.image }} style={{ ...styles.productImage, width: 48, height: 48 }} />
                    <View style={styles.productInfo}>
                      <AppText variant="cardTitle" color={colors.textPrimary}>
                        {item.name}
                      </AppText>
                      <AppText variant="small" color={colors.textSecondary}>
                        Đang ở: {CAT_NAMES[item.categoryId] || item.categoryId}
                        {groupsOf(item).length > 0 &&
                          ` · Đang có nhãn: ${groupsOf(item).map((g) => CAT_NAMES[g] || g).join(', ')}`}
                        {` · ${formatCurrency(item.basePrice)}`}
                      </AppText>
                    </View>
                    <Plus size={18} color={colors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bước 2: form đặc trưng theo nhóm — vẫn trong luồng modal bước 1 */}
      <Modal
        visible={pickerVisible && !!pendingItem}
        transparent
        animationType="slide"
        onRequestClose={() => { setPendingItem(null); setPickerVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                {pendingItem?.name} → {groupName}
              </AppText>
              <TouchableOpacity onPress={() => { setPendingItem(null); setPickerVisible(false); }}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {group === 'cheese_party' && (
              <>
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Điểm nhấn phô mai (ghi vào mô tả)
                  </AppText>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ví dụ: X3 phô mai kéo sợi"
                    value={formNote}
                    onChangeText={setFormNote}
                  />
                </View>
                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AppText variant="captionMedium" color={colors.textSecondary}>
                      {'Gắn badge "New" cho món'}
                    </AppText>
                    <Switch
                      value={formNew}
                      onValueChange={setFormNew}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    % giảm cho món (giá mới tự tính — để trống nếu không giảm)
                  </AppText>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="Ví dụ: 20"
                    value={formValue}
                    onChangeText={setFormValue}
                  />
                </View>
              </>
            )}

            {group === 'member_deals' && (
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  % giảm cho thành viên (giá mới tự tính) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 15"
                  value={formValue}
                  onChangeText={setFormValue}
                />
              </View>
            )}

            {group === 'hot_deals' && (
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  % giảm giá Deal Hot (tối đa 70%) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 50"
                  value={formValue}
                  onChangeText={setFormValue}
                />
              </View>
            )}

            {!!previewLine && (
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <AppText variant="small" color={colors.textSecondary}>
                  Kết quả: {previewLine}
                </AppText>
              </View>
            )}

            {isSaving ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.formActions}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => { setPendingItem(null); setPickerVisible(false); }}
                  >
                    <AppText variant="captionSemiBold" color={colors.textPrimary}>
                      Hủy
                    </AppText>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.8}
                    onPress={handleConfirmAdd}
                  >
                    <AppText variant="captionSemiBold" color={colors.white}>
                      Thêm vào {groupName}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
