import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';

const when = (value: any) => {
  const millis = value?.seconds ? value.seconds * 1000 : Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toLocaleString('vi-VN') : '';
};

/** Why an order was cancelled and, for a paid one, where the refund stands. */
export function OrderCancellationCard({ order }: { order: Record<string, any> }) {
  if (order.status !== 'CANCELLED') return null;
  const reason = String(order.cancelReason ?? '').replace(/^Cửa hàng từ chối:\s*/, '');
  const due = when(order.refundDueAt);
  return (
    <View style={styles.card}>
      <AppText variant="bodyMedium">Đơn hàng đã bị hủy</AppText>
      {!!reason && <AppText variant="caption" color={colors.textSecondary}>Lý do: {reason}</AppText>}
      {order.paymentStatus === 'REFUND_PENDING' && (
        <AppText variant="caption" color={colors.warning}>
          Đang chờ hoàn tiền{due ? `, dự kiến hoàn trước ${due}` : ' trong vòng 24 giờ'}. Bạn sẽ nhận thông báo khi cửa hàng hoàn xong.
        </AppText>
      )}
      {order.paymentStatus === 'REFUNDED' && (
        <AppText variant="caption" color={colors.success}>
          Đã hoàn tiền{when(order.refundedAt) ? ` lúc ${when(order.refundedAt)}` : ''}. Tiền về tài khoản trong 1-3 ngày làm việc.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.errorSoft, borderRadius: radius.card, padding: spacing.base, marginBottom: 12, gap: spacing.xs },
});
