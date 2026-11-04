import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import Svg, { Path, G } from 'react-native-svg';
import { Alert } from '../../utils/alert';
import { AppButton } from '../../components/ui/AppButton';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import * as FirestorePkg from 'firebase/firestore';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useCart } from '../../state/CartContext';
import { useToast } from '../../state/ToastContext';
import { useCatalog } from '../../services/catalog';
import { rewardCatalog, type RewardWallet, type RedeemedGift } from '../../data/rewards';
import { redeemReward } from '../../services/rewardService';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  fetchUserMemberStats,
  getMemberTierFromSpent,
  calculateMaturityDate,
  MEMBER_GIFTS_DOC_ID,
  loadOrSeedMemberGiftRules,
  getEligibleMemberGifts,
  getMemberGiftOccasionLabel,
  type MemberTierInfo,
  type MemberGiftRule,
} from '../../utils/memberTier';
import { styles } from '../../styles/rewards.styles';

// Header Right Receipt Icon (matches user screenshot)
const ReceiptListIcon = () => (
  <View style={styles.receiptBox}>
    <View style={styles.receiptLine} />
    <View style={styles.receiptLine} />
    <View style={styles.receiptLine} />
  </View>
);

// Crisp Vector Pizza Badge Icon on #CF4226 Member Card (1 slice = Cơ Bản, 2 = Vàng, 3 = VIP)
const MemberCardPizzaIcon = ({
  tier = 'vip',
  height = 34,
}: {
  tier?: 'basic' | 'gold' | 'vip';
  height?: number;
}) => {
  if (tier === 'basic') {
    return (
      <Svg width={30} height={height} viewBox="0 0 36 44" fill="none">
        <G transform="rotate(14 18 22)">
          <Path d="M4 5C11 2 25 2 32 5L30 9.5C24 7 12 7 6 9.5L4 5Z" fill="#FFFFFF" />
          <Path d="M6.2 11.2C12.2 8.8 23.8 8.8 29.8 11.2L18 41L6.2 11.2Z" fill="#FFFFFF" />
          <Path
            d="M18 14L19.3 18H23.5L20.1 20.4L21.4 24.4L18 22L14.6 24.4L15.9 20.4L12.5 18H16.7L18 14Z"
            fill="#CF4226"
          />
          <Path
            d="M18 26.5L18.8 29H21.4L19.3 30.5L20.1 33L18 31.5L15.9 33L16.7 30.5L14.6 29H17.2L18 26.5Z"
            fill="#CF4226"
          />
        </G>
      </Svg>
    );
  }

  if (tier === 'gold') {
    return (
      <Svg width={44} height={height} viewBox="0 0 56 44" fill="none">
        <G transform="translate(2, 4) rotate(-24 18 32)">
          <Path d="M5 6C11 3.5 23 3.5 29 6L27.5 10C22 8 12 8 6.5 10L5 6Z" fill="#FFFFFF" />
          <Path d="M7 11.5C12 9.5 22 9.5 27 11.5L17 38L7 11.5Z" fill="#FFFFFF" />
          <Path
            d="M17 14.5L18.2 18.2H22L18.9 20.4L20.1 24.1L17 21.9L13.9 24.1L15.1 20.4L12 18.2H15.8L17 14.5Z"
            fill="#CF4226"
          />
          <Path
            d="M17 25.5L17.7 27.6H19.9L18.1 28.9L18.8 31L17 29.7L15.2 31L15.9 28.9L14.1 27.6H16.3L17 25.5Z"
            fill="#CF4226"
          />
        </G>
        <G transform="translate(18, 1) rotate(14 18 34)">
          <Path d="M4 5C11 2.2 25 2.2 32 5L30.2 9.5C24 7.2 12 7.2 5.8 9.5L4 5Z" fill="#FFFFFF" />
          <Path d="M6.2 11.2C12.2 9 23.8 9 29.8 11.2L18 40L6.2 11.2Z" fill="#FFFFFF" />
          <Path
            d="M18 14.5L19.3 18.5H23.5L20.1 21L21.4 25L18 22.5L14.6 25L15.9 21L12.5 18.5H16.7L18 14.5Z"
            fill="#CF4226"
          />
          <Path
            d="M18 26.5L18.8 28.9H21.3L19.3 30.4L20.1 32.8L18 31.3L15.9 32.8L16.7 30.4L14.7 28.9H17.2L18 26.5Z"
            fill="#CF4226"
          />
        </G>
      </Svg>
    );
  }

  // VIP: 3 Pizza Slices
  return (
    <Svg width={50} height={height} viewBox="0 0 64 44" fill="none">
      <G transform="translate(0, 6) rotate(-38 16 28)">
        <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill="#FFFFFF" />
        <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill="#FFFFFF" />
        <Path
          d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
          fill="#CF4226"
        />
      </G>
      <G transform="translate(17, 1)">
        <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill="#FFFFFF" />
        <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill="#FFFFFF" />
        <Path
          d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
          fill="#CF4226"
        />
      </G>
      <G transform="translate(32, 6) rotate(38 16 28)">
        <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill="#FFFFFF" />
        <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill="#FFFFFF" />
        <Path
          d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
          fill="#CF4226"
        />
      </G>
    </Svg>
  );
};

