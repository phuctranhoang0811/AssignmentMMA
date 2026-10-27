import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamilies } from '../theme/typography';

export const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  groupSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  groupTitle: {
    flexShrink: 1, // long titles wrap on 320dp phones instead of pushing the badge off-screen
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  requiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  optionalBadge: {
    marginLeft: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  optionalText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  groupSubtitle: {
    flexShrink: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 14,
    lineHeight: 19,
  },

  /* Grid / List Cards */
  optionsGrid: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFFBF9',
  },
  optionCardDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.55,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionName: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1F2937',
  },
  optionNameSelected: {
    color: colors.primary,
    fontFamily: fontFamilies.bold,
  },
  optionDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 17,
  },
  unsupportedHint: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    color: '#EF4444',
    marginTop: 3,
    fontWeight: '600',
  },
  priceTag: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  priceTagFree: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 8,
  },
  priceTagSelected: {
    color: colors.primary,
  },

  /* Extra sauce toggle */
  extraSauceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
  },
  extraSauceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  extraSauceText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  extraSaucePrice: {
    fontFamily: fontFamilies.bold,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.primary,
  },

  /* Toppings Tab & Counters */
  toppingsCountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // "Đã chọn x/5" moves under the hint on narrow screens
    columnGap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toppingsCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  toppingsCountText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  categoryTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // 4 tabs are wider than a 320px phone; wrap so "Rau củ" stays tappable
    gap: 8,
    marginBottom: 12,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryTabTextActive: {
    fontFamily: fontFamilies.semiBold,
    color: '#FFFFFF',
  },

  /* Topping Row Card with Quantity Controls */
  toppingItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  toppingItemCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF9F7',
  },
  toppingItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  toppingName: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  toppingPrice: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperQtyText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    width: 26,
    textAlign: 'center',
  },
  addTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
  },
  addTopBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  /* Nhóm 5: Free Preferences Chips */
  prefSection: {
    marginBottom: 14,
  },
  prefLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipItemActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextActive: {
    fontFamily: fontFamilies.semiBold,
    color: colors.primary,
    fontWeight: '700',
  },

  /* Removed Ingredients List */
  removeIngredientsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  removeIngredientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  removeIngredientPillActive: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  removeIngredientText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    fontWeight: '500',
    color: '#374151',
  },
  removeIngredientTextActive: {
    fontFamily: fontFamilies.medium,
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },

  /* Special Instructions Input */
  noteInputWrap: {
    position: 'relative',
    marginTop: 4,
  },
  noteInput: {
    fontFamily: fontFamilies.regular,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    paddingBottom: 24,
    fontSize: 13.5,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  charCountText: {
    fontFamily: fontFamilies.medium,
    position: 'absolute',
    right: 10,
    bottom: 6,
    fontSize: 11,
    color: '#6B7280',
  },
});
