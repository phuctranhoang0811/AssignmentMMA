import React, { useEffect, useRef, useCallback } from 'react';
import {
  Image,
  Animated,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../state/AuthContext';
import { styles } from '../styles/splash.styles';

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  const handleNavigateNext = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (!isLoading && user) {
        const isAdmin =
          user.role === 'SUPER_ADMIN' ||
          user.role === 'STORE_MANAGER' ||
          user.role === 'ADMIN';
        const isStaff =
          user.role === 'EMPLOYEE' ||
          user.role === 'ROLE_KITCHEN' ||
          user.role === 'ROLE_RIDER';

        if (isAdmin) {
          router.replace('/admin/dashboard');
        } else if (isStaff) {
          router.replace('/staff/orders');
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        router.replace('/welcome');
      }
    });
  }, [fadeAnim, router, user, isLoading]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      handleNavigateNext();
    }, 2200);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, handleNavigateNext]);

  return (
    <Pressable style={styles.container} onPress={handleNavigateNext}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.imageWrapper,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/splash-fpt.png')}
          style={styles.splashImage}
          resizeMode="cover"
        />
      </Animated.View>
    </Pressable>
  );
}
