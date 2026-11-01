import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ticket,
  Plus,
  Award,
  X,
  Trash2,
  Gift,
  Edit2,
  Check,
} from 'lucide-react-native';
import * as FirestorePkg from 'firebase/firestore';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminPromotions.styles';
import { Coupon } from '../../types/user';
import { Product } from '../../types/product';
import { mockCoupons } from '../../data/mockPromotions';
import { mockProducts } from '../../data/mockProducts';
import { rewardCatalog } from '../../data/rewards';
import { formatCurrency } from '../../utils/formatCurrency';
import { isCouponExpired } from '../../utils/coupons';
import { reportAdminAction } from '../../services/orderApi';

export interface AdminRewardGiftItem {
  id: string;
  title: string;
  points: number;
  imageUrl?: string;
  productId?: string;
  stored?: boolean;
}

export default function AdminPromotionsScreen() {
  // Built-in coupons ship with the app; only coupons stored in Firestore can be removed here.
  const [coupons, setCoupons] = useState<(Coupon & { stored?: boolean })[]>(mockCoupons);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voucher Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('150000');
  const [maxDiscount, setMaxDiscount] = useState('50000');
  const [desc, setDesc] = useState('');
  const [expiresAt, setExpiresAt] = useState('31/12/2026');
  const [usageLimit, setUsageLimit] = useState('');

  // FPT Rewards Gift Items state
  const [rewardItems, setRewardItems] = useState<AdminRewardGiftItem[]>(() =>
    rewardCatalog.map((r) => ({ id: r.id, title: r.title, points: r.points, stored: false }))
  );
  const [menuProducts, setMenuProducts] = useState<Product[]>(mockProducts);
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<AdminRewardGiftItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardPoints, setRewardPoints] = useState('50');
  const [rewardImageUrl, setRewardImageUrl] = useState('');
  const [isSavingReward, setIsSavingReward] = useState(false);

  // 2 ô chuyển đổi: chỉ hiện nội dung của ô được chọn
  const [section, setSection] = useState<'voucher' | 'rewards'>('voucher');

  const loadRewardsAndProducts = useCallback(async () => {
    const getDocsFn = (FirestorePkg as any).getDocs;
    if (typeof getDocsFn !== 'function') return;

    try {
      const [rewardsSnap, productsSnap] = await Promise.all([
        ((FirestorePkg as any).getDoc ? (FirestorePkg as any).getDoc(doc(db, 'coupons', '__REWARDS_CONFIG__')) : Promise.resolve(null)).catch(() => null),
        getDocsFn(collection(db, 'products')).catch(() => null),
      ]);

      if (productsSnap && !productsSnap.empty) {
        const pList: Product[] = [];
        productsSnap.forEach((d: any) => {
          const data = d.data();
          pList.push({
            id: d.id,
            name: data.name || 'Món ăn',
            categoryId: data.categoryId || data.category || 'pizza',
            description: data.description || '',
            image: data.image || data.imageUrl || '',
            basePrice: Number(data.basePrice || data.price || 0),
            isAvailable: data.isAvailable !== false,
            variants: data.variants || [],
            addons: data.addons || [],
          });
        });
        if (pList.length > 0) setMenuProducts(pList);
      }

      if (rewardsSnap) {
        const storedRewardsMap = new Map<string, AdminRewardGiftItem>();
        Object.entries(rewardsSnap.data?.()?.items || {}).forEach(([rId, rawItem]: [string, any]) => { const d = { id: rId, data: () => rawItem };
          const data = d.data();
          if (data?.deleted) {
            storedRewardsMap.set(d.id, { id: d.id, title: '', points: -1, stored: true });
            return;
          }
          storedRewardsMap.set(d.id, {
            id: d.id,
            title: data.title || 'Quà FPT Rewards',
            points: Number(data.points || 30),
            imageUrl: data.imageUrl || undefined,
            productId: data.productId || undefined,
            stored: true,
          });
        });

        const merged: AdminRewardGiftItem[] = [];
        storedRewardsMap.forEach((val) => {
          if (val.points > 0 && !rewardCatalog.some((b) => b.id === val.id)) {
            merged.push(val);
          }
        });
        rewardCatalog.forEach((base) => {
          const override = storedRewardsMap.get(base.id);
          if (override && override.points === -1) return; // deleted
          if (override) {
            merged.push(override);
          } else {
            merged.push({ id: base.id, title: base.title, points: base.points, stored: false });
          }
        });
        setRewardItems(merged);
      }
    } catch {
      // Fallback to default catalog
    }
  }, []);

  useEffect(() => {
    // Lắng nghe Firestore collection 'coupons'
    const unsub = onSnapshot(
      collection(db, 'coupons'),
      (snapshot: any) => {
        const list: (Coupon & { stored?: boolean })[] = [];
        snapshot.forEach((d: any) => {
          if (String(d.id).startsWith('__')) return;
          const data = d.data();
          list.push({
            code: data.code || '',
            discountType: data.discountType || 'PERCENT',
            value: Number(data.value || 0),
            minSubtotal: Number(data.minSubtotal || 0),
            maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
            description: data.description || '',
            expiresAt: data.expiresAt || undefined,
            ...(data.usageLimit
              ? { usageLimit: Number(data.usageLimit), usedCount: Number(data.usedCount || 0) }
              : {}),
            stored: true,
          });
        });
        setCoupons([...list, ...mockCoupons.filter((m) => !list.some((c) => c.code === m.code))]);
      },
      (err: any) => {
        console.warn('Lỗi Firestore coupons:', err.message);
        setCoupons(mockCoupons);
      }
    );

    void loadRewardsAndProducts();
    return () => unsub();
  }, [loadRewardsAndProducts]);

  const handleCreateCoupon = async () => {
    if (!code.trim() || !value.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã Voucher và giá trị giảm');
      return;
    }

    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(expiresAt.trim()) || isCouponExpired({ expiresAt })) {
      Alert.alert('Lỗi', 'Hạn dùng phải là ngày trong tương lai, dạng dd/mm/yyyy');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCoupon = {
        code: code.trim().toUpperCase(),
        discountType,
        value: Number(value),
        minSubtotal: Number(minSubtotal) || 0,
        ...(discountType === 'PERCENT' ? { maxDiscount: Number(maxDiscount) || 50000 } : {}),
        description:
          desc.trim() ||
          `Giảm ${discountType === 'PERCENT' ? `${value}%` : formatCurrency(Number(value))} cho đơn từ ${formatCurrency(Number(minSubtotal))}`,
        expiresAt: expiresAt.trim(),
        ...(Number(usageLimit) > 0
          ? { usageLimit: Math.floor(Number(usageLimit)), usedCount: 0 }
          : {}),
        createdAt: serverTimestamp(),
      };

      const ref = doc(db, 'coupons', newCoupon.code);
      if (mockCoupons.some((m) => m.code === newCoupon.code) || (await getDoc(ref)).exists()) {
        Alert.alert('Mã đã tồn tại', `Mã ${newCoupon.code} đang được sử dụng.`);
        return;
      }
      await setDoc(ref, newCoupon);
      void reportAdminAction('COUPON_CREATED', `coupons/${newCoupon.code}`, {
        discountType: newCoupon.discountType,
        value: newCoupon.value,
      });

      setModalVisible(false);
      setCode('');
      setValue('');
      setDesc('');
      setUsageLimit('');
      Alert.alert('Thành công', `Đã phát hành mã ưu đãi ${newCoupon.code}`);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể tạo mã giảm giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = (item: Coupon & { stored?: boolean }) => {
    if (!item.stored) {
      Alert.alert('Mã mặc định', `Mã ${item.code} là ưu đãi mặc định của hệ thống.`);
      return;
    }
    Alert.alert('Xóa mã ưu đãi', `Bạn muốn gỡ mã ${item.code}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ bỏ',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'coupons', item.code));
            void reportAdminAction('COUPON_DELETED', `coupons/${item.code}`);
          } catch (e: any) {
            Alert.alert('Chưa gỡ được mã', e?.message || 'Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  // Mở modal thêm món đổi điểm FPT Rewards
  const handleOpenAddReward = () => {
    setEditingReward(null);
    const firstProd = menuProducts[0];
    if (firstProd) {
      setSelectedProductId(firstProd.id);
      setRewardTitle(`Đổi 01 ${firstProd.name} miễn phí`);
      setRewardImageUrl(firstProd.image || '');
    } else {
      setSelectedProductId('');
      setRewardTitle('');
      setRewardImageUrl('');
    }
    setRewardPoints('60');
    setRewardModalVisible(true);
  };

  // Mở modal sửa điểm món đổi quà
  const handleOpenEditReward = (item: AdminRewardGiftItem) => {
    setEditingReward(item);
    setSelectedProductId(item.productId || '');
    setRewardTitle(item.title);
    setRewardPoints(String(item.points));
    setRewardImageUrl(item.imageUrl || '');
    setRewardModalVisible(true);
  };

  const handleSelectProductForReward = (prod: Product) => {
    setSelectedProductId(prod.id);
    setRewardTitle(`Đổi 01 ${prod.name} miễn phí`);
    setRewardImageUrl(prod.image || '');
  };

  const handleSaveRewardItem = async () => {
    const cleanTitle = rewardTitle.trim();
    const pts = Math.floor(Number(rewardPoints.replace(/[^0-9]/g, '')));
    if (!cleanTitle) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn món hoặc nhập tên quà đổi điểm.');
      return;
    }
    if (!pts || pts <= 0) {
      Alert.alert('Điểm chưa hợp lệ', 'Số điểm cần để đổi phải lớn hơn 0.');
      return;
    }

    setIsSavingReward(true);
    try {
      const rewardId = editingReward ? editingReward.id : `RW_${Date.now()}`;
      const payload = {
        id: rewardId,
        title: cleanTitle,
        points: pts,
        ...(rewardImageUrl ? { imageUrl: rewardImageUrl } : {}),
        ...(selectedProductId ? { productId: selectedProductId } : {}),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'coupons', '__REWARDS_CONFIG__'), { items: { [rewardId]: payload }, updatedAt: serverTimestamp() }, { merge: true });

      setRewardItems((prev) => {
        const exists = prev.some((r) => r.id === rewardId);
        if (exists) {
          return prev.map((r) =>
            r.id === rewardId
              ? { ...r, title: cleanTitle, points: pts, imageUrl: rewardImageUrl, productId: selectedProductId, stored: true }
              : r
          );
        }
        return [
          {
            id: rewardId,
            title: cleanTitle,
            points: pts,
            imageUrl: rewardImageUrl,
            productId: selectedProductId,
            stored: true,
          },
          ...prev,
        ];
      });

      setRewardModalVisible(false);
      Alert.alert('Thành công', `Đã lưu món đổi quà (${pts} điểm)`);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể lưu món đổi điểm.');
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleDeleteRewardItem = (item: AdminRewardGiftItem) => {
    Alert.alert('Xóa món đổi quà', `Bạn muốn gỡ "${item.title}" khỏi danh sách FPT Rewards?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            if (rewardCatalog.some((b) => b.id === item.id)) {
              await setDoc(doc(db, 'coupons', '__REWARDS_CONFIG__'), { items: { [item.id]: { id: item.id, deleted: true, updatedAt: serverTimestamp() } }, updatedAt: serverTimestamp() }, { merge: true });
            } else {
              await setDoc(doc(db, 'coupons', '__REWARDS_CONFIG__'), { items: { [item.id]: { id: item.id, deleted: true, updatedAt: serverTimestamp() } }, updatedAt: serverTimestamp() }, { merge: true });
            }
            setRewardItems((prev) => prev.filter((r) => r.id !== item.id));
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không thể xóa món đổi quà.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Ưu đãi & FPT Rewards"
        subtitle="Quản lý Voucher & Món đổi điểm"
        showBack={false}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2 ô chuyển đổi: Voucher / FPT Rewards */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {([
            { key: 'voucher', label: 'Mã Giảm Giá (Voucher)', icon: Ticket },
            { key: 'rewards', label: 'FPT Rewards', icon: Gift },
          ] as const).map((tab) => {
            const isActive = section === tab.key;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                onPress={() => setSection(tab.key)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.primary : colors.border,
                  backgroundColor: isActive ? colors.primarySoft : colors.surface,
                }}
              >
                <Icon size={16} color={isActive ? colors.primary : colors.textSecondary} />
                <AppText variant="captionSemiBold" color={isActive ? colors.primary : colors.textSecondary}>
                  {tab.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {section === 'voucher' && (
        /* Card: Quản lý Voucher */
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Ticket size={20} color={colors.primary} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Mã Giảm Giá (Voucher)
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Tạo mã giảm giá mới"
            >
              <Plus size={16} color={colors.white} />
              <AppText variant="captionSemiBold" color={colors.white}>
                Tạo mã
              </AppText>
            </TouchableOpacity>
          </View>

          {coupons.map((item, index) => (
            <View key={item.code + index} style={styles.couponItem}>
              <View style={styles.couponTop}>
                <View style={styles.codeBadge}>
                  <AppText variant="captionSemiBold" color={colors.primary}>
                    {item.code}
                  </AppText>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteCoupon(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Gỡ mã ${item.code}`}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>

              <AppText variant="bodyMedium" color={colors.textPrimary} style={styles.couponDesc}>
                {item.description}
              </AppText>

              <View style={styles.couponMetaRow}>
                <AppText variant="small" color={colors.textSecondary}>
                  Đơn tối thiểu: {formatCurrency(item.minSubtotal)}
                </AppText>
                <AppText
                  variant="small"
                  color={isCouponExpired(item) ? colors.error : colors.textSecondary}
                >
                  {item.expiresAt
                    ? `Hạn dùng: ${item.expiresAt}${isCouponExpired(item) ? ' (đã hết hạn)' : ''}`
                    : 'Không giới hạn thời gian'}
                </AppText>
              </View>
            </View>
          ))}
        </View>
        )}

        {section === 'rewards' && (
        <>
        {/* Card: Quản lý Món Đổi Điểm FPT Rewards */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Gift size={20} color={colors.primary} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Món Đổi Điểm FPT Rewards
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleOpenAddReward}
              activeOpacity={0.8}
            >
              <Plus size={16} color={colors.white} />
              <AppText variant="captionSemiBold" color={colors.white}>
                Thêm món
              </AppText>
            </TouchableOpacity>
          </View>

          <AppText variant="caption" color={colors.textSecondary} style={{ marginBottom: 12 }}>
            Chọn món từ thực đơn và xét số điểm cần để khách hàng đổi miễn phí tại trang FPT Reward.
          </AppText>

          {rewardItems.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" color={colors.textPrimary} numberOfLines={2}>
                  {item.title}
                </AppText>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: colors.primarySoft,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 999,
                    marginTop: 6,
                  }}
                >
                  <AppText variant="captionSemiBold" color={colors.primary}>
                    {item.points} điểm
                  </AppText>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleOpenEditReward(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Edit2 size={14} color={colors.textPrimary} />
                  <AppText variant="small" color={colors.textPrimary}>
                    Sửa điểm
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteRewardItem(item)}
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: colors.errorSoft,
                  }}
                >
                  <Trash2 size={14} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Card 3: Quy tắc 3 Hạng Thành Viên (Đồng bộ 100% với trang User) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Award size={20} color={colors.warning} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Hạng Thành Viên (10.000đ = 1 điểm)
              </AppText>
            </View>
          </View>

          <View style={styles.tierRow}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: colors.surfaceAlt }]}>
                <AppText variant="small" color={colors.textPrimary}>
                  CƠ BẢN
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                {'< 1.000.000đ'}
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.textSecondary}>
              Tích điểm đổi quà (0%)
            </AppText>
          </View>

          <View style={styles.tierRow}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: '#FEF3C7' }]}>
                <AppText variant="small" color="#B45309">
                  HẠNG VÀNG
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                {'≥ 1.000.000đ'}
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.primary}>
              Giảm 10% món lẻ
            </AppText>
          </View>

          <View style={[styles.tierRow, { borderBottomWidth: 0 }]}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="small" color={colors.primary}>
                  HẠNG VIP
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                {'≥ 2.000.000đ'}
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.primary}>
              Giảm 15% món lẻ
            </AppText>
          </View>
        </View>
        </>
        )}
      </ScrollView>

      {/* Modal Tạo Voucher Mới */}
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
                Phát Hành Mã Ưu Đãi Mới
              </AppText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Mã Voucher (Code) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: FPTPIZZA30"
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Loại giảm giá
                </AppText>
                <View style={styles.typeSelectorRow}>
                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      discountType === 'PERCENT' && styles.typeBtnActive,
                    ]}
                    onPress={() => setDiscountType('PERCENT')}
                  >
                    <AppText
                      variant="captionMedium"
                      color={discountType === 'PERCENT' ? colors.white : colors.textPrimary}
                    >
                      Theo Phần Trăm (%)
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      discountType === 'FIXED' && styles.typeBtnActive,
                    ]}
                    onPress={() => setDiscountType('FIXED')}
                  >
                    <AppText
                      variant="captionMedium"
                      color={discountType === 'FIXED' ? colors.white : colors.textPrimary}
                    >
                      Số Tiền Cố Định (VNĐ)
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  {discountType === 'PERCENT'
                    ? 'Phần trăm giảm (%) *'
                    : 'Số tiền giảm (VNĐ) *'}
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder={discountType === 'PERCENT' ? 'Ví dụ: 20' : 'Ví dụ: 30000'}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={setValue}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Đơn hàng tối thiểu (VNĐ)
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="150000"
                  keyboardType="numeric"
                  value={minSubtotal}
                  onChangeText={setMinSubtotal}
                />
              </View>

              {discountType === 'PERCENT' && (
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Giảm tối đa (VNĐ)
                  </AppText>
                  <TextInput
                    style={styles.formInput}
                    placeholder="50000"
                    keyboardType="numeric"
                    value={maxDiscount}
                    onChangeText={setMaxDiscount}
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Hạn dùng (dd/mm/yyyy) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="31/12/2026"
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Số lượt dùng tối đa (để trống = không giới hạn)
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: 100"
                  keyboardType="numeric"
                  value={usageLimit}
                  onChangeText={setUsageLimit}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Mô tả điều kiện
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Mô tả ngắn gọn về ưu đãi..."
                  value={desc}
                  onChangeText={setDesc}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Hủy"
                    variant="outline"
                    onPress={() => setModalVisible(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Phát hành Voucher"
                    isLoading={isSubmitting}
                    onPress={handleCreateCoupon}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Thêm / Sửa Món Đổi Điểm FPT Rewards */}
      <Modal
        visible={rewardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRewardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                {editingReward ? 'Chỉnh Sửa Điểm Đổi Quà' : 'Thêm Món Đổi Điểm'}
              </AppText>
              <TouchableOpacity onPress={() => setRewardModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!editingReward && (
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Chọn món từ thực đơn
                  </AppText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                  >
                    {menuProducts.map((prod) => {
                      const selected = selectedProductId === prod.id;
                      return (
                        <TouchableOpacity
                          key={prod.id}
                          onPress={() => handleSelectProductForReward(prod)}
                          activeOpacity={0.8}
                          style={{
                            width: 128,
                            padding: 8,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primarySoft : colors.surface,
                          }}
                        >
                          {!!prod.image && (
                            <Image
                              source={{ uri: prod.image }}
                              style={{ width: '100%', height: 68, borderRadius: 8, marginBottom: 6 }}
                            />
                          )}
                          <AppText variant="small" color={colors.textPrimary} numberOfLines={2}>
                            {prod.name}
                          </AppText>
                          {selected && (
                            <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.primary, borderRadius: 10, padding: 2 }}>
                              <Check size={12} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Tên quà hiển thị trên FPT Reward *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: Đổi 01 Pizza Hải Sản Cỡ Vừa miễn phí"
                  value={rewardTitle}
                  onChangeText={setRewardTitle}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Số điểm cần để đổi *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: 60"
                  keyboardType="numeric"
                  value={rewardPoints}
                  onChangeText={setRewardPoints}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Hủy"
                    variant="outline"
                    onPress={() => setRewardModalVisible(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Lưu quà đổi điểm"
                    isLoading={isSavingReward}
                    onPress={handleSaveRewardItem}
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
