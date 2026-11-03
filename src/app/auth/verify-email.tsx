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
import { sendOtpToEmail } from '../../services/otpService';
import { verifyAccountEmail } from '../../services/orderApi';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/forgotPassword.styles';

/** A new account must prove its e-mail before it can order or redeem rewards. */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const working = useRef(false);
  const verified = user?.emailVerified !== false;
  // Google accounts need no code: the backend takes Google's word for the address.
  const googleOnly = user?.hasPassword === false;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const run = async (action: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa thể xác minh. Vui lòng thử lại.'); }
    finally { working.current = false; setBusy(false); }
  };

  const sendCode = () => run(async () => {
    const result = await sendOtpToEmail(user?.email ?? '');
    if (!result.success) throw new Error(result.error);
    setSentTo(user?.email ?? '');
    setCooldown(30);
  });
  const verify = () => run(async () => {
    if (!googleOnly && !/^\d{4}$/.test(code)) throw new Error('Nhập đủ 4 số của mã xác minh.');
    await verifyAccountEmail(googleOnly ? undefined : code);
    // The profile listener flips emailVerified as soon as the backend records it.
    router.back();
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Xác minh email" showBack />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            {verified ? <MailCheck size={32} color={colors.primary} /> : <Mail size={32} color={colors.primary} />}
          </View>
          {verified ? (
            <>
              <AppText variant="h2">Email đã được xác minh</AppText>
              <AppButton title="Quay lại" onPress={() => router.back()} />
            </>
          ) : (
            <>
              <AppText variant="h2">Xác minh email để đặt hàng</AppText>
              <AppText variant="body" color={colors.textSecondary}>
                {googleOnly
                  ? `Email ${user?.email} cần được xác nhận một lần trước khi đặt hàng hoặc đổi quà.`
                  : `Chúng tôi sẽ gửi mã 4 số tới ${user?.email}. Nhập mã để hoàn tất.`}
              </AppText>
              {!googleOnly && (
                <>
                  <AppButton title={sentTo ? (cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã') : 'Gửi mã xác minh'}
                    variant="outline" isLoading={busy && !code} disabled={busy || cooldown > 0} onPress={() => { void sendCode(); }} />
                  <AppInput label="Mã xác minh" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad" maxLength={4} placeholder="0000" accessibilityLabel="Mã xác minh 4 số" />
                </>
              )}
              {!!error && <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">{error}</AppText>}
              <AppButton title="Xác minh" isLoading={busy} disabled={busy || (!googleOnly && code.length < 4)} onPress={() => { void verify(); }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
