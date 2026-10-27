import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, MailCheck } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppText } from '../../components/ui/AppText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { isValidEmail } from '../../utils/validators';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/forgotPassword.styles';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sending = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSend = async () => {
    if (sending.current || cooldown > 0) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    sending.current = true;
    setIsSending(true);
    setError('');
    try {
      await resetPassword(normalizedEmail);
      setSentEmail(normalizedEmail);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa thể gửi email. Vui lòng thử lại.');
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Quên mật khẩu" showBack />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            {sentEmail ? <MailCheck size={32} color={colors.primary} /> : <Mail size={32} color={colors.primary} />}
          </View>
          <AppText variant="h2">{sentEmail ? 'Kiểm tra email của bạn' : 'Đặt lại mật khẩu'}</AppText>
          {sentEmail ? (
            <>
              <AppText variant="body" color={colors.textSecondary}>
                Nếu email {sentEmail} đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.
              </AppText>
              <AppText variant="body" color={colors.textSecondary}>
                Mở email, nhấn vào liên kết và đặt mật khẩu mới. Sau đó quay lại ứng dụng để đăng nhập.
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Chưa thấy email? Hãy kiểm tra thư mục Spam hoặc Thư rác. Nếu liên kết hết hạn, bạn có thể yêu cầu gửi lại.
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="body" color={colors.textSecondary}>
                Nhập email bạn đã đăng ký. Chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.
              </AppText>
              <AppInput label="Email" accessibilityLabel="Email đã đăng ký"
                placeholder="ten@email.com" value={email} editable={!isSending}
                onChangeText={value => { setEmail(value); setError(''); }}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                autoComplete="email" returnKeyType="send" onSubmitEditing={() => { void handleSend(); }} />
            </>
          )}
          {!!error && <AppText variant="body" color={colors.error} accessibilityLiveRegion="polite">{error}</AppText>}
          <AppButton title={cooldown > 0 ? `Gửi lại sau ${cooldown}s` : sentEmail ? 'Gửi lại email' : 'Gửi email đặt lại mật khẩu'}
            onPress={() => { void handleSend(); }} isLoading={isSending} disabled={cooldown > 0} />
          {!!sentEmail && <AppButton title="Dùng email khác" variant="outline" disabled={isSending}
            onPress={() => { setSentEmail(''); setError(''); }} />}
          <AppButton title="Quay lại đăng nhập" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
