import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  subheading: {
    marginBottom: spacing.md,
  },
  couponCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  leftStub: {
    width: 90,
    backgroundColor: colors.primarySoft,
    borderRightWidth: 1,
    borderRightColor: '#FBDCD3',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  contentCol: {
    flex: 1,
    padding: spacing.base,
    justifyContent: 'space-between',
  },
  description: {
    marginVertical: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
});

export default styles;
