import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { AppText } from '../ui/AppText';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import type { StoreStatus } from '../../utils/storeHours';

/** Shown above the cart and checkout while the store is closed or has paused ordering. Renders nothing when open. */
export function StoreClosedBanner({ status }: { status: StoreStatus }) {
  if (status.open) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLabel={`Cửa hàng đang đóng cửa. ${status.message}`}>
      <Clock size={18} color={colors.warning} />
      <View style={styles.text}>
        <AppText variant="bodyMedium" color={colors.warning}>
          {status.reason === 'PAUSED' ? 'Cửa hàng tạm ngưng nhận đơn' : 'Cửa hàng đang đóng cửa'}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>{status.message}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warningSoft,
    borderRadius: radius.md, padding: spacing.base, marginHorizontal: spacing.base, marginTop: spacing.sm,
  },
  text: { flex: 1 },
});
