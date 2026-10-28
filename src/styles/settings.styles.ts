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
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  devHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
  },
  devCard: {
    borderColor: '#FCD7CC',
    backgroundColor: '#FFFBF9',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
});

export default styles;
