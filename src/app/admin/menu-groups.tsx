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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Plus, Search, X, Trash2, Edit2, Upload, RotateCcw, Check, Image as ImageIcon } from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminProducts.styles';
import { Product } from '../../types/product';
import { productService } from '../../services';
import { formatCurrency } from '../../utils/formatCurrency';
import { memberDiscountLabel } from '../../utils/memberDiscount';
import { reportAdminAction } from '../../services/orderApi';
import { pickAndUploadImage } from '../../services/imageUpload';
import {
  PromoBannerContent,
  PROMO_BANNER_DOC_ID,
  PROMO_BANNER_STORAGE_KEY,
} from '../../components/banners/PromoBannerSlides';

// 3 nhóm promo hiển thị card trên trang chủ — mỗi món chỉ được nằm ở tối đa 1 nhóm promo
const PROMO_GROUPS = [
  { id: 'cheese_party', name: 'Tiệc Cheese' },
  { id: 'member_deals', name: 'Thành Viên' },
  { id: 'hot_deals', name: 'Deal Hot 70%' },
];
const PROMO_IDS = PROMO_GROUPS.map((g) => g.id);

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
  hot_deals: 'Deal Hot 70%',
  pizza: 'Pizza',
  starters: 'Khai vị',
  drinks: 'Thức uống',
};

