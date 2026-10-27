import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { CheckCircle2 } from 'lucide-react-native';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { auth } from '../../services/firebase';
import { finishPayosCart, getPayosPayment, reconcilePayosPayment, watchPayosPayments, PaymentSnapshot } from '../../services/payosService';

export default function PayosScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { user } = useAuth();
  const { items, clearCart } = useCart();
  const [payment, setPayment] = useState<PaymentSnapshot | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const active = useRef(true);
  const latestCart = useRef(JSON.stringify(items));
  const cleared = useRef(false);
  const confirmed = useRef(false);
  latestCart.current = JSON.stringify(items);
  const accept = useCallback((snapshot: PaymentSnapshot) => {
    if (!active.current || snapshot.id !== orderId) return;
    setPayment(previous => previous?.paymentStatus === 'PAID' ? previous : {
      ...snapshot, providerStatus: snapshot.providerStatus ?? previous?.providerStatus,
    });
    setError('');
    if (snapshot.paymentStatus === 'PAID') confirmed.current = true;
    if (snapshot.paymentStatus === 'PAID' && !cleared.current) {
      cleared.current = true;
      void finishPayosCart(snapshot.id, latestCart.current).then(shouldClear => {
        if (shouldClear && active.current) clearCart();
      }).catch(() => { cleared.current = false; });
    }
  }, [orderId, clearCart]);
  const refresh = useCallback(async (reconcile = false) => {
    if (confirmed.current) return;
    if (!orderId || !/^[a-f0-9]{64}$/.test(orderId)) {
      setError('Không tìm thấy mã đơn thanh toán hợp lệ.'); return;
    }
    const uid = auth.currentUser?.uid;
    try {
      const snapshot = await (reconcile ? reconcilePayosPayment(orderId) : getPayosPayment(orderId));
      if (uid && uid === auth.currentUser?.uid) accept(snapshot);
    } catch (err) {
      if (active.current && !confirmed.current) setError(err instanceof Error ? err.message : 'Chưa thể kiểm tra thanh toán.');
    }
  }, [orderId, accept]);
  useEffect(() => {
    active.current = true;
    if (!auth.currentUser) { setPayment(null); setError('Vui lòng đăng nhập lại để xem thanh toán.'); return; }
    void refresh();
    let stopSocket = () => {};
    try { stopSocket = watchPayosPayments(accept, () => { void refresh(); }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Chưa thể kết nối thanh toán.'); }
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refresh(true); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 15000);
    return () => { active.current = false; stopSocket(); foreground.remove(); clearInterval(timer); };
  }, [refresh, accept, user?.id]);
  const paid = payment?.paymentStatus === 'PAID';
  const successReveal = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!paid) return;
    let disposed = false;
    let animation: Animated.CompositeAnimation | undefined;
    const showImmediately = () => {
      animation?.stop();
      successReveal.setValue(1);
      successScale.setValue(1);
    };
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', reduce => {
      if (reduce) showImmediately();
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (disposed || reduce) return;
      successReveal.setValue(0);
      successScale.setValue(0.65);
      animation = Animated.parallel([
        Animated.timing(successReveal, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(successScale, { toValue: 1, speed: 16, bounciness: 8, useNativeDriver: true }),
      ]);
      animation.start();
    }).catch(() => { if (!disposed) showImmediately(); });
    return () => { disposed = true; preference.remove(); animation?.stop(); };
  }, [paid, successReveal, successScale]);
  const terminal = !paid && ['CANCELLED', 'EXPIRED'].includes(payment?.providerStatus ?? '');
  const checkoutOnly = !!payment?.payment && !payment.payment.qrCode;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title={paid ? 'Thanh toán thành công' : 'Thanh toán payOS'} showBack={!paid} />
      <ScrollView>
        <Animated.View style={[styles.content, {
          opacity: successReveal,
          transform: [{ translateY: successReveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }]}>
        {paid && <Animated.View style={[styles.successIcon, { transform: [{ scale: successScale }] }]}
          accessibilityLabel="Đã xác nhận thanh toán">
          <CheckCircle2 size={64} color={colors.success} />
        </Animated.View>}
        <AppText variant="h3">{paid ? 'Thanh toán thành công' : terminal ? 'Link thanh toán đã đóng' : checkoutOnly ? 'Mở payOS để thanh toán' : 'Quét QR để thanh toán'}</AppText>
        {payment && <>
          <AppText variant="body">Đơn #{payment.orderCode}</AppText>
          <AppText variant="h2" color={colors.primary}>{formatCurrency(payment.total)}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>Tổng tiền đã được xác nhận khi tạo thanh toán.</AppText>
        </>}
        {!payment && !error && <ActivityIndicator color={colors.primary} />}
        {!paid && !terminal && payment?.payment?.qrCode && <View style={styles.qr}>
          <QRCode value={payment.payment.qrCode} size={230} />
        </View>}
        <AppText variant="body" color={colors.textSecondary}>
          {paid ? 'Hệ thống đã xác nhận nhận tiền cho đơn hàng của bạn.' : terminal ? 'Vui lòng quay lại checkout để kiểm tra đơn trước khi thanh toán tiếp.' : checkoutOnly ? 'Link thanh toán đã được khôi phục nhưng chưa có mã QR trong ứng dụng. Nhấn “Mở trang thanh toán payOS” để xem mã QR và thanh toán đúng đơn này.' : 'Mở ứng dụng ngân hàng để quét mã. Trạng thái sẽ tự cập nhật sau khi hệ thống xác nhận nhận tiền.'}
        </AppText>
        {!!error && <AppText variant="body" color={colors.error}>{error}</AppText>}
        {!paid && !terminal && payment?.payment?.checkoutUrl && <AppButton title="Mở trang thanh toán payOS" variant="outline" onPress={() => {
          void Linking.openURL(payment.payment!.checkoutUrl).catch(() => setError('Không thể mở trang thanh toán. Vui lòng thử lại.'));
        }} />}
        {!paid && <AppButton title="Kiểm tra thanh toán" isLoading={checking} onPress={() => {
          setChecking(true); void refresh(true).finally(() => { if (active.current) setChecking(false); });
        }} />}
        {paid && <>
          <AppButton title="Theo dõi đơn hàng" onPress={() => router.replace('/order/tracking')} />
          <AppButton title="Về thực đơn" variant="outline" onPress={() => router.replace('/(tabs)/menu')} />
        </>}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 18, alignItems: 'center' },
  qr: { padding: 18, backgroundColor: '#FFFFFF', borderRadius: 16 },
  successIcon: { padding: 24, borderRadius: 60, backgroundColor: colors.successSoft, marginTop: 24 },
});
