import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  MapPin,
  ChevronRight,
  Plus,
  Flame,
  Clock,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  Check,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { productService } from '../../services';
import { Product, CategoryId } from '../../types/product';
import { mockCategories } from '../../data/mockCategories';
import { mockProducts } from '../../data/mockProducts';
import { useCart } from '../../state/CartContext';
import { formatCurrency } from '../../utils/formatCurrency';

const BRAND_RED = '#CF4226';

export default function HomeScreen() {
  const router = useRouter();
  const { addItem, itemCount, subtotal } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lunch Combo 3/4 Sheet State
  const [showLunchSheet, setShowLunchSheet] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carousel banner index
  const [bannerIndex, setBannerIndex] = useState(0);

  // Lunch Combo Countdown Timer
  const [hours, setHours] = useState(3);
  const [minutes, setMinutes] = useState(33);
  const [seconds, setSeconds] = useState(29);

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

  const loadData = async (cat: CategoryId = selectedCategory) => {
    try {
      const list = await productService.list({
        categoryId: cat === 'all' ? undefined : cat,
      });
      setProducts(list);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(selectedCategory);
  }, [selectedCategory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(selectedCategory);
  };

  const favoritePizzas = products.slice(0, 4);

  const lunchCombos = mockProducts.filter(
    (p) => p.tags?.includes('Combo Trưa') || p.id.startsWith('CB')
  );

  const handleAddCombo = (combo: Product) => {
    addItem({
      productId: combo.id,
      quantity: 1,
      addonIds: [],
    });
    setShowLunchSheet(false);
    router.push('/(tabs)/cart');
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
          <View style={styles.bellBadge}>
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
        {/* ======================================================== */}
        {/* HERO PROMOTIONAL BANNER (Matches user screenshot 1 & 2)  */}
        {/* ======================================================== */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerCard}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80',
              }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.bannerOverlay}>
              <View style={styles.bannerTagBox}>
                <Text style={styles.bannerTagText}>COMBO PIZZA KÉO</Text>
              </View>
              <Text style={styles.bannerPriceTag}>MỚI CHỈ TỪ 389.000đ</Text>
              <View style={styles.memberDiscountPill}>
                <Text style={styles.memberDiscountText}>GIẢM TỚI 40.000đ Cho Thành Viên</Text>
              </View>
            </View>
          </View>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[styles.dot, i === bannerIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* ======================================================== */}
        {/* GREETING & LOCATION (Chào mừng bạn trở lại)              */}
        {/* ======================================================== */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Chào mừng bạn trở lại</Text>
          <Text style={styles.greetingSubtitle}>
            Vui lòng chọn Giao hàng hoặc Mua mang về để đặt hàng
          </Text>

          <TouchableOpacity
            style={styles.locationCard}
            activeOpacity={0.8}
            onPress={() => router.push('/profile/addresses')}
          >
            <View style={styles.locationIconWrap}>
              <MapPin size={20} color={BRAND_RED} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.locationLabel}>Giao hàng tới</Text>
              <Text style={styles.locationDetail} numberOfLines={1}>
                29 Đường Lê Duẩn, Quận 1, TP. Hồ Chí Minh
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
            <View key={item.id} style={styles.pizzaCard}>
              <Image
                source={{ uri: item.image || (item as any).imageUrl }}
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
                    activeOpacity={0.8}
                    onPress={() => {
                      addItem({
                        productId: item.id,
                        quantity: 1,
                        addonIds: [],
                      });
                    }}
                  >
                    <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* ======================================================== */}
        {/* SECTION: MENU CATEGORIES                                 */}
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
          contentContainerStyle={styles.categoriesScroll}
        >
          {mockCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      {/* ======================================================== */}
      {/* COMBO TRƯA COUNTDOWN BANNER (Dính trực tiếp vào Navbar)   */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* COMBO TRƯA COUNTDOWN BANNER (Dính trực tiếp vào Navbar)   */}
      {/* ======================================================== */}
      <View style={styles.stickyComboWrapper}>
        <TouchableOpacity
          style={styles.lunchComboBanner}
          activeOpacity={0.9}
          onPress={() => setShowLunchSheet(true)}
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
            <ChevronUp size={22} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 24,
  },

  /* Header */
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerPlaceholder: {
    width: 36,
  },
  headerLogoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 6,
  },
  headerBrandImg: {
    width: 114,
    height: 25,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: BRAND_RED,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Promotional Carousel Banner */
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  bannerCard: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E63946',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bannerTagBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bannerTagText: {
    color: BRAND_RED,
    fontSize: 13,
    fontWeight: '800',
  },
  bannerPriceTag: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  memberDiscountPill: {
    backgroundColor: '#FFE500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberDiscountText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: BRAND_RED,
    width: 16,
    borderRadius: 3,
  },

  /* Greeting & Delivery Card */
  greetingSection: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  greetingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  locationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111215',
  },
  locationDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_RED,
  },

  /* Horizontal Pizza Scroll */
  horizontalPizzaScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 24,
  },
  pizzaCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pizzaCardImg: {
    width: '100%',
    height: 130,
  },
  pizzaCardInfo: {
    padding: 12,
  },
  pizzaCardName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E2024',
    height: 38,
  },
  pizzaCardPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  fromText: {
    fontSize: 11,
    color: '#6B7280',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111215',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Categories Chips */
  categoriesScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: BRAND_RED,
  },
  categoryChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  /* Lunch Combo Banner */
  stickyComboWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  lunchComboBanner: {
    backgroundColor: BRAND_RED,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lunchLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  lunchTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 6,
  },
  lunchSub: {
    color: '#FFE0DC',
    fontSize: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timerNum: {
    color: BRAND_RED,
    fontSize: 13,
    fontWeight: '800',
  },
  timerColon: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginHorizontal: 4,
  },
  lunchArrow: {
    padding: 4,
  },

  /* ========================================================== */
  /* 3/4 LUNCH COMBO BOTTOM SHEET STYLES                        */
  /* ========================================================== */
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    height: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 20,
  },
  sheetHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetBannerWrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  simpleMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  simpleMenuImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  simpleMenuInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    minHeight: 78,
  },
  simpleMenuName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  simpleMenuDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  simpleMenuPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  simpleNewPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND_RED,
  },
  simpleOldPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  simpleAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
