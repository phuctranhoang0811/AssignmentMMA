import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeOrderOverrides, type OrderDispatchOverride } from '../services/storeSync';
import { useAuth } from '../state/AuthContext';
import { useContentWidth } from '../utils/layout';
import { triggerHaptic } from '../utils/haptics';
import { formatCurrency } from '../utils/formatCurrency';
import {
  fetchUserMemberStats,
  loadOrSeedMemberGiftRules,
  getEligibleMemberGifts,
  getMemberGiftOccasionLabel,
} from '../utils/memberTier';
import { styles, BRAND_RED } from '../styles/offers.styles';

// Custom SVG: Hand holding red takeaway bag (matching Screenshot 2)
const OrderBagIcon = () => (
  <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
    {/* Green sleeve cuff */}
    <Rect
      x="14"
      y="13"
      width="12"
      height="11"
      rx="2"
      fill="#166534"
      stroke="#111827"
      strokeWidth={1.8}
    />
    {/* Hand */}
    <Path
      d="M25 14H36C39 14 41 16 41 18.5C41 20.5 39.2 22 37 22H25V14Z"
      fill="#FDBA9C"
      stroke="#111827"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Bag top handle */}
    <Path
      d="M25 20H39L41 24H23L25 20Z"
      fill={BRAND_RED}
      stroke="#111827"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Main Red Bag */}
    <Path
      d="M23 24H41L46 43C46.5 45 45 47 43 47H21C19 47 17.5 45 18 43L23 24Z"
      fill={BRAND_RED}
      stroke="#111827"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* White front label on bag */}
    <Path
      d="M28 31H42.8L45.2 41H28V31Z"
      fill="#FFFFFF"
      stroke="#111827"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </Svg>
);

// Custom SVG: Centered Gift Box Icon (64x64 matching OrderBagIcon, brand red & white only)
const BrandGiftLogoIcon = () => (
  <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
    {/* Gift box body */}
    <Rect
      x="15"
      y="28"
      width="34"
      height="22"
      rx="3"
      fill={BRAND_RED}
      stroke="#111827"
      strokeWidth={1.8}
    />
    {/* Gift box lid */}
    <Rect
      x="13"
      y="21"
      width="38"
      height="8"
      rx="2.5"
      fill={BRAND_RED}
      stroke="#111827"
      strokeWidth={1.8}
    />
    {/* Vertical ribbon */}
    <Rect
      x="29"
      y="21"
      width="6"
      height="29"
      fill="#FFFFFF"
      stroke="#111827"
      strokeWidth={1.6}
    />
    {/* Bow left & right */}
    <Path
      d="M32 21C27 21 22 18 22 14.5C22 12 24.5 11 27 12.5C29.5 14 32 18 32 21Z"
      fill="#FFFFFF"
      stroke="#111827"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    <Path
      d="M32 21C37 21 42 18 42 14.5C42 12 39.5 11 37 12.5C34.5 14 32 18 32 21Z"
      fill="#FFFFFF"
      stroke="#111827"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </Svg>
);

interface NotificationItem {
  id: string;
  type: 'order' | 'welcome';
  title: string;
  subtitle?: string;
  timeLabel: string;
  orderId?: string;
  imageUrl?: string;
  read: boolean;
}

function getOrderStatusText(status?: string, hasAssignedStaff?: boolean): string {
  switch (status) {
    case 'PREPARING':
      return 'Đang chuẩn bị món';
    case 'READY':
      return hasAssignedStaff ? 'Nhân viên đang nhận đơn đi giao' : 'Món đã làm xong';
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return 'Đang giao hàng';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
    case 'REJECTED':
      return 'Đã hủy';
    case 'PENDING':
    case 'PENDING_CONFIRMATION':
    case 'CONFIRMED':
    default:
      return 'Đã xác nhận';
  }
}

