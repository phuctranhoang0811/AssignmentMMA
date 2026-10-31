import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import Svg, { Path, Rect, G, Text as SvgText } from 'react-native-svg';
import { triggerHaptic } from '../../utils/haptics';
import { styles, BRAND_RED } from '../../styles/rewardTerms.styles';

const DARK_SLATE = '#28364A';

/* 1. Top Logo: HUT [Pizza Slice] REWARDS™ (Screenshot 1) */
const HutRewardsBannerLogo = () => (
  <Svg width={290} height={64} viewBox="0 0 290 64" fill="none">
    {/* Left Top & Bottom Red Lines */}
    <Path d="M12 15H84" stroke={BRAND_RED} strokeWidth={1.5} />
    <Path d="M12 49H90" stroke={BRAND_RED} strokeWidth={1.5} />

    {/* Right Top & Bottom Red Lines */}
    <Path d="M122 15H278" stroke={BRAND_RED} strokeWidth={1.5} />
    <Path d="M116 49H278" stroke={BRAND_RED} strokeWidth={1.5} />

    {/* Bold "HUT" */}
    <SvgText
      x="14"
      y="41"
      fill="#111827"
      fontSize="26"
      fontWeight="900"
      letterSpacing="1"
    >
      HUT
    </SvgText>

    {/* Center Pizza Slice with 2 Stars */}
    <G transform="translate(85, 6)">
      {/* Crust arc */}
      <Path
        d="M2 5C10 1.5 26 1.5 34 5L32.2 10.5C25 7.5 11 7.5 3.8 10.5L2 5Z"
        fill={BRAND_RED}
      />
      {/* Main slice triangle */}
      <Path
        d="M4.2 12.2C11.2 9.4 24.8 9.4 31.8 12.2L18 52L4.2 12.2Z"
        fill={BRAND_RED}
      />
      {/* Top 5-point star */}
      <Path
        d="M18 16L19.6 20.6H24.4L20.5 23.4L22 28L18 25.2L14 28L15.5 23.4L11.6 20.6H16.4L18 16Z"
        fill="#FFFFFF"
      />
      {/* Bottom smaller star */}
      <Path
        d="M18 31L19.1 34.2H22.5L19.7 36.2L20.8 39.4L18 37.4L15.2 39.4L16.3 36.2L13.5 34.2H16.9L18 31Z"
        fill="#FFFFFF"
      />
    </G>

    {/* Thin "REWARDS" */}
    <SvgText
      x="123"
      y="41"
      fill="#111827"
      fontSize="26"
      fontWeight="300"
      letterSpacing="2.5"
    >
      REWARDS
    </SvgText>
    <SvgText x="268" y="25" fill="#111827" fontSize="9" fontWeight="600">
      TM
    </SvgText>
  </Svg>
);

/* 2. Small Pizza Slice Icon next to "Tích điểm" (Screenshot 1) */
const SmallPizzaPointIcon = () => (
  <Svg width={22} height={26} viewBox="0 0 36 48" fill="none" style={{ marginLeft: 8 }}>
    <Path
      d="M2 5C10 1.5 26 1.5 34 5L32 10C25 7 11 7 4 10L2 5Z"
      fill={BRAND_RED}
    />
    <Path
      d="M4.5 12C11.5 9.2 24.5 9.2 31.5 12L18 46L4.5 12Z"
      fill={BRAND_RED}
    />
    <Path
      d="M18 15L19.4 19.2H23.8L20.2 21.8L21.5 26L18 23.4L14.5 26L15.8 21.8L12.2 19.2H16.6L18 15Z"
      fill="#FFFFFF"
    />
    <Path
      d="M18 28.5L18.9 31.2H21.8L19.5 32.9L20.4 35.6L18 33.9L15.6 35.6L16.5 32.9L14.2 31.2H17.1L18 28.5Z"
      fill="#FFFFFF"
    />
  </Svg>
);

/* 3. Tab Icons: 1 Slice (Cơ Bản), 2 Slices (Vàng), 3 Slices (VIP) */
const SingleSliceTabIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={28} viewBox="0 0 36 44" fill="none">
    <G transform="rotate(14 18 22)">
      <Path d="M4 5C11 2 25 2 32 5L30 9.5C24 7 12 7 6 9.5L4 5Z" fill={color} />
      <Path d="M6.2 11.2C12.2 8.8 23.8 8.8 29.8 11.2L18 41L6.2 11.2Z" fill={color} />
      <Path
        d="M18 14L19.3 18H23.5L20.1 20.4L21.4 24.4L18 22L14.6 24.4L15.9 20.4L12.5 18H16.7L18 14Z"
        fill="#FFFFFF"
      />
      <Path
        d="M18 26.5L18.8 29H21.4L19.3 30.5L20.1 33L18 31.5L15.9 33L16.7 30.5L14.6 29H17.2L18 26.5Z"
        fill="#FFFFFF"
      />
    </G>
  </Svg>
);

