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
  addIconBtn: {
    padding: spacing.xs,
  },
  addBox: {
    backgroundColor: colors.surface,
    padding: spacing.base,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  addBoxTitle: {
    marginBottom: spacing.md,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelRowText: {
    marginLeft: spacing.xs,
  },
  defaultBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.xs,
    marginLeft: spacing.xs,
  },
  namePhone: {
    marginBottom: 4,
  },
  setDefaultRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
});

export default styles;
