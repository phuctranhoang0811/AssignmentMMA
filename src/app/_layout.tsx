import React, { useEffect } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '../state/AuthContext';
import { CartProvider } from '../state/CartContext';
import { OrderProvider } from '../state/OrderContext';
import { FavoritesProvider } from '../state/FavoritesContext';
import { ToastProvider } from '../state/ToastContext';
import { colors } from '../theme/colors';
import { styles } from '../styles/rootLayout.styles';

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 600;

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

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

  if (!fontsLoaded && Platform.OS !== 'web') {
    return null;
  }

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
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
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
              <ToastProvider>
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
              </ToastProvider>
            </FavoritesProvider>
          </OrderProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
