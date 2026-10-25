import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
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

export default function LoginScreen() {
  const { loginDemo } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleBack = () => {
    if (returnTo === 'profile') {
      router.replace('/(tabs)/profile');
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (returnTo === 'profile') {
      const onBackPress = () => {
        router.replace('/(tabs)/profile');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [returnTo]);

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
      router.replace('/(tabs)/home');
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
      router.replace('/(tabs)/home');
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  topNav: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  brandSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 14,
  },
  logoWrapper: {
    width: 95,
    height: 95,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandSubtitle: {
    fontSize: 15.5,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  brandTitle: {
    fontSize: 21,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  badgeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeTextWrap: {
    marginLeft: 6,
  },
  badgeMainText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  badgeSubText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9.5,
    fontWeight: '400',
    marginTop: 1,
    lineHeight: 12,
  },
  badgeDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 14,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1F1F1F',
    marginLeft: 8,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 16,
    paddingVertical: 2,
  },
  forgotText: {
    color: '#DE4525',
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#DE4525',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DE4525',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  demoLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  demoLoginText: {
    color: '#DE4525',
    fontSize: 12.5,
    fontWeight: '500',
    marginLeft: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  footerNormalText: {
    color: '#6B7280',
    fontSize: 13.5,
  },
  footerLinkText: {
    color: '#DE4525',
    fontSize: 13.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