const DoubleSliceTabIcon = ({ color }: { color: string }) => (
  <Svg width={36} height={28} viewBox="0 0 54 44" fill="none">
    <G transform="translate(0, 2) rotate(-22 18 28)">
      <Path d="M5 6C11 3.5 23 3.5 29 6L27.5 10C22 8 12 8 6.5 10L5 6Z" fill={color} />
      <Path d="M7 11.5C12 9.5 22 9.5 27 11.5L17 38L7 11.5Z" fill={color} />
      <Path
        d="M17 15L18.1 18.2H21.5L18.7 20.2L19.8 23.4L17 21.4L14.2 23.4L15.3 20.2L12.5 18.2H15.9L17 15Z"
        fill="#FFFFFF"
      />
    </G>
    <G transform="translate(18, 0) rotate(22 18 28)">
      <Path d="M5 6C11 3.5 23 3.5 29 6L27.5 10C22 8 12 8 6.5 10L5 6Z" fill={color} />
      <Path d="M7 11.5C12 9.5 22 9.5 27 11.5L17 38L7 11.5Z" fill={color} />
      <Path
        d="M17 15L18.1 18.2H21.5L18.7 20.2L19.8 23.4L17 21.4L14.2 23.4L15.3 20.2L12.5 18.2H15.9L17 15Z"
        fill="#FFFFFF"
      />
    </G>
  </Svg>
);

const TripleSliceTabIcon = ({ color }: { color: string }) => (
  <Svg width={42} height={28} viewBox="0 0 64 44" fill="none">
    <G transform="translate(0, 6) rotate(-38 16 28)">
      <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill={color} />
      <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill={color} />
      <Path
        d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
        fill="#FFFFFF"
      />
    </G>
    <G transform="translate(17, 1)">
      <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill={color} />
      <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill={color} />
      <Path
        d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
        fill="#FFFFFF"
      />
    </G>
    <G transform="translate(32, 6) rotate(38 16 28)">
      <Path d="M5 6C10 4 20 4 25 6L23.8 9.5C19 7.8 11 7.8 6.2 9.5L5 6Z" fill={color} />
      <Path d="M6.5 11C11 9.2 19 9.2 23.5 11L15 35L6.5 11Z" fill={color} />
      <Path
        d="M15 14L15.9 16.8H18.8L16.5 18.5L17.4 21.3L15 19.6L12.6 21.3L13.5 18.5L11.2 16.8H14.1L15 14Z"
        fill="#FFFFFF"
      />
    </G>
  </Svg>
);

/* 4. Benefit Illustrations (Screenshots 2, 4, 5) */
const WelcomeGiftIllustration = () => (
  <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
    {/* 3 Stars */}
    <Path
      d="M18 22L20.5 26.5L25.5 27.5L22 31L22.8 36L18 33.6L13.2 36L14 31L10.5 27.5L15.5 26.5L18 22Z"
      fill={BRAND_RED}
    />
    <Path
      d="M35 12L36.8 15.2L40.4 15.9L37.8 18.4L38.4 22L35 20.3L31.6 22L32.2 18.4L29.6 15.9L33.2 15.2L35 12Z"
      fill={BRAND_RED}
    />
    <Path
      d="M39 27L40.8 30.2L44.4 30.9L41.8 33.4L42.4 37L39 35.3L35.6 37L36.2 33.4L33.6 30.9L37.2 30.2L39 27Z"
      fill={BRAND_RED}
    />

    {/* Tilted Gift Box Lid */}
    <G transform="rotate(42 62 28)">
      <Rect x="36" y="22" width="52" height="13" rx="4" fill={BRAND_RED} />
      <Rect x="59" y="22" width="6" height="13" fill="#FFFFFF" />
      <Path
        d="M52 22C52 16 58 16 61 22M72 22C72 16 66 16 63 22"
        stroke={BRAND_RED}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </G>

    {/* Gift Box Body */}
    <Rect x="24" y="45" width="46" height="42" rx="6" fill={BRAND_RED} />
    <Rect x="45" y="45" width="4" height="42" fill="#FFFFFF" />
  </Svg>
);

