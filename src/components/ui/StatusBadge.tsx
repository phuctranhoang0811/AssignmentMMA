import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { OrderStatus } from '../../types/order';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from './AppText';

interface StatusBadgeProps {
  status: OrderStatus;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style }) => {
  const getConfig = () => {
    switch (status) {
      case 'PENDING_CONFIRMATION':
        return {
          label: 'Chờ xác nhận',
          textColor: colors.warning,
          bgColor: colors.warningSoft,
        };
      case 'CONFIRMED':
        return {
          label: 'Đã xác nhận',
          textColor: colors.primary,
          bgColor: colors.primarySoft,
        };
      case 'PREPARING':
        return {
          label: 'Đang nấu',
          textColor: colors.warning,
          bgColor: colors.warningSoft,
        };
      case 'READY':
        return {
          label: 'Sẵn sàng',
          textColor: colors.success,
          bgColor: colors.successSoft,
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Đang giao',
          textColor: colors.primary,
          bgColor: colors.primarySoft,
        };
      case 'COMPLETED':
        return {
          label: 'Hoàn thành',
          textColor: colors.success,
          bgColor: colors.successSoft,
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy',
          textColor: colors.error,
          bgColor: colors.errorSoft,
        };
      default:
        return {
          label: status,
          textColor: colors.textSecondary,
          bgColor: colors.surfaceAlt,
        };
    }
  };

  const { label, textColor, bgColor } = getConfig();

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      <View style={[styles.dot, { backgroundColor: textColor }]} />
      <AppText variant="captionMedium" color={textColor}>
        {label}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
});
