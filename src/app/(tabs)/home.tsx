import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { Alert } from '../../utils/alert';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useContentWidth } from '../../utils/layout';
import {
  Bell,
  MapPin,
  ChevronRight,
  Plus,
  ChevronDown,
} from 'lucide-react-native';
import { productService } from '../../services';
import { Product } from '../../types/product';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { triggerHaptic } from '../../utils/haptics';
import { formatCurrency } from '../../utils/formatCurrency';
import { StoreLocationModal } from '../../components/modals/StoreLocationModal';
import { getSavedDeliveryAddress, saveDeliveryAddress } from '../../services/addressStorage';

import { styles, BRAND_RED } from '../../styles/home.styles';

const PROMO_BANNERS = [
  {
    id: 'b1',
    tag: 'COMBO PIZZA KÉO',
    price: 'MỚI CHỈ TỪ 389.000đ',
    discount: 'GIẢM TỚI 40.000đ Cho Thành Viên',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'b2',
    tag: 'MUA 1 TẶNG 1',
    price: 'THỨ 3 SIÊU HỘI',
    discount: 'ÁP DỤNG PIZZA SIZE LỚN',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'b3',
    tag: 'COMBO GIA ĐÌNH',
    price: 'TRỌN VỊ CHỈ 499.000đ',
    discount: 'TẶNG NGAY 02 NƯỚC NGỌT LỚN',
    image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=1000&q=80',
  },
];

/* SVG Icons for Bottom Section replicating reference design */
const TrackingOrderSvg = () => (
  <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
    {/* Back Bag */}
    <Path
      d="M10 14H24V31C24 32.1 23.1 33 22 33H12C10.9 33 10 32.1 10 31V14Z"
      stroke="#E53935"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13.5 14V10.5C13.5 8.6 15.1 7 17 7C18.9 7 20.5 8.6 20.5 10.5V14"
      stroke="#E53935"
      strokeWidth={1.9}
      strokeLinecap="round"
    />
    {/* Front Bag */}
    <Path
      d="M16 17H30V34C30 35.1 29.1 36 28 36H18C16.9 36 16 35.1 16 34V17Z"
      stroke="#E53935"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#FFFFFF"
    />
    <Path
      d="M19.5 17V13.5C19.5 11.6 21.1 10 23 10C24.9 10 26.5 11.6 26.5 13.5V17"
      stroke="#E53935"
      strokeWidth={1.9}
      strokeLinecap="round"
    />
  </Svg>
);

