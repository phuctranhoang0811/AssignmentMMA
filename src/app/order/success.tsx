import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle2, Clock, ArrowRight, Home } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { styles } from '../../styles/orderSuccess.styles';
import { formatCurrency } from '../../utils/formatCurrency';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function OrderSuccessScreen() {
  const { orderId, orderCode, total } = useLocalSearchParams<{ orderId: string; orderCode?: string; total?: string }>();
  const paid = !!total;
  // The backend writes orders/{orderId} in the same transaction that marks the payment paid; follow it live.
  const [order, setOrder] = useState<any>(null);
  useEffect(() => {
    if (!orderId) return;
    return onSnapshot(doc(db, 'orders', orderId), snapshot => setOrder(snapshot.exists() ? snapshot.data() : null), () => {});
  }, [orderId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
      >
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <CheckCircle2 size={56} color={colors.success} />
          </View>

          <AppText variant="h1" align="center" style={styles.title}>
            {paid ? 'Thanh toán thành công!' : 'Đã tạo đơn hàng thành công!'}
          </AppText>

          <View style={styles.idBox}>
            <View style={styles.row}>
              <AppText variant="captionMedium" color={colors.textSecondary}>Mã đơn hàng</AppText>
              <AppText variant="bodyMedium" numberOfLines={1} style={styles.orderId}>
                #{orderCode || orderId?.slice(0, 8).toUpperCase() || 'PT-2026-DEMO'}
              </AppText>
            </View>
            {paid && <View style={[styles.row, styles.rowDivider]}>
              <AppText variant="captionMedium" color={colors.textSecondary}>Đã thanh toán</AppText>
              <AppText variant="h3" color={colors.primary}>{formatCurrency(Number(total))}</AppText>
            </View>}
          </View>

          {order?.status && order.status !== 'CANCELLED' ? (
            <View style={styles.timelineBox}>
              <OrderTimeline
                status={order.status}
                fulfillmentType={['takeaway', 'PICKUP'].includes(order.fulfillmentType) ? 'PICKUP' : 'DELIVERY'}
                history={order.statusHistory}
              />
            </View>
          ) : (
            <View style={styles.statusBox}>
              <Clock size={20} color={colors.warning} />
              <View style={styles.statusTextCol}>
                <AppText variant="bodyMedium">{order?.status === 'CANCELLED' ? 'Đơn hàng đã bị hủy' : 'Đang tải trạng thái đơn...'}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Trạng thái đơn hàng sẽ tự cập nhật tại đây.
                </AppText>
              </View>
            </View>
          )}

          <AppText variant="caption" color={colors.textSecondary} align="center" style={styles.note}>
            Thời gian dự kiến nhận món: 30–45 phút
          </AppText>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Theo dõi đơn hàng"
            icon={<ArrowRight size={18} color={colors.white} />}
            onPress={() => {
              router.replace(orderId ? { pathname: '/order/tracking', params: { orderId } } : '/order/tracking');
            }}
            style={styles.mb}
          />

          <AppButton
            title="Về trang chủ"
            variant="outline"
            icon={<Home size={18} color={colors.textPrimary} />}
            onPress={() => router.replace('/(tabs)/home')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