const parseNumber = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export default function AdminMenuGroupsScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState('cheese_party');

  // Custom Banner URLs cho 3 nhóm promo (lưu tại doc `products/__PROMO_BANNERS`)
  const [customBanners, setCustomBanners] = useState<Record<string, string>>({});
  // Bản nháp Banner chưa lưu (chỉ khi bấm "Lưu Banner" mới ghi lên Firestore)
  const [draftBanners, setDraftBanners] = useState<Record<string, string | null>>({});
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUrlModalVisible, setBannerUrlModalVisible] = useState(false);
  const [bannerUrlInput, setBannerUrlInput] = useState('');

  // Modal chọn món có sẵn trong menu để thêm vào nhóm
  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form đặc trưng theo nhóm (bấm món trong picker hoặc bấm Sửa -> mở form này)
  const [pendingItem, setPendingItem] = useState<Product | null>(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [formValue, setFormValue] = useState(''); // % giảm giá
  const [formNote, setFormNote] = useState(''); // cheese: điểm nhấn phô mai
  const [formNew, setFormNew] = useState(true); // cheese: badge New

  useEffect(() => {
    AsyncStorage.getItem(PROMO_BANNER_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setCustomBanners((prev) => ({ ...parsed, ...prev }));
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(
      collection(db, 'products'),
      (snapshot: any) => {
        const list: (Product & { sortOrder?: number })[] = [];
        const bannersMap: Record<string, string> = {};
        let foundBannerDoc = false;
        snapshot.forEach((d: any) => {
          const data = d.data();
          if (d.id === PROMO_BANNER_DOC_ID) {
            foundBannerDoc = true;
            PROMO_IDS.forEach((gid) => {
              if (typeof data?.[gid] === 'string' && data[gid].trim().length > 0) {
                bannersMap[gid] = data[gid].trim();
              }
            });
            return;
          }
          if (d.id.startsWith('__')) return;
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
            isSpicy: data.isSpicy === true,
            isAvailable: data.isAvailable !== false,
            variants: data.variants || [],
            addons: data.addons || [],
            promoGroups: Array.isArray(data.promoGroups) ? data.promoGroups : undefined,
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 999,
          } as Product & { sortOrder?: number });
        });
        list.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        if (foundBannerDoc) {
          setCustomBanners(bannersMap);
          AsyncStorage.setItem(PROMO_BANNER_STORAGE_KEY, JSON.stringify(bannersMap)).catch(() => {});
        }
        setProducts(list);
        setLoading(false);
      },
      (err: any) => {
        console.warn('Lỗi Firestore onSnapshot products:', err.message);
        setProducts([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const groupName = PROMO_GROUPS.find((g) => g.id === group)?.name || group;
  const groupProducts = products.filter((p) => inGroup(p, group));
  const savedCustomBanner = customBanners[group] || '';
  const hasUnsavedBanner = Object.prototype.hasOwnProperty.call(draftBanners, group);
  const currentCustomBanner = hasUnsavedBanner ? draftBanners[group] || '' : savedCustomBanner;

  // ---------- QUẢN LÝ BANNER QUẢNG CÁO CỦA NHÓM ----------

  const saveGroupBannerUrl = async (url: string | null) => {
    setIsUploadingBanner(true);
    try {
      const nextBanners = { ...customBanners };
      if (url && url.trim().length > 0) {
        nextBanners[group] = url.trim();
      } else {
        delete nextBanners[group];
      }

      await AsyncStorage.setItem(PROMO_BANNER_STORAGE_KEY, JSON.stringify(nextBanners)).catch(
        () => {}
      );

      await setDoc(
        doc(db, 'products', PROMO_BANNER_DOC_ID),
        {
          [group]: url && url.trim().length > 0 ? url.trim() : deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setCustomBanners(nextBanners);
      setDraftBanners((prev) => {
        const copy = { ...prev };
        delete copy[group];
        return copy;
      });

      void reportAdminAction('PROMO_BANNER_UPDATED', `products/${PROMO_BANNER_DOC_ID}`, {
        group,
        action: url ? 'set_custom_banner' : 'reset_default_banner',
      });
      Alert.alert('Đã lưu Banner', `Banner trang chủ của nhóm "${groupName}" đã được cập nhật.`);
    } catch (e: any) {
      Alert.alert('Không lưu được banner', e?.message || 'Vui lòng thử lại.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleUploadBannerFromDevice = async () => {
    setIsUploadingBanner(true);
    try {
      const uploadedUrl = await pickAndUploadImage('banners', {
        aspect: [16, 10],
        quality: 0.85,
      });
      if (uploadedUrl) {
        setDraftBanners((prev) => ({
          ...prev,
          [group]: uploadedUrl,
        }));
      }
    } catch (e: any) {
      Alert.alert('Chọn ảnh banner thất bại', e?.message || 'Vui lòng thử lại.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleResetDefaultBanner = () => {
    setDraftBanners((prev) => ({
      ...prev,
      [group]: null,
    }));
  };

  const handleCancelDraftBanner = () => {
    setDraftBanners((prev) => {
      const copy = { ...prev };
      delete copy[group];
      return copy;
    });
  };

  const handleConfirmSaveBanner = async () => {
    if (!hasUnsavedBanner) return;
    await saveGroupBannerUrl(draftBanners[group] ?? null);
  };

  // Điều kiện riêng của Tiệc Cheese: chỉ nhận món pizza / combo pizza
  const isPizzaOrCombo = (p: Product) => {
    const name = p.name.toLowerCase();
    return (
      p.categoryId === 'pizza' ||
      p.categoryId === 'cheese_party' ||
      name.includes('pizza') ||
      name.includes('combo') ||
      p.id.startsWith('CB') ||
      (p.tags || []).some((t) => t.toLowerCase().includes('combo'))
    );
  };

  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();

  // Chỉ được chọn món Pizza đã tạo trong menu VÀ chưa thuộc bất kỳ nhóm promo nào (không thêm Khai vị / Thức uống)
  const pickableProducts = products
    .filter((p) => groupsOf(p).length === 0)
    .filter((p) => isPizzaOrCombo(p))
    .filter(
      (p) =>
        !searchQuery.trim() ||
        norm(`${p.name} ${p.description || ''}`).includes(norm(searchQuery))
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
      productService.invalidateCache?.();
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
    if (groupsOf(item).length > 0) {
      Alert.alert(
        'Món đã thuộc nhóm ưu đãi khác',
        `Món "${item.name}" đang nằm trong ${groupsOf(item)
          .map((g) => CAT_NAMES[g] || g)
          .join(', ')}. Vui lòng gỡ khỏi nhóm cũ trước khi thêm vào ${groupName}.`
      );
      return;
    }
    setIsEditingItem(false);
    setPendingItem(item);
    setFormValue(group === 'hot_deals' ? '30' : '15');
    setFormNote('');
    setFormNew(Boolean(item.isNew));
  };

  // Bấm nút Sửa trên món đã nằm trong nhóm -> mở form chỉnh % giảm giá
  const handleEditGroupItem = (item: Product) => {
    let currentPct = item.discountPercent || 0;
    if (!currentPct && item.originalPrice && item.originalPrice > item.basePrice) {
      currentPct = Math.round(((item.originalPrice - item.basePrice) / item.originalPrice) * 100);
    }
    if (!currentPct && item.memberDiscountTag) {
      const m = item.memberDiscountTag.match(/(\d+)\s*%/);
      if (m) currentPct = Number(m[1]);
    }
    setIsEditingItem(true);
    setPendingItem(item);
    setFormValue(String(currentPct || (group === 'hot_deals' ? 30 : 15)));
    setFormNote('');
    setFormNew(Boolean(item.isNew));
    setPickerVisible(true);
  };

  // Tính payload "đặc sản" theo từng nhóm.
  // Mỗi món chỉ thuộc duy nhất 1 nhóm promo (`promoGroups: [group]`) và luôn có badge giảm giá trên card.
  const buildGroupPayload = (item: Product): Record<string, any> | null => {
    const existingGroups = groupsOf(item).filter((g) => g !== group);
    if (existingGroups.length > 0) {
      Alert.alert(
        'Không thể thêm trùng nhóm',
        `Món "${item.name}" đã thuộc nhóm ${existingGroups.map((g) => CAT_NAMES[g] || g).join(', ')}.`
      );
      return null;
    }
    const promoGroups = [group];
    const migration: Record<string, any> = PROMO_IDS.includes(item.categoryId)
      ? { categoryId: FALLBACK_GROUP }
      : {};

    if (group === 'cheese_party') {
      const note = formNote.trim();
      const pct = parseNumber(formValue);
      if (pct <= 0 || pct >= 100) {
        Alert.alert('% giảm không hợp lệ', 'Vui lòng nhập % giảm từ 1% đến 99% để hiển thị mức giảm trên card.');
        return null;
      }
      const original = baseOf(item);
      const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
      return {
        ...migration,
        promoGroups,
        originalPrice: original,
        basePrice: salePrice,
        discountPercent: pct,
        memberDiscountTag: `Ưu đãi thành viên ${pct}%`,
        isNew: formNew,
        isPopular: false,
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
      const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
      return {
        ...migration,
        promoGroups,
        originalPrice: original,
        basePrice: salePrice,
        discountPercent: pct,
        memberDiscountTag: `Ưu đãi thành viên ${pct}%`,
        isPopular: false,
      };
    }

    // hot_deals
    const pct = parseNumber(formValue);
    const original = baseOf(item);
    if (pct <= 0 || pct > 70) {
      Alert.alert('% giảm không hợp lệ', 'Deal Hot chỉ nhận số giảm từ 1% đến 70%.');
      return null;
    }
    const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
    return {
      ...migration,
      promoGroups,
      originalPrice: original,
      basePrice: salePrice,
      discountPercent: pct,
      memberDiscountTag: `GIẢM ${pct}%`,
      isPopular: false,
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
    setIsEditingItem(false);
    setPendingItem(null);
    setPickerVisible(false);
    setSearchQuery('');
  };

  // Bỏ món khỏi nhóm promo: gỡ nhãn nhóm và khôi phục giá gốc
  const handleRemoveFromGroup = (item: Product) => {
    const remaining = groupsOf(item).filter((g) => g !== group);
    Alert.alert(
      'Bỏ khỏi nhóm',
      `Bỏ "${item.name}" khỏi ${groupName}? Giá ưu đãi & nhãn giảm giá sẽ bị gỡ, món trở về giá gốc và vẫn nằm ở ${CAT_NAMES[item.categoryId] || item.categoryId}.`,
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
    if (group === 'member_deals' || group === 'cheese_party') {
      const pct = parseNumber(formValue);
      const original = baseOf(pendingItem);
      if (pct > 0 && pct < 100) {
        const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
        return `Giá ưu đãi: ${vnd(salePrice)} (gốc ${vnd(original)} gạch ngang) + nhãn trên card "Ưu đãi thành viên ${pct}%"`;
      }
      return 'Nhập % giảm (1–99%)';
    }
    const pct = parseNumber(formValue);
    const original = baseOf(pendingItem);
    if (pct > 0 && pct <= 70) {
      const salePrice = Math.round((original * (100 - pct)) / 100 / 1000) * 1000;
      return `Giá ưu đãi: ${vnd(salePrice)} (gốc ${vnd(original)} gạch ngang) + nhãn trên card "GIẢM ${pct}%"`;
    }
    return 'Nhập % giảm (1–70%)';
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Nhóm Ưu Đãi"
        subtitle="Quản lý banner quảng cáo & danh sách món theo từng chiến dịch"
        showBack={true}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/admin/products'))}
      />

      {/* Chọn nhóm (chia đều 3 tab vừa khít thanh) */}
      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 8,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {PROMO_GROUPS.map((g) => {
          const isActive = group === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              activeOpacity={0.7}
              onPress={() => {
                setGroup(g.id);
                setPendingItem(null);
              }}
            >
              <AppText
                variant="captionMedium"
                color={isActive ? colors.white : colors.textPrimary}
                numberOfLines={1}
              >
                {g.name}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Danh sách món + Banner quảng cáo của nhóm */}
      {!loading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {/* KHỐI QUẢN LÝ BANNER QUẢNG CÁO CỦA NHÓM ĐANG CHỌN */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              marginBottom: 4,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <ImageIcon size={16} color={colors.primary} />
                <AppText variant="cardTitle" color={colors.textPrimary} style={{ flex: 1 }} numberOfLines={1}>
                  Banner Trang chủ — {groupName}
                </AppText>
              </View>
              <View
                style={{
                  backgroundColor: hasUnsavedBanner
                    ? colors.primarySoft
                    : currentCustomBanner
                      ? colors.primarySoft
                      : colors.surfaceAlt,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                <AppText
                  variant="small"
                  color={
                    hasUnsavedBanner || currentCustomBanner
                      ? colors.primary
                      : colors.textSecondary
                  }
                  style={{ fontWeight: '700' }}
                >
                  {hasUnsavedBanner
                    ? 'Chưa lưu'
                    : currentCustomBanner
                      ? 'Ảnh tùy chỉnh'
                      : 'Mặc định'}
                </AppText>
              </View>
            </View>

            {/* Khung xem trước Banner trực tiếp */}
            <View
              style={{
                width: '100%',
                height: 186,
                borderRadius: 14,
                overflow: 'hidden',
                borderWidth: hasUnsavedBanner ? 2 : 1,
                borderColor: hasUnsavedBanner ? colors.primary : '#EFE6E4',
                backgroundColor: colors.white,
                position: 'relative',
              }}
            >
              <PromoBannerContent groupId={group} customImageUrl={currentCustomBanner} />
              {isUploadingBanner && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255,255,255,0.72)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            </View>

            {/* Hàng nút chọn / đổi ảnh Banner */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: hasUnsavedBanner ? colors.surface : colors.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                activeOpacity={0.8}
                disabled={isUploadingBanner}
                onPress={handleUploadBannerFromDevice}
              >
                <Upload size={15} color={hasUnsavedBanner ? colors.primary : colors.white} />
                <AppText
                  variant="captionSemiBold"
                  color={hasUnsavedBanner ? colors.primary : colors.white}
                >
                  Tải ảnh mới
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                activeOpacity={0.8}
                disabled={isUploadingBanner}
                onPress={() => {
                  setBannerUrlInput(currentCustomBanner);
                  setBannerUrlModalVisible(true);
                }}
              >
                <Edit2 size={14} color={colors.textPrimary} />
                <AppText variant="captionSemiBold" color={colors.textPrimary}>
                  Dán link ảnh
                </AppText>
              </TouchableOpacity>

              {(!!currentCustomBanner || !!savedCustomBanner) && (
                <TouchableOpacity
                  style={{
                    height: 38,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: colors.errorSoft,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                  activeOpacity={0.8}
                  disabled={isUploadingBanner}
                  onPress={handleResetDefaultBanner}
                >
                  <RotateCcw size={14} color={colors.error} />
                  <AppText variant="small" color={colors.error} style={{ fontWeight: '700' }}>
                    Mặc định
                  </AppText>
                </TouchableOpacity>
              )}
            </View>

            {/* Thanh xác nhận Lưu Banner / Hủy khi vừa chọn ảnh mới */}
            {hasUnsavedBanner && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                  activeOpacity={0.8}
                  disabled={isUploadingBanner}
                  onPress={handleCancelDraftBanner}
                >
                  <X size={15} color={colors.textSecondary} />
                  <AppText variant="captionSemiBold" color={colors.textSecondary}>
                    Hủy thay đổi
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1.4,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  activeOpacity={0.85}
                  disabled={isUploadingBanner}
                  onPress={handleConfirmSaveBanner}
                >
                  <Check size={16} color={colors.white} />
                  <AppText variant="captionSemiBold" color={colors.white} style={{ fontWeight: '700' }}>
                    Lưu Banner
                  </AppText>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Số món + nút thêm */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 4,
              marginBottom: 4,
            }}
          >
            <AppText variant="bodyMedium" color={colors.textSecondary}>
              {`${groupProducts.length} món trong ${groupName}`}
            </AppText>
            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.8}
              onPress={() => {
                setIsEditingItem(false);
                setPendingItem(null);
                setPickerVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Thêm món vào ${groupName}`}
            >
              <Plus size={18} color={colors.white} />
              <AppText variant="captionSemiBold" color={colors.white}>
                Thêm món
              </AppText>
            </TouchableOpacity>
          </View>

          {groupProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                {'Nhóm đang trống. Bấm "Thêm món" để chọn món có sẵn trong Menu.'}
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
                        <AppText
                          variant="small"
                          color={colors.textSecondary}
                          style={{ textDecorationLine: 'line-through' }}
                        >
                          {formatCurrency(item.originalPrice)}
                        </AppText>
                      )}
                    </View>
                    {!!memberDiscountLabel(item) && (
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: colors.primary,
                          borderRadius: 4,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          marginTop: 2,
                        }}
                      >
                        <AppText variant="small" color={colors.white}>
                          {memberDiscountLabel(item)}
                        </AppText>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      activeOpacity={0.7}
                      onPress={() => handleEditGroupItem(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sửa giảm giá ${item.name}`}
                    >
                      <Edit2 size={13} color={colors.textPrimary} />
                      <AppText variant="small" color={colors.textPrimary} style={{ fontWeight: '600' }}>
                        Sửa
                      </AppText>
                    </TouchableOpacity>
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
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal dán link ảnh Banner */}
      <Modal
        visible={bannerUrlModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBannerUrlModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                Đổi ảnh Banner — {groupName}
              </AppText>
              <TouchableOpacity onPress={() => setBannerUrlModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <AppText variant="captionSemiBold" style={styles.inputLabel}>
                Đường dẫn ảnh (URL) hoặc tải từ thiết bị
              </AppText>
              <TextInput
                style={styles.formInput}
                placeholder="https://example.com/banner.jpg"
                placeholderTextColor={colors.textSecondary}
                value={bannerUrlInput}
                onChangeText={setBannerUrlInput}
                autoCapitalize="none"
              />
            </View>

            {!!bannerUrlInput.trim() && (
              <View
                style={{
                  width: '100%',
                  height: 150,
                  borderRadius: 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 14,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Image
                  source={{ uri: bannerUrlInput.trim() }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            )}

            <View style={styles.formActions}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={{
                    height: 46,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setBannerUrlModalVisible(false)}
                >
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    Hủy
                  </AppText>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={{
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    const trimmed = bannerUrlInput.trim();
                    setBannerUrlModalVisible(false);
                    setDraftBanners((prev) => ({
                      ...prev,
                      [group]: trimmed || null,
                    }));
                  }}
                >
                  <AppText variant="bodyMedium" color={colors.white} style={{ fontWeight: '700' }}>
                    Xem trước
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bước 1: chọn món có sẵn trong Menu (chỉ hiện các món chưa thuộc nhóm promo nào) */}
      <Modal
        visible={pickerVisible && !pendingItem}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPickerVisible(false);
          setPendingItem(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                Chọn món thêm vào {groupName}
              </AppText>
              <TouchableOpacity
                onPress={() => {
                  setPickerVisible(false);
                  setPendingItem(null);
                }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 10 }}>
              ⚠️ Chỉ hiển thị các món Pizza trong Menu chưa thuộc nhóm ưu đãi nào khác.
            </AppText>

            <View style={[styles.searchInputWrap, { flex: 0, height: 42, marginBottom: 12 }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                placeholder="Tìm món Pizza có sẵn trong Menu..."
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
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
            >
              {pickableProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    Các món Pizza trong Menu đều đã có nhóm ưu đãi (hoặc không khớp từ khóa).
                  </AppText>
                </View>
              ) : (
                pickableProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.cardMainRow,
                      {
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handlePickItem(item)}
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={{ ...styles.productImage, width: 48, height: 48 }}
                    />
                    <View style={styles.productInfo}>
                      <AppText variant="cardTitle" color={colors.textPrimary}>
                        {item.name}
                      </AppText>
                      <AppText variant="small" color={colors.textSecondary}>
                        Pizza · {formatCurrency(item.basePrice)}
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

      {/* Bước 2: form thiết lập % giảm giá để hiện lên card */}
      <Modal
        visible={pickerVisible && !!pendingItem}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsEditingItem(false);
          setPendingItem(null);
          setPickerVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                {isEditingItem ? `Sửa giảm giá: ${pendingItem?.name}` : `${pendingItem?.name} → ${groupName}`}
              </AppText>
              <TouchableOpacity
                onPress={() => {
                  setIsEditingItem(false);
                  setPendingItem(null);
                  setPickerVisible(false);
                }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {group === 'cheese_party' && (
              <>
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    % giảm hiển thị trên card (tự tính giá ưu đãi) *
                  </AppText>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="Ví dụ: 14"
                    value={formValue}
                    onChangeText={setFormValue}
                  />
                </View>
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Điểm nhấn phô mai (tùy chọn)
                  </AppText>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Để trống nếu giữ nguyên mô tả gốc"
                    value={formNote}
                    onChangeText={setFormNote}
                  />
                </View>
                <View style={styles.formGroup}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
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
              </>
            )}

            {group === 'member_deals' && (
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  % giảm cho thành viên hiển thị trên card *
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
                  % giảm giá Deal Hot hiển thị trên card (tối đa 70%) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 31"
                  value={formValue}
                  onChangeText={setFormValue}
                />
              </View>
            )}

            {!!previewLine && (
              <View
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
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
                    onPress={() => {
                      if (isEditingItem) {
                        setIsEditingItem(false);
                        setPendingItem(null);
                        setPickerVisible(false);
                      } else {
                        setPendingItem(null);
                      }
                    }}
                  >
                    <AppText variant="bodyMedium" color={colors.textSecondary}>
                      {isEditingItem ? 'Hủy' : '← Chọn món khác'}
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
                    onPress={handleConfirmAdd}
                  >
                    <AppText variant="bodyMedium" color={colors.white} style={{ fontWeight: '700' }}>
                      {isEditingItem ? 'Lưu thay đổi' : `Thêm vào ${groupName}`}
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
