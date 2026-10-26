import { StyleSheet } from 'react-native';
import { fontFamilies } from '../theme/typography';

export const BRAND_RED = '#CF4226';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 90,
  },

  /* Header */
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 36,
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerRightBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptBox: {
    width: 22,
    height: 22,
    borderWidth: 1.8,
    borderColor: '#4B5563',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  receiptLine: {
    width: '100%',
    height: 1.6,
    backgroundColor: '#4B5563',
    marginVertical: 1.2,
    borderRadius: 1,
  },

  /* Member Card */
  memberCard: {
    backgroundColor: BRAND_RED,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 18,
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBadgeWrap: {
    marginRight: 12,
  },
  fanBadgeImg: {
    width: 44,
    height: 32,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTierTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardExpireSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 2,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 22,
    paddingTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statNumber: {
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    marginLeft: 6,
    fontWeight: '500',
  },

  /* Segmented Filter Tabs */
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentBtnActive: {
    backgroundColor: BRAND_RED,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Items List (Danh sách) */
  itemsListContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemImageWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: 68,
    height: 68,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
  },
  itemPoints: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  redeemButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  /* Quà của tôi tab */
  giftTabContainer: {
    padding: 16,
  },
  voucherCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  voucherLeft: {
    width: 90,
    backgroundColor: BRAND_RED,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  voucherPercent: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  voucherOffText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  voucherRight: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  voucherTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  voucherDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  voucherExpiry: {
    fontSize: 11,
    color: BRAND_RED,
    fontWeight: '600',
    marginTop: 6,
  },

  /* Lịch sử tab */
  historyTabContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    marginTop: 30,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptyHistorySub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 240,
  },
});

export default styles;
