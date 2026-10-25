import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Home, User, ShoppingCart } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../state/CartContext';
import { triggerHaptic } from '../../utils/haptics';

const BRAND_RED = '#CF4226';

// Custom Pizza Slice Icon for Menu Tab (matches user screenshot)
const MenuPizzaIcon = ({ size = 22, color = '#6B7280' }: { size?: number; color?: any }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2L2 21c2 1 6 1 10 1s8 0 10-1L12 2z" />
    <Circle cx="12" cy="11" r="1.2" fill={color} />
    <Circle cx="8" cy="16" r="1.2" fill={color} />
    <Circle cx="15" cy="17" r="1.2" fill={color} />
  </Svg>
);

// Custom Pizza Reward Slice Badge Icon for FPT Reward Tab (matches user screenshot)
const RewardBadgeIcon = ({ size = 22, color = '#6B7280' }: { size?: number; color?: any }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22L3 6a18 18 0 0 1 18 0L12 22z" />
    <Path d="M4.5 7.5a16 16 0 0 1 15 0" />
    <Circle cx="12" cy="12" r="1" fill={color} />
    <Circle cx="9.5" cy="15.5" r="0.8" fill={color} />
    <Circle cx="14.5" cy="15.5" r="0.8" fill={color} />
  </Svg>
);

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();
  const cartScaleAnim = useRef(new Animated.Value(itemCount > 0 ? 1 : 0)).current;

  const isAndroid = Platform.OS === 'android';
  const bottomInset = insets.bottom;
  const tabBottomPadding = Math.max(bottomInset, isAndroid ? 12 : 8);
  const tabHeight = 60 + tabBottomPadding;

  const showFloatingCart = itemCount > 0 && !pathname.includes('cart');

  useEffect(() => {
    if (showFloatingCart) {
      Animated.sequence([
        Animated.spring(cartScaleAnim, {
          toValue: 1.15,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(cartScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(cartScaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showFloatingCart, itemCount, cartScaleAnim]);

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: BRAND_RED,
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#ECECEC',
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: tabBottomPadding,
            paddingTop: 8,
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ color, size }) => <MenuPizzaIcon size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: 'FPT Reward',
            tabBarIcon: ({ color, size }) => <RewardBadgeIcon size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Tài khoản',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
        {/* Hidden from Tab Bar but route accessible */}
        <Tabs.Screen
          name="cart"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Floating Red Cart Button with Badge */}
      {showFloatingCart && (
        <Animated.View
          style={[
            styles.floatingCartWrap,
            {
              bottom: tabHeight + 14,
              transform: [{ scale: cartScaleAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.floatingCartBtn}
            activeOpacity={0.88}
            onPress={() => {
              triggerHaptic('light');
              router.push('/(tabs)/cart');
            }}
          >
            <ShoppingCart size={24} color="#FFFFFF" strokeWidth={2.2} />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingCartWrap: {
    position: 'absolute',
    right: 18,
    zIndex: 9999,
  },
  floatingCartBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BRAND_RED,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
