import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Search, Plus, X } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { hasPromptedMemberDiscount, setPromptedMemberDiscount } from '../../utils/sessionFlags';
import { productService } from '../../services';
import { Product, CategoryId } from '../../types/product';
import { mockCategories } from '../../data/mockCategories';

const BRAND_RED = '#CF4226';
const ACTIVE_TAB_RED = '#C62828';

// ==========================================
// CUSTOM SVG ICONS MATCHING USER SCREENSHOTS
// ==========================================

const CheeseWheelIcon = ({ color = '#6B7280', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={1.8} />
    <Path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M5.3 18.7L18.7 5.3" stroke={color} strokeWidth={1.2} strokeDasharray="1.5 2" />
    <Circle cx="12" cy="12" r="2.8" fill={color} />
  </Svg>
);

const MemberDealIcon = ({ color = '#6B7280', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={1.8} />
    <Path d="M8.5 15.5l7-7M9 9.2h.01M15 14.8h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const HotDealIcon = ({ color = '#6B7280', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={1.8} />
    <Path d="M8 12c1.2-2.5 2.5-3.5 4-3.5s2.5 1.5 2 3.5c-.8 3-4 3-3.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const PizzaSliceIcon = ({ color = '#6B7280', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2L2 21c2 1 6 1 10 1s8 0 10-1L12 2z" />
    <Circle cx="12" cy="11" r="1.2" fill={color} />
    <Circle cx="8" cy="16" r="1.2" fill={color} />
  </Svg>
);

const StarterBowlIcon = ({ color = '#6B7280', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 11h16a8 8 0 0 1-16 0z" />
    <Path d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3" />
    <Path d="M2 19h20" strokeWidth={1.5} />
  </Svg>
);

const DrinkCupIcon = ({ color = '#6B7280', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 7h12l-1.5 13h-9L6 7z" />
    <Path d="M5 7h14" />
    <Path d="M15 3l-3 4" />
  </Svg>
);

// ==========================================
// BANNER DATA PER CATEGORY
// ==========================================
interface BannerData {
  badge?: string;
  headline: string;
  subheadline: string;
  image: string;
}

const CATEGORY_BANNERS: Record<string, BannerData> = {
  cheese_party: {
    badge: 'MỚI PIZZA',
    headline: 'PHÔ MAI KÉO',
    subheadline: 'X3 CHEESE',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
  },
  member_deals: {
    badge: 'GIẢM THÊM',
    headline: 'ƯU ĐÃI THÀNH VIÊN',
    subheadline: 'TIẾT KIỆM TỚI 70.000 VNĐ',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80',
  },
  hot_deals: {
    badge: 'KHUYẾN MÃI',
    headline: 'DEAL NÓNG 70%',
    subheadline: 'Áp dụng cho Pizza thứ 2',
    image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=1200&q=80',
  },
  pizza: {
    badge: 'SIGNATURE',
    headline: 'PIZZA',
    subheadline: 'ĐẬM VỊ Ý, NGẬP TRÀN TOPPING',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=1200&q=80',
  },
  starters: {
    badge: 'STARTER',
    headline: 'STARTER',
    subheadline: 'Khai vị hấp dẫn & Món phụ',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
  },
  drinks: {
    badge: 'REFRESH',
    headline: 'THỨC UỐNG',
    subheadline: 'Trà trái cây & Nước ngọt mát lạnh',
    image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=1200&q=80',
  },
};

const PizzaHutProductCard = ({ product }: { product: Product }) => {
  const handleAdd = (e: any) => {
    e.stopPropagation?.();
    triggerHaptic('medium');
    // Bấm dấu cộng chuyển vào trang chi tiết món ăn
    router.push({
      pathname: '/product/[id]',
      params: { id: product.id },
    });
  };

  const handlePressCard = () => {
    triggerHaptic('light');
    router.push({
      pathname: '/product/[id]',
      params: { id: product.id },
    });
  };

  return (
    <View style={styles.cardOuter}>
      {/* Red Member Discount Badge */}
      {!!product.memberDiscountTag && (
        <View style={styles.memberTagWrapper}>
          <View style={styles.memberTag}>
            <Text style={styles.memberTagText}>{product.memberDiscountTag}</Text>
          </View>
        </View>
      )}

      {/* Main White Card */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePressCard}
        style={styles.cardContainer}
      >
        {/* Left Column: Image */}
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: product.image }}
            style={styles.productImage}
            resizeMode="cover"
          />
        </View>

        {/* Right Column: Information */}
        <View style={styles.infoWrapper}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.name}
          </Text>

          {!!product.description && (
            <Text style={styles.productDesc} numberOfLines={2}>
              {product.description}
            </Text>
          )}

          {/* New / Spicy Badges */}
          <View style={styles.badgesRow}>
            {product.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
            )}
            {product.isSpicy && (
              <Text style={styles.spicyIcon}>🌶️</Text>
            )}
          </View>

          {/* Price & Action Row */}
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Chỉ từ</Text>
              <View style={styles.priceNumbersRow}>
                <Text style={styles.currentPrice}>
                  {formatCurrency(product.basePrice)}
                </Text>
                {!!product.originalPrice && product.originalPrice > product.basePrice && (
                  <Text style={styles.originalPrice}>
                    {formatCurrency(product.originalPrice)}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.plusButton}
              onPress={handleAdd}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default function MenuScreen() {
  const { promptMemberDiscount } = useLocalSearchParams<{ promptMemberDiscount?: string }>();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('cheese_party');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Khi thêm món ưu đãi từ trang chi tiết và quay lại menu, hiển thị popup hỏi đăng nhập
  useEffect(() => {
    if (promptMemberDiscount === '1' && !hasPromptedMemberDiscount()) {
      const timer = setTimeout(() => {
        setShowMemberModal(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [promptMemberDiscount]);

  const handleConfirmLogin = () => {
    setPromptedMemberDiscount(true);
    setShowMemberModal(false);
    router.push({
      pathname: '/auth/login',
      params: { returnTo: 'menu' },
    });
  };

  const handleCancelModal = () => {
    setPromptedMemberDiscount(true);
    setShowMemberModal(false);
  };

  const mainScrollRef = useRef<any>(null);
  const tabsScrollRef = useRef<any>(null);
  const isManualScrolling = useRef(false);

  // Store layout Y coordinates for each section
  const sectionOffsets = useRef<{ [key: string]: number }>({});
  // Store layout X coordinates for each tab
  const tabOffsets = useRef<{ [key: string]: number }>({});

  // Load all products initially
  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await productService.list();
      setAllProducts(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Group products by category
  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const cat of mockCategories) {
      map[cat.id] = allProducts.filter((p) => p.categoryId === cat.id);
    }
    return map;
  }, [allProducts]);

  // Filtered products for search mode
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.ingredients?.some((ing) => ing.toLowerCase().includes(q))
    );
  }, [allProducts, searchQuery]);

  // Tab Icon Renderer
  const renderTabIcon = (catId: CategoryId, color: string) => {
    switch (catId) {
      case 'cheese_party':
        return <CheeseWheelIcon color={color} size={17} />;
      case 'member_deals':
        return <MemberDealIcon color={color} size={17} />;
      case 'hot_deals':
        return <HotDealIcon color={color} size={17} />;
      case 'pizza':
        return <PizzaSliceIcon color={color} size={17} />;
      case 'starters':
        return <StarterBowlIcon color={color} size={17} />;
      case 'drinks':
        return <DrinkCupIcon color={color} size={17} />;
      default:
        return null;
    }
  };

  // Scroll to section when tab is pressed
  const handleSelectCategory = (catId: CategoryId) => {
    triggerHaptic('light');
    setIsSearchActive(false);
    setSearchQuery('');
    setSelectedCategory(catId);

    isManualScrolling.current = true;
    const targetY = sectionOffsets.current[catId] ?? 0;
    mainScrollRef.current?.scrollTo({
      y: Math.max(0, targetY - 4),
      animated: true,
    });

    const targetTabX = tabOffsets.current[catId] ?? 0;
    tabsScrollRef.current?.scrollTo({
      x: Math.max(0, targetTabX - 60),
      animated: true,
    });

    setTimeout(() => {
      isManualScrolling.current = false;
    }, 700);
  };

  // Handle user scrolling to update active tab
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isManualScrolling.current || isSearchActive) return;
    const scrollY = event.nativeEvent.contentOffset.y;

    let activeCat = mockCategories[0].id;
    for (const cat of mockCategories) {
      const offset = sectionOffsets.current[cat.id] ?? 0;
      if (scrollY >= offset - 80) {
        activeCat = cat.id;
      }
    }

    if (activeCat !== selectedCategory) {
      setSelectedCategory(activeCat);
      const targetTabX = tabOffsets.current[activeCat] ?? 0;
      tabsScrollRef.current?.scrollTo({
        x: Math.max(0, targetTabX - 60),
        animated: true,
      });
    }
  };

  const handleToggleSearch = () => {
    triggerHaptic('light');
    if (!isSearchActive) {
      setIsSearchActive(true);
    } else {
      setIsSearchActive(false);
      setSearchQuery('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. TOP HEADER: Centered Pizza Hut Logo */}
      <View style={styles.header}>
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
      </View>

      {/* 2. HORIZONTAL CATEGORY TABS */}
      <View style={styles.tabsContainer}>
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsList}
        >
          {/* Tab 1: Tìm kiếm */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.tabItem, isSearchActive && styles.activeTabItem]}
            onPress={handleToggleSearch}
          >
            <View style={styles.tabIconWrap}>
              <Search
                size={17}
                color={isSearchActive ? ACTIVE_TAB_RED : '#6B7280'}
                strokeWidth={2.2}
              />
            </View>
            <Text
              style={[
                styles.tabText,
                isSearchActive && styles.activeTabText,
              ]}
            >
              Tìm kiếm
            </Text>
            {isSearchActive && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>

          {/* 6 Requested Categories */}
          {mockCategories.map((cat) => {
            const isActive = !isSearchActive && selectedCategory === cat.id;
            const iconColor = isActive ? ACTIVE_TAB_RED : '#6B7280';

            return (
              <TouchableOpacity
                key={cat.id}
                activeOpacity={0.7}
                onLayout={(e) => {
                  tabOffsets.current[cat.id] = e.nativeEvent.layout.x;
                }}
                style={[styles.tabItem, isActive && styles.activeTabItem]}
                onPress={() => handleSelectCategory(cat.id)}
              >
                <View style={styles.tabIconWrap}>
                  {renderTabIcon(cat.id, iconColor)}
                </View>
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.activeTabText,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name.toUpperCase()}
                </Text>
                {isActive && <View style={styles.activeTabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. INLINE SEARCH INPUT */}
      {isSearchActive && (
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchInputRow}>
            <Search size={18} color="#9E9E9E" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm pizza, combo, khai vị, nước uống..."
              placeholderTextColor="#9E9E9E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#9E9E9E" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 4. MAIN CONTINUOUS SCROLL CONTENT */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_RED} />
          <Text style={styles.loadingText}>Đang tải thực đơn...</Text>
        </View>
      ) : isSearchActive ? (
        /* SEARCH RESULTS VIEW */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Không tìm thấy món phù hợp</Text>
              <Text style={styles.emptyDesc}>
                Vui lòng thử từ khóa khác
              </Text>
            </View>
          ) : (
            searchResults.map((product) => (
              <PizzaHutProductCard key={product.id} product={product} />
            ))
          )}
        </ScrollView>
      ) : (
        /* ALL 6 SECTIONS CONNECTED CONTINUOUSLY (NỐI TIẾP NHAU) */
        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={styles.listContent}
        >
          {mockCategories.map((cat) => {
            const items = productsByCategory[cat.id] || [];
            const banner = CATEGORY_BANNERS[cat.id] || CATEGORY_BANNERS.cheese_party;
            const categoryTitle = cat.name.toUpperCase();

            return (
              <View
                key={cat.id}
                onLayout={(e) => {
                  sectionOffsets.current[cat.id] = e.nativeEvent.layout.y;
                }}
                style={styles.categorySection}
              >
                {/* Section Header Divider (Centered title matching tab) */}
                <View style={styles.sectionHeaderDivider}>
                  <View style={styles.sectionDividerLine} />
                  <Text style={styles.sectionHeaderTitle}>
                    {categoryTitle}
                  </Text>
                  <View style={styles.sectionDividerLine} />
                </View>

                {/* Banner Graphics Card for this Section */}
                <View style={styles.bannerCard}>
                  <Image
                    source={{ uri: banner.image }}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                  <View style={styles.bannerOverlay}>
                    {!!banner.badge && (
                      <View style={styles.bannerBadgeBox}>
                        <Text style={styles.bannerBadgeText}>{banner.badge}</Text>
                      </View>
                    )}
                    <Text style={styles.bannerHeadline}>{banner.headline}</Text>
                    <Text style={styles.bannerSubheadline}>{banner.subheadline}</Text>
                  </View>
                </View>

                {/* Products in this Section */}
                <View style={styles.sectionProductsList}>
                  {items.map((product) => (
                    <PizzaHutProductCard key={product.id} product={product} />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Pop-up Ưu Đãi Thành Viên */}
      <Modal
        visible={showMemberModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ưu Đãi Thành Viên</Text>
            <Text style={styles.modalMessage}>
              Sản phẩm có giá ưu đãi đặc biệt dành cho thành viên. Bạn có muốn đăng nhập để nhận ưu đãi này không?
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCancelModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmLogin}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  /* 1. Header */
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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

  /* 2. Category Tabs */
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDEDED',
  },
  tabsList: {
    paddingHorizontal: 8,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 80,
  },
  activeTabItem: {},
  tabIconWrap: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A4A',
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: ACTIVE_TAB_RED,
    fontWeight: '800',
  },
  activeTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: ACTIVE_TAB_RED,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  /* 3. Search Bar */
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E2024',
  },

  /* 4. Continuous Category Section */
  listContent: {
    paddingBottom: 50,
  },
  categorySection: {
    marginBottom: 20,
  },
  sectionHeaderDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ECECEC',
  },
  sectionHeaderTitle: {
    marginHorizontal: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2024',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  /* Banner */
  bannerCard: {
    height: 120,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#C62828',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.88,
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(183, 28, 28, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  bannerBadgeBox: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  bannerBadgeText: {
    color: '#B71C1C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  bannerHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubheadline: {
    color: '#FFEAEA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* Products */
  sectionProductsList: {
    paddingTop: 2,
  },
  cardOuter: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  memberTagWrapper: {
    marginBottom: -6,
    zIndex: 2,
  },
  memberTag: {
    backgroundColor: '#C62828',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  memberTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrapper: {
    width: 104,
    height: 104,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  infoWrapper: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-between',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2024',
    lineHeight: 20,
  },
  productDesc: {
    fontSize: 12,
    color: '#666666',
    marginTop: 3,
    lineHeight: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  newBadge: {
    backgroundColor: '#C62828',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  spicyIcon: {
    fontSize: 13,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },
  priceNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2024',
  },
  originalPrice: {
    fontSize: 12,
    color: '#9E9E9E',
    textDecorationLine: 'line-through',
  },
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACTIVE_TAB_RED,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACTIVE_TAB_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },

  /* Empty & Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2024',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },

  /* Modal Ưu Đãi Thành Viên */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalConfirmButton: {
    backgroundColor: ACTIVE_TAB_RED,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
