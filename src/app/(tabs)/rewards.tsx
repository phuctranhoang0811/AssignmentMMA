import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../state/AuthContext';
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
  image: any;
}

const REWARD_ITEMS: RewardItem[] = [
  {
    id: 'R01',
    title: 'Đổi 01 Lon Pepsi 320ML miễn phí',
    points: 30,
    image: require('../../../assets/rewards/pepsi.png'),
  },
  {
    id: 'R02',
    title: 'Đổi 01 Lon 7Up 320ML miễn phí',
    points: 30,
    image: require('../../../assets/rewards/7up.png'),
  },
  {
    id: 'R03',
    title: 'Đổi 01 Lon Mirinda Cam 320ML miễn phí',
    points: 30,
    image: require('../../../assets/rewards/mirinda.png'),
  },
  {
    id: 'R04',
    title: 'Đổi 01 Xà Lách Cá Ngừ và Thịt Xông Khói miễn phí',
    points: 70,
    image: require('../../../assets/rewards/salad.png'),
  },
  {
    id: 'R05',
    title: 'Đổi 01 Mỳ Ý Bò Bằm Xốt Cà Chua miễn phí',
    points: 100,
    image: require('../../../assets/rewards/spaghetti.png'),
  },
  {
    id: 'R06',
    title: 'Đổi 01 Pizza Phô Mai Cao Cấp Đế Dày Cỡ Vừa miễn phí',
    points: 120,
    image: require('../../../assets/rewards/pizza_cheese.png'),
  },
  {
    id: 'R07',
    title: 'Đổi 01 Pizza Thập Cẩm Đế Dày Cỡ Vừa miễn phí',
    points: 180,
    image: require('../../../assets/rewards/pizza_supreme.png'),
  },
];

export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'my_gifts' | 'history'>('list');
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace({ pathname: '/auth/login', params: { returnTo: 'profile' } });
    }
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const handleRedeem = (item: RewardItem) => {
    if (userPoints < item.points) {
      const msg = `Bạn cần ${item.points} điểm để đổi món này. Điểm hiện tại của bạn là ${userPoints} điểm.\nHãy tích điểm bằng cách đặt các món ăn ngon tại Pizza FPT nhé!`;
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Chưa đủ điểm', msg);
      }
    } else {
      const msg = `Chúc mừng! Bạn đã đổi thành công: ${item.title}. Quà đã được chuyển vào mục "Quà của tôi".`;
      setUserPoints((prev) => prev - item.points);
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Đổi quà thành công', msg);
      }
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
              <Text style={styles.cardExpireSub}>Ngày hết hạn 30/11/2027</Text>
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
        {/* 3 SEGMENTED TABS: Danh sách | Quà của tôi (1) | Lịch sử   */}
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
              Quà của tôi (1)
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
                  style={styles.redeemButton}
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
            <View style={styles.voucherCard}>
              <View style={styles.voucherLeft}>
                <Text style={styles.voucherPercent}>40K</Text>
                <Text style={styles.voucherOffText}>GIẢM GIÁ</Text>
              </View>
              <View style={styles.voucherRight}>
                <Text style={styles.voucherTitle}>Voucher Chào Mừng Thành Viên Mới</Text>
                <Text style={styles.voucherDesc}>Giảm 40.000đ cho đơn hàng từ 150.000đ</Text>
                <Text style={styles.voucherExpiry}>Hạn dùng: 30/11/2026</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.historyTabContainer}>
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryTitle}>Chưa có lịch sử tích đổi điểm</Text>
              <Text style={styles.emptyHistorySub}>
                Lịch sử tích điểm và quà bạn đã đổi sẽ hiển thị tại đây.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

