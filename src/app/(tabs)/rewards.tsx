import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRAND_RED = '#CF4226';

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
  const [activeTab, setActiveTab] = useState<'list' | 'my_gifts' | 'history'>('list');
  const [userPoints, setUserPoints] = useState(0);

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
        contentContainerStyle={styles.scrollContent}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 90,
  },

  /* Header */
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerRightBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptBox: {
    width: 22,
    height: 22,
    borderWidth: 1.8,
    borderColor: '#4B5563',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  receiptLine: {
    width: '100%',
    height: 1.6,
    backgroundColor: '#4B5563',
    marginVertical: 1.2,
    borderRadius: 1,
  },

  /* Member Card */
  memberCard: {
    backgroundColor: BRAND_RED,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 18,
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBadgeWrap: {
    marginRight: 12,
  },
  fanBadgeImg: {
    width: 44,
    height: 32,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTierTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardExpireSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 2,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 22,
    paddingTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statNumber: {
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    marginLeft: 6,
    fontWeight: '500',
  },

  /* Segmented Filter Tabs */
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentBtnActive: {
    backgroundColor: BRAND_RED,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Items List (Danh sách) */
  itemsListContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemImageWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: 68,
    height: 68,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
  },
  itemPoints: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  redeemButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  /* Quà của tôi tab */
  giftTabContainer: {
    padding: 16,
  },
  voucherCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  voucherLeft: {
    width: 90,
    backgroundColor: BRAND_RED,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  voucherPercent: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  voucherOffText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  voucherRight: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  voucherTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  voucherDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  voucherExpiry: {
    fontSize: 11,
    color: BRAND_RED,
    fontWeight: '600',
    marginTop: 6,
  },

  /* Lịch sử tab */
  historyTabContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    marginTop: 30,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptyHistorySub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 240,
  },
});
