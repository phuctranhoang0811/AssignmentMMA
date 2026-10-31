import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../state/AuthContext';
import { useContentWidth } from '../utils/layout';
import { triggerHaptic } from '../utils/haptics';
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

// Custom SVG: Red Brand Emblem (matching Screenshot 2 second item)
const BrandGiftLogoIcon = () => (
  <Svg width={92} height={92} viewBox="0 0 92 92" fill="none">
    <Circle cx="30" cy="46" r="44" fill={BRAND_RED} />
    <Circle
      cx="30"
      cy="46"
      r="36"
      stroke="#FFFFFF"
      strokeWidth={2.5}
    />
    <Path
      d="M8 48L24 38L36 38L52 48H8Z"
      fill="#FFFFFF"
    />
    <Path
      d="M20 35H40L37 30H23L20 35Z"
      fill="#FFFFFF"
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
  read: boolean;
}

function getOrderStatusText(status?: string): string {
  switch (status) {
    case 'PREPARING':
      return 'Đang chuẩn bị';
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return 'Đang giao hàng';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
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

  const loadPersonalNotifications = useCallback(async () => {
    if (!isAuthenticated || !user || user.isDemo) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    try {
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

      const orderNotifs: NotificationItem[] = foundOrders.map((order) => {
        const code = order.orderCode || order.id.slice(0, 10).toUpperCase();
        const statusText = getOrderStatusText(order.status);
        const clock = formatOrderClock(order);
        return {
          id: `order-${order.id}`,
          type: 'order',
          title: `Đơn hàng #${code}`,
          subtitle: `${statusText} - ${clock}`,
          timeLabel: formatRelativeTime(order),
          orderId: order.id,
          read: false,
        };
      });

      const welcomeNotif: NotificationItem = {
        id: 'welcome-gift',
        type: 'welcome',
        title: 'HUT TẶNG BẠN MÓN QUÀ - ĐĂNG KÝ THÀNH VIÊN MỚI',
        timeLabel: '21/10/2026',
        read: false,
      };

      setNotifications([...orderNotifs, welcomeNotif]);
    } catch {
      setNotifications([
        {
          id: 'welcome-gift',
          type: 'welcome',
          title: 'HUT TẶNG BẠN MÓN QUÀ - ĐĂNG KÝ THÀNH VIÊN MỚI',
          timeLabel: '21/10/2026',
          read: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    loadPersonalNotifications();
  }, [loadPersonalNotifications]);

  const handleReadAll = () => {
    triggerHaptic('light');
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const handleDeleteNotification = (id: string) => {
    triggerHaptic('medium');
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePressNotification = (item: NotificationItem) => {
    triggerHaptic('light');
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.type === 'order') {
      router.push(
        item.orderId
          ? { pathname: '/order/tracking', params: { orderId: item.orderId } }
          : '/order/tracking'
      );
    } else {
      router.push('/(tabs)/rewards');
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

      {/* 2-Tab Segmented Switch */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'promo' && styles.tabButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('light');
              setActiveTab('promo');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'promo' && styles.tabTextActive,
              ]}
            >
              Thông báo khuyến mãi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'personal' && styles.tabButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('light');
              setActiveTab('personal');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'personal' && styles.tabTextActive,
              ]}
            >
              Thông tin của bạn
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Content */}
      {activeTab === 'promo' ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Không có thông báo nào</Text>
        </View>
      ) : !isAuthenticated || !user || user.isDemo ? (
        <View style={styles.guestPromptWrap}>
          <Text style={styles.guestPromptText}>
            Vui lòng đăng nhập để xem thông tin của bạn
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
                    <View style={styles.iconBoxLogo}>
                      <BrandGiftLogoIcon />
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <View>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {!!item.subtitle && (
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
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
                  onPress={() => handleDeleteNotification(item.id)}
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
