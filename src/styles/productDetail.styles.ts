import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { fontFamilies } from '../theme/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.surfaceAlt,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -20,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 32,
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
  discountChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignSelf: 'center',
  },
  memberNote: {
    marginBottom: spacing.sm,
  },
  soldOutBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  relatedSection: {
    paddingTop: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  relatedTitle: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  relatedList: {
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  relatedCard: {
    width: 180,
  },
  ingredientsBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#ECEEF2',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  ingredientsText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 20,
    marginTop: 3,
  },
  noteContainer: {
    marginTop: spacing.md,
  },
  noteTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: spacing.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  toast: {
    position: 'absolute',
    bottom: 95,
    alignSelf: 'center',
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  toastText: {
    fontFamily: fontFamilies.medium,
    marginLeft: spacing.xs,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

export default styles;
