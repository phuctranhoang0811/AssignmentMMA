import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, onSnapshot, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  isProductDiscounted,
  sortPopularProducts,
  selectDefaultPopularIds,
  ensureDefaultPopularRecommendations,
} from '../../utils/popularRecommendations';
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
import { subscribeOrderOverrides, type OrderDispatchOverride } from '../../services/storeSync';
import {
  fetchUserMemberStats,
  loadOrSeedMemberGiftRules,
  getEligibleMemberGifts,
} from '../../utils/memberTier';
import {
  PromoBannerContent,
  PROMO_BANNER_DOC_ID,
  PROMO_BANNER_STORAGE_KEY,
} from '../../components/banners/PromoBannerSlides';

import { styles, BRAND_RED } from '../../styles/home.styles';

const PROMO_BANNERS = [
  { id: 'cheese_party', categoryId: 'cheese_party' },
  { id: 'member_deals', categoryId: 'member_deals' },
  { id: 'hot_deals', categoryId: 'hot_deals' },
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
  const { showToast } = useToast();
  const {
    fulfillmentType: fulfillmentMode,
    setFulfillmentType: setFulfillmentMode,
  } = useCart();
  // Width of the screen's own column (phone, desktop-web frame or tablet column), minus side padding.
  const bannerWidth = useContentWidth() - 32;
  const bannerScrollRef = useRef<any>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [customBanners, setCustomBanners] = useState<Record<string, string>>({});

  // Store Location / Address Autocomplete Modal
  const [showStoreLocationModal, setShowStoreLocationModal] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});

  useEffect(() => {
    const unsub = subscribeOrderOverrides((map) => {
      setOrderOverrides(map);
    });
    return () => unsub();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const uid = user?.id;
      if (!uid || user?.isDemo) {
        setUnreadNotifCount(0);
        return;
      }

      const delKey = `@pizza_fpt_deleted_notifs_${uid}`;
      const readKey = `@pizza_fpt_read_notifs_${uid}`;
      const syncDel: string[] = (() => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(delKey);
            if (raw) return JSON.parse(raw);
          }
        } catch {}
        return [];
      })();
      const syncRead: string[] = (() => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(readKey);
            if (raw) return JSON.parse(raw);
          }
        } catch {}
        return [];
      })();

      Promise.all([
        AsyncStorage.getItem(delKey).catch(() => null),
        AsyncStorage.getItem(readKey).catch(() => null),
        getDoc(doc(db, 'users', uid)).catch(() => null),
        getDocs(query(collection(db, 'orders'), where('userId', '==', uid))).catch(() => null),
        fetchUserMemberStats(uid).catch(() => null),
        loadOrSeedMemberGiftRules().catch(() => []),
      ])
        .then(([delRaw, readRaw, userSnap, ordersSnap, memberStats, giftRules]) => {
          if (!active) return;
          const userData = userSnap?.exists?.() ? userSnap.data() : undefined;
          const deletedSet = new Set<string>([
            ...syncDel,
            ...(delRaw ? JSON.parse(delRaw) : []),
            ...(Array.isArray(userData?.deletedNotifIds) ? userData.deletedNotifIds : []),
          ]);
          const readSet = new Set<string>([
            ...syncRead,
            ...(readRaw ? JSON.parse(readRaw) : []),
            ...(Array.isArray(userData?.readNotifIds) ? userData.readNotifIds : []),
          ]);
          let count = 0;
          ordersSnap?.forEach((d) => {
            const raw = d.data();
            const override = orderOverrides[d.id];
            const effectiveStatus = String(
              override?.status || raw.status || 'PENDING_CONFIRMATION'
            );
            const hasAssignedStaff = Boolean(
              override?.assignedStaffId || raw.assignedStaffId
            );
            const statusKey =
              effectiveStatus === 'READY' && hasAssignedStaff
                ? 'READY_ASSIGNED'
                : effectiveStatus;
            const nid = `order-${d.id}-${statusKey}`;
            const legacyId = `order-${d.id}`;
            const isTerminal =
              effectiveStatus === 'COMPLETED' ||
              effectiveStatus === 'DELIVERED' ||
              effectiveStatus === 'CANCELLED' ||
              effectiveStatus === 'REJECTED';
            const isDeleted =
              deletedSet.has(nid) || (isTerminal && deletedSet.has(legacyId));
            const isRead =
              readSet.has(nid) || (isTerminal && readSet.has(legacyId));
            if (!isDeleted && !isRead) {
              count += 1;
            }
          });

          // Cộng thêm số thông báo Quà Tặng Đặc Quyền Thành Viên chưa đọc
          const syncUsedGifts: string[] = (() => {
            try {
              if (typeof window !== 'undefined' && window.localStorage) {
                const raw = window.localStorage.getItem(`fpt_used_member_gifts_${uid}`);
                if (raw) return JSON.parse(raw);
              }
            } catch {}
            return [];
          })();
          const usedSet = new Set<string>([
            ...syncUsedGifts,
            ...(Array.isArray(userData?.usedMemberGiftIds) ? userData.usedMemberGiftIds : []),
          ]);
          const eligibleGifts = memberStats
            ? getEligibleMemberGifts(
                giftRules,
                memberStats.id,
                userData?.birthday || (user as any)?.birthday
              )
            : [];
          eligibleGifts.forEach((rule) => {
            if (usedSet.has(rule.id)) return;
            const nid = `member-gift-${rule.id}`;
            if (!deletedSet.has(nid) && !readSet.has(nid)) {
              count += 1;
            }
          });

          setUnreadNotifCount(count);
        })
        .catch(() => {});

      return () => {
        active = false;
      };
    }, [user?.id, user?.isDemo, orderOverrides])
  );

  // Re-read when the account changes: logging out clears the saved address.
  useEffect(() => {
    getSavedDeliveryAddress().then((saved) => setCurrentAddress(saved || ''));
  }, [user?.id]);

  // Lắng nghe realtime banner quảng cáo do Admin cập nhật tại /admin/menu-groups
  useEffect(() => {
    AsyncStorage.getItem(PROMO_BANNER_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setCustomBanners((prev) => ({ ...parsed, ...prev }));
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(
      doc(db, 'products', PROMO_BANNER_DOC_ID),
      (snap) => {
        if (!snap.exists()) {
          return;
        }
        const data = snap.data() || {};
        const next: Record<string, string> = {};
        PROMO_BANNERS.forEach((b) => {
          if (typeof data[b.id] === 'string' && data[b.id].trim().length > 0) {
            next[b.id] = data[b.id].trim();
          }
        });
        setCustomBanners(next);
        AsyncStorage.setItem(PROMO_BANNER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      },
      () => {
        // Ignore snapshot errors gracefully
      }
    );
    return () => unsub();
  }, []);

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
        setProducts(list);
        void ensureDefaultPopularRecommendations(list);
      },
      () => {}
    );
    return () => unsub();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const favoritePizzas = (() => {
    const popular = products.filter(
      (p) =>
        p.isPopular &&
        (p.categoryId !== 'pizza' || !isProductDiscounted(p))
    );
    if (popular.length > 0) {
      return sortPopularProducts(popular);
    }
    const fallbackIds = selectDefaultPopularIds(products);
    return sortPopularProducts(products.filter((p) => fallbackIds.has(p.id)));
  })();

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
          {unreadNotifCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadNotifCount}</Text>
            </View>
          )}
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
              <TouchableOpacity
                key={banner.id}
                activeOpacity={0.92}
                style={[styles.bannerCard, { width: bannerWidth }]}
                onPress={() => {
                  triggerHaptic('light');
                  router.push({
                    pathname: '/(tabs)/menu',
                    params: { category: banner.categoryId },
                  });
                }}
              >
                <PromoBannerContent
                  groupId={banner.id}
                  customImageUrl={customBanners[banner.id]}
                />
              </TouchableOpacity>
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
              <Text style={styles.locationLabel}>{fulfillmentMode === 'takeaway' ? 'Nhận tại cửa hàng (Mua mang về)' : 'Địa chỉ nhận hàng'}</Text>
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
          {favoritePizzas.map((item) => {
            const isSoldOut = item.isAvailable === false;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.pizzaCard}
                activeOpacity={isSoldOut ? 1 : 0.88}
                disabled={isSoldOut}
                onPress={() => {
                  if (isSoldOut) return;
                  triggerHaptic('light');
                  router.push({
                    pathname: '/product/[id]',
                    params: { id: item.id },
                  });
                }}
              >
                <View style={{ width: 88, height: 88, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  <Image
                    source={{ uri: item.image }}
                    style={[styles.pizzaCardImg, isSoldOut && { opacity: 0.85 }]}
                    resizeMode="contain"
                  />
                  {isSoldOut && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(17, 24, 39, 0.16)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 10,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: 'rgba(31, 41, 55, 0.88)',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 10,
                            fontWeight: '800',
                            letterSpacing: 0.4,
                          }}
                        >
                          HẾT MÓN
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.pizzaCardInfo}>
                  <Text
                    style={[styles.pizzaCardName, isSoldOut && { color: '#4B5563' }]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <View style={styles.pizzaCardPriceRow}>
                    <View>
                      <Text style={[styles.fromText, isSoldOut && { color: '#6B7280' }]}>
                        {item.categoryId === 'drinks' || item.categoryId === 'starters'
                          ? 'Giá bán'
                          : 'Chỉ từ'}
                      </Text>
                      <Text style={[styles.priceText, isSoldOut && { color: '#6B7280' }]}>
                        {formatCurrency(item.basePrice)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.addBtn,
                        isSoldOut && { backgroundColor: '#D1D5DB' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Xem chi tiết ${item.name}`}
                      activeOpacity={isSoldOut ? 1 : 0.8}
                      disabled={isSoldOut}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        if (isSoldOut) return;
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
            );
          })}
        </ScrollView>

        {/* ======================================================== */}
        {/* SECTION: MENU (Cards Carousel matching Screenshot 2)     */}
        {/* ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Menu</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/(tabs)/menu', params: { category: 'all' } })
            }
          >
            <Text style={styles.viewMoreText}>Xem thêm</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.menuPromoScroll}
        >
          {/* Card 1: TIỆC CHEESE */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/(tabs)/menu', params: { category: 'cheese_party' } })}
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
                TIỆC CHEESE
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: GIÁ ƯU ĐÃI THÀNH VIÊN */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/(tabs)/menu', params: { category: 'member_deals' } })}
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
                THÀNH VIÊN
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: DEAL NÓNG 70% */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/(tabs)/menu', params: { category: 'hot_deals' } })}
          >
            <View style={styles.myBoxGraphic}>
              <Text style={styles.myBoxTitle}>DEAL HOT</Text>
              <Text style={styles.myBoxSub}>GIẢM ĐẾN 70%</Text>
            </View>
            <View style={styles.menuPromoLabelBox}>
              <Text style={styles.menuPromoLabelText} numberOfLines={1}>
                DEAL HOT 70%
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 4: PIZZA */}
          <TouchableOpacity
            style={styles.menuPromoCard}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/(tabs)/menu', params: { category: 'pizza' } })}
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
                PIZZA
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
            onPress={() => { setFulfillmentMode('takeaway'); setShowStoreLocationModal(true); }}
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
            message: mode === 'delivery' ? `Đã chọn giao tới: ${addr}` : `Đã chọn mua mang về: ${addr}`,
            type: 'success',
          });
        }}
      />
    </SafeAreaView>
  );
}
