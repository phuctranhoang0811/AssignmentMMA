import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../state/AuthContext';
import { styles } from '../styles/welcome.styles';
import { isStaffRole } from '../utils/staff';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      const isStaff = isStaffRole(user.role);

      if (isStaff) {
        router.replace('/staff/orders');
      } else {
        router.replace('/(tabs)/home');
      }
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