function formatOrderClock(order: any): string {
  if (order.deliveryTime && /^\d{1,2}:\d{2}/.test(order.deliveryTime)) {
    return order.deliveryTime.slice(0, 5);
  }
  const ts = order.createdAt?.seconds
    ? new Date(order.createdAt.seconds * 1000)
    : order.createdAt
    ? new Date(order.createdAt)
    : null;
  if (ts && !isNaN(ts.getTime())) {
    const hh = String(ts.getHours()).padStart(2, '0');
    const mm = String(ts.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return '09:00';
}

function formatRelativeTime(order: any): string {
  const ts = order.createdAt?.seconds
    ? order.createdAt.seconds * 1000
    : order.createdAt
    ? new Date(order.createdAt).getTime()
    : 0;
  if (!ts || isNaN(ts)) return 'Vừa xong';
  const diffMs = Math.max(0, Date.now() - ts);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentWidth = useContentWidth();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'promo' | 'personal'>('promo');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});
  const deletedSetRef = React.useRef<Set<string>>(new Set());
  const readSetRef = React.useRef<Set<string>>(new Set());

  const getDeletedStorageKey = (uid: string) => `@pizza_fpt_deleted_notifs_${uid}`;
  const getReadStorageKey = (uid: string) => `@pizza_fpt_read_notifs_${uid}`;

  const readSyncLocalList = (key: string): string[] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return [];
  };

  const writeSyncLocalList = (key: string, list: string[]) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(list));
      }
    } catch {}
    AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => {});
  };

  useEffect(() => {
    const unsub = subscribeOrderOverrides((map) => {
      setOrderOverrides((prev) => {
        const prevJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(map);
        return prevJson === nextJson ? prev : map;
      });
    });
    return () => unsub();
  }, []);

  const hasLoadedOnceRef = React.useRef(false);

  const loadPersonalNotifications = useCallback(async () => {
    if (!isAuthenticated || !user?.id || user.isDemo) {
      setNotifications([]);
      return;
    }

    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    try {
      const uid = user.id || 'guest';
      const delKey = getDeletedStorageKey(uid);
      const readKey = getReadStorageKey(uid);

      // Nạp ngay từ localStorage đồng bộ trước
      readSyncLocalList(delKey).forEach((id) => deletedSetRef.current.add(id));
      readSyncLocalList(readKey).forEach((id) => readSetRef.current.add(id));

      const [storedDeletedRaw, storedReadRaw, userSnap] = await Promise.all([
        AsyncStorage.getItem(delKey).catch(() => null),
        AsyncStorage.getItem(readKey).catch(() => null),
        user.id ? getDoc(doc(db, 'users', user.id)).catch(() => null) : Promise.resolve(null),
      ]);

      const userData = userSnap?.exists?.() ? userSnap.data() : undefined;
      [
        ...(storedDeletedRaw ? JSON.parse(storedDeletedRaw) : []),
        ...(Array.isArray(userData?.deletedNotifIds) ? userData.deletedNotifIds : []),
      ].forEach((id: string) => deletedSetRef.current.add(id));

      [
        ...(storedReadRaw ? JSON.parse(storedReadRaw) : []),
        ...(Array.isArray(userData?.readNotifIds) ? userData.readNotifIds : []),
      ].forEach((id: string) => readSetRef.current.add(id));

      const ordersCol = collection(db, 'orders');
      const foundOrders: any[] = [];

      if (user.id) {
        const qUser = query(ordersCol, where('userId', '==', user.id));
        const snapUser = await getDocs(qUser);
        snapUser.forEach((docSnap) => {
          foundOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      if (user.phone) {
        const cleanDigits = user.phone.replace(/\D/g, '');
        const variations = new Set<string>([
          user.phone,
          cleanDigits,
          cleanDigits.startsWith('0') ? cleanDigits.slice(1) : '0' + cleanDigits,
        ]);
        for (const p of variations) {
          if (!p) continue;
          const qPhone = query(ordersCol, where('customer.phone', '==', p));
          const snapPhone = await getDocs(qPhone);
          snapPhone.forEach((docSnap) => {
            if (!foundOrders.some((o) => o.id === docSnap.id)) {
              foundOrders.push({ id: docSnap.id, ...docSnap.data() });
            }
          });
        }
      }

      foundOrders.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });

      const orderNotifs: NotificationItem[] = foundOrders
        .filter((o) => String(o.orderCode || '').toUpperCase() !== 'PF-X469QK')
        .map((order) => {
          const override = orderOverrides[order.id];
          const effectiveStatus = String(
            override?.status || order.status || 'PENDING_CONFIRMATION'
          );
          const hasAssignedStaff = Boolean(
            override?.assignedStaffId || order.assignedStaffId
          );
          const statusKey =
            effectiveStatus === 'READY' && hasAssignedStaff
              ? 'READY_ASSIGNED'
              : effectiveStatus;
          const code = order.orderCode || order.id.slice(0, 10).toUpperCase();
          const statusText = getOrderStatusText(effectiveStatus, hasAssignedStaff);
          const clock = formatOrderClock(order);
          const notifId = `order-${order.id}-${statusKey}`;
          const legacyId = `order-${order.id}`;
          const isTerminal =
            effectiveStatus === 'COMPLETED' ||
            effectiveStatus === 'DELIVERED' ||
            effectiveStatus === 'CANCELLED' ||
            effectiveStatus === 'REJECTED';

          const isDeleted =
            deletedSetRef.current.has(notifId) ||
            (isTerminal && deletedSetRef.current.has(legacyId));

          return {
            id: notifId,
            type: 'order' as const,
            title: `Đơn hàng #${code}`,
            subtitle: `${statusText} - ${clock}`,
            timeLabel: formatRelativeTime(order),
            orderId: order.id,
            read:
              readSetRef.current.has(notifId) ||
              (isTerminal && readSetRef.current.has(legacyId)),
            _deleted: isDeleted,
          };
        })
        .filter((item) => !item._deleted);

      // Tạo thông báo Quà Tặng Đặc Quyền Thành Viên (Thăng Hạng Vàng / VIP & Sinh Nhật)
      const [memberStats, giftRules] = await Promise.all([
        fetchUserMemberStats(uid).catch(() => null),
        loadOrSeedMemberGiftRules().catch(() => []),
      ]);

      const localUsedGifts = readSyncLocalList(`fpt_used_member_gifts_${uid}`);
      const usedSet = new Set<string>([
        ...localUsedGifts,
        ...(Array.isArray(userData?.usedMemberGiftIds) ? userData.usedMemberGiftIds : []),
      ]);

      const eligibleGifts = memberStats
        ? getEligibleMemberGifts(
            giftRules,
            memberStats.id,
            userData?.birthday || (user as any)?.birthday,
            memberStats
          )
        : [];

      const memberGiftNotifs: NotificationItem[] = eligibleGifts
        .filter((rule) => !usedSet.has(rule.id))
        .map((rule) => {
          const notifId = `member-gift-${rule.id}`;
          const cleanBaseTitle = rule.title
            .replace(/^Quà Sinh Nhật:\s*/i, '')
            .replace(/\s*miễn phí$/i, '')
            .replace(/\s*\((Cỡ [^)]+)\)/i, ' - $1')
            .trim();
          const minK = Math.round((rule.minSubtotal || 0) / 1000);
          const displayGiftTitle =
            minK > 0 && !cleanBaseTitle.toLowerCase().includes('đơn hàng từ')
              ? `${cleanBaseTitle} cho đơn hàng từ ${minK}K`
              : cleanBaseTitle;
          return {
            id: notifId,
            type: 'welcome' as const,
            title: displayGiftTitle,
            subtitle: `${getMemberGiftOccasionLabel(rule.occasion)} — Nhận tại Quà của tôi`,
            timeLabel: 'Quà của tôi',
            read: readSetRef.current.has(notifId),
            _deleted: deletedSetRef.current.has(notifId),
          };
        })
        .filter((item) => !item._deleted);

      setNotifications([...memberGiftNotifs, ...orderNotifs]);
      hasLoadedOnceRef.current = true;
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id, user?.phone, user?.isDemo, orderOverrides]);

  useEffect(() => {
    loadPersonalNotifications();
  }, [loadPersonalNotifications]);

  const handleReadAll = async () => {
    triggerHaptic('light');
    notifications.forEach((n) => {
      readSetRef.current.add(n.id);
      if (n.orderId) readSetRef.current.add(`order-${n.orderId}`);
    });
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    if (user?.id) {
      const merged = Array.from(readSetRef.current);
      writeSyncLocalList(getReadStorageKey(user.id), merged);
      await updateDoc(doc(db, 'users', user.id), { readNotifIds: merged }).catch(() => {});
    }
  };

  const handleDeleteNotification = async (id: string, orderId?: string) => {
    triggerHaptic('medium');
    deletedSetRef.current.add(id);
    if (orderId) {
      deletedSetRef.current.add(`order-${orderId}`);
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (user?.id) {
      const merged = Array.from(deletedSetRef.current);
      writeSyncLocalList(getDeletedStorageKey(user.id), merged);
      await updateDoc(doc(db, 'users', user.id), { deletedNotifIds: merged }).catch(() => {});
    }
  };

  const handlePressNotification = async (item: NotificationItem) => {
    triggerHaptic('light');
    readSetRef.current.add(item.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (user?.id) {
      const merged = Array.from(readSetRef.current);
      writeSyncLocalList(getReadStorageKey(user.id), merged);
      await updateDoc(doc(db, 'users', user.id), { readNotifIds: merged }).catch(() => {});
    }
    if (item.type === 'order') {
      router.push(
        item.orderId
          ? { pathname: '/order/tracking', params: { orderId: item.orderId } }
          : '/order/tracking'
      );
    } else {
      router.push({ pathname: '/(tabs)/rewards', params: { tab: 'my_gifts' } });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header: < | Thông báo | Đọc tất cả */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thông báo</Text>

        <TouchableOpacity
          style={styles.readAllButton}
          onPress={handleReadAll}
          activeOpacity={0.7}
        >
          <Text style={styles.readAllText}>Đọc tất cả</Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách Thông báo chung */}
      {!isAuthenticated || !user || user.isDemo ? (
        <View style={styles.guestPromptWrap}>
          <Text style={styles.guestPromptText}>
            Vui lòng đăng nhập để xem thông báo
          </Text>
          <TouchableOpacity
            style={styles.guestLoginBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.guestLoginBtnText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={BRAND_RED} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Không có thông báo nào</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
        >
          {notifications.map((item) => (
            <View key={item.id} style={styles.swipeRowWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToOffsets={[0, 84]}
                decelerationRate="fast"
                bounces={false}
              >
                <TouchableOpacity
                  style={[
                    styles.notificationCard,
                    { width: contentWidth },
                    !item.read && styles.notificationCardUnread,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handlePressNotification(item)}
                >
                  {item.type === 'order' ? (
                    <View style={styles.iconBoxPink}>
                      <OrderBagIcon />
                    </View>
                  ) : (
                    <View style={styles.iconBoxPink}>
                      <BrandGiftLogoIcon />
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <View>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {!!item.subtitle && (
                        <Text style={styles.cardSubtitle} numberOfLines={2}>
                          {item.subtitle}
                        </Text>
                      )}
                    </View>

                    <View style={styles.cardFooterRow}>
                      <Text style={styles.timeText}>{item.timeLabel}</Text>
                      <Text style={styles.moreText}>Xem thêm</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Swipe-to-delete Red Trash Button */}
                <TouchableOpacity
                  style={styles.deleteActionBtn}
                  activeOpacity={0.85}
                  onPress={() => handleDeleteNotification(item.id, item.orderId)}
                >
                  <Trash2 size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          ))}

          <Text style={styles.noMoreText}>Không còn thông báo nào</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
