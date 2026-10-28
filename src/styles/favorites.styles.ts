import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
  },
});

export default styles;
