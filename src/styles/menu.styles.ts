import { StyleSheet } from 'react-native';

export const ACTIVE_TAB_RED = '#C62828';
export const BRAND_RED = ACTIVE_TAB_RED;

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  /* 1. Header */
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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

  /* 2. Category Tabs */
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDEDED',
  },
  tabsList: {
    paddingHorizontal: 8,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 80,
  },
  activeTabItem: {},
  tabIconWrap: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A4A',
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: ACTIVE_TAB_RED,
    fontWeight: '800',
  },
  activeTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: ACTIVE_TAB_RED,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  /* 3. Search Bar */
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E2024',
  },

  /* 4. Continuous Category Section */
  listContent: {
    paddingBottom: 50,
  },
  categorySection: {
    marginBottom: 20,
  },
  sectionHeaderDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ECECEC',
  },
  sectionHeaderTitle: {
    marginHorizontal: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2024',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  /* Banner */
  bannerCard: {
    height: 120,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#C62828',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.88,
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(183, 28, 28, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  bannerBadgeBox: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  bannerBadgeText: {
    color: '#B71C1C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  bannerHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubheadline: {
    color: '#FFEAEA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* Products */
  sectionProductsList: {
    paddingTop: 2,
  },
  cardOuter: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  memberTagWrapper: {
    marginBottom: -6,
    zIndex: 2,
  },
  memberTag: {
    backgroundColor: '#C62828',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  memberTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrapper: {
    width: 104,
    height: 104,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  infoWrapper: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-between',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2024',
    lineHeight: 20,
  },
  productDesc: {
    fontSize: 12,
    color: '#666666',
    marginTop: 3,
    lineHeight: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  newBadge: {
    backgroundColor: '#C62828',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  spicyIcon: {
    fontSize: 13,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },
  priceNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2024',
  },
  originalPrice: {
    fontSize: 12,
    color: '#9E9E9E',
    textDecorationLine: 'line-through',
  },
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACTIVE_TAB_RED,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACTIVE_TAB_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },

  /* Empty & Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2024',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },

  /* Modal Ưu Đãi Thành Viên */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalConfirmButton: {
    backgroundColor: ACTIVE_TAB_RED,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default styles;
