import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { AppButton } from '../../components/ui/AppButton';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { rewardCatalog, type RewardWallet, type RedeemedGift } from '../../data/rewards';
import { getRewardWallet, redeemReward } from '../../services/rewardService';
import {
  fetchUserMemberStats,
  getMemberTierFromSpent,
  calculateMaturityDate,
  type MemberTierInfo,
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

interface RewardItem {
  id: string;
  title: string;
  points: number;
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
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading } = useAuth();
  const userId = user?.id;
  const isDemo = user?.isDemo;
  const [activeTab, setActiveTab] = useState<'list' | 'my_gifts' | 'history'>('list');
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [walletOwner, setWalletOwner] = useState<string>();
  const [tierInfo, setTierInfo] = useState<MemberTierInfo>(() =>
    getMemberTierFromSpent(0, 0, calculateMaturityDate())
  );
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setWallet(null);
      setWalletOwner(undefined);
      setError('');
      setLoading(false);
      if (!userId || isDemo) return;
      setLoading(true);

      Promise.all([
        fetchUserMemberStats(userId),
        getRewardWallet().catch(async () => {
          // Fallback đọc trực tiếp từ Firestore users/{userId} nếu backend /api/rewards chưa phản hồi
          const userSnap = await getDoc(doc(db, 'users', userId)).catch(() => null);
          const data = userSnap?.exists() ? userSnap.data() : undefined;
          const stats = await fetchUserMemberStats(userId);
          const redeemedGifts: RedeemedGift[] = Array.isArray(data?.redeemedGifts)
            ? data.redeemedGifts
            : [];
          const spentPoints = redeemedGifts.reduce(
            (sum, g) => sum + (Number(g.points) || 0),
            0
          );
          const storedPoints =
            typeof data?.rewardPoints === 'number'
              ? Math.max(data.rewardPoints, stats.earnedPointsFromOrders - spentPoints)
              : Math.max(0, stats.earnedPointsFromOrders - spentPoints);
          return {
            points: storedPoints,
            gifts: redeemedGifts,
          } as RewardWallet;
        }),
      ])
        .then(([stats, walletVal]) => {
          if (active && latestWalletKey.current === walletKey) {
            setTierInfo(stats);
            const spentPoints = (walletVal.gifts ?? []).reduce(
              (sum, g) => sum + (Number(g.points) || 0),
              0
            );
            const syncedPoints = Math.max(
              walletVal.points ?? 0,
              stats.earnedPointsFromOrders - spentPoints
            );
            setWallet({ ...walletVal, points: syncedPoints });
            setWalletOwner(userId);
          }
        })
        .catch(() => {
          if (active && latestWalletKey.current === walletKey) {
            setError('Không thể tải điểm và quà. Vui lòng thử lại.');
          }
        })
        .finally(() => {
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
      const updated = await redeemReward(item.id).catch(async () => {
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
        return { points: nextPoints, gifts: nextGifts } as RewardWallet;
      });
      if (owner.current !== uid) return;
      setWallet(updated);
      setActiveTab('my_gifts');
      notify('Đổi quà thành công', `Bạn đã đổi: ${item.title}.`);
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
              <Image
                source={require('../../../assets/rewards/fan_icon.png')}
                style={styles.fanBadgeImg}
                resizeMode="contain"
              />
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
        {/* 3 SEGMENTED TABS: Danh sách | Quà của tôi | Lịch sử      */}
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
              Quà của tôi ({gifts.length + 1})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'history' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'history' && styles.segmentTextActive,
              ]}
            >
              Lịch sử
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* CONTENT BASED ON ACTIVE TAB                             */}
        {/* ======================================================== */}
        {loading && <ActivityIndicator style={{ marginTop: 16 }} color="#CF4226" />}
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
            {REWARD_ITEMS.map((item) => (
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
                <TouchableOpacity
                  style={[
                    styles.redeemButton,
                    {
                      opacity: redeeming || userPoints < item.points ? 0.45 : 1,
                    },
                  ]}
                  disabled={redeeming}
                  activeOpacity={0.75}
                  onPress={() => handleRedeem(item)}
                >
                  <Text style={styles.redeemBtnText}>Đổi</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'my_gifts' && (
          <View style={styles.giftTabContainer}>
            {/* Voucher Chào mừng Thành viên mới */}
            <View style={[styles.voucherCard, { marginBottom: 12 }]}>
              <View style={styles.voucherLeft}>
                <Text style={styles.voucherPercent}>40K</Text>
                <Text style={styles.voucherOffText}>GIẢM GIÁ</Text>
              </View>
              <View style={styles.voucherRight}>
                <Text style={styles.voucherTitle}>
                  Voucher Chào Mừng Thành Viên Mới
                </Text>
                <Text style={styles.voucherDesc}>
                  Giảm 40.000đ cho đơn hàng từ 150.000đ
                </Text>
                <Text style={styles.voucherExpiry}>
                  Hạn dùng: {tierInfo.maturityDate}
                </Text>
              </View>
            </View>

            {gifts.map((gift) => (
              <View key={gift.id} style={[styles.voucherCard, { marginBottom: 12 }]}>
                <View style={styles.voucherLeft}>
                  <Text style={styles.voucherPercent}>QUÀ</Text>
                  <Text style={styles.voucherOffText}>{gift.points} ĐIỂM</Text>
                </View>
                <View style={styles.voucherRight}>
                  <Text style={styles.voucherTitle}>{gift.title}</Text>
                  <Text style={styles.voucherDesc}>Mã quà: {gift.id}</Text>
                  <Text style={styles.voucherExpiry}>
                    {new Date(gift.redeemedAt).toLocaleString('vi-VN')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.giftTabContainer}>
            {gifts.length === 0 && !loading && !error && (
              <View style={styles.emptyHistoryBox}>
                <Text style={styles.emptyHistoryTitle}>
                  Chưa có lịch sử tích đổi điểm
                </Text>
                <Text style={styles.emptyHistorySub}>
                  Lịch sử tích điểm và quà bạn đã đổi sẽ hiển thị tại đây.
                </Text>
              </View>
            )}
            {gifts.map((gift) => (
              <View key={gift.id} style={[styles.voucherCard, { marginBottom: 12 }]}>
                <View style={styles.voucherRight}>
                  <Text style={styles.voucherTitle}>{gift.title}</Text>
                  <Text style={styles.voucherDesc}>Đã dùng {gift.points} điểm</Text>
                  <Text style={styles.voucherExpiry}>
                    {new Date(gift.redeemedAt).toLocaleString('vi-VN')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
