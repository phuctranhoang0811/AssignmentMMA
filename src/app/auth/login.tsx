import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, Flame, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../state/AuthContext';
import { isValidEmail } from '../../utils/validators';

export default function LoginScreen() {
  const { loginDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleLogin = async () => {
    const errs: Record<string, string> = {};
    if (!isValidEmail(email)) {
      errs.email = 'Vui lòng nhập email hợp lệ';
    }
    if (!password || password.length < 6) {
      errs.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      await loginDemo(email);
      router.back();
    } catch (e: any) {
      Alert.alert('Đăng nhập thất bại', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    try {
      await loginDemo('demo@pizzatime.local');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Đăng nhập" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Logo & Welcome */}
          <View style={styles.brandHeader}>
            <View style={styles.logoCircle}>
              <Flame size={36} color={colors.primary} />
            </View>
            <AppText variant="h1" align="center" style={styles.title}>
              Chào mừng trở lại!
            </AppText>
            <AppText variant="body" color={colors.textSecondary} align="center">
              Đăng nhập để xem lịch sử đơn hàng và địa chỉ đã lưu
            </AppText>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <AppInput
              label="Địa chỉ Email"
              placeholder="nhapemail@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              error={errors.email}
              leftIcon={<Mail size={18} color={colors.textSecondary} />}
            />

            <AppInput
              label="Mật khẩu"
              placeholder="Nhập mật khẩu"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setErrors((prev) => ({ ...prev, password: '' }));
              }}
              error={errors.password}
              leftIcon={<Lock size={18} color={colors.textSecondary} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              }
            />

            <AppButton
              title="Đăng nhập"
              onPress={handleLogin}
              isLoading={isLoading}
              style={styles.submitBtn}
            />

            {/* Quick Demo Login Option */}
            <View style={styles.demoLoginBox}>
              <AppButton
                title="Đăng nhập nhanh với tài khoản Demo"
                variant="secondary"
                icon={<Sparkles size={16} color={colors.primary} />}
                onPress={handleQuickDemoLogin}
                isLoading={isLoading}
              />
              <AppText variant="caption" color={colors.textSecondary} align="center" style={{ marginTop: 6 }}>
                demo@pizzatime.local • Nguyễn Minh Anh
              </AppText>
            </View>
          </View>

          {/* Footer Register Link */}
          <View style={styles.footer}>
            <AppText variant="body" color={colors.textSecondary}>
              Chưa có tài khoản?{' '}
            </AppText>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <AppText variant="bodyMedium" color={colors.primary}>
                Đăng ký ngay
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  title: {
    marginBottom: spacing.xs,
  },
  form: {
    marginBottom: spacing.xl,
  },
  submitBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  demoLoginBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
