import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../state/AuthContext';
import { CartProvider } from '../state/CartContext';
import { OrderProvider } from '../state/OrderContext';
import { FavoritesProvider } from '../state/FavoritesContext';
import { colors } from '../theme/colors';

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 600;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const linkId = 'plus-jakarta-sans-google-font';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  const stackContent = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="checkout/index" options={{ headerShown: false }} />
      <Stack.Screen name="checkout/payment" options={{ headerShown: false }} />
      <Stack.Screen name="checkout/review" options={{ headerShown: false }} />
      <Stack.Screen name="order/success" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register" options={{ headerShown: false }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
      <Stack.Screen name="profile/addresses" options={{ headerShown: false }} />
      <Stack.Screen name="profile/settings" options={{ headerShown: false }} />
      <Stack.Screen name="favorites" options={{ headerShown: false }} />
      <Stack.Screen name="offers" options={{ headerShown: false }} />
      <Stack.Screen name="demo/staff-orders" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <OrderProvider>
            <FavoritesProvider>
              <StatusBar style="dark" />
              {isDesktopWeb ? (
                <View style={styles.desktopCanvas}>
                  <View style={styles.phoneFrame}>
                    <View style={styles.notchContainer}>
                      <View style={styles.dynamicIsland} />
                    </View>
                    {stackContent}
                  </View>
                </View>
              ) : (
                <View style={styles.mobileContainer}>{stackContent}</View>
              )}
            </FavoritesProvider>
          </OrderProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  desktopCanvas: {
    flex: 1,
    backgroundColor: '#EAEAE5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 450,
    backgroundColor: colors.background,
    overflow: 'hidden',
    height: '100%',
    maxHeight: 900,
    borderRadius: 36,
    borderWidth: 7,
    borderColor: '#1C1C1E',
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
  },
  notchContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  dynamicIsland: {
    width: 90,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
  },
});
