import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
  Platform,
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
  Calendar,
  ChevronDown,
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
import { isCouponExpired, isValidFutureCouponDate } from '../../utils/coupons';
import { reportAdminAction } from '../../services/orderApi';
import {
  MEMBER_GIFTS_DOC_ID,
  MEMBER_GIFT_OCCASIONS,
  getMemberGiftOccasionLabel,
  loadOrSeedMemberGiftRules,
  type MemberGiftOccasion,
  type MemberGiftRule,
} from '../../utils/memberTier';

export type RewardPizzaSize = 'small' | 'medium' | 'large';

export interface AdminRewardGiftItem {
  id: string;
  title: string;
  points: number;
  imageUrl?: string;
  productId?: string;
  pizzaSize?: RewardPizzaSize;
  stored?: boolean;
}

function getPizzaSizeLabel(size?: RewardPizzaSize): string {
  if (size === 'small') return 'Cỡ Nhỏ';
  if (size === 'large') return 'Cỡ Lớn';
  return 'Cỡ Vừa';
}

function getCouponBenefitLabel(item: Coupon): string {
  if (item.freeShipping) return 'Miễn phí giao hàng';
  if (item.discountType === 'PERCENT') {
    return `Giảm ${item.value}%${
      item.maxDiscount ? ` (tối đa ${formatCurrency(item.maxDiscount)})` : ''
    }`;
  }
  return `Giảm ${formatCurrency(item.value)}`;
}

const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE_H = WHEEL_ITEM_H * 5; // 220
const WHEEL_PAD_Y = WHEEL_ITEM_H * 2; // 88

interface WheelColumnProps {
  items: { value: number; label: string }[];
  selectedValue: number;
  onSelect: (val: number) => void;
}

