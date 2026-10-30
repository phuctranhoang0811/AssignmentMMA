import { StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamilies } from '../theme/typography';

export const BRAND_RED = colors.primary;

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    width: 36,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  /* White Section Blocks */
  whiteSectionBlock: {
    backgroundColor: '#FFFFFF',
  },
  sectionDividerGap: {
    height: 8,
    backgroundColor: '#F4F5F7',
  },

  /* Cart Count Heading */
  cartCountHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  /* Cart Items */
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemImageContainer: {
    position: 'relative',
    width: 76,
    height: 76,
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  discountBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: BRAND_RED,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 6,
  },
  discountBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discountBadgePercent: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 14,
  },
  itemTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  itemQuantity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemSubName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  itemOptions: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 2,
  },
  itemBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemAction: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  editActionText: {
    fontSize: 15,
    color: BRAND_RED,
    fontWeight: '600',
  },
  deleteActionText: {
    fontSize: 15,
    color: BRAND_RED,
    fontWeight: '600',
  },
  itemPriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  /* "Bạn sẽ thích" Section */
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  recommendationsList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 14,
  },
  recCard: {
    width: 290,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    alignItems: 'center',
  },
  recImage: {
    width: 78,
    height: 78,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  recContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  recTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  recDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  recBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  recPrice: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  recAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Option Rows: Full-width matching Pizza Hut mockup */
  fullWidthOptionRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  optionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 16,
  },
  voucherActionText: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 14,
    color: BRAND_RED,
    fontWeight: '400',
    marginRight: 6,
  },
  cutleryActionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '400',
    marginRight: 6,
  },

  /* Pricing Breakdown */
  pricingSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rewardPointsNote: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  /* Bottom Sticky Bar */
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  freeShipHintRow: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  freeShipHintText: {
    fontSize: 13,
    color: '#374151',
  },
  checkoutBtn: {
    backgroundColor: BRAND_RED,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  checkoutBtnText: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  comboBanner: {
    backgroundColor: BRAND_RED,
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  comboBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  comboBannerSub: {
    color: '#FFFFFF',
    fontSize: 11,
    marginRight: 4,
  },
  timerBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  timerDigit: {
    color: BRAND_RED,
    fontSize: 12,
    fontWeight: '800',
  },
  timerColon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* SCREEN: MÃ GIẢM GIÁ */
  modalFullContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  voucherHeader: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  voucherBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voucherInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  voucherApplyBtn: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: '#EAEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherApplyBtnActive: {
    backgroundColor: BRAND_RED,
  },
  voucherApplyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B3BC',
  },
  voucherApplyBtnTextActive: {
    color: '#FFFFFF',
  },
  voucherSubheading: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 20,
  },
  emptyVoucherBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyVoucherTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 18,
  },
  emptyVoucherSubtitle: {
    fontSize: 13.5,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  quickVouchersWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  quickVouchersLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND_RED,
  },
  appliedVoucherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  appliedVoucherCode: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_RED,
  },
  appliedVoucherTitle: {
    fontSize: 12.5,
    color: '#4B5563',
    marginTop: 2,
  },
  removeVoucherBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeVoucherText: {
    fontSize: 13,
    color: BRAND_RED,
    fontWeight: '600',
  },
  voucherBottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  voucherDoneBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* MODAL: MUỖNG NĨA NHỰA */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  cutlerySheet: {
    backgroundColor: '#FFFFFF',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  cutleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cutleryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cutleryCloseBtn: {
    padding: 4,
  },
  recycleIconWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  cutleryDescLine1: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  cutleryBullet: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginTop: 4,
    paddingLeft: 4,
  },
  cutleryDescLine2: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginTop: 14,
  },
  cutleryCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },
  cutleryApplyBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cutleryApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Empty Cart State */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: BRAND_RED,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ======================================================== */
  /* MODAL XÁC NHẬN XÓA MÓN                                  */
  /* ======================================================== */
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  deleteModalRedLine: {
    width: 44,
    height: 3,
    backgroundColor: '#C62828',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 16,
  },
  deleteModalMessage: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
    lineHeight: 22,
  },
  deleteModalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  deleteModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalCancelBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  deleteModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  deleteModalConfirmBtn: {
    backgroundColor: '#C62828',
  },
  deleteModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default styles;
