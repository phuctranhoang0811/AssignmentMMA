import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TextInput,
  Text,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  BadgePercent,
  Star,
  Smartphone,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { styles } from '../../styles/login.styles';

export default function LoginScreen() {
  const { loginDemo } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleBack = () => {
    if (returnTo === 'staff' || returnTo === 'profile') {
      router.replace('/(tabs)/profile');
    } else if (returnTo === 'menu') {
      router.replace('/(tabs)/menu');
    } else if (returnTo === 'cart') {
      router.replace('/(tabs)/cart');
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (returnTo === 'staff' || returnTo === 'profile' || returnTo === 'menu' || returnTo === 'cart') {
      const onBackPress = () => {
        if (returnTo === 'staff' || returnTo === 'profile') router.replace('/(tabs)/profile');
        else if (returnTo === 'menu') router.replace('/(tabs)/menu');
        else if (returnTo === 'cart') router.replace('/(tabs)/cart');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [returnTo]);

  const navigateAfterLogin = () => {
    if (returnTo === 'admin' || identifier.trim().toLowerCase().includes('admin@')) {
      router.replace('/admin/dashboard');
    } else if (returnTo === 'staff' || identifier.trim().toLowerCase().includes('employee@')) {
      router.replace('/staff/orders');
    } else if (returnTo === 'profile') {
      router.replace('/(tabs)/profile');
    } else if (returnTo === 'menu') {
      router.replace('/(tabs)/menu');
    } else if (returnTo === 'cart') {
      router.replace('/(tabs)/cart');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (!identifier.trim()) {
      setErrorMessage('Vui lòng nhập email hoặc số điện thoại của bạn');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsLoading(true);
    try {
      await loginDemo(identifier.trim(), password);
      navigateAfterLogin();
    } catch (e: any) {
      Alert.alert('Đăng nhập thất bại', e.message || 'Tài khoản hoặc mật khẩu không đúng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    try {
      await loginDemo('demo@pizzatime.local');
      navigateAfterLogin();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background Graphic (Orange Header with Pizza Art -> White Bottom) */}
      <Image
        source={require('../../../assets/login-bg.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top Header Navigation */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.backText}>Quay lại</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Header Brand & Badges */}
            <View style={styles.brandSection}>
              {/* Seamless HD Mockup Logo */}
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../../../assets/mockup_logo_circle.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.brandSubtitle}>Đăng nhập để mở khóa</Text>
              <Text style={styles.brandTitle}>lợi ích tuyệt vời</Text>

              {/* 3 Badges Row */}
              <View style={styles.badgesContainer}>
                {/* Badge 1 */}
                <View style={styles.badgeItem}>
                  <BadgePercent size={23} color="#FFFFFF" strokeWidth={1.8} />
                  <View style={styles.badgeTextWrap}>
                    <Text style={styles.badgeMainText}>Ưu đãi</Text>
                    <Text style={styles.badgeSubText}>Nhiều khuyến mãi</Text>
                  </View>
                </View>

                <View style={styles.badgeDivider} />

                {/* Badge 2 */}
                <View style={styles.badgeItem}>
                  <Star size={22} color="#FFFFFF" strokeWidth={1.8} />
                  <View style={styles.badgeTextWrap}>
                    <Text style={styles.badgeMainText}>Rewards</Text>
                    <Text style={styles.badgeSubText}>Tích điểm nhanh</Text>
                  </View>
                </View>

                <View style={styles.badgeDivider} />

                {/* Badge 3 */}
                <View style={styles.badgeItem}>
                  <Smartphone size={22} color="#FFFFFF" strokeWidth={1.8} />
                  <View style={styles.badgeTextWrap}>
                    <Text style={styles.badgeMainText}>Đặt món</Text>
                    <Text style={styles.badgeSubText}>Dễ dàng, tiện lợi</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* White Form Card */}
            <View style={styles.card}>
              {/* Email / SĐT Field */}
              <Text style={styles.inputLabel}>Email / Số điện thoại</Text>
              <View style={[styles.inputBox, errorMessage.includes('email') && styles.inputError]}>
                <Mail size={18} color="#9CA3AF" strokeWidth={1.8} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Vui lòng nhập email hoặc số điện thoại của bạn"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={identifier}
                  onChangeText={(val) => {
                    setIdentifier(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                />
              </View>

              {/* Password Field */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Mật khẩu</Text>
              <View style={[styles.inputBox, errorMessage.includes('Mật khẩu') && styles.inputError]}>
                <Lock size={18} color="#9CA3AF" strokeWidth={1.8} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Vui lòng nhập mật khẩu của bạn"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeBtn}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#9CA3AF" strokeWidth={1.8} />
                  ) : (
                    <Eye size={18} color="#9CA3AF" strokeWidth={1.8} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Error Banner */}
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              {/* Quên mật khẩu link */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => router.push('/auth/forgot-password')}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Quên mật khẩu</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitText}>Đăng Nhập</Text>
                )}
              </TouchableOpacity>

              {/* Quick Demo Login Shortcut */}
              <TouchableOpacity
                style={styles.demoLoginBtn}
                onPress={handleQuickDemoLogin}
                activeOpacity={0.7}
              >
                <Sparkles size={14} color="#DE4525" />
                <Text style={styles.demoLoginText}>Đăng nhập nhanh với tài khoản Demo</Text>
              </TouchableOpacity>

              {/* Footer Register Navigation */}
              <View style={styles.footerRow}>
                <Text style={styles.footerNormalText}>Bạn chưa có tài khoản? </Text>
                <TouchableOpacity
                  onPress={() => router.push('/auth/register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerLinkText}>Tạo tài khoản</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

