import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Search, Plus, X } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { productService } from '../../services';
import { Product, CategoryId } from '../../types/product';
import { mockCategories } from '../../data/mockCategories';
import { styles, ACTIVE_TAB_RED, BRAND_RED } from '../../styles/menu.styles';

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
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('cheese_party');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
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
                accessibilityLabel={cat.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
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
                  {({ member_deals: 'Thành viên', hot_deals: 'Deal hot', starters: 'Khai vị', drinks: 'Đồ uống' } as Record<string, string>)[cat.id] || cat.name}
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

    </SafeAreaView>
  );
}

