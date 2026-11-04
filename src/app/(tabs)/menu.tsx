import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
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
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Search, Plus, X } from 'lucide-react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatCurrency';
import { triggerHaptic } from '../../utils/haptics';
import { hasPromptedMemberDiscount, setPromptedMemberDiscount } from '../../utils/sessionFlags';
import { memberDiscountLabel } from '../../utils/memberDiscount';
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
  const isDrinkOrStarter =
    product.categoryId === 'drinks' || product.categoryId === 'starters';
  const isSoldOut = product.isAvailable === false;

  const handleAdd = (e: any) => {
    e.stopPropagation?.();
    if (isSoldOut) return;
    triggerHaptic('medium');
    router.push({
      pathname: '/product/[id]',
      params: { id: product.id },
    });
  };

  const handlePressCard = () => {
    if (isSoldOut) return;
    triggerHaptic('light');
    router.push({
      pathname: '/product/[id]',
      params: { id: product.id },
    });
  };

  const showFromLabel =
    !isDrinkOrStarter &&
    ((product.variants && product.variants.length > 1) ||
      product.categoryId === 'pizza' ||
      product.categoryId === 'cheese_party');

  return (
    <View style={styles.cardOuter}>
      {/* Red Member Discount Badge — hiển thị % giảm + giá sau giảm */}
      {!!memberDiscountLabel(product) && (
        <View style={[styles.memberTagWrapper, isSoldOut && { opacity: 0.55 }]}>
          <View style={styles.memberTag}>
            <Text style={styles.memberTagText}>{memberDiscountLabel(product)}</Text>
          </View>
        </View>
      )}

      {/* Main White Card */}
      <TouchableOpacity
        activeOpacity={isSoldOut ? 1 : 0.88}
        disabled={isSoldOut}
        onPress={handlePressCard}
        style={[styles.cardContainer, isSoldOut && styles.cardContainerSoldOut]}
      >
        {/* Left Column: Image */}
        <View style={[styles.imageWrapper, isDrinkOrStarter && { backgroundColor: '#FFFFFF' }]}>
          <Image
            source={{ uri: product.image }}
            style={[
              styles.productImage,
              isDrinkOrStarter && { backgroundColor: '#FFFFFF' },
              isSoldOut && { opacity: 0.85 },
            ]}
            resizeMode={isDrinkOrStarter ? 'contain' : 'cover'}
          />
          {isSoldOut && (
            <View style={styles.soldOutImageOverlay}>
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutBadgeText}>HẾT MÓN</Text>
              </View>
            </View>
          )}
        </View>

        {/* Right Column: Information */}
        <View style={styles.infoWrapper}>
          <Text
            style={[styles.productTitle, isSoldOut && styles.soldOutTitleText]}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          {!!product.description && (
            <Text
              style={[styles.productDesc, isSoldOut && styles.soldOutSubText]}
              numberOfLines={2}
            >
              {product.description}
            </Text>
          )}

          {/* New / Spicy Badges */}
          <View style={[styles.badgesRow, isSoldOut && { opacity: 0.7 }]}>
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
              {showFromLabel && (
                <Text style={[styles.priceLabel, isSoldOut && styles.soldOutSubText]}>
                  Chỉ từ
                </Text>
              )}
              <View style={styles.priceNumbersRow}>
                <Text style={[styles.currentPrice, isSoldOut && styles.soldOutSubText]}>
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
              activeOpacity={isSoldOut ? 1 : 0.8}
              disabled={isSoldOut}
              style={[styles.plusButton, isSoldOut && styles.plusButtonDisabled]}
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
  const { promptMemberDiscount, category: categoryParam } = useLocalSearchParams<{
    promptMemberDiscount?: string;
    category?: string;
  }>();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('cheese_party');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Khi thêm món ưu đãi từ trang chi tiết và quay lại menu, hiển thị popup hỏi đăng nhập (chỉ hỏi 1 lần trong 1 phiên)
  useEffect(() => {
    if (promptMemberDiscount === '1' && !hasPromptedMemberDiscount()) {
      setPromptedMemberDiscount(true);
      router.setParams({ promptMemberDiscount: undefined });
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
  const manualScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store layout Y coordinates & DOM refs for each section
  const sectionOffsets = useRef<{ [key: string]: number }>({});
  const sectionRefs = useRef<{ [key: string]: any }>({});
  // Store layout X coordinates & DOM refs for each tab
  const tabOffsets = useRef<{ [key: string]: number }>({});
  const tabRefs = useRef<{ [key: string]: any }>({});

  const getSectionY = useCallback((catId: string): number => {
    const scrollNode =
      mainScrollRef.current?.getScrollableNode?.() ?? mainScrollRef.current;
    const sectionNode = sectionRefs.current[catId];
    if (
      scrollNode &&
      sectionNode &&
      typeof scrollNode.getBoundingClientRect === 'function' &&
      typeof sectionNode.getBoundingClientRect === 'function'
    ) {
      const scrollRect = scrollNode.getBoundingClientRect();
      const sectionRect = sectionNode.getBoundingClientRect();
      const computedY = (scrollNode.scrollTop || 0) + (sectionRect.top - scrollRect.top);
      sectionOffsets.current[catId] = computedY;
      return computedY;
    }
    if (sectionNode && typeof sectionNode.offsetTop === 'number') {
      sectionOffsets.current[catId] = sectionNode.offsetTop;
      return sectionNode.offsetTop;
    }
    return sectionOffsets.current[catId] ?? 0;
  }, []);

  const getTabX = useCallback((catId: string): number => {
    const tabNode = tabRefs.current[catId];
    if (tabNode && typeof tabNode.offsetLeft === 'number') {
      tabOffsets.current[catId] = tabNode.offsetLeft;
      return tabNode.offsetLeft;
    }
    return tabOffsets.current[catId] ?? 0;
  }, []);

  // Load all products initially
  const loadMenu = useCallback(async () => {
    try {
      const data = await productService.list();
      setAllProducts(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMenu();
    }, [loadMenu])
  );

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: (Product & { sortOrder?: number })[] = [];
        snap.forEach((d) => {
          if (d.id.startsWith('__')) return;
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || '',
            categoryId: data.categoryId || data.category || 'pizza',
            description: data.description || '',
            image: data.image || data.imageUrl || '',
            basePrice: Number(data.basePrice || data.price || 0),
            originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
            isAvailable: data.isAvailable !== false,
            isPopular: Boolean(data.isPopular),
            isNew: Boolean(data.isNew),
            isSpicy: Boolean(data.isSpicy),
            discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
            memberDiscountTag: data.memberDiscountTag || undefined,
            promoGroups: Array.isArray(data.promoGroups) ? data.promoGroups : undefined,
            variants: Array.isArray(data.variants) ? data.variants : [],
            addons: Array.isArray(data.addons) ? data.addons : [],
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 999,
          } as Product & { sortOrder?: number });
        });
        list.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setAllProducts(list);
        setIsLoading(false);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Nhóm được chọn từ Home ('category' trên URL) -> tự cuộn xuống đúng khu vực đó
  useEffect(() => {
    if (isLoading || allProducts.length === 0) return;
    const catId =
      typeof categoryParam === 'string' && categoryParam !== 'all'
        ? categoryParam
        : null;
    if (!catId || !mockCategories.some((c) => c.id === catId)) return;

    const targetCat = catId as CategoryId;
    setSelectedCategory(targetCat);
    setIsSearchActive(false);
    setSearchQuery('');

    const timer = setTimeout(() => {
      const targetTabX = getTabX(targetCat);
      tabsScrollRef.current?.scrollTo({
        x: Math.max(0, targetTabX - 60),
        animated: false,
      });
      const targetY = getSectionY(targetCat);
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, targetY - 4),
        animated: true,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [categoryParam, isLoading, allProducts.length, getSectionY, getTabX]);

  // Nhóm promo = nhãn dán lên món, KHÔNG phải danh mục gốc:
  // món vẫn ở Pizza/Khai vị/Nước uống đồng thời hiện thêm trong Tiệc Cheese / Thành Viên / Deal Hot.

  const inPromoGroup = (p: Product, g: string) =>
    (p.promoGroups || []).includes(g) || p.categoryId === g; // categoryId === group: dữ liệu kiểu cũ

  const hasDiscountCard = (p: Product) =>
    Boolean(memberDiscountLabel(p)) ||
    Boolean(p.originalPrice && p.originalPrice > p.basePrice) ||
    Boolean(p.promoGroups && p.promoGroups.length > 0);

  // Group products by category (trong danh mục gốc như Pizza/Khai vị/Nước: ưu tiên xếp các card có giảm giá lên đầu trước)
  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const cat of mockCategories) {
      map[cat.id] = ['cheese_party', 'member_deals', 'hot_deals'].includes(cat.id)
        ? allProducts.filter((p) => inPromoGroup(p, cat.id))
        : allProducts
            .filter((p) => p.categoryId === cat.id)
            .sort((a, b) => Number(hasDiscountCard(b)) - Number(hasDiscountCard(a)));
    }
    return map;
  }, [allProducts]);

  const normalizeSearchText = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();

  // Filtered products for search mode (hỗ trợ tìm cả có dấu lẫn không dấu theo đúng tên món)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return allProducts;
    const qRaw = searchQuery.toLowerCase().trim();
    const qNorm = normalizeSearchText(searchQuery);
    const tokens = qNorm.split(' ').filter(Boolean);

    const matched = allProducts.filter((p) => {
      const nameRaw = p.name.toLowerCase();
      if (nameRaw.includes(qRaw)) return true;

      const nameNorm = normalizeSearchText(p.name);
      if (nameNorm.includes(qNorm)) return true;

      return tokens.length > 0 && tokens.every((tok) => nameNorm.includes(tok));
    });

    // Ưu tiên món khớp nguyên từ (ví dụ gõ "mi" thì "Mì Ý..." lên trước "Mirinda...")
    return matched.sort((a, b) => {
      const aWords = normalizeSearchText(a.name).split(' ');
      const bWords = normalizeSearchText(b.name).split(' ');
      const aExact = tokens.every((tok) => aWords.includes(tok)) ? 1 : 0;
      const bExact = tokens.every((tok) => bWords.includes(tok)) ? 1 : 0;
      return bExact - aExact;
    });
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
    const wasSearchActive = isSearchActive;
    setIsSearchActive(false);
    setSearchQuery('');
    setSelectedCategory(catId);

    if (manualScrollTimer.current) {
      clearTimeout(manualScrollTimer.current);
    }
    isManualScrolling.current = true;

    const targetTabX = getTabX(catId);
    tabsScrollRef.current?.scrollTo({
      x: Math.max(0, targetTabX - 60),
      animated: false,
    });

    const performScroll = () => {
      const targetY = getSectionY(catId);
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, targetY - 4),
        animated: true,
      });
    };

    if (wasSearchActive) {
      setTimeout(performScroll, 60);
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(performScroll);
    } else {
      performScroll();
    }

    manualScrollTimer.current = setTimeout(() => {
      isManualScrolling.current = false;
    }, 1000);
  };

  // Handle user scrolling to update active tab
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isManualScrolling.current || isSearchActive) return;
    const scrollY = event.nativeEvent.contentOffset.y;

    let activeCat = mockCategories[0].id;
    for (const cat of mockCategories) {
      const offset = getSectionY(cat.id);
      if (scrollY >= offset - 80) {
        activeCat = cat.id;
      }
    }

    if (activeCat !== selectedCategory) {
      setSelectedCategory(activeCat);
      const targetTabX = getTabX(activeCat);
      tabsScrollRef.current?.scrollTo({
        x: Math.max(0, targetTabX - 60),
        animated: false,
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
                ref={(el) => {
                  tabRefs.current[cat.id] = el;
                }}
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
          style={{ flex: 1 }}
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
        /* Danh sách nối tiếp đầy đủ 6 nhóm thực đơn */
        <ScrollView
          ref={mainScrollRef}
          style={{ flex: 1 }}
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
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
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