const BirthdayCupcakeIllustration = () => (
  <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
    {/* Candle Flame */}
    <Path
      d="M48 8C48 8 56 17 56 23C56 27.4 52.4 31 48 31C43.6 31 40 27.4 40 23C40 17 48 8 48 8Z"
      fill={BRAND_RED}
    />
    {/* Candle Wick */}
    <Rect x="46.5" y="30" width="3" height="5" fill={BRAND_RED} />
    {/* Top Frosting Tier */}
    <Rect x="29" y="34" width="38" height="16" rx="8" fill={BRAND_RED} />
    {/* Bottom Frosting Tier */}
    <Rect x="18" y="47" width="60" height="16" rx="8" fill={BRAND_RED} />
    {/* Cupcake Base Wrapper */}
    <Path
      d="M25 66H33L35 87H28L25 66ZM38 66H46V87H39L38 66ZM50 66H58L57 87H50V66ZM63 66H71L68 87H61L63 66Z"
      fill={BRAND_RED}
    />
  </Svg>
);

const DiscountScallopBadge = ({ percent }: { percent: number }) => (
  <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
    {/* 12-lobe Scalloped Seal */}
    <Path
      d="M48 6C52.5 6 55.8 10.2 60 11.4C64.2 12.5 69.2 10.6 72.7 13.3C76.2 16 76.2 21.3 78.6 25C81 28.7 86.2 30.5 87.4 34.8C88.5 39 85.2 43.5 85.2 48C85.2 52.5 88.5 57 87.4 61.2C86.2 65.5 81 67.3 78.6 71C76.2 74.7 76.2 80 72.7 82.7C69.2 85.4 64.2 83.5 60 84.6C55.8 85.8 52.5 90 48 90C43.5 90 40.2 85.8 36 84.6C31.8 83.5 26.8 85.4 23.3 82.7C19.8 80 19.8 74.7 17.4 71C15 67.3 9.8 65.5 8.6 61.2C7.5 57 10.8 52.5 10.8 48C10.8 43.5 7.5 39 8.6 34.8C9.8 30.5 15 28.7 17.4 25C19.8 21.3 19.8 16 23.3 13.3C26.8 10.6 31.8 12.5 36 11.4C40.2 10.2 43.5 6 48 6Z"
      fill={BRAND_RED}
    />
    <SvgText
      x="48"
      y="56"
      fill="#FFFFFF"
      fontSize="25"
      fontWeight="800"
      textAnchor="middle"
    >
      {`${percent}%`}
    </SvgText>
  </Svg>
);

