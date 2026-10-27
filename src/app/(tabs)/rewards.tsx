import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../state/AuthContext';
import { rewardCatalog, type RewardWallet } from '../../data/rewards';
import { getRewardWallet, redeemReward } from '../../services/rewardService';
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
const REWARD_ITEMS: RewardItem[] = rewardCatalog.map((item, index) => ({ ...item, image: REWARD_IMAGES[index] }));
const notify = (title: string, message: string) => Platform.OS === 'web' ? alert(message) : Alert.alert(title, message);

export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading } = useAuth();
  const userId = user?.id;
  const isDemo = user?.isDemo;
  const [activeTab, setActiveTab] = useState<'list' | 'my_gifts' | 'history'>('list');
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [walletOwner, setWalletOwner] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const busy = useRef(false);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [attempt, setAttempt] = useState(0);
  const currentWallet = walletOwner === user?.id ? wallet : null;
  const userPoints = currentWallet?.points ?? user?.rewardPoints ?? 0;
  const gifts = currentWallet?.gifts ?? [];

  useEffect(() => {
    let active = true;
    setWallet(null);
    setWalletOwner(undefined);
    setError('');
    setLoading(false);
    if (!userId || isDemo) return;
    setLoading(true);
    getRewardWallet().then(value => {
      if (active) { setWallet(value); setWalletOwner(userId); }
    }).catch(() => {
      if (active) setError('Không thể tải điểm và quà. Vui lòng thử lại.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, isDemo, attempt]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace({ pathname: '/auth/login', params: { returnTo: 'rewards' } });
    }
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const handleRedeem = async (item: RewardItem) => {
    if (busy.current || !currentWallet) return;
    busy.current = true;
    setRedeeming(true);
    const uid = user?.id;
    try {
      const updated = await redeemReward(item.id);
      if (owner.current !== uid) return;
      setWallet(updated);
      setActiveTab('my_gifts');
      notify('Đổi quà thành công', `Bạn đã đổi: ${item.title}.`);
    } catch (error) {
      if (owner.current === uid) {
        notify('Chưa thể đổi quà', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        setAttempt(value => value + 1);
      }
    } finally { busy.current = false; setRedeeming(false); }
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
          onPress={() => setActiveTab('history')}
          accessibilityLabel="Lịch sử đổi quà"
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
              <Text style={styles.cardTierTitle}>Thành viên Thường</Text>
              <Text style={styles.cardExpireSub}>Tích điểm và đổi quà cùng Pizza FPT</Text>
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
              <Text style={styles.statNumber}>0%</Text>
              <Text style={styles.statLabel}>giảm giá</Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 3 SEGMENTED TABS: Danh sách | Quà của tôi ({gifts.length}) | Lịch sử   */}
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
            style={[styles.segmentBtn, activeTab === 'my_gifts' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('my_gifts')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'my_gifts' && styles.segmentTextActive,
              ]}
            >
              Quà của tôi ({gifts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'history' && styles.segmentBtnActive]}
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
        {!!error && <View style={{ padding: 16 }}>
          <Text>{error}</Text>
          <TouchableOpacity onPress={() => setAttempt(value => value + 1)} style={{ paddingVertical: 12 }} accessibilityRole="button">
            <Text>Thử lại</Text>
          </TouchableOpacity>
        </View>}
        {user?.isDemo && <View style={{ padding: 16 }}>
          <Text>Đăng nhập tài khoản thật để tải điểm và đổi quà.</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/auth/login', params: { returnTo: 'rewards' } })} style={{ paddingVertical: 12 }}>
            <Text>Đăng nhập</Text>
          </TouchableOpacity>
        </View>}
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
                  style={[styles.redeemButton, { opacity: !currentWallet || redeeming || userPoints < item.points ? 0.45 : 1 }]}
                  disabled={!currentWallet || redeeming || userPoints < item.points}
                  activeOpacity={0.75}
                  onPress={() => handleRedeem(item)}
                >
                  <Text style={styles.redeemBtnText}>Đổi</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {(activeTab === 'my_gifts' || activeTab === 'history') && (
          <View style={styles.giftTabContainer}>
            {gifts.length === 0 && !loading && !error && <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryTitle}>{activeTab === 'history' ? 'Chưa có lịch sử đổi quà' : 'Bạn chưa có quà đã đổi'}</Text>
              <Text style={styles.emptyHistorySub}>Đổi quà trong Danh sách khi bạn có đủ điểm.</Text>
            </View>}
            {gifts.map(gift => <View key={gift.id} style={[styles.voucherCard, { marginBottom: 12 }]}>
              <View style={styles.voucherRight}>
                <Text style={styles.voucherTitle}>{gift.title}</Text>
                <Text style={styles.voucherDesc}>{activeTab === 'history' ? `Đã dùng ${gift.points} điểm` : `Mã quà: ${gift.id}`}</Text>
                <Text style={styles.voucherExpiry}>{new Date(gift.redeemedAt).toLocaleString('vi-VN')}</Text>
              </View>
            </View>)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