const StoreLocationSvg = () => (
  <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
    <Path
      d="M21 5C14.9 5 10 9.9 10 16C10 24.5 21 35 21 35C21 35 32 24.5 32 16C32 9.9 27.1 5 21 5Z"
      stroke="#E53935"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="21" cy="16" r="4.5" stroke="#E53935" strokeWidth={2} />
    <Path
      d="M15 36C17 37.2 19 37.8 21 37.8C23 37.8 25 37.2 27 36"
      stroke="#E53935"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

const HelpPhoneSvg = () => (
  <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
    <Path
      d="M9.5 11C9.5 24 17 31.5 30 31.5L32 26.5L26.5 24L24 26.5C19.8 24.5 16.5 21.2 14.5 17L17 14.5L14.5 9L9.5 11Z"
      stroke="#E53935"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Rect x="21" y="7" width="16" height="12" rx="6" stroke="#E53935" strokeWidth={1.8} fill="#FFFFFF" />
    <Circle cx="25.5" cy="13" r="1.3" fill="#E53935" />
    <Circle cx="29" cy="13" r="1.3" fill="#E53935" />
    <Circle cx="32.5" cy="13" r="1.3" fill="#E53935" />
  </Svg>
);

const TermsDocsSvg = () => (
  <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
    <Rect x="13" y="6" width="20" height="26" rx="3" stroke="#E53935" strokeWidth={1.9} fill="#FFFFFF" />
    <Rect x="9" y="10" width="20" height="26" rx="3" stroke="#E53935" strokeWidth={1.9} fill="#FFFFFF" />
    <Path d="M13 16H23M13 21H23M13 26H19M13 31H17" stroke="#E53935" strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fulfillmentType: fulfillmentMode, setFulfillmentType: setFulfillmentMode } = useCart();
  const { showToast } = useToast();
  // Width of the screen's own column (phone, desktop-web frame or tablet column), minus side padding.
  const bannerWidth = useContentWidth() - 32;
  const bannerScrollRef = useRef<any>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Store Location / Address Autocomplete Modal
  const [showStoreLocationModal, setShowStoreLocationModal] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');

  // Re-read when the account changes: logging out clears the saved address.
  useEffect(() => {
    getSavedDeliveryAddress().then((saved) => setCurrentAddress(saved || ''));
  }, [user?.id]);

  // Lunch Combo 3/4 Sheet State
  const [showLunchSheet, setShowLunchSheet] = useState(false);

  // Carousel banner index
  const [bannerIndex, setBannerIndex] = useState(0);

  // Lunch Combo Countdown Timer
  const [hours, setHours] = useState(3);
  const [minutes, setMinutes] = useState(33);
  const [seconds, setSeconds] = useState(29);

  // Auto scroll carousel every 4.5s
  useEffect(() => {
    const bannerTimer = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % PROMO_BANNERS.length;
        bannerScrollRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(bannerTimer);
  }, [bannerWidth]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prevSec) => {
        if (prevSec > 0) return prevSec - 1;
        setMinutes((prevMin) => {
          if (prevMin > 0) return prevMin - 1;
          setHours((prevH) => (prevH > 0 ? prevH - 1 : 0));
          return 59;
        });
        return 59;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const list = await productService.list();
      setProducts(list);
    } catch {
      // Keep whatever was shown before; pulling down to refresh tries again.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const favoritePizzas = products.slice(0, 4);

  const lunchCombos = products.filter(
    (p) => p.tags?.includes('Combo Trưa') || p.id.startsWith('CB')
  );

  const handleAddCombo = (combo: Product) => {
    triggerHaptic('light');
    setShowLunchSheet(false);
    router.push({
      pathname: '/product/[id]',
      params: { id: combo.id },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ======================================================== */}
      {/* HEADER: Centered Logo + Bell Notification with Red Badge */}
      {/* ======================================================== */}
      <View style={styles.header}>
        <View style={styles.headerPlaceholder} />

        {/* Center: Pizza Emblem Image + Brand Name */}
        <View style={styles.headerLogoWrap}>
          <Image
            source={require('../../../assets/header_logo.png')}
            style={styles.headerLogoImg}
            resizeMode="contain"
          />
          <Image
            source={require('../../../assets/pizza_fpt_brand_text.png')}
            style={styles.headerBrandImg}
            resizeMode="contain"
          />
        </View>

        {/* Right: Bell Icon with Red Notification Badge */}
        <TouchableOpacity
          style={styles.bellButton}
          activeOpacity={0.7}
          onPress={() => router.push('/offers')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Bell size={24} color="#1E2024" strokeWidth={1.8} />
          <View style={[styles.bellBadge, (!user || user.isDemo) && { display: 'none' }]}>
            <Text style={styles.bellBadgeText}>1</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_RED}
          />
        }
      >
        {/* HERO PROMOTIONAL BANNER */}
        <View style={styles.bannerContainer}>
          <ScrollView
            ref={bannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={bannerWidth}
            decelerationRate="fast"
            contentContainerStyle={{ alignItems: 'center' }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
              if (idx >= 0 && idx < PROMO_BANNERS.length) {
                setBannerIndex(idx);
              }
            }}
          >
            {PROMO_BANNERS.map((banner) => (
              <View key={banner.id} style={[styles.bannerCard, { width: bannerWidth }]}>
                <Image
                  source={{ uri: banner.image }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                <View style={styles.bannerOverlay}>
                  <View style={styles.bannerTagBox}>
                    <Text style={styles.bannerTagText}>{banner.tag}</Text>
                  </View>
                  <Text style={styles.bannerPriceTag}>{banner.price}</Text>
                  <View style={styles.memberDiscountPill}>
                    <Text style={styles.memberDiscountText}>{banner.discount}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {PROMO_BANNERS.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  setBannerIndex(i);
                  bannerScrollRef.current?.scrollTo({ x: i * bannerWidth, animated: true });
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <View
                  style={[styles.dot, i === bannerIndex && styles.dotActive]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ======================================================== */}
        {/* GREETING & LOCATION (Chào mừng bạn trở lại)              */}
        {/* ======================================================== */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle} numberOfLines={1}>
            {user && !user.isDemo && user.fullname
              ? `Chào ${user.fullname.trim().split(/\s+/).pop()}, mừng bạn trở lại`
              : 'Chào mừng bạn đến Pizza FPT'}
          </Text>
          <Text style={styles.greetingSubtitle}>
            Chọn địa chỉ nhận hàng để bắt đầu đặt món
          </Text>

          <TouchableOpacity
            style={styles.locationCard}
            activeOpacity={0.8}
            onPress={() => setShowStoreLocationModal(true)}
          >
            <View style={styles.locationIconWrap}>
              <MapPin size={20} color={BRAND_RED} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.locationLabel}>Địa chỉ nhận hàng</Text>
              <Text
                style={[
                  styles.locationDetail,
                  !currentAddress && { color: '#9CA3AF', fontStyle: 'italic' },
                ]}
                numberOfLines={1}
              >
                {currentAddress || 'Bấm để chọn địa chỉ nhận hàng...'}
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* SECTION: BẠN SẼ THÍCH (Horizontal Pizza List)            */}
        {/* ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bạn sẽ thích</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPizzaScroll}
        >
          {favoritePizzas.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.pizzaCard}
              activeOpacity={0.88}
              onPress={() => {
                triggerHaptic('light');
                router.push({
                  pathname: '/product/[id]',
                  params: { id: item.id },
                });
              }}
            >
              <Image
                source={{ uri: item.image }}
                style={styles.pizzaCardImg}
                resizeMode="cover"
              />
              <View style={styles.pizzaCardInfo}>
                <Text style={styles.pizzaCardName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.pizzaCardPriceRow}>
                  <View>
                    <Text style={styles.fromText}>Chỉ từ</Text>
                    <Text style={styles.priceText}>{formatCurrency(item.basePrice)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Xem chi tiết ${item.name}`}
                    activeOpacity={0.8}
                    onPress={() => {
                      triggerHaptic('medium');
                      router.push({
                        pathname: '/product/[id]',
                        params: { id: item.id },
                      });
                    }}
                  >
                    <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ======================================================== */}
        {/* SECTION: MENU (Cards Carousel matching Screenshot 2)     */}
        {/* ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Menu</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/menu')}>
            <Text style={styles.viewMoreText}>Xem thêm</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.menuPromoScroll}
        >
          {/* Card 1: KIDS MENU */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/menu')}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
              }}
              style={styles.menuPromoImg}
              resizeMode="cover"
            />
            <View style={styles.menuPromoLabelBox}>
              <Text style={styles.menuPromoLabelText} numberOfLines={1}>
                KIDS MENU
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: GIÁ ƯU ĐÃI THÀNH VIÊN */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push('/offers')}
          >
            <View style={styles.memberDealGraphic}>
              <Text style={styles.memberDealTopText}>
                GIẢM THÊM CHO{'\n'}THÀNH VIÊN
              </Text>
              <View style={styles.memberDealTicket}>
                <Text style={styles.memberDealTicketText}>TỚI 70.000 VNĐ</Text>
              </View>
            </View>
            <View style={styles.menuPromoLabelBox}>
              <Text style={styles.menuPromoLabelText} numberOfLines={1}>
                GIÁ ƯU ĐÃI THÀN...
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: MY BOX */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/menu')}
          >
            <View style={styles.myBoxGraphic}>
              <Text style={styles.myBoxTitle}>MY BOX</Text>
              <Text style={styles.myBoxSub}>COMBO 1 NGƯỜI</Text>
            </View>
            <View style={styles.menuPromoLabelBox}>
              <Text style={styles.menuPromoLabelText} numberOfLines={1}>
                MY BOX
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 4: COMBO NHÓM */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/menu')}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80',
              }}
              style={styles.menuPromoImg}
              resizeMode="cover"
            />
            <View style={styles.menuPromoLabelBox}>
              <Text style={styles.menuPromoLabelText} numberOfLines={1}>
                COMBO NHÓM
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* ======================================================== */}
        {/* SECTION: TRACK ORDER & STORE LOCATION                    */}
        {/* ======================================================== */}
        <View style={styles.actionCardsSection}>
          {/* Card 1: Theo dõi đơn hàng */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.72}
            onPress={() => {
              if (user && !user.isDemo) {
                router.push('/order/tracking');
              } else {
                router.push('/order/lookup');
              }
            }}
          >
            <View style={styles.actionIconBox}>
              <TrackingOrderSvg />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Theo dõi đơn hàng</Text>
              <Text style={styles.actionSubtitle}>
                Dễ dàng theo dõi trạng thái đơn hàng của bạn
              </Text>
            </View>
            <ChevronRight size={22} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Card 2: Cửa hàng của chúng tôi */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.72}
            onPress={() => setShowStoreLocationModal(true)}
          >
            <View style={styles.actionIconBox}>
              <StoreLocationSvg />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Cửa hàng của chúng tôi</Text>
            </View>
            <ChevronRight size={22} color="#9CA3AF" />
          </TouchableOpacity>

          {/* ======================================================== */}
          {/* SECTION: KẾT NỐI VỚI PIZZA FPT                           */}
          {/* ======================================================== */}
          <Text style={styles.connectSectionTitle}>Kết nối với Pizza FPT</Text>

          {/* Card 3: Cần trợ giúp? */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.72}
            onPress={() => Linking.openURL('tel:19001822')}
          >
            <View style={styles.actionIconBox}>
              <HelpPhoneSvg />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Cần trợ giúp?</Text>
              <Text style={styles.actionSubtitle}>Gọi 1900 1822</Text>
            </View>
            <ChevronRight size={22} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Card 4: Điều khoản và Điều kiện */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.72}
            onPress={() => {
              Alert.alert(
                'Điều khoản và Điều kiện',
                'Chào mừng bạn đến với Pizza FPT!\n\n1. Quy định đặt hàng & thanh toán.\n2. Chính sách bảo mật thông tin khách hàng.\n3. Chính sách giao hàng nhanh và hoàn tiền.\n\nTổng đài hỗ trợ 24/7: 1900 1822',
                [{ text: 'Đồng ý' }]
              );
            }}
          >
            <View style={styles.actionIconBox}>
              <TermsDocsSvg />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Điều khoản và Điều kiện</Text>
            </View>
            <ChevronRight size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ======================================================== */}
      {/* 3/4 LUNCH COMBO BOTTOM SHEET MODAL                       */}
      {/* ======================================================== */}
      <Modal
        visible={showLunchSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLunchSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          {/* Backdrop tap to close */}
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowLunchSheet(false)} />

          <View style={styles.sheetContainer}>
            {/* Grabber handle */}
            <View style={styles.sheetHandleBar} />

            {/* Header: Thanh COMBO TRƯA nguyên bản với mũi tên hướng xuống để đóng */}
            <View style={styles.sheetBannerWrapper}>
              <TouchableOpacity
                style={styles.lunchComboBanner}
                activeOpacity={0.9}
                onPress={() => setShowLunchSheet(false)}
              >
                <View style={styles.lunchLeft}>
                  <Text style={styles.lunchTitle}>COMBO TRƯA</Text>
                  <Text style={styles.lunchSub}>kết thúc sau</Text>
                </View>

                <View style={styles.timerRow}>
                  <View style={styles.timerBox}>
                    <Text style={styles.timerNum}>{hours}</Text>
                  </View>
                  <Text style={styles.timerColon}>:</Text>
                  <View style={styles.timerBox}>
                    <Text style={styles.timerNum}>{String(minutes).padStart(2, '0')}</Text>
                  </View>
                  <Text style={styles.timerColon}>:</Text>
                  <View style={styles.timerBox}>
                    <Text style={styles.timerNum}>{String(seconds).padStart(2, '0')}</Text>
                  </View>
                </View>

                <View style={styles.lunchArrow}>
                  <ChevronDown size={22} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Danh sách các món ăn giảm giá trong Combo Trưa */}
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {lunchCombos.map((combo) => {
                const originalPrice = Math.round(
                  combo.basePrice / (1 - (combo.discountPercent || 35) / 100)
                );

                return (
                  <View key={combo.id} style={styles.simpleMenuItem}>
                    <Image
                      source={{ uri: combo.image }}
                      style={styles.simpleMenuImg}
                      resizeMode="cover"
                    />

                    <View style={styles.simpleMenuInfo}>
                      <Text style={styles.simpleMenuName} numberOfLines={1}>
                        {combo.name}
                      </Text>
                      <Text style={styles.simpleMenuDesc} numberOfLines={2}>
                        {combo.description}
                      </Text>

                      <View style={styles.simpleMenuPriceRow}>
                        <View style={styles.priceWrap}>
                          <Text style={styles.simpleNewPrice}>
                            {formatCurrency(combo.basePrice)}
                          </Text>
                          <Text style={styles.simpleOldPrice}>
                            {formatCurrency(originalPrice)}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.simpleAddBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`Thêm ${combo.name} vào giỏ`}
                          activeOpacity={0.8}
                          onPress={() => handleAddCombo(combo)}
                        >
                          <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Tìm cửa hàng gần bạn nhất / Gợi ý địa chỉ tự động */}
      <StoreLocationModal
        visible={showStoreLocationModal}
        onClose={() => setShowStoreLocationModal(false)}
        currentAddress={currentAddress}
        initialFulfillment={fulfillmentMode}
        onConfirmAddress={(addr, mode) => {
          setCurrentAddress(addr);
          saveDeliveryAddress(addr);
          setFulfillmentMode(mode);
          showToast({
            message: mode === 'delivery' ? `Đã chọn giao tới: ${addr}` : 'Đã chọn mua mang về',
            type: 'success',
          });
        }}
      />
    </SafeAreaView>
  );
}
