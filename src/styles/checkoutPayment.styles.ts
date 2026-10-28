import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressItem: {
    alignItems: 'center',
    width: 70,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  completedDot: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  activeDot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  completedLine: {
    backgroundColor: colors.success,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  activePaymentCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  demoBadge: {
    backgroundColor: '#FFE2D7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.xs,
    marginLeft: spacing.xs,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  selectedRadioCircle: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  demoNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  demoNoticeText: {
    marginLeft: spacing.xs,
    flex: 1,
    lineHeight: 16,
  },
});

export default styles;