type RewardPizzaSize = 'small' | 'medium' | 'large';

function getPizzaSizeLabel(size?: RewardPizzaSize): string {
  if (size === 'small') return 'Cỡ Nhỏ';
  if (size === 'large') return 'Cỡ Lớn';
  return 'Cỡ Vừa';
}

interface RewardItem {
  id: string;
  title: string;
  points: number;
  productId?: string;
  pizzaSize?: RewardPizzaSize;
  image: import('react-native').ImageSourcePropType;
}

const REWARD_IMAGES = [
  require('../../../assets/rewards/pepsi.png'),
  require('../../../assets/rewards/7up.png'),
  require('../../../assets/rewards/mirinda.png'),
  require('../../../assets/rewards/salad.png'),
  require('../../../assets/rewards/spaghetti.png'),
  require('../../../assets/rewards/pizza_cheese.png'),
  require('../../../assets/rewards/pizza_supreme.png'),
];
const REWARD_ITEMS: RewardItem[] = rewardCatalog.map((item, index) => ({
  ...item,
  image: REWARD_IMAGES[index],
}));

const notify = (title: string, message: string) =>
  Platform.OS === 'web' ? alert(message) : Alert.alert(title, message);

export default function RewardsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading } = useAuth();
  const {
    items: cartItems,
    itemCount: cartItemCount,
    addItem,
    removeItem,
    subtotal: cartSubtotal,
  } = useCart();
  const { showToast } = useToast();
  const { products, productsMap } = useCatalog();
  const userId = user?.id;
  const isDemo = user?.isDemo;
  const [activeTab, setActiveTab] = useState<'list' | 'my_gifts'>('list');
  const [giftPopup, setGiftPopup] = useState<
    | { type: 'min_subtotal'; minSubtotal: number }
    | { type: 'added' }
    | { type: 'removed' }
    | null
  >(null);
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [walletOwner, setWalletOwner] = useState<string>();
  const [rewardItems, setRewardItems] = useState<RewardItem[]>([]);
  const [memberGiftRules, setMemberGiftRules] = useState<MemberGiftRule[]>([]);
  const [userBirthday, setUserBirthday] = useState<string | undefined>((user as any)?.birthday);
  const [usedMemberGiftIds, setUsedMemberGiftIds] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage && user?.id) {
        const raw = window.localStorage.getItem(`fpt_used_member_gifts_${user.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [tierInfo, setTierInfo] = useState<MemberTierInfo>(() =>
    getMemberTierFromSpent(0, 0, calculateMaturityDate())
  );

  useEffect(() => {
    if (params?.tab === 'my_gifts') {
      setActiveTab('my_gifts');
    }
  }, [params?.tab]);

  useEffect(() => {
    if (!userId) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`fpt_used_member_gifts_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setUsedMemberGiftIds(parsed);
          }
        }
      }
    } catch {}
  }, [userId]);

  useEffect(() => {
    let active = true;
    const applyMemberGiftsSnap = (snap: any) => {
      if (!active) return;
      const snapData = snap?.exists?.() ? snap.data?.() : null;
      if (!snapData || snapData.seededMemberGiftsV1 !== true) {
        void loadOrSeedMemberGiftRules().then((rules) => {
          if (active) setMemberGiftRules(rules);
        });
        return;
      }
      const list: MemberGiftRule[] = [];
      Object.entries(snapData.items || {}).forEach(([gId, val]: [string, any]) => {
        if (!val || val.deleted) return;
        list.push({
          id: gId,
          occasion: val.occasion || 'TIER_GOLD',
          title: val.title || 'Quà Tặng Thành Viên',
          minSubtotal: Number(val.minSubtotal || 280000),
          imageUrl: val.imageUrl || undefined,
          productId: val.productId || undefined,
          pizzaSize: val.pizzaSize || undefined,
        });
      });
      setMemberGiftRules(list);
    };

    let unsubMg: (() => void) | undefined;
    try {
      if (typeof onSnapshot === 'function') {
        unsubMg = onSnapshot(
          doc(db, 'coupons', MEMBER_GIFTS_DOC_ID),
          (snap) => applyMemberGiftsSnap(snap),
          () => {
            void loadOrSeedMemberGiftRules().then((rules) => {
              if (active) setMemberGiftRules(rules);
            });
          }
        );
      } else {
        void loadOrSeedMemberGiftRules().then((rules) => {
          if (active) setMemberGiftRules(rules);
        });
      }
    } catch {
      void loadOrSeedMemberGiftRules().then((rules) => {
        if (active) setMemberGiftRules(rules);
      });
    }

    return () => {
      active = false;
      unsubMg?.();
    };
  }, []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const busy = useRef(false);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [attempt, setAttempt] = useState(0);
  const walletKey = `${userId}:${isDemo}:${attempt}:${user?.rewardPoints}`;
  const latestWalletKey = useRef(walletKey);
  latestWalletKey.current = walletKey;
  const currentWallet = walletOwner === user?.id ? wallet : null;
  const userPoints =
    currentWallet?.points ??
    Math.max(user?.rewardPoints ?? 0, tierInfo.earnedPointsFromOrders);
  const gifts = currentWallet?.gifts ?? [];

  useEffect(() => {
    let active = true;

    const build6RewardsFromProducts = async () => {
      try {
        const productsSnap = await getDocs(collection(db, 'products'));
        if (!active || productsSnap.empty) return;
        const pList: { id: string; name: string; categoryId: string; image: string }[] = [];
        productsSnap.forEach((d: any) => {
          if (String(d.id).startsWith('__')) return;
          const data = d.data();
          pList.push({
            id: d.id,
            name: data.name || 'Món ăn',
            categoryId: String(data.categoryId || data.category || 'pizza').toLowerCase(),
            image: data.image || data.imageUrl || '',
          });
        });

        const drinks = pList
          .filter((p) => ['drinks', 'drink'].includes(p.categoryId))
          .slice(0, 2);
        const starters = pList
          .filter((p) => ['starters', 'starter', 'pasta'].includes(p.categoryId))
          .slice(0, 2);
        const pizzas = pList
          .filter((p) =>
            ['pizza', 'cheese_party', 'member_deals', 'hot_deals'].includes(p.categoryId)
          )
          .slice(0, 2);

        const defaultPicks: {
          prod: { id: string; name: string; categoryId: string; image: string };
          points: number;
          pizzaSize?: RewardPizzaSize;
        }[] = [
          ...(drinks[0] ? [{ prod: drinks[0], points: 35 }] : []),
          ...(drinks[1] ? [{ prod: drinks[1], points: 50 }] : []),
          ...(starters[0] ? [{ prod: starters[0], points: 75 }] : []),
          ...(starters[1] ? [{ prod: starters[1], points: 90 }] : []),
          ...(pizzas[0] ? [{ prod: pizzas[0], points: 130, pizzaSize: 'medium' as const }] : []),
          ...(pizzas[1] ? [{ prod: pizzas[1], points: 150, pizzaSize: 'medium' as const }] : []),
        ];

        const seededMap: Record<string, any> = {};
        const seededList: RewardItem[] = [];
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
            productId: prod.id,
            ...(pizzaSize ? { pizzaSize } : {}),
            image: prod.image ? { uri: prod.image } : REWARD_IMAGES[5],
          });
        });

        if (active) {
          setRewardItems(seededList);
        }

        await setDoc(doc(db, 'coupons', '__REWARDS_CONFIG'), {
          seeded6MenuRewards: true,
          seeded6MenuRewardsV2: true,
          seeded6MenuRewardsV3: true,
          items: seededMap,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } catch {}
    };

    const applyRewardsSnap = (snap: any) => {
      if (!active) return;
      const snapData = snap?.exists?.() ? snap.data?.() : null;
      if (!snapData || snapData.seeded6MenuRewardsV3 !== true) {
        void build6RewardsFromProducts();
        return;
      }
      const itemsObj = snapData.items || {};
      const list: RewardItem[] = [];
      Object.entries(itemsObj).forEach(([rId, val]: [string, any]) => {
        if (!val || val.deleted) return;
        const pts = Number(val.points || 0);
        if (pts <= 0) return;
        list.push({
          id: rId,
          title: val.title || 'Món quà FPT Rewards',
          points: pts,
          productId: val.productId || undefined,
          pizzaSize: val.pizzaSize || undefined,
          image: val.imageUrl ? { uri: val.imageUrl } : REWARD_IMAGES[5],
        });
      });
      list.sort((a, b) => a.points - b.points);
      setRewardItems(list);
    };

    let unsub: (() => void) | undefined;
    try {
      if (typeof onSnapshot === 'function') {
        unsub = onSnapshot(
          doc(db, 'coupons', '__REWARDS_CONFIG'),
          (snap) => applyRewardsSnap(snap),
          () => {
            void build6RewardsFromProducts();
          }
        );
      } else {
        getDoc(doc(db, 'coupons', '__REWARDS_CONFIG'))
          .then((snap) => applyRewardsSnap(snap))
          .catch(() => {
            void build6RewardsFromProducts();
          });
      }
    } catch {
      void build6RewardsFromProducts();
    }

    return () => {
      active = false;
      unsub?.();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError('');

      if (!userId || isDemo) {
        setLoading(false);
        return;
      }

      if (!wallet) {
        setLoading(true);
      }

      Promise.all([
        fetchUserMemberStats(userId),
        getDoc(doc(db, 'users', userId)).catch(() => null),
      ])
        .then(([stats, userSnap]) => {
          if (!active || latestWalletKey.current !== walletKey) return;
          setTierInfo(stats);
          const uData = userSnap?.exists?.() ? userSnap.data?.() : undefined;
          if (uData?.birthday) {
            setUserBirthday(String(uData.birthday));
          }
          if (Array.isArray(uData?.usedMemberGiftIds)) {
            setUsedMemberGiftIds((prev) => {
              const merged = Array.from(new Set([...prev, ...uData.usedMemberGiftIds]));
              try {
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.setItem(
                    `fpt_used_member_gifts_${userId}`,
                    JSON.stringify(merged)
                  );
                }
              } catch {}
              return merged;
            });
          }

          const redeemedGifts: RedeemedGift[] = Array.isArray(uData?.redeemedGifts)
            ? uData.redeemedGifts
            : [];
          const spentPoints = redeemedGifts.reduce(
            (sum, g) => sum + (Number(g.points) || 0),
            0
          );
          const netOrderPoints = Math.max(0, stats.earnedPointsFromOrders - spentPoints);
          const syncedPoints =
            typeof uData?.rewardPoints === 'number'
              ? spentPoints > 0
                ? uData.rewardPoints
                : Math.max(uData.rewardPoints, netOrderPoints)
              : netOrderPoints;

          setWallet({
            points: syncedPoints,
            gifts: redeemedGifts,
          });
          setWalletOwner(userId);
          setLoading(false);
        })
        .catch(() => {
          if (active && latestWalletKey.current === walletKey) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [userId, isDemo, walletKey])
  );

  useEffect(() => {
    if (pathname.includes('rewards') && !isLoading && !isAuthenticated) {
      router.replace({ pathname: '/auth/login', params: { returnTo: 'rewards' } });
    }
  }, [pathname, isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const resolveRewardProductId = (item: { productId?: string; title?: string; id?: string }): string => {
    if (item.productId && productsMap?.[item.productId]) return item.productId;
    if (item.productId) return item.productId;
    const rawId = String(item.id || '');
    const matchFromId = /^RW_MENU_\d+_(.+)$/.exec(rawId);
    if (matchFromId && matchFromId[1]) return matchFromId[1];

    const allProds = products && products.length > 0 ? products : Object.values(productsMap || {});
    const lowerTitle = String(item.title || '').toLowerCase();
    const matched = allProds.find(
      (p) => p?.name && lowerTitle.includes(String(p.name).toLowerCase())
    );
    return matched?.id || allProds[0]?.id || '';
  };

  const isItemPizza = (item: RewardItem): boolean => {
    const pid = resolveRewardProductId(item);
    const prod = pid ? productsMap?.[pid] : undefined;
    const cat = String(prod?.categoryId || '').toLowerCase();
    return (
      Boolean(item.pizzaSize) ||
      cat === 'pizza' ||
      cat === 'cheese_party' ||
      cat === 'member_deals' ||
      cat === 'hot_deals' ||
      String(item.title || '').toLowerCase().includes('pizza') ||
      String(prod?.name || '').toLowerCase().includes('pizza')
    );
  };

  const getSelectedSizeForItem = (item: RewardItem): RewardPizzaSize => {
    if (item.pizzaSize) return item.pizzaSize;
    const lowerTitle = String(item.title || '').toLowerCase();
    if (lowerTitle.includes('cỡ lớn')) return 'large';
    if (lowerTitle.includes('cỡ nhỏ')) return 'small';
    return 'medium';
  };

  const resolvePizzaVariantId = (
    productId: string,
    item: RewardItem
  ): string | undefined => {
    if (!isItemPizza(item)) return undefined;

    const targetSize = getSelectedSizeForItem(item);
    const prod = productsMap?.[productId];
    const variants = prod?.variants || [];
    if (variants.length > 0) {
      const keywords =
        targetSize === 'large'
          ? ['large', 'lớn', '30cm', '12"']
          : targetSize === 'small'
            ? ['small', 'nhỏ', '20cm', '7"']
            : ['medium', 'vừa', '25cm', '9"'];
      const matchedVariant = variants.find((v) =>
        keywords.some(
          (k) =>
            String(v.id || '').toLowerCase() === k ||
            String(v.name || '').toLowerCase().includes(k)
        )
      );
      if (matchedVariant) return matchedVariant.id;
    }

    return targetSize;
  };

  const handleRedeem = async (item: RewardItem) => {
    if (busy.current) return;
    if (userPoints < item.points) {
      notify(
        'Chưa đủ điểm',
        `Bạn cần ${item.points} điểm để đổi món này. Điểm hiện tại của bạn là ${userPoints} điểm.`
      );
      return;
    }
    busy.current = true;
    setRedeeming(true);
    const uid = user?.id;
    try {
      if (!uid) throw new Error('Vui lòng đăng nhập.');
      const newGift: RedeemedGift = {
        id: `GIFT-${Date.now().toString().slice(-6)}`,
        rewardId: item.id,
        title: item.title,
        points: item.points,
        redeemedAt: new Date().toISOString(),
      };
      const nextPoints = Math.max(0, userPoints - item.points);
      const nextGifts = [newGift, ...gifts];
      await updateDoc(doc(db, 'users', uid), {
        rewardPoints: nextPoints,
        redeemedGifts: nextGifts,
      }).catch(() => {});
      void redeemReward(item.id).catch(() => {});
      const updated: RewardWallet = { points: nextPoints, gifts: nextGifts };
      if (owner.current !== uid) return;
      setWallet(updated);

      const targetProductId = resolveRewardProductId(item);
      if (targetProductId) {
        const resolvedVariantId = resolvePizzaVariantId(targetProductId, item);
        addItem({
          productId: targetProductId,
          ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
          addonIds: [],
          quantity: 1,
          specialInstructions: `Quà đổi điểm FPT Rewards [PTS:${item.points}]`,
        });
      }

      showToast({
        message: `Đã đổi "${item.title}" vào giỏ hàng!`,
        type: 'success',
      });
    } catch (err) {
      if (owner.current === uid) {
        notify(
          'Chưa thể đổi quà',
          err instanceof Error ? err.message : 'Vui lòng thử lại.'
        );
        setAttempt((value) => value + 1);
      }
    } finally {
      busy.current = false;
      setRedeeming(false);
    }
  };

  const eligibleMemberGifts = getEligibleMemberGifts(
    memberGiftRules,
    tierInfo.id,
    userBirthday || (user as any)?.birthday,
    tierInfo
  );
  const unusedMemberGifts = eligibleMemberGifts.filter(
    (g) => !usedMemberGiftIds.includes(g.id)
  );
  const usedMemberGifts = eligibleMemberGifts.filter((g) =>
    usedMemberGiftIds.includes(g.id)
  );

  const findInCartMemberGiftLine = (rule: MemberGiftRule) => {
    return cartItems.find((it) =>
      String(it.specialInstructions || '').includes(`(${rule.id})`)
    );
  };

  const handleUseMemberGift = async (rule: MemberGiftRule) => {
    if (cartSubtotal < rule.minSubtotal) {
      setGiftPopup({
        type: 'min_subtotal',
        minSubtotal: rule.minSubtotal || 280000,
      });
      return;
    }

    const targetProductId = resolveRewardProductId(rule);
    if (!targetProductId) {
      notify('Chưa tìm thấy món', 'Món quà hiện không khả dụng trong thực đơn.');
      return;
    }

    const fakeRewardItem: RewardItem = {
      id: rule.id,
      title: rule.title,
      points: 0,
      productId: targetProductId,
      pizzaSize: rule.pizzaSize,
      image: REWARD_IMAGES[5],
    };
    const resolvedVariantId = resolvePizzaVariantId(targetProductId, fakeRewardItem);

    addItem({
      productId: targetProductId,
      ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
      addonIds: [],
      quantity: 1,
      specialInstructions: `Quà đổi điểm FPT Rewards (${rule.id}) [MIN:${rule.minSubtotal || 280000}]`,
    });

    setGiftPopup({ type: 'added' });
  };

  const handleCancelMemberGift = (rule: MemberGiftRule) => {
    const inCartLine = findInCartMemberGiftLine(rule);
    if (inCartLine && inCartLine.lineId) {
      removeItem(inCartLine.lineId);
    }
    setGiftPopup({ type: 'removed' });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ======================================================== */}
      {/* HEADER: Centered "FPT rewards" + Right Receipt Icon       */}
      {/* ======================================================== */}
      <View style={styles.header}>
        <View style={styles.headerPlaceholder} />
        <Text style={styles.headerTitle}>FPT rewards</Text>
        <TouchableOpacity
          style={styles.headerRightBtn}
          onPress={() => router.push('/rewards/terms')}
          accessibilityLabel="Điều khoản và điều kiện"
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ReceiptListIcon />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
      >
        {/* ======================================================== */}
        {/* MEMBER CARD (Solid #CF4226 brand red, matches mockup)   */}
        {/* ======================================================== */}
        <View style={styles.memberCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardBadgeWrap}>
              <MemberCardPizzaIcon tier={tierInfo.id} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTierTitle}>{tierInfo.cardTitle}</Text>
              <Text style={styles.cardExpireSub}>
                Ngày hết hạn {tierInfo.maturityDate}
              </Text>
            </View>
          </View>

          <View style={styles.cardStatsRow}>
            {/* Stat 1: Điểm */}
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userPoints}</Text>
              <Text style={styles.statLabel}>điểm</Text>
            </View>

            {/* Stat 2: Giảm giá */}
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{tierInfo.discountPercent}%</Text>
              <Text style={styles.statLabel}>giảm giá</Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 2 SEGMENTED TABS: Danh sách | Quà của tôi                */}
        {/* ======================================================== */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'list' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('list')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'list' && styles.segmentTextActive,
              ]}
            >
              Danh sách
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'my_gifts' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('my_gifts')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'my_gifts' && styles.segmentTextActive,
              ]}
            >
              Quà của tôi ({unusedMemberGifts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* CONTENT BASED ON ACTIVE TAB                             */}
        {/* ======================================================== */}
        {loading && rewardItems.length === 0 && unusedMemberGifts.length === 0 && (
          <ActivityIndicator style={{ marginTop: 16 }} color="#CF4226" />
        )}
        {!!error && (
          <View style={{ padding: 16 }}>
            <Text>{error}</Text>
            <TouchableOpacity
              onPress={() => setAttempt((value) => value + 1)}
              style={{ paddingVertical: 12 }}
              accessibilityRole="button"
            >
              <Text>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}
        {user?.isDemo && (
          <View style={{ padding: 16 }}>
            <Text>Đăng nhập tài khoản thật để tải điểm và đổi quà.</Text>
            <AppButton
              title="Đăng nhập"
              style={{ marginTop: 12 }}
              onPress={() =>
                router.push({ pathname: '/auth/login', params: { returnTo: 'rewards' } })
              }
            />
          </View>
        )}
        {activeTab === 'list' && (
          <View style={styles.itemsListContainer}>
            {rewardItems.length === 0 && !loading && (
              <View style={styles.emptyHistoryBox}>
                <Text style={styles.emptyHistoryTitle}>
                  Chưa có món quà đổi điểm
                </Text>
                <Text style={styles.emptyHistorySub}>
                  Danh sách quà đổi điểm FPT Rewards sẽ hiển thị tại đây khi được cập nhật.
                </Text>
              </View>
            )}
            {rewardItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                {/* Product Thumbnail */}
                <View style={styles.itemImageWrap}>
                  <Image
                    source={item.image}
                    style={styles.itemImage}
                    resizeMode="contain"
                  />
                </View>

                {/* Details */}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemPoints}>{item.points} Điểm</Text>
                </View>

                {/* Redeem Button */}
                {(() => {
                  const canRedeem = userPoints >= item.points;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.redeemButton,
                        {
                          backgroundColor: canRedeem ? '#CF4226' : '#E5E7EB',
                          opacity: redeeming ? 0.6 : 1,
                        },
                      ]}
                      disabled={redeeming || !canRedeem}
                      activeOpacity={0.75}
                      onPress={() => handleRedeem(item)}
                    >
                      <Text
                        style={[
                          styles.redeemBtnText,
                          {
                            color: canRedeem ? '#FFFFFF' : '#9CA3AF',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        Đổi
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'my_gifts' && (
          <View style={styles.giftTabContainer}>
            {unusedMemberGifts.length === 0 && !loading && (
              <View style={styles.emptyHistoryBox}>
                <Text style={styles.emptyHistoryTitle}>
                  Bạn chưa có quà tặng nào
                </Text>
                <Text style={styles.emptyHistorySub}>
                  Quà tặng đặc quyền khi đạt Hạng Vàng / Kim Cương hoặc quà Sinh nhật sẽ hiển thị tại đây!
                </Text>
              </View>
            )}

            {unusedMemberGifts.map((rule) => {
              const targetPid = resolveRewardProductId(rule);
              const matchedProd = targetPid ? productsMap?.[targetPid] : undefined;
              const imgSource = rule.imageUrl
                ? { uri: rule.imageUrl }
                : matchedProd?.image
                  ? { uri: matchedProd.image }
                  : REWARD_IMAGES[5];

              const cleanBaseTitle = rule.title
                .replace(/^Quà Sinh Nhật:\s*/i, '')
                .replace(/\s*miễn phí$/i, '')
                .replace(/\s*\((Cỡ [^)]+)\)/i, ' - $1')
                .trim();
              const minK = Math.round((rule.minSubtotal || 0) / 1000);
              const displayGiftTitle =
                minK > 0 && !cleanBaseTitle.toLowerCase().includes('đơn hàng từ')
                  ? `${cleanBaseTitle} cho đơn hàng từ ${minK}K`
                  : cleanBaseTitle;

              return (
                <View
                  key={rule.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    backgroundColor: '#FFFFFF',
                    paddingVertical: 16,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    gap: 14,
                  }}
                >
                  <Image
                    source={imgSource}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 42,
                    }}
                    resizeMode="contain"
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: '#111827',
                        lineHeight: 22,
                      }}
                    >
                      {displayGiftTitle}
                    </Text>

                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '400',
                        color: '#374151',
                        marginTop: 4,
                      }}
                    >
                      Exp: {rule.expiresAt || tierInfo.maturityDate}
                    </Text>

                    {(() => {
                      const inCartLine = findInCartMemberGiftLine(rule);
                      if (inCartLine) {
                        return (
                          <TouchableOpacity
                            style={{
                              alignSelf: 'flex-end',
                              marginTop: 10,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#E5E7EB',
                              paddingHorizontal: 30,
                              paddingVertical: 11,
                              borderRadius: 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            activeOpacity={0.8}
                            onPress={() => handleCancelMemberGift(rule)}
                          >
                            <Text
                              style={{
                                color: '#D1D5DB',
                                fontSize: 15,
                                fontWeight: '600',
                              }}
                            >
                              Hủy
                            </Text>
                          </TouchableOpacity>
                        );
                      }

                      return (
                        <TouchableOpacity
                          style={{
                            alignSelf: 'flex-end',
                            marginTop: 10,
                            backgroundColor: '#CF4226',
                            paddingHorizontal: 22,
                            paddingVertical: 11,
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          activeOpacity={0.8}
                          onPress={() => handleUseMemberGift(rule)}
                        >
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: 15,
                              fontWeight: '600',
                            }}
                          >
                            Sử dụng
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Nút Giỏ hàng nổi góc dưới phải khi giỏ hàng có món (giống hình 2, 3, 4) */}
      {cartItemCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/cart')}
          style={{
            position: 'absolute',
            right: 20,
            bottom: 24,
            width: 58,
            height: 58,
            borderRadius: 18,
            backgroundColor: '#CF4226',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.22,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <ShoppingCart size={24} color="#FFFFFF" />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
            }}
          >
            <Text
              style={{
                color: '#CF4226',
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {cartItemCount}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Popup Thông báo điều kiện đơn hàng / Thêm hoặc Xóa Coupon khỏi giỏ hàng */}
      <Modal
        visible={giftPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGiftPopup(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 22,
              paddingVertical: 24,
              alignItems: 'center',
            }}
          >
            {giftPopup?.type === 'min_subtotal' ? (
              <>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: '#111827',
                    textAlign: 'center',
                    lineHeight: 24,
                  }}
                >
                  Đơn hàng chưa đạt điều kiện sử{'\n'}dụng ưu đãi:
                </Text>

                <View
                  style={{
                    width: 88,
                    height: 2.5,
                    backgroundColor: '#CF4226',
                    borderRadius: 2,
                    marginTop: 8,
                    marginBottom: 16,
                  }}
                />

                <Text
                  style={{
                    fontSize: 14.5,
                    color: '#1F2937',
                    textAlign: 'center',
                    lineHeight: 22,
                  }}
                >
                  Các sản phẩm có giá ưu đãi hoặc combo không được tính vào giá trị xét điều kiện. Vui lòng chọn thêm món lẻ nguyên giá đạt mức tối thiểu{' '}
                  {(giftPopup.minSubtotal || 280000).toLocaleString('en-US')}đ để sử dụng ưu đãi.
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    width: '100%',
                    gap: 12,
                    marginTop: 22,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setGiftPopup(null)}
                    style={{
                      flex: 1,
                      paddingVertical: 13,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#111827',
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                    >
                      Đã hiểu
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setGiftPopup(null);
                      router.push('/(tabs)/menu');
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 13,
                      borderRadius: 8,
                      backgroundColor: '#CF4226',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                    >
                      Đến thực đơn
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: '#111827',
                    textAlign: 'center',
                  }}
                >
                  Thông báo
                </Text>

                <View
                  style={{
                    width: 88,
                    height: 2.5,
                    backgroundColor: '#CF4226',
                    borderRadius: 2,
                    marginTop: 8,
                    marginBottom: 18,
                  }}
                />

                <Text
                  style={{
                    fontSize: 15,
                    color: '#1F2937',
                    textAlign: 'center',
                    lineHeight: 22,
                  }}
                >
                  {giftPopup?.type === 'added'
                    ? 'Coupon đã được thêm vào giỏ hàng'
                    : 'Coupon đã được xoá khỏi giỏ hàng'}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setGiftPopup(null)}
                  style={{
                    width: '100%',
                    marginTop: 22,
                    paddingVertical: 13,
                    borderRadius: 8,
                    backgroundColor: '#CF4226',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 15.5,
                      fontWeight: '600',
                    }}
                  >
                    Xác nhận
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
