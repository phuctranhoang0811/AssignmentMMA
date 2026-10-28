import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const BRAND_RED = colors.primary;

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 110,
  },

  /* Header */
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerPlaceholder: {
    width: 36,
  },
  headerLogoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 6,
  },
  headerBrandImg: {
    width: 114,
    height: 25,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: BRAND_RED,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Promotional Carousel Banner */
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  bannerCard: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E63946',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bannerTagBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bannerTagText: {
    color: BRAND_RED,
    fontSize: 13,
    fontWeight: '800',
  },
  bannerPriceTag: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  memberDiscountPill: {
    backgroundColor: '#FFE500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberDiscountText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: BRAND_RED,
    width: 16,
    borderRadius: 3,
  },

  /* Greeting & Delivery Card */
  greetingSection: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  greetingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  locationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111215',
  },
  locationDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_RED,
  },

  /* Horizontal Pizza Scroll */
  horizontalPizzaScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 24,
  },
  pizzaCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pizzaCardImg: {
    width: '100%',
    height: 130,
  },
  pizzaCardInfo: {
    padding: 12,
  },
  pizzaCardName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E2024',
    height: 38,
  },
  pizzaCardPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  fromText: {
    fontSize: 11,
    color: '#6B7280',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111215',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Categories Chips */
  categoriesScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: BRAND_RED,
  },
  categoryChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  /* Menu Promo Cards Carousel */
  menuPromoScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 20,
  },
  menuPromoCard: {
    width: 132,
    height: 144,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  menuPromoImg: {
    width: '100%',
    height: 104,
    backgroundColor: '#F3F4F6',
  },
  menuPromoLabelBox: {
    height: 38,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
  },
  menuPromoLabelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A1D20',
    textAlign: 'center',
  },
  memberDealGraphic: {
    width: '100%',
    height: 104,
    backgroundColor: '#DE3B2B',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  memberDealTopText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 5,
  },
  memberDealTicket: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFC8C8',
    borderStyle: 'dashed',
  },
  memberDealTicketText: {
    color: '#DE3B2B',
    fontSize: 10.5,
    fontWeight: '900',
  },
  myBoxGraphic: {
    width: '100%',
    height: 104,
    backgroundColor: '#921A12',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  myBoxTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  myBoxSub: {
    color: '#FFBABA',
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },

  /* Action Cards & Connect Section */
  actionCardsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F242D',
  },
  actionSubtitle: {
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 2,
  },
  connectSectionTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#111827',
    marginTop: 14,
    marginBottom: 14,
  },

  /* Lunch Combo Banner */
  stickyComboWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  lunchComboBanner: {
    backgroundColor: BRAND_RED,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lunchLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  lunchTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 6,
  },
  lunchSub: {
    color: '#FFE0DC',
    fontSize: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timerNum: {
    color: BRAND_RED,
    fontSize: 13,
    fontWeight: '800',
  },
  timerColon: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginHorizontal: 4,
  },
  lunchArrow: {
    padding: 4,
  },

  /* 3/4 LUNCH COMBO BOTTOM SHEET STYLES */
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    height: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 20,
  },
  sheetHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetBannerWrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  simpleMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  simpleMenuImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  simpleMenuInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    minHeight: 78,
  },
  simpleMenuName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  simpleMenuDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  simpleMenuPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  simpleNewPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND_RED,
  },
  simpleOldPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  simpleAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default styles;