export default function RewardTermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedTier, setSelectedTier] = useState<'basic' | 'gold' | 'vip'>('basic');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Điều khoản và điều kiện</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 28, 44) },
        ]}
      >
        {/* 1. HUT REWARDS Logo */}
        <View style={styles.logoSection}>
          <HutRewardsBannerLogo />
        </View>

        {/* 2. Red Box: MAKE EVERY BITE MORE REWARDING */}
        <View style={styles.redBannerBox}>
          <Text style={styles.bannerHeading}>MAKE EVERY BITE MORE REWARDING</Text>

          {/* Step 1 */}
          <View style={styles.stepCard}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepTitle}>Tạo Tài Khoản</Text>
            </View>
            <Text style={styles.stepDesc}>
              Sử dụng website hoặc ứng dụng để đăng ký dễ dàng.
            </Text>
            <Text style={styles.stepBigNumber}>1</Text>
          </View>

          {/* Step 2 */}
          <View style={styles.stepCard}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepTitle}>Tích điểm</Text>
              <SmallPizzaPointIcon />
            </View>
            <Text style={styles.stepDesc}>10.000đ = 1 điểm</Text>
            <Text style={styles.stepBigNumber}>2</Text>
          </View>

          {/* Step 3 */}
          <View style={[styles.stepCard, styles.stepCardLast]}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepTitle}>Đổi Quà</Text>
            </View>
            <Text style={styles.stepDesc}>
              Đổi lấy món ngon với chỉ từ 30 điểm
            </Text>
            <Text style={styles.stepBigNumber}>3</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.sectionTopBorder} />

        {/* 3. Tier Tabs: Cơ Bản | Vàng | VIP */}
        <View style={styles.tierTabsBar}>
          <TouchableOpacity
            style={styles.tierTabBtn}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('light');
              setSelectedTier('basic');
            }}
          >
            <SingleSliceTabIcon
              color={selectedTier === 'basic' ? BRAND_RED : DARK_SLATE}
            />
            <Text
              style={[
                styles.tierTabLabel,
                selectedTier === 'basic' && styles.tierTabLabelActive,
              ]}
            >
              Cơ Bản
            </Text>
            {selectedTier === 'basic' && <View style={styles.tierTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tierTabBtn}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('light');
              setSelectedTier('gold');
            }}
          >
            <DoubleSliceTabIcon
              color={selectedTier === 'gold' ? BRAND_RED : DARK_SLATE}
            />
            <Text
              style={[
                styles.tierTabLabel,
                selectedTier === 'gold' && styles.tierTabLabelActive,
              ]}
            >
              Vàng
            </Text>
            {selectedTier === 'gold' && <View style={styles.tierTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tierTabBtn}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('light');
              setSelectedTier('vip');
            }}
          >
            <TripleSliceTabIcon
              color={selectedTier === 'vip' ? BRAND_RED : DARK_SLATE}
            />
            <Text
              style={[
                styles.tierTabLabel,
                selectedTier === 'vip' && styles.tierTabLabelActive,
              ]}
            >
              VIP
            </Text>
            {selectedTier === 'vip' && <View style={styles.tierTabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* 4. Benefit Icons & Details by Selected Tier */}
        {selectedTier === 'basic' && (
          <>
            <View style={styles.benefitIconsRow}>
              <View style={styles.benefitIconCol}>
                <View style={styles.benefitIconBox}>
                  <WelcomeGiftIllustration />
                </View>
                <Text style={styles.benefitIconTitle}>Voucher chào mừng</Text>
              </View>

              <View style={styles.benefitIconCol}>
                <View style={styles.benefitIconBox}>
                  <BirthdayCupcakeIllustration />
                </View>
                <Text style={styles.benefitIconTitle}>Voucher sinh nhật</Text>
              </View>
            </View>

            <View style={styles.benefitDetailCard}>
              <Text style={styles.detailSectionHeading}>Quyền lợi:</Text>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Voucher Chào mừng: tặng ngay 01 voucher khi Đăng ký thành công
                  trở thành Thành viên mới (sau 72h trừ Thứ Bảy, Chủ Nhật và Ngày
                  Lễ). Mỗi số điện thoại hợp lệ chỉ được nhận 01 Voucher trong
                  suốt thời gian diễn ra chương trình.
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Voucher Sinh Nhật: được gửi vào tháng sinh nhật cho khách hàng đã
                  đăng ký thành viên và trở thành khách hàng thân thiết trên hệ
                  thống Pizza Hut trước ngày đầu tiên của tháng sinh nhật. Giới hạn
                  01 voucher/ 01 Thành viên/ năm.
                </Text>
              </View>

              <Text style={styles.detailSectionHeadingSpaced}>
                Quy định bảng xếp hạng
              </Text>

              <View style={[styles.bulletRow, { marginBottom: 0 }]}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Tổng chi tiêu trước ngày đáo hạn ≥ 1.000.000 VND sẽ được nâng
                  hạng VÀNG.
                </Text>
              </View>
            </View>
          </>
        )}

        {selectedTier === 'gold' && (
          <>
            <View style={styles.benefitIconsRow}>
              <View style={styles.benefitIconCol}>
                <View style={styles.benefitIconBox}>
                  <BirthdayCupcakeIllustration />
                </View>
                <Text style={styles.benefitIconTitle}>Voucher sinh nhật</Text>
              </View>

              <View style={styles.benefitIconCol}>
                <View style={styles.benefitIconBox}>
                  <DiscountScallopBadge percent={10} />
                </View>
                <Text style={styles.benefitIconTitle}>Giảm giá 10%</Text>
              </View>
            </View>

            <View style={styles.benefitDetailCard}>
              <Text style={styles.detailSectionHeading}>Quyền lợi:</Text>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Voucher Sinh Nhật: được gửi vào tháng sinh nhật cho khách hàng đã
                  đăng ký thành viên và trở thành khách hàng thân thiết trên hệ
                  thống Pizza Hut trước ngày đầu tiên của tháng sinh nhật. Giới hạn
                  01 voucher/ 01 Thành viên/ năm.
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Giảm giá: 10% cho các món lẻ (không được áp dụng cùng lúc với các
                  chương trình khuyến mại khác cho cùng một sản phẩm hàng hóa, dịch
                  vụ và COMBO).
                </Text>
              </View>

              <Text style={styles.detailSectionHeadingSpaced}>
                Quy định bảng xếp hạng
              </Text>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Tổng chi tiêu trước ngày đáo hạn ≥ 2.000.000 VND sẽ được nâng
                  hạng VIP.
                </Text>
              </View>

              <View style={[styles.bulletRow, { marginBottom: 0 }]}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Tổng chi tiêu trước ngày đáo hạn {'<'} 1.000.000 VND sẽ bị giảm
                  xuống hạng CƠ BẢN.
                </Text>
              </View>
            </View>
          </>
        )}

        {selectedTier === 'vip' && (
          <>
            <View style={styles.benefitIconsRow}>
              <View style={styles.benefitIconCol}>
                <View style={styles.benefitIconBox}>
                  <BirthdayCupcakeIllustration />
                </View>
                <Text style={styles.benefitIconTitle}>Voucher sinh nhật</Text>
              </View>

              <View style={styles.benefitIconCol}>
                <View style={styles.benefitIconBox}>
                  <DiscountScallopBadge percent={15} />
                </View>
                <Text style={styles.benefitIconTitle}>Giảm giá 15%</Text>
              </View>
            </View>

            <View style={styles.benefitDetailCard}>
              <Text style={styles.detailSectionHeading}>Quyền lợi:</Text>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Voucher Sinh Nhật: được gửi vào tháng sinh nhật cho khách hàng đã
                  đăng ký thành viên và trở thành khách hàng thân thiết trên hệ
                  thống Pizza Hut trước ngày đầu tiên của tháng sinh nhật. Giới hạn
                  01 voucher/ 01 Thành viên/ năm.
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Giảm giá: 15% cho các món lẻ (không được áp dụng cùng lúc với các
                  chương trình khuyến mại khác cho cùng một sản phẩm hàng hóa, dịch
                  vụ và COMBO).
                </Text>
              </View>

              <Text style={styles.detailSectionHeadingSpaced}>
                Quy định bảng xếp hạng
              </Text>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Tổng chi tiêu trước ngày đáo hạn ≥ 2.000.000 VND, chúc mừng bạn
                  đã duy trì được hạng VIP.
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Tổng chi tiêu trước ngày đáo hạn {'<'}2.000.000 VND sẽ bị giảm
                  xuống hạng VÀNG.
                </Text>
              </View>

              <View style={[styles.bulletRow, { marginBottom: 0 }]}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Tổng chi tiêu {'<'}1.000.000 VND sẽ bị giảm xuống hạng CƠ BẢN.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* 5. Ngày đáo hạn Card (Screenshot 3) */}
        <View style={styles.maturityCard}>
          <Text style={styles.maturityHeading}>Ngày đáo hạn</Text>

          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Điểm thưởng có giá trị ít nhất 12 tháng kể từ ngày đăng ký thành
              viên. Điểm thưởng sẽ đáo hạn vào các ngày đáo hạn cố định hàng năm:
              28/02 (29/02); 31/05; 31/08 và 30/11 tùy vào thời điểm đăng ký thành
              viên của Hut Lovers. Ví dụ: Nếu Hut Lovers đăng ký thành viên thành
              công vào ngày 25/12/2023, theo chu kỳ 12 tháng và ngày đáo hạn cố
              định hàng năm gần nhất là 29/02, tất cả các điểm tích lũy sẽ hết hạn
              vào ngày 29/02/2024.
            </Text>
          </View>

          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Trước thời điểm đáo hạn điểm thưởng 07 ngày, Hut Lovers sẽ nhận được
              thông báo qua app/ tin nhắn/ email để thông báo về hạng thành viên.
              Nếu Hut Lovers không quy đổi điểm trước ngày đáo hạn điểm thưởng,
              toàn bộ điểm tích lũy sẽ bị mất.
            </Text>
          </View>

          <View style={[styles.bulletRow, { marginBottom: 0 }]}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Việc nâng hạng thành viên sẽ được tự động cập nhật trước 7 giờ sáng
              của ngày tiếp theo.
            </Text>
          </View>
        </View>

        {/* Bottom Underlined Link */}
        <TouchableOpacity
          style={styles.bottomTermsBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/support/terms')}
        >
          <Text style={styles.bottomTermsText}>Điều kiện và điều khoản</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

