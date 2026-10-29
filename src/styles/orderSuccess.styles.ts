import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.successSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.base,
  },
  idBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.xl,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderId: {
    flexShrink: 1,
    marginLeft: spacing.md,
    letterSpacing: 0.5,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    padding: spacing.base,
    borderRadius: radius.md,
    width: '100%',
    marginBottom: spacing.base,
  },
  timelineBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
    width: '100%',
    marginBottom: spacing.base,
  },
  statusTextCol: {
    marginLeft: spacing.md,
    flex: 1,
  },
  note: {
    marginTop: spacing.sm,
  },
  actions: {
    width: '100%',
  },
  mb: {
    marginBottom: spacing.md,
  },
});

export default styles;
