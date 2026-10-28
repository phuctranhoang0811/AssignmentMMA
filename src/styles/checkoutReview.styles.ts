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
    paddingBottom: spacing['4xl'],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  cardHeading: {
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  noteText: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 0,
  },
});

export default styles;