const WheelColumn: React.FC<WheelColumnProps> = ({ items, selectedValue, onSelect }) => {
  const scrollRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = Math.max(
    0,
    items.findIndex((it) => it.value === selectedValue)
  );

  useEffect(() => {
    if (isDraggingRef.current) return;
    const targetY = selectedIndex * WHEEL_ITEM_H;
    currentOffsetRef.current = targetY;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, 30);
    return () => clearTimeout(t);
  }, [selectedIndex, items.length]);

  const snapToNearest = useCallback(
    (offsetY: number) => {
      if (items.length === 0) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(offsetY / WHEEL_ITEM_H)));
      const targetY = idx * WHEEL_ITEM_H;
      currentOffsetRef.current = targetY;
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      const chosen = items[idx];
      if (chosen && chosen.value !== selectedValue) {
        onSelect(chosen.value);
      }
    },
    [items, onSelect, selectedValue]
  );

  const handleScroll = (e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    currentOffsetRef.current = y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ITEM_H)));
    const chosen = items[idx];
    if (chosen && chosen.value !== selectedValue) {
      onSelect(chosen.value);
    }
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        snapToNearest(currentOffsetRef.current);
      }
    }, 140);
  };

  // Hỗ trợ bấm giữ chuột kéo lên/xuống mượt mà trên giả lập Web lẫn cảm ứng điện thoại
  const webDragProps: Record<string, any> =
    Platform.OS === 'web'
      ? {
          onMouseDown: (e: any) => {
            isDraggingRef.current = true;
            dragStartYRef.current = e.clientY ?? e.pageY ?? 0;
            dragStartOffsetRef.current = currentOffsetRef.current;

            const handleMouseMove = (moveEvt: any) => {
              if (!isDraggingRef.current) return;
              const curY = moveEvt.clientY ?? moveEvt.pageY ?? 0;
              const delta = dragStartYRef.current - curY;
              const maxScroll = Math.max(0, (items.length - 1) * WHEEL_ITEM_H);
              const nextY = Math.max(0, Math.min(maxScroll, dragStartOffsetRef.current + delta));
              currentOffsetRef.current = nextY;
              scrollRef.current?.scrollTo({ y: nextY, animated: false });
              const idx = Math.max(0, Math.min(items.length - 1, Math.round(nextY / WHEEL_ITEM_H)));
              const chosen = items[idx];
              if (chosen) onSelect(chosen.value);
            };

            const handleMouseUp = () => {
              isDraggingRef.current = false;
              snapToNearest(currentOffsetRef.current);
              if (typeof window !== 'undefined') {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              }
            };

            if (typeof window !== 'undefined') {
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }
          },
        }
      : {};

  return (
    <View
      style={
        {
          flex: 1,
          height: WHEEL_VISIBLE_H,
          overflow: 'hidden',
          userSelect: 'none',
        } as any
      }
      {...webDragProps}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={(e) => snapToNearest(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => snapToNearest(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: WHEEL_PAD_Y }}
      >
        {items.map((it, idx) => {
          const dist = Math.abs(idx - selectedIndex);
          const isCenter = dist === 0;
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : 0.28;
          return (
            <TouchableOpacity
              key={it.value}
              activeOpacity={0.7}
              onPress={() => {
                onSelect(it.value);
                scrollRef.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: true });
              }}
              style={{
                height: WHEEL_ITEM_H,
                alignItems: 'center',
                justifyContent: 'center',
                opacity,
              }}
            >
              <AppText
                variant={isCenter ? 'bodySemiBold' : 'body'}
                color={isCenter ? colors.primary : colors.textPrimary}
                style={{
                  fontSize: isCenter ? 17 : dist === 1 ? 15 : 13.5,
                  fontWeight: isCenter ? '800' : '500',
                }}
              >
                {it.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default function AdminPromotionsScreen() {
  const [coupons, setCoupons] = useState<(Coupon & { stored?: boolean })[]>(mockCoupons);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<(Coupon & { stored?: boolean }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voucher Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [desc, setDesc] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [usageLimit, setUsageLimit] = useState('');

  // FPT Rewards Gift Items state (100% từ Firestore, không dùng mock data)
  const [rewardItems, setRewardItems] = useState<AdminRewardGiftItem[]>([]);
  const [menuProducts, setMenuProducts] = useState<Product[]>([]);
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<AdminRewardGiftItem | null>(null);
  const [rewardCategoryTab, setRewardCategoryTab] = useState<'pizza' | 'starters' | 'drinks'>('pizza');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rewardPizzaSize, setRewardPizzaSize] = useState<RewardPizzaSize>('medium');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardImageUrl, setRewardImageUrl] = useState('');
  const [isSavingReward, setIsSavingReward] = useState(false);

  // Quà Tặng Đặc Quyền Thành Viên (Thăng hạng & Sinh nhật)
  const [memberGifts, setMemberGifts] = useState<MemberGiftRule[]>([]);
  const [memberGiftModalVisible, setMemberGiftModalVisible] = useState(false);
  const [editingMemberGift, setEditingMemberGift] = useState<MemberGiftRule | null>(null);
  const [mgOccasion, setMgOccasion] = useState<MemberGiftOccasion>('TIER_GOLD');
  const [mgCategoryTab, setMgCategoryTab] = useState<'pizza' | 'starters' | 'drinks'>('pizza');
  const [mgProductId, setMgProductId] = useState<string>('');
  const [mgPizzaSize, setMgPizzaSize] = useState<RewardPizzaSize>('medium');
  const [mgTitle, setMgTitle] = useState('');
  const [mgMinSubtotal, setMgMinSubtotal] = useState('280000');
  const [mgExpiresAt, setMgExpiresAt] = useState('30/11/2027');
  const [showMgDatePicker, setShowMgDatePicker] = useState(false);
  const [mgImageUrl, setMgImageUrl] = useState('');
  const [isSavingMemberGift, setIsSavingMemberGift] = useState(false);

  // 4 Card mục lục: chỉ khi bấm vào 1 trong 4 card mới chuyển sang trang chi tiết mục đó
  const [section, setSection] = useState<
    'voucher' | 'rewards' | 'gold_gifts' | 'diamond_gifts' | null
  >(null);

  const loadRewardsAndProducts = useCallback(async () => {
    const getDocsFn = (FirestorePkg as any).getDocs;
    if (typeof getDocsFn !== 'function') return;

    try {
      const [rewardsSnap, productsSnap, mgList] = await Promise.all([
        ((FirestorePkg as any).getDoc
          ? (FirestorePkg as any).getDoc(doc(db, 'coupons', '__REWARDS_CONFIG'))
          : Promise.resolve(null)
        ).catch(() => null),
        getDocsFn(collection(db, 'products')).catch(() => null),
        loadOrSeedMemberGiftRules().catch(() => [] as MemberGiftRule[]),
      ]);
      setMemberGifts(mgList);

      let pList: Product[] = [];
      if (productsSnap && !productsSnap.empty) {
        productsSnap.forEach((d: any) => {
          if (String(d.id).startsWith('__')) return;
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
        setMenuProducts(pList);
      }

      const snapData = rewardsSnap?.exists?.() ? rewardsSnap.data?.() : null;
      if ((!snapData || snapData.seeded6MenuRewardsV3 !== true) && pList.length > 0) {
        const drinks = pList
          .filter((p) => ['drinks', 'drink'].includes(String(p.categoryId || '').toLowerCase()))
          .slice(0, 2);
        const starters = pList
          .filter((p) =>
            ['starters', 'starter', 'pasta'].includes(String(p.categoryId || '').toLowerCase())
          )
          .slice(0, 2);
        const pizzas = pList
          .filter((p) =>
            ['pizza', 'cheese_party', 'member_deals', 'hot_deals'].includes(
              String(p.categoryId || '').toLowerCase()
            )
          )
          .slice(0, 2);

        const defaultPicks: { prod: Product; points: number; pizzaSize?: RewardPizzaSize }[] = [
          ...(drinks[0] ? [{ prod: drinks[0], points: 35 }] : []),
          ...(drinks[1] ? [{ prod: drinks[1], points: 50 }] : []),
          ...(starters[0] ? [{ prod: starters[0], points: 75 }] : []),
          ...(starters[1] ? [{ prod: starters[1], points: 90 }] : []),
          ...(pizzas[0] ? [{ prod: pizzas[0], points: 130, pizzaSize: 'medium' as const }] : []),
          ...(pizzas[1] ? [{ prod: pizzas[1], points: 150, pizzaSize: 'medium' as const }] : []),
        ];

        const seededMap: Record<string, any> = {};
        const seededList: AdminRewardGiftItem[] = [];
        defaultPicks.forEach(({ prod, points, pizzaSize }, idx) => {
          const rId = `RW_MENU_${idx + 1}_${prod.id}`;
          const sizeSuffix = pizzaSize ? ` (${getPizzaSizeLabel(pizzaSize)})` : '';
          const title = `Đổi 01 ${prod.name}${sizeSuffix} miễn phí`;
          seededMap[rId] = {
            id: rId,
            title,
            points,
            imageUrl: prod.image || '',
            productId: prod.id,
            ...(pizzaSize ? { pizzaSize } : {}),
            updatedAt: serverTimestamp(),
          };
          seededList.push({
            id: rId,
            title,
            points,
            imageUrl: prod.image || undefined,
            productId: prod.id,
            ...(pizzaSize ? { pizzaSize } : {}),
            stored: true,
          });
        });

        await setDoc(doc(db, 'coupons', '__REWARDS_CONFIG'), {
          seeded6MenuRewards: true,
          seeded6MenuRewardsV2: true,
          seeded6MenuRewardsV3: true,
          items: seededMap,
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        setRewardItems(seededList);
      } else if (snapData) {
        const list: AdminRewardGiftItem[] = [];
        Object.entries(snapData.items || {}).forEach(([rId, rawItem]: [string, any]) => {
          if (!rawItem || rawItem.deleted) return;
          const pts = Number(rawItem.points || 0);
          if (pts <= 0) return;
          list.push({
            id: rId,
            title: rawItem.title || 'Quà FPT Rewards',
            points: pts,
            imageUrl: rawItem.imageUrl || undefined,
            productId: rawItem.productId || undefined,
            pizzaSize: rawItem.pizzaSize || undefined,
            stored: true,
          });
        });
        list.sort((a, b) => a.points - b.points);
        setRewardItems(list);
      } else {
        setRewardItems([]);
      }
    } catch {
      // Ignore error
    }
  }, []);

  useEffect(() => {
    // Lắng nghe Firestore collection 'coupons'
    const unsub = onSnapshot(
      collection(db, 'coupons'),
      (snapshot: any) => {
        const list: (Coupon & { stored?: boolean })[] = [];
        const deletedCodes = new Set<string>();
        snapshot.forEach((d: any) => {
          if (String(d.id).startsWith('__')) return;
          const data = d.data();
          const codeKey = String(data.code || d.id).toUpperCase();
          if (data?.deleted) {
            deletedCodes.add(codeKey);
            return;
          }
          list.push({
            code: codeKey,
            discountType: data.discountType || 'PERCENT',
            value: Number(data.value || 0),
            minSubtotal: Number(data.minSubtotal || 0),
            maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
            description: data.description || '',
            expiresAt: data.expiresAt || undefined,
            freeShipping: Boolean(data.freeShipping),
            firstOrderOnly: Boolean(data.firstOrderOnly),
            ...(data.usageLimit
              ? { usageLimit: Number(data.usageLimit), usedCount: Number(data.usedCount || 0) }
              : {}),
            stored: true,
          });
        });
        setCoupons([
          ...list,
          ...mockCoupons.filter(
            (m) =>
              !deletedCodes.has(m.code.toUpperCase()) &&
              !list.some((c) => c.code.toUpperCase() === m.code.toUpperCase())
          ),
        ]);
      },
      (err: any) => {
        console.warn('Lỗi Firestore coupons:', err.message);
        setCoupons(mockCoupons);
      }
    );

    void loadRewardsAndProducts();
    return () => unsub();
  }, [loadRewardsAndProducts]);

  const handleOpenCreateCoupon = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('PERCENT');
    setValue('');
    setMinSubtotal('');
    setMaxDiscount('');
    setDesc('');
    setExpiresAt('');
    setShowDatePicker(false);
    setUsageLimit('');
    setModalVisible(true);
  };

  const handleOpenEditCoupon = (item: Coupon & { stored?: boolean }) => {
    setEditingCoupon(item);
    setCode(item.code);
    setDiscountType(item.discountType || 'PERCENT');
    setValue(String(item.value ?? ''));
    setMinSubtotal(item.minSubtotal ? String(item.minSubtotal) : '');
    setMaxDiscount(item.maxDiscount ? String(item.maxDiscount) : '');
    setDesc(item.description || '');
    setExpiresAt(item.expiresAt || '');
    setShowDatePicker(false);
    setUsageLimit(item.usageLimit ? String(item.usageLimit) : '');
    setModalVisible(true);
  };

  const handleCreateCoupon = async () => {
    if (!code.trim() || (!value.trim() && !editingCoupon?.freeShipping)) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã Voucher và giá trị giảm');
      return;
    }

    if (expiresAt.trim()) {
      const checkDate = isValidFutureCouponDate(expiresAt);
      if (!checkDate.valid) {
        Alert.alert('Ngày hết hạn chưa hợp lệ', checkDate.error || 'Vui lòng nhập đúng định dạng dd/mm/yyyy');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const normalizedCode = code.trim().toUpperCase();
      const numVal = Number(value) || 0;
      const numMin = Number(minSubtotal) || 0;
      const newCoupon: Record<string, any> = {
        code: normalizedCode,
        discountType,
        value: numVal,
        minSubtotal: numMin,
        ...(discountType === 'PERCENT' && Number(maxDiscount) > 0
          ? { maxDiscount: Number(maxDiscount) }
          : {}),
        description:
          desc.trim() ||
          `Giảm ${
            discountType === 'PERCENT' ? `${numVal}%` : formatCurrency(numVal)
          } cho đơn từ ${formatCurrency(numMin)}`,
        ...(expiresAt.trim() ? { expiresAt: expiresAt.trim() } : {}),
        ...(editingCoupon?.freeShipping ? { freeShipping: true } : {}),
        ...(editingCoupon?.firstOrderOnly ? { firstOrderOnly: true } : {}),
        ...(Number(usageLimit) > 0
          ? {
              usageLimit: Math.floor(Number(usageLimit)),
              usedCount: editingCoupon?.usedCount || 0,
            }
          : {}),
        deleted: false,
        updatedAt: serverTimestamp(),
      };

      const ref = doc(db, 'coupons', normalizedCode);
      if (!editingCoupon) {
        const existingInList = coupons.some((c) => c.code.toUpperCase() === normalizedCode);
        const existingSnap = await getDoc(ref);
        if (existingInList || (existingSnap.exists() && !existingSnap.data()?.deleted)) {
          Alert.alert('Mã đã tồn tại', `Mã ${normalizedCode} đang được sử dụng.`);
          return;
        }
        newCoupon.createdAt = serverTimestamp();
      }

      await setDoc(ref, newCoupon);
      void reportAdminAction(
        editingCoupon ? 'COUPON_UPDATED' : 'COUPON_CREATED',
        `coupons/${normalizedCode}`,
        {
          discountType: newCoupon.discountType,
          value: newCoupon.value,
        }
      );

      setModalVisible(false);
      setEditingCoupon(null);
      setCode('');
      setValue('');
      setDesc('');
      setUsageLimit('');
      Alert.alert(
        'Thành công',
        editingCoupon
          ? `Đã cập nhật mã ưu đãi ${normalizedCode}`
          : `Đã phát hành mã ưu đãi ${normalizedCode}`
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu mã giảm giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = (item: Coupon & { stored?: boolean }) => {
    Alert.alert('Xóa mã ưu đãi', `Bạn muốn gỡ mã ${item.code}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ bỏ',
        style: 'destructive',
        onPress: async () => {
          try {
            const isDefaultMock = mockCoupons.some(
              (m) => m.code.toUpperCase() === item.code.toUpperCase()
            );
            if (isDefaultMock) {
              await setDoc(
                doc(db, 'coupons', item.code),
                { code: item.code, deleted: true, updatedAt: serverTimestamp() },
                { merge: true }
              );
            } else {
              await deleteDoc(doc(db, 'coupons', item.code));
            }
            setCoupons((prev) =>
              prev.filter((c) => c.code.toUpperCase() !== item.code.toUpperCase())
            );
            void reportAdminAction('COUPON_DELETED', `coupons/${item.code}`);
          } catch (e: any) {
            Alert.alert('Chưa gỡ được mã', e?.message || 'Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const isProductPizza = (prod?: Product | null, fallbackTitle?: string): boolean => {
    if (prod) {
      const c = String(prod.categoryId || '').toLowerCase();
      return (
        c === 'pizza' ||
        c === 'cheese_party' ||
        c === 'member_deals' ||
        c === 'hot_deals' ||
        String(prod.name || '').toLowerCase().includes('pizza')
      );
    }
    return String(fallbackTitle || '').toLowerCase().includes('pizza');
  };

  // Mở modal thêm món đổi điểm FPT Rewards
  const handleOpenAddReward = () => {
    setEditingReward(null);
    setRewardCategoryTab('pizza');
    setSelectedProductId('');
    setRewardPizzaSize('medium');
    setRewardTitle('');
    setRewardImageUrl('');
    setRewardPoints('');
    setRewardModalVisible(true);
  };

  // Mở modal sửa điểm món đổi quà
  const handleOpenEditReward = (item: AdminRewardGiftItem) => {
    setEditingReward(item);
    setSelectedProductId(item.productId || '');
    const inferredSize: RewardPizzaSize =
      item.pizzaSize ||
      (item.title.toLowerCase().includes('cỡ lớn')
        ? 'large'
        : item.title.toLowerCase().includes('cỡ nhỏ')
          ? 'small'
          : 'medium');
    setRewardPizzaSize(inferredSize);
    setRewardTitle(item.title);
    setRewardPoints(String(item.points));
    setRewardImageUrl(item.imageUrl || '');
    setRewardModalVisible(true);
  };

  const handleSelectProductForReward = (prod: Product) => {
    setSelectedProductId(prod.id);
    const isPizza = isProductPizza(prod);
    const sizeSuffix = isPizza ? ` (${getPizzaSizeLabel(rewardPizzaSize)})` : '';
    setRewardTitle(`Đổi 01 ${prod.name}${sizeSuffix} miễn phí`);
    setRewardImageUrl(prod.image || '');
  };

  const handleSelectPizzaSize = (nextSize: RewardPizzaSize) => {
    setRewardPizzaSize(nextSize);
    const matchedProd = selectedProductId
      ? menuProducts.find((p) => p.id === selectedProductId)
      : undefined;
    if (matchedProd) {
      setRewardTitle(`Đổi 01 ${matchedProd.name} (${getPizzaSizeLabel(nextSize)}) miễn phí`);
    } else if (rewardTitle.trim()) {
      const stripped = rewardTitle
        .replace(/\s*\(Cỡ (Nhỏ|Vừa|Lớn)\)/gi, '')
        .replace(/\s+miễn phí$/i, '');
      setRewardTitle(`${stripped} (${getPizzaSizeLabel(nextSize)}) miễn phí`);
    }
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

    const matchedProd = selectedProductId
      ? menuProducts.find((p) => p.id === selectedProductId)
      : undefined;
    const isPizza =
      editingReward
        ? Boolean(editingReward.pizzaSize) || isProductPizza(matchedProd, cleanTitle)
        : rewardCategoryTab === 'pizza' || isProductPizza(matchedProd, cleanTitle);

    setIsSavingReward(true);
    try {
      const rewardId = editingReward ? editingReward.id : `RW_${Date.now()}`;
      const nextList: AdminRewardGiftItem[] = (() => {
        const updatedItem: AdminRewardGiftItem = {
          id: rewardId,
          title: cleanTitle,
          points: pts,
          imageUrl: rewardImageUrl || undefined,
          productId: selectedProductId || undefined,
          pizzaSize: isPizza ? rewardPizzaSize : undefined,
          stored: true,
        };
        const exists = rewardItems.some((r) => r.id === rewardId);
        if (exists) {
          return rewardItems.map((r) => (r.id === rewardId ? updatedItem : r));
        }
        return [updatedItem, ...rewardItems];
      })();

      const fullItemsMap: Record<string, any> = {};
      nextList.forEach((r) => {
        fullItemsMap[r.id] = {
          id: r.id,
          title: r.title,
          points: r.points,
          ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
          ...(r.productId ? { productId: r.productId } : {}),
          ...(r.pizzaSize ? { pizzaSize: r.pizzaSize } : {}),
          updatedAt: serverTimestamp(),
        };
      });

      await setDoc(
        doc(db, 'coupons', '__REWARDS_CONFIG'),
        {
          seeded6MenuRewards: true,
          seeded6MenuRewardsV2: true,
          seeded6MenuRewardsV3: true,
          items: fullItemsMap,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setRewardItems(nextList);
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
            const remaining = rewardItems.filter((r) => r.id !== item.id);
            const fullItemsMap: Record<string, any> = {
              [item.id]: { id: item.id, deleted: true, updatedAt: serverTimestamp() },
            };
            remaining.forEach((r) => {
              fullItemsMap[r.id] = {
                id: r.id,
                title: r.title,
                points: r.points,
                ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
                ...(r.productId ? { productId: r.productId } : {}),
                ...(r.pizzaSize ? { pizzaSize: r.pizzaSize } : {}),
                updatedAt: serverTimestamp(),
              };
            });

            await setDoc(
              doc(db, 'coupons', '__REWARDS_CONFIG'),
              {
                seeded6MenuRewards: true,
                seeded6MenuRewardsV2: true,
                seeded6MenuRewardsV3: true,
                items: fullItemsMap,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            setRewardItems(remaining);
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không thể xóa món đổi quà.');
          }
        },
      },
    ]);
  };

  // Mở modal tạo quà tặng đặc quyền thành viên (Vàng / Kim Cương)
  const handleOpenAddMemberGift = (defaultTierGroup?: 'gold' | 'diamond') => {
    setEditingMemberGift(null);
    const isDiamond = defaultTierGroup === 'diamond' || section === 'diamond_gifts';
    setMgOccasion(isDiamond ? 'TIER_VIP' : 'TIER_GOLD');
    setMgCategoryTab('pizza');
    setMgProductId('');
    setMgPizzaSize('medium');
    setMgTitle('');
    setMgMinSubtotal(isDiamond ? '280000' : '250000');
    setMgExpiresAt('30/11/2027');
    setShowMgDatePicker(false);
    setMgImageUrl('');
    setMemberGiftModalVisible(true);
  };

  // Mở modal sửa quà tặng thành viên
  const handleOpenEditMemberGift = (item: MemberGiftRule) => {
    setEditingMemberGift(item);
    setMgOccasion(item.occasion);
    setMgProductId(item.productId || '');
    const inferredSize: RewardPizzaSize =
      item.pizzaSize ||
      (item.title.toLowerCase().includes('cỡ lớn')
        ? 'large'
        : item.title.toLowerCase().includes('cỡ nhỏ')
          ? 'small'
          : 'medium');
    setMgPizzaSize(inferredSize);
    setMgTitle(item.title);
    setMgMinSubtotal(String(item.minSubtotal || 280000));
    setMgExpiresAt(item.expiresAt || '30/11/2027');
    setShowMgDatePicker(false);
    setMgImageUrl(item.imageUrl || '');
    setMemberGiftModalVisible(true);
  };

  const handleSelectProductForMemberGift = (prod: Product) => {
    setMgProductId(prod.id);
    const isPizza = isProductPizza(prod);
    const sizeSuffix = isPizza ? ` (${getPizzaSizeLabel(mgPizzaSize)})` : '';
    setMgTitle(`Tặng 01 ${prod.name}${sizeSuffix} miễn phí`);
    setMgImageUrl(prod.image || '');
  };

  const handleSelectMemberGiftPizzaSize = (nextSize: RewardPizzaSize) => {
    setMgPizzaSize(nextSize);
    const matchedProd = mgProductId
      ? menuProducts.find((p) => p.id === mgProductId)
      : undefined;
    if (matchedProd) {
      setMgTitle(`Tặng 01 ${matchedProd.name} (${getPizzaSizeLabel(nextSize)}) miễn phí`);
    } else if (mgTitle.trim()) {
      const stripped = mgTitle
        .replace(/\s*\(Cỡ (Nhỏ|Vừa|Lớn)\)/gi, '')
        .replace(/\s+miễn phí$/i, '');
      setMgTitle(`${stripped} (${getPizzaSizeLabel(nextSize)}) miễn phí`);
    }
  };

  const handleSaveMemberGift = async () => {
    const cleanTitle = mgTitle.trim();
    const minSub = Math.max(0, Math.floor(Number(mgMinSubtotal.replace(/[^0-9]/g, '')) || 0));
    if (!cleanTitle) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn món hoặc nhập tên quà tặng thành viên.');
      return;
    }

    const matchedProd = mgProductId
      ? menuProducts.find((p) => p.id === mgProductId)
      : undefined;
    const isPizza = editingMemberGift
      ? Boolean(editingMemberGift.pizzaSize) || isProductPizza(matchedProd, cleanTitle)
      : mgCategoryTab === 'pizza' || isProductPizza(matchedProd, cleanTitle);

    setIsSavingMemberGift(true);
    try {
      const giftId = editingMemberGift ? editingMemberGift.id : `MG_${mgOccasion}_${Date.now()}`;
      const updatedItem: MemberGiftRule = {
        id: giftId,
        occasion: mgOccasion,
        title: cleanTitle,
        minSubtotal: minSub,
        imageUrl: mgImageUrl || undefined,
        productId: mgProductId || undefined,
        pizzaSize: isPizza ? mgPizzaSize : undefined,
      };
      const exists = memberGifts.some((g) => g.id === giftId);
      const nextList = exists
        ? memberGifts.map((g) => (g.id === giftId ? updatedItem : g))
        : [updatedItem, ...memberGifts];

      const fullItemsMap: Record<string, any> = {};
      nextList.forEach((g) => {
        fullItemsMap[g.id] = {
          id: g.id,
          occasion: g.occasion,
          title: g.title,
          minSubtotal: g.minSubtotal,
          ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
          ...(g.productId ? { productId: g.productId } : {}),
          ...(g.pizzaSize ? { pizzaSize: g.pizzaSize } : {}),
          updatedAt: serverTimestamp(),
        };
      });

      await setDoc(
        doc(db, 'coupons', MEMBER_GIFTS_DOC_ID),
        {
          seededMemberGiftsV1: true,
          items: fullItemsMap,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMemberGifts(nextList);
      setMemberGiftModalVisible(false);
      Alert.alert(
        'Thành công',
        `Đã lưu "${getMemberGiftOccasionLabel(mgOccasion)}" (Hóa đơn từ ${formatCurrency(minSub)})`
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể lưu quà tặng thành viên.');
    } finally {
      setIsSavingMemberGift(false);
    }
  };

  const handleDeleteMemberGift = (item: MemberGiftRule) => {
    Alert.alert(
      'Xóa quà tặng thành viên',
      `Bạn muốn gỡ "${item.title}" (${getMemberGiftOccasionLabel(item.occasion)})?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const remaining = memberGifts.filter((g) => g.id !== item.id);
              const fullItemsMap: Record<string, any> = {
                [item.id]: { id: item.id, deleted: true, updatedAt: serverTimestamp() },
              };
              remaining.forEach((g) => {
                fullItemsMap[g.id] = {
                  id: g.id,
                  occasion: g.occasion,
                  title: g.title,
                  minSubtotal: g.minSubtotal,
                  expiresAt: g.expiresAt || '30/11/2027',
                  ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
                  ...(g.productId ? { productId: g.productId } : {}),
                  ...(g.pizzaSize ? { pizzaSize: g.pizzaSize } : {}),
                  updatedAt: serverTimestamp(),
                };
              });

              await setDoc(
                doc(db, 'coupons', MEMBER_GIFTS_DOC_ID),
                {
                  seededMemberGiftsV1: true,
                  items: fullItemsMap,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
              setMemberGifts(remaining);
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message || 'Không thể xóa quà tặng thành viên.');
            }
          },
        },
      ]
    );
  };

  const goldMemberGifts = memberGifts.filter(
    (g) => g.occasion === 'TIER_GOLD' || g.occasion === 'BIRTHDAY_GOLD'
  );
  const diamondMemberGifts = memberGifts.filter(
    (g) => g.occasion === 'TIER_VIP' || g.occasion === 'BIRTHDAY_VIP'
  );

  const getHeaderMeta = () => {
    switch (section) {
      case 'voucher':
        return {
          title: 'Mã Giảm Giá (Voucher)',
          subtitle: `Đang có ${coupons.length} mã ưu đãi hoạt động`,
        };
      case 'rewards':
        return {
          title: 'Món Đổi Điểm FPT Rewards',
          subtitle: `Đang có ${rewardItems.length} món trong danh mục đổi điểm`,
        };
      case 'gold_gifts':
        return {
          title: 'Quà Thành Viên Vàng',
          subtitle: 'Quà khi đạt Thành Viên Vàng & Sinh Nhật Vàng',
        };
      case 'diamond_gifts':
        return {
          title: 'Quà Thành Viên Kim Cương',
          subtitle: 'Quà khi đạt Thành Viên Kim Cương & Sinh Nhật Kim Cương',
        };
      default:
        return {
          title: 'Ưu đãi & FPT Rewards',
          subtitle: 'Chọn một danh mục bên dưới để xem chi tiết',
        };
    }
  };

  const headerMeta = getHeaderMeta();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title={headerMeta.title}
        subtitle={headerMeta.subtitle}
        showBack={section !== null}
        onBack={() => setSection(null)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Màn hình chính: Chỉ hiện 4 Card, bấm vào chuyển hẳn sang trang chi tiết của mục đó */}
        {section === null && (
          <View style={{ gap: 14 }}>
            {(
              [
                {
                  key: 'voucher',
                  label: 'Mã Giảm Giá (Voucher)',
                  desc: 'Phát hành, chỉnh sửa mức giảm, đơn tối thiểu và hạn dùng các mã Voucher',
                  badge: `${coupons.length} mã`,
                  icon: Ticket,
                  accentBg: colors.primarySoft,
                  accentColor: colors.primary,
                },
                {
                  key: 'rewards',
                  label: 'Món Đổi Điểm FPT Rewards',
                  desc: 'Chọn món từ thực đơn (Pizza kèm Size, Khai vị, Thức uống) và xét điểm đổi quà',
                  badge: `${rewardItems.length} món`,
                  icon: Gift,
                  accentBg: colors.primarySoft,
                  accentColor: colors.primary,
                },
                {
                  key: 'gold_gifts',
                  label: 'Quà Thành Viên Vàng',
                  desc: 'Quà tặng tự động khi khách đạt Thành Viên Vàng và quà tháng Sinh Nhật Hạng Vàng',
                  badge: `${goldMemberGifts.length} quà`,
                  icon: Award,
                  accentBg: colors.primarySoft,
                  accentColor: colors.primary,
                },
                {
                  key: 'diamond_gifts',
                  label: 'Quà Thành Viên Kim Cương',
                  desc: 'Quà tặng tự động khi khách đạt Thành Viên Kim Cương và quà tháng Sinh Nhật Kim Cương',
                  badge: `${diamondMemberGifts.length} quà`,
                  icon: Award,
                  accentBg: colors.primarySoft,
                  accentColor: colors.primary,
                },
              ] as const
            ).map((card) => {
              const Icon = card.icon;
              return (
                <TouchableOpacity
                  key={card.key}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={card.label}
                  onPress={() => setSection(card.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    gap: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: card.accentBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={24} color={card.accentColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <AppText
                        variant="bodySemiBold"
                        color={colors.textPrimary}
                        style={{ fontSize: 16, flex: 1 }}
                      >
                        {card.label}
                      </AppText>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: card.accentBg,
                        }}
                      >
                        <AppText
                          variant="small"
                          color={card.accentColor}
                          style={{ fontWeight: '700' }}
                        >
                          {card.badge}
                        </AppText>
                      </View>
                    </View>

                    <AppText
                      variant="small"
                      color={colors.textSecondary}
                      style={{ lineHeight: 18 }}
                    >
                      {card.desc}
                    </AppText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {section === 'voucher' && (
          /* Card 1: Quản lý Mã Giảm Giá (Voucher) */
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
                onPress={handleOpenCreateCoupon}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    <View style={styles.codeBadge}>
                      <AppText variant="captionSemiBold" color={colors.primary}>
                        {item.code}
                      </AppText>
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <AppText variant="small" color={colors.textPrimary} style={{ fontWeight: '700' }}>
                        {getCouponBenefitLabel(item)}
                      </AppText>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleOpenEditCoupon(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sửa mã ${item.code}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Edit2 size={13} color={colors.textPrimary} />
                      <AppText variant="small" color={colors.textPrimary}>
                        Sửa
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteCoupon(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Gỡ mã ${item.code}`}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <AppText variant="bodyMedium" color={colors.textPrimary} style={styles.couponDesc}>
                  {item.description}
                </AppText>

                <View style={[styles.couponMetaRow, { flexWrap: 'wrap', gap: 6 }]}>
                  <AppText
                    variant="small"
                    color={isCouponExpired(item) ? colors.error : colors.textSecondary}
                  >
                    {item.expiresAt
                      ? `Hạn dùng: ${item.expiresAt}${isCouponExpired(item) ? ' (đã hết hạn)' : ''}`
                      : 'Không giới hạn thời gian'}
                  </AppText>
                  {!!item.usageLimit && (
                    <AppText variant="small" color={colors.primary} style={{ fontWeight: '600' }}>
                      Đã dùng: {item.usedCount || 0}/{item.usageLimit} lượt
                    </AppText>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {section === 'rewards' && (
          /* Card 2: Quản lý Món Đổi Điểm FPT Rewards */
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

            {rewardItems.length === 0 ? (
              <View
                style={{
                  paddingVertical: 24,
                  alignItems: 'center',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <AppText variant="bodyMedium" color={colors.textSecondary}>
                  Chưa có món đổi điểm nào.
                </AppText>
                <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 4 }}>
                  {'Bấm "+ Thêm món" ở góc phải để thêm món đổi điểm FPT Rewards.'}
                </AppText>
              </View>
            ) : (
              rewardItems.map((item) => {
                const matchedProd = item.productId
                  ? menuProducts.find((p) => p.id === item.productId)
                  : undefined;
                const displayImage = item.imageUrl || matchedProd?.image || '';

                return (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      gap: 12,
                    }}
                  >
                    {!!displayImage && (
                      <Image
                        source={{ uri: displayImage }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 10,
                          backgroundColor: colors.surfaceAlt,
                        }}
                        resizeMode="cover"
                      />
                    )}

                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyMedium" color={colors.textPrimary} numberOfLines={2}>
                        {item.title}
                      </AppText>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginTop: 6,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.primarySoft,
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                            borderRadius: 999,
                          }}
                        >
                          <AppText variant="captionSemiBold" color={colors.primary}>
                            {item.points} điểm
                          </AppText>
                        </View>
                        {(item.pizzaSize || isProductPizza(matchedProd, item.title)) && (
                          <View
                            style={{
                              backgroundColor: colors.surfaceAlt,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <AppText variant="small" color={colors.textSecondary} style={{ fontWeight: '600' }}>
                              Size: {getPizzaSizeLabel(item.pizzaSize || 'medium')}
                            </AppText>
                          </View>
                        )}
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
                );
              })
            )}
          </View>
        )}

        {(section === 'gold_gifts' || section === 'diamond_gifts') && (() => {
          const isDiamondSection = section === 'diamond_gifts';
          const listToRender = isDiamondSection ? diamondMemberGifts : goldMemberGifts;
          const cardHeading = isDiamondSection
            ? 'Quà Thành Viên Kim Cương'
            : 'Quà Thành Viên Vàng';
          const cardDesc = isDiamondSection
            ? 'Tự động tặng vào mục "Quà của tôi" (FPT Rewards) và thông báo qua Chuông khi khách đạt Hạng Kim Cương hoặc đến tháng Sinh Nhật Kim Cương.'
            : 'Tự động tặng vào mục "Quà của tôi" (FPT Rewards) và thông báo qua Chuông khi khách đạt Hạng Vàng hoặc đến tháng Sinh Nhật Hạng Vàng.';

          return (
            <View style={styles.card}>
              <View style={[styles.cardHeader, { gap: 8 }]}>
                <View style={[styles.headerLeft, { flex: 1 }]}>
                  <Award size={20} color={colors.primary} />
                  <AppText
                    variant="cardTitle"
                    color={colors.textPrimary}
                    style={{ flex: 1 }}
                    numberOfLines={1}
                  >
                    {cardHeading}
                  </AppText>
                </View>
                <TouchableOpacity
                  style={[styles.createBtn, { flexShrink: 0 }]}
                  onPress={() => handleOpenAddMemberGift(isDiamondSection ? 'diamond' : 'gold')}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color={colors.white} />
                  <AppText variant="captionSemiBold" color={colors.white}>
                    Tạo quà
                  </AppText>
                </TouchableOpacity>
              </View>

              <AppText variant="caption" color={colors.textSecondary} style={{ marginBottom: 12 }}>
                {cardDesc}
              </AppText>

              {listToRender.length === 0 ? (
                <View
                  style={{
                    paddingVertical: 24,
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    Chưa có quà tặng nào trong mục này.
                  </AppText>
                  <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 4 }}>
                    Bấm &quot;+ Tạo quà&quot; ở góc phải để thêm quà tặng mới.
                  </AppText>
                </View>
              ) : (
                listToRender.map((item) => {
                  const matchedProd = item.productId
                    ? menuProducts.find((p) => p.id === item.productId)
                    : undefined;
                  const displayImage = item.imageUrl || matchedProd?.image || '';
                  const cleanBaseTitle = item.title
                    .replace(/^Quà Sinh Nhật:\s*/i, '')
                    .replace(/\s*miễn phí$/i, '')
                    .replace(/\s*\((Cỡ [^)]+)\)/i, ' - $1')
                    .trim();
                  const minK = Math.round((item.minSubtotal || 0) / 1000);
                  const displayGiftTitle =
                    minK > 0 && !cleanBaseTitle.toLowerCase().includes('đơn hàng từ')
                      ? `${cleanBaseTitle} cho đơn hàng từ ${minK}K`
                      : cleanBaseTitle;

                  return (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 14,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        gap: 12,
                      }}
                    >
                      {!!displayImage && (
                        <Image
                          source={{ uri: displayImage }}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: colors.surface,
                          }}
                          resizeMode="contain"
                        />
                      )}

                      <View style={{ flex: 1 }}>
                        <AppText
                          variant="bodySemiBold"
                          color={colors.textPrimary}
                          style={{ lineHeight: 20 }}
                        >
                          {displayGiftTitle}
                        </AppText>

                        <AppText
                          variant="body"
                          color="#374151"
                          style={{ marginTop: 4, fontSize: 13.5 }}
                        >
                          Exp: +01 tháng kể từ ngày khách đạt được
                        </AppText>

                        <AppText
                          variant="small"
                          color={colors.textSecondary}
                          style={{ marginTop: 2 }}
                        >
                          {getMemberGiftOccasionLabel(item.occasion)}
                        </AppText>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleOpenEditMemberGift(item)}
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
                            Sửa
                          </AppText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDeleteMemberGift(item)}
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
                  );
                })
              )}
            </View>
          );
        })()}
      </ScrollView>

      {/* Modal Tạo / Sửa Voucher */}
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
                {editingCoupon ? `Chỉnh Sửa Mã ${editingCoupon.code}` : 'Phát Hành Mã Ưu Đãi Mới'}
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
                  style={[styles.formInput, editingCoupon && { opacity: 0.65 }]}
                  placeholder="Ví dụ: FPTPIZZA20"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  editable={!editingCoupon}
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
                  placeholderTextColor="#9CA3AF"
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
                  placeholder="Ví dụ: 150000"
                  placeholderTextColor="#9CA3AF"
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
                    placeholder="Ví dụ: 50000 (để trống = không giới hạn)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={maxDiscount}
                    onChangeText={setMaxDiscount}
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Hạn dùng
                </AppText>
                {(() => {
                  const now = new Date();
                  const curYear = now.getFullYear();
                  const curMonth = now.getMonth() + 1;
                  const curDay = now.getDate();

                  const parsed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(expiresAt.trim());
                  const selYear = parsed ? Number(parsed[3]) : curYear;
                  const rawMonth = parsed ? Number(parsed[2]) : curMonth;
                  const selMonth = Math.min(12, Math.max(1, rawMonth));
                  const maxDay = new Date(selYear, selMonth, 0).getDate();
                  const rawDay = parsed ? Number(parsed[1]) : curDay;
                  const selDay = Math.min(maxDay, Math.max(1, rawDay));

                  const yearItems = Array.from({ length: 8 }, (_, i) => ({
                    value: curYear - 2 + i,
                    label: `Năm ${curYear - 2 + i}`,
                  }));
                  const monthItems = Array.from({ length: 12 }, (_, i) => ({
                    value: i + 1,
                    label: `Tháng ${String(i + 1).padStart(2, '0')}`,
                  }));
                  const dayItems = Array.from({ length: maxDay }, (_, i) => ({
                    value: i + 1,
                    label: `Ngày ${String(i + 1).padStart(2, '0')}`,
                  }));

                  const applyWheelDate = (d: number, m: number, y: number) => {
                    const validM = Math.min(12, Math.max(1, m));
                    const maxD = new Date(y, validM, 0).getDate();
                    const validD = Math.min(maxD, Math.max(1, d));
                    const formatted = `${String(validD).padStart(2, '0')}/${String(
                      validM
                    ).padStart(2, '0')}/${y}`;
                    setExpiresAt(formatted);
                  };

                  const dateCheck = expiresAt.trim()
                    ? isValidFutureCouponDate(expiresAt)
                    : { valid: true };

                  return (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!expiresAt.trim()) {
                            applyWheelDate(curDay, curMonth, curYear);
                          }
                          setShowDatePicker((prev) => !prev);
                        }}
                        style={[
                          styles.formInput,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 11,
                            borderColor: showDatePicker ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Calendar
                            size={18}
                            color={expiresAt.trim() ? colors.primary : '#9CA3AF'}
                          />
                          <AppText
                            variant="body"
                            color={expiresAt.trim() ? colors.textPrimary : '#9CA3AF'}
                            style={{ fontWeight: expiresAt.trim() ? '600' : '400' }}
                          >
                            {expiresAt.trim()
                              ? expiresAt.trim()
                              : 'Bấm để chọn ngày hết hạn'}
                          </AppText>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {!!expiresAt.trim() && (
                            <TouchableOpacity
                              onPress={(e: any) => {
                                e?.stopPropagation?.();
                                setExpiresAt('');
                                setShowDatePicker(false);
                              }}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 999,
                                backgroundColor: '#FEE2E2',
                              }}
                            >
                              <AppText variant="small" color={colors.error} style={{ fontWeight: '700' }}>
                                Xóa
                              </AppText>
                            </TouchableOpacity>
                          )}
                          <ChevronDown size={18} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>

                      {!dateCheck.valid && !!dateCheck.error && (
                        <AppText
                          variant="small"
                          color={colors.error}
                          style={{ marginTop: 6, fontWeight: '600' }}
                        >
                          {dateCheck.error}
                        </AppText>
                      )}

                      {/* Popup Con Lăn Kéo Chọn Ngày / Tháng / Năm chuẩn App Điện Thoại */}
                      <Modal
                        visible={showDatePicker}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setShowDatePicker(false)}
                      >
                        <TouchableOpacity
                          activeOpacity={1}
                          onPress={() => setShowDatePicker(false)}
                          style={{
                            flex: 1,
                            backgroundColor: 'rgba(0,0,0,0.45)',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <TouchableOpacity
                            activeOpacity={1}
                            onPress={(e: any) => e?.stopPropagation?.()}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderTopLeftRadius: 20,
                              borderTopRightRadius: 20,
                              paddingHorizontal: 16,
                              paddingTop: 14,
                              paddingBottom: 24,
                              maxWidth: 460,
                              width: '100%',
                              alignSelf: 'center',
                            }}
                          >
                            {/* Thanh tiêu đề Con Lăn */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingBottom: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                              }}
                            >
                              <TouchableOpacity
                                onPress={() => {
                                  setExpiresAt('');
                                  setShowDatePicker(false);
                                }}
                                style={{ paddingVertical: 4, paddingHorizontal: 6 }}
                              >
                                <AppText variant="bodyMedium" color={colors.textSecondary}>
                                  Không giới hạn
                                </AppText>
                              </TouchableOpacity>

                              <AppText variant="bodySemiBold" color={colors.textPrimary}>
                                Kéo chọn Ngày Hết Hạn
                              </AppText>

                              <TouchableOpacity
                                onPress={() => setShowDatePicker(false)}
                                style={{
                                  backgroundColor: colors.primary,
                                  paddingHorizontal: 14,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                }}
                              >
                                <AppText variant="captionSemiBold" color={colors.white}>
                                  Xong
                                </AppText>
                              </TouchableOpacity>
                            </View>

                            {/* Khung Con Lăn 3 Cột có vạch Highlight ở chính giữa */}
                            <View
                              style={{
                                position: 'relative',
                                height: WHEEL_VISIBLE_H,
                                marginTop: 8,
                                justifyContent: 'center',
                              }}
                            >
                              {/* Thanh Highlight dòng đang chọn ở chính giữa */}
                              <View
                                pointerEvents="none"
                                style={{
                                  position: 'absolute',
                                  top: WHEEL_PAD_Y,
                                  left: 0,
                                  right: 0,
                                  height: WHEEL_ITEM_H,
                                  backgroundColor: colors.primarySoft,
                                  borderRadius: 10,
                                  borderTopWidth: 1,
                                  borderBottomWidth: 1,
                                  borderColor: '#FECACA',
                                }}
                              />

                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <WheelColumn
                                  items={dayItems}
                                  selectedValue={selDay}
                                  onSelect={(d) => applyWheelDate(d, selMonth, selYear)}
                                />
                                <WheelColumn
                                  items={monthItems}
                                  selectedValue={selMonth}
                                  onSelect={(m) => applyWheelDate(selDay, m, selYear)}
                                />
                                <WheelColumn
                                  items={yearItems}
                                  selectedValue={selYear}
                                  onSelect={(y) => applyWheelDate(selDay, selMonth, y)}
                                />
                              </View>
                            </View>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </Modal>
                    </>
                  );
                })()}
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Số lượt dùng tối đa (để trống = không giới hạn)
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: 100"
                  placeholderTextColor="#9CA3AF"
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
                  placeholder="Mô tả ngắn gọn về ưu đãi (để trống sẽ tự tạo)..."
                  placeholderTextColor="#9CA3AF"
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
                    title={editingCoupon ? 'Lưu thay đổi' : 'Phát hành Voucher'}
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
                    Chọn danh mục món
                  </AppText>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    {(
                      [
                        { id: 'pizza', label: 'Pizza' },
                        { id: 'starters', label: 'Khai vị' },
                        { id: 'drinks', label: 'Thức uống' },
                      ] as const
                    ).map((cat) => {
                      const active = rewardCategoryTab === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          activeOpacity={0.8}
                          onPress={() => setRewardCategoryTab(cat.id)}
                          style={{
                            flex: 1,
                            paddingVertical: 9,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary : colors.surface,
                            alignItems: 'center',
                          }}
                        >
                          <AppText
                            variant="captionSemiBold"
                            color={active ? colors.white : colors.textPrimary}
                          >
                            {cat.label}
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Chọn món trong danh mục
                  </AppText>
                  {(() => {
                    const filteredByCat = menuProducts.filter((prod) => {
                      const c = String(prod.categoryId || '').toLowerCase();
                      if (rewardCategoryTab === 'pizza') {
                        return (
                          c === 'pizza' ||
                          c === 'cheese_party' ||
                          c === 'member_deals' ||
                          c === 'hot_deals'
                        );
                      }
                      if (rewardCategoryTab === 'starters') {
                        return c === 'starters' || c === 'starter' || c === 'pasta';
                      }
                      return c === 'drinks' || c === 'drink';
                    });

                    if (filteredByCat.length === 0) {
                      return (
                        <View
                          style={{
                            paddingVertical: 16,
                            alignItems: 'center',
                            backgroundColor: colors.surface,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <AppText variant="small" color={colors.textSecondary}>
                            Chưa có món nào trong danh mục này.
                          </AppText>
                        </View>
                      );
                    }

                    return (
                      <ScrollView
                        style={{ maxHeight: 240 }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 10,
                            paddingVertical: 4,
                          }}
                        >
                          {filteredByCat.map((prod) => {
                            const selected = selectedProductId === prod.id;
                            return (
                              <TouchableOpacity
                                key={prod.id}
                                onPress={() => handleSelectProductForReward(prod)}
                                activeOpacity={0.8}
                                style={{
                                  width: '31%',
                                  minWidth: 96,
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
                                    style={{
                                      width: '100%',
                                      height: 68,
                                      borderRadius: 8,
                                      marginBottom: 6,
                                    }}
                                    resizeMode="cover"
                                  />
                                )}
                                <AppText
                                  variant="small"
                                  color={colors.textPrimary}
                                  numberOfLines={2}
                                  style={{ fontWeight: selected ? '700' : '500' }}
                                >
                                  {prod.name}
                                </AppText>
                                {selected && (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      top: 6,
                                      right: 6,
                                      backgroundColor: colors.primary,
                                      borderRadius: 10,
                                      padding: 2,
                                    }}
                                  >
                                    <Check size={12} color="#FFFFFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    );
                  })()}
                </View>
              )}

              {(() => {
                const matchedProd = selectedProductId
                  ? menuProducts.find((p) => p.id === selectedProductId)
                  : undefined;
                const showPizzaSizeSelector = editingReward
                  ? Boolean(editingReward.pizzaSize) ||
                    isProductPizza(matchedProd, editingReward.title)
                  : rewardCategoryTab === 'pizza' || isProductPizza(matchedProd, rewardTitle);

                if (!showPizzaSizeSelector) return null;

                return (
                  <View style={styles.formGroup}>
                    <AppText variant="captionSemiBold" style={styles.inputLabel}>
                      Chọn kích thước bánh (Size) *
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(
                        [
                          { id: 'small', label: 'Cỡ Nhỏ (20cm)' },
                          { id: 'medium', label: 'Cỡ Vừa (25cm)' },
                          { id: 'large', label: 'Cỡ Lớn (30cm)' },
                        ] as const
                      ).map((sz) => {
                        const active = rewardPizzaSize === sz.id;
                        return (
                          <TouchableOpacity
                            key={sz.id}
                            activeOpacity={0.8}
                            onPress={() => handleSelectPizzaSize(sz.id)}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 6,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: active ? colors.primary : colors.border,
                              backgroundColor: active ? colors.primarySoft : colors.surface,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <AppText
                              variant="captionSemiBold"
                              color={active ? colors.primary : colors.textPrimary}
                              style={{ fontSize: 12.5, textAlign: 'center' }}
                            >
                              {sz.label}
                            </AppText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

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

      {/* Modal Tạo / Sửa Quà Tặng Thành Viên (Thăng Hạng & Sinh Nhật) */}
      <Modal
        visible={memberGiftModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMemberGiftModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                {editingMemberGift
                  ? 'Chỉnh Sửa Quà Thành Viên'
                  : section === 'diamond_gifts'
                    ? 'Tạo Quà Thành Viên Kim Cương'
                    : 'Tạo Quà Thành Viên Vàng'}
              </AppText>
              <TouchableOpacity onPress={() => setMemberGiftModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. Chọn Dịp tặng quà */}
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Dịp tặng quà *
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {MEMBER_GIFT_OCCASIONS.filter((occ) =>
                    section === 'diamond_gifts'
                      ? occ.tierGroup === 'diamond'
                      : section === 'gold_gifts'
                        ? occ.tierGroup === 'gold'
                        : true
                  ).map((occ) => {
                    const active = mgOccasion === occ.id;
                    return (
                      <TouchableOpacity
                        key={occ.id}
                        activeOpacity={0.8}
                        onPress={() => setMgOccasion(occ.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primarySoft : colors.surface,
                        }}
                      >
                        <AppText
                          variant="captionSemiBold"
                          color={active ? colors.primary : colors.textPrimary}
                        >
                          {occ.shortLabel}
                        </AppText>
                        <AppText
                          variant="small"
                          color={colors.textSecondary}
                          style={{ marginTop: 2, fontSize: 11 }}
                        >
                          {occ.description}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 2. Chọn món trong thực đơn */}
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Chọn danh mục món tặng
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(
                    [
                      { id: 'pizza', label: 'Pizza' },
                      { id: 'starters', label: 'Khai vị' },
                      { id: 'drinks', label: 'Thức uống' },
                    ] as const
                  ).map((cat) => {
                    const active = mgCategoryTab === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.8}
                        onPress={() => setMgCategoryTab(cat.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary : colors.surface,
                          alignItems: 'center',
                        }}
                      >
                        <AppText
                          variant="captionSemiBold"
                          color={active ? colors.white : colors.textPrimary}
                        >
                          {cat.label}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Chọn món tặng từ thực đơn
                </AppText>
                {(() => {
                  const filteredByCat = menuProducts.filter((prod) => {
                    const c = String(prod.categoryId || '').toLowerCase();
                    if (mgCategoryTab === 'pizza') {
                      return (
                        c === 'pizza' ||
                        c === 'cheese_party' ||
                        c === 'member_deals' ||
                        c === 'hot_deals'
                      );
                    }
                    if (mgCategoryTab === 'starters') {
                      return c === 'starters' || c === 'starter' || c === 'pasta';
                    }
                    return c === 'drinks' || c === 'drink';
                  });

                  if (filteredByCat.length === 0) {
                    return (
                      <View
                        style={{
                          paddingVertical: 16,
                          alignItems: 'center',
                          backgroundColor: colors.surface,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <AppText variant="small" color={colors.textSecondary}>
                          Chưa có món nào trong danh mục này.
                        </AppText>
                      </View>
                    );
                  }

                  return (
                    <ScrollView
                      style={{ maxHeight: 220 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 10,
                          paddingVertical: 4,
                        }}
                      >
                        {filteredByCat.map((prod) => {
                          const selected = mgProductId === prod.id;
                          return (
                            <TouchableOpacity
                              key={prod.id}
                              onPress={() => handleSelectProductForMemberGift(prod)}
                              activeOpacity={0.8}
                              style={{
                                width: '31%',
                                minWidth: 96,
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
                                  style={{
                                    width: '100%',
                                    height: 64,
                                    borderRadius: 8,
                                    marginBottom: 6,
                                  }}
                                  resizeMode="cover"
                                />
                              )}
                              <AppText
                                variant="small"
                                color={colors.textPrimary}
                                numberOfLines={2}
                                style={{ fontWeight: selected ? '700' : '500' }}
                              >
                                {prod.name}
                              </AppText>
                              {selected && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                    backgroundColor: colors.primary,
                                    borderRadius: 10,
                                    padding: 2,
                                  }}
                                >
                                  <Check size={12} color="#FFFFFF" />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  );
                })()}
              </View>

              {/* 3. Chọn kích thước bánh (Size) nếu là Pizza */}
              {(() => {
                const matchedProd = mgProductId
                  ? menuProducts.find((p) => p.id === mgProductId)
                  : undefined;
                const showPizzaSize = editingMemberGift
                  ? Boolean(editingMemberGift.pizzaSize) ||
                    isProductPizza(matchedProd, editingMemberGift.title)
                  : mgCategoryTab === 'pizza' || isProductPizza(matchedProd, mgTitle);

                if (!showPizzaSize) return null;

                return (
                  <View style={styles.formGroup}>
                    <AppText variant="captionSemiBold" style={styles.inputLabel}>
                      Chọn kích thước bánh (Size) *
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(
                        [
                          { id: 'small', label: 'Cỡ Nhỏ (20cm)' },
                          { id: 'medium', label: 'Cỡ Vừa (25cm)' },
                          { id: 'large', label: 'Cỡ Lớn (30cm)' },
                        ] as const
                      ).map((sz) => {
                        const active = mgPizzaSize === sz.id;
                        return (
                          <TouchableOpacity
                            key={sz.id}
                            activeOpacity={0.8}
                            onPress={() => handleSelectMemberGiftPizzaSize(sz.id)}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 6,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: active ? colors.primary : colors.border,
                              backgroundColor: active ? colors.primarySoft : colors.surface,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <AppText
                              variant="captionSemiBold"
                              color={active ? colors.primary : colors.textPrimary}
                              style={{ fontSize: 12.5, textAlign: 'center' }}
                            >
                              {sz.label}
                            </AppText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

              {/* 4. Tên quà hiển thị */}
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Tên quà hiển thị trong &quot;Quà của tôi&quot; &amp; Thông báo *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: Tặng 01 Pizza Cá Ngừ (Cỡ Vừa) miễn phí"
                  value={mgTitle}
                  onChangeText={setMgTitle}
                />
              </View>

              {/* 5. Điều kiện hóa đơn tối thiểu */}
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Điều kiện hóa đơn tối thiểu để áp dụng quà (VNĐ) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: 280000"
                  keyboardType="numeric"
                  value={mgMinSubtotal}
                  onChangeText={setMgMinSubtotal}
                />
              </View>

              {/* 6. Ngày hết hạn (Exp) tự động theo ngày đạt được + 1 tháng */}
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Thời hạn hiệu lực (Exp)
                </AppText>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Calendar size={18} color={colors.primary} />
                  <AppText variant="body" color={colors.textPrimary} style={{ flex: 1 }}>
                    Tự động tính <AppText variant="bodySemiBold" color={colors.primary}>+01 tháng</AppText> kể từ ngày khách đạt hạng / sinh nhật
                  </AppText>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Hủy"
                    variant="outline"
                    onPress={() => setMemberGiftModalVisible(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Lưu quà thành viên"
                    isLoading={isSavingMemberGift}
                    onPress={handleSaveMemberGift}
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
