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
import { User, Mail, Phone, Lock, Eye, EyeOff, CheckSquare, Square } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../state/AuthContext';
import { isValidEmail, isValidPhone, isValidName } from '../../utils/validators';

export default function RegisterScreen() {
  const { registerDemo } = useAuth();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRegister = async () => {
    const errs: Record<string, string> = {};

    if (!isValidName(fullname)) {
      errs.fullname = 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự)';
    }
    if (!isValidEmail(email)) {
      errs.email = 'Email không hợp lệ';
    }
    if (!isValidPhone(phone)) {
      errs.phone = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)';
    }
    if (!password || password.length < 6) {
      errs.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    if (!agreeTerms) {
      errs.terms = 'Bạn cần đồng ý với điều khoản sử dụng';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      await registerDemo(fullname, email, phone);
      Alert.alert('Thành công', 'Tạo tài khoản demo thành công!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ]);
    } catch (e: any) {
      Alert.alert('Đăng ký thất bại', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Tạo tài khoản mới" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
            <AppInput
              label="Họ và tên *"
              placeholder="Nguyễn Văn A"
              value={fullname}
              onChangeText={(t) => {
                setFullname(t);
                setErrors((prev) => ({ ...prev, fullname: '' }));
              }}
              error={errors.fullname}
              leftIcon={<User size={18} color={colors.textSecondary} />}
            />

            <AppInput
              label="Email *"
              placeholder="email@example.com"
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
              label="Số điện thoại *"
              placeholder="0901234567"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              error={errors.phone}
              leftIcon={<Phone size={18} color={colors.textSecondary} />}
            />

            <AppInput
              label="Mật khẩu *"
              placeholder="Tối thiểu 6 ký tự"
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

            <AppInput
              label="Xác nhận mật khẩu *"
              placeholder="Nhập lại mật khẩu"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }}
              error={errors.confirmPassword}
              leftIcon={<Lock size={18} color={colors.textSecondary} />}
            />

            {/* Terms checkbox */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAgreeTerms(!agreeTerms)}
              style={styles.termsRow}
            >
              {agreeTerms ? (
                <CheckSquare size={20} color={colors.primary} />
              ) : (
                <Square size={20} color={colors.textSecondary} />
              )}
              <AppText variant="caption" color={colors.textSecondary} style={styles.termsText}>
                Tôi đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư (Bản Demo).
              </AppText>
            </TouchableOpacity>
            {errors.terms && (
              <AppText variant="caption" color={colors.error} style={{ marginTop: 2, marginBottom: spacing.sm }}>
                {errors.terms}
              </AppText>
            )}

            <AppButton
              title="Đăng ký tài khoản"
              onPress={handleRegister}
              isLoading={isLoading}
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.footer}>
            <AppText variant="body" color={colors.textSecondary}>
              Đã có tài khoản?{' '}
            </AppText>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <AppText variant="bodyMedium" color={colors.primary}>
                Đăng nhập
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
  form: {
    marginBottom: spacing.xl,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  termsText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
