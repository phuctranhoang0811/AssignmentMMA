import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Check, X, ChefHat, Truck, CheckCircle } from 'lucide-react-native';
import { OrderStatus, FulfillmentType } from '../../types/order';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';

interface OrderTimelineProps {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  history?: { status: OrderStatus; at: string; note?: string }[];
}

type StepDefinition = {
  statuses: OrderStatus[];
  title: string;
  icon: any;
};

const PulsingRing: React.FC = () => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnim = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    pulseAnim.start();
    return () => pulseAnim.stop();
  }, [animValue]);

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.7, 0.2, 0],
  });

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
};

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  status,
  history = [],
}) => {
  const steps: StepDefinition[] = [
    { statuses: ['PENDING_CONFIRMATION', 'CONFIRMED'], title: 'Đã xác nhận', icon: Check },
    { statuses: ['PREPARING', 'READY'], title: 'Đang chuẩn bị', icon: ChefHat },
    { statuses: ['OUT_FOR_DELIVERY'], title: 'Đang giao hàng', icon: Truck },
    { statuses: ['COMPLETED'], title: 'Hoàn thành', icon: CheckCircle },
  ];

  if (status === 'CANCELLED') {
    return (
      <View style={styles.cancelledContainer}>
        <View style={styles.cancelledIcon}>
          <X size={20} color={colors.white} />
        </View>
        <View style={styles.cancelledText}>
          <AppText variant="cardTitle" color={colors.error}>
            Đơn hàng đã bị hủy
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Đơn hàng không thể tiếp tục thực hiện
          </AppText>
        </View>
      </View>
    );
  }

  const foundIndex = steps.findIndex((s) => s.statuses.includes(status));
  const currentStepIndex = foundIndex >= 0 ? foundIndex : 0;

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isPassed = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const IconComponent = step.icon;

        const historyItem = [...history].reverse().find((h) => step.statuses.includes(h.status));

        return (
          <View key={step.title} style={styles.stepRow}>
            <View style={styles.leftColumn}>
              {/* Animated pulse ring for current active node */}
              {isCurrent && <PulsingRing />}

              <View
                style={[
                  styles.nodeCircle,
                  isPassed && styles.passedCircle,
                  isCurrent && styles.currentCircle,
                ]}
              >
                {isPassed ? (
                  <Check size={14} color={colors.white} />
                ) : (
                  <IconComponent
                    size={14}
                    color={isCurrent ? colors.white : colors.textDisabled}
                  />
                )}
              </View>

              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.verticalLine,
                    isPassed && styles.passedLine,
                  ]}
                />
              )}
            </View>

            <View style={styles.rightContent}>
              <View style={styles.titleRow}>
                <View style={styles.titleWithBadge}>
                  <AppText
                    variant={isCurrent ? 'cardTitle' : 'bodyMedium'}
                    color={
                      isCurrent
                        ? colors.primary
                        : isPassed
                        ? colors.textPrimary
                        : colors.textDisabled
                    }
                  >
                    {step.title}
                  </AppText>
                  {isCurrent && (
                    <View style={styles.currentLiveBadge}>
                      <View style={styles.liveDot} />
                      <AppText variant="captionMedium" color={colors.primary}>
                        Đang xử lý
                      </AppText>
                    </View>
                  )}
                </View>

                <AppText variant="caption" color={colors.textSecondary}>
                  {historyItem
                    ? new Date(historyItem.at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--'}
                </AppText>
              </View>

              {historyItem?.note ? (
                <AppText variant="caption" color={isCurrent ? colors.textPrimary : colors.textSecondary} style={styles.note}>
                  {historyItem.note}
                </AppText>
              ) : isCurrent ? (
                <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                  Hệ thống đang tiến hành bước này...
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 58,
  },
  leftColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.md,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    zIndex: 0,
  },
  nodeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  passedCircle: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  currentCircle: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: -2,
  },
  passedLine: {
    backgroundColor: colors.success,
  },
  rightContent: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  currentLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 4,
  },
  note: {
    marginTop: 3,
  },
  cancelledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorSoft,
    padding: spacing.base,
    borderRadius: radius.md,
    marginVertical: spacing.md,
  },
  cancelledIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cancelledText: {
    flex: 1,
  },
});
