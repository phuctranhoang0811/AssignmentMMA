import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../state/AuthContext';
import { fontFamilies } from '../theme/typography';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)/home');
    }
  }, [user, isLoading, router]);

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const handleGuest = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Top Section: Pizza FPT Dining Hero Image */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../../assets/onboarding-hero.png')}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* Bottom Sheet Card */}
      <View
        style={[
          styles.card,
          {
            paddingBottom: Math.max(insets.bottom + 16, 32),
          },
        ]}
      >
        {/* Title Lines */}
        <Text style={styles.titleRegular}>
          Đăng nhập để nhận thêm nhiều lợi ích từ
        </Text>
        <Text style={styles.titleBold}>Pizza FPT Rewards</Text>

        {/* Primary Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleLogin}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryButtonText}>Đăng nhập</Text>
        </TouchableOpacity>

        {/* Secondary Guest Button */}
        <TouchableOpacity
          style={styles.guestButton}
          onPress={handleGuest}
          activeOpacity={0.7}
        >
          <Text style={styles.guestButtonText}>
            Tiếp tục với tư cách khách
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  heroContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#9A2113',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  titleRegular: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2024',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleBold: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    fontWeight: '800',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#CF4226',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#CF4226',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  guestButton: {
    marginTop: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    color: '#C0321F',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
