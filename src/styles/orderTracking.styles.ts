import { StyleSheet } from 'react-native';

export const BRAND_RED = '#CF4226';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '400',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    minHeight: '100%',
  },

  /* ======================================================== */
  /* BẢN NHỎ NHỎ (EXACT SAME AS PHOTO 1)                      */
  /* ======================================================== */
  orderCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLeftCol: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  cardLeftLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  cardLeftTime: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_RED,
    marginTop: 4,
    textAlign: 'center',
  },
  cardRightCol: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  cardRightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardOrderCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardOrderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardOrderStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 3,
  },
  cardAddressText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginTop: 3,
  },
  cardBoldPrefix: {
    fontWeight: '700',
    color: '#111827',
  },
  cardPaymentText: {
    fontSize: 13,
    color: '#374151',
    marginTop: 3,
  },
  cardDetailLink: {
    color: BRAND_RED,
    fontWeight: '600',
  },

  /* ======================================================== */
  /* TRANG CHI TIẾT (EXACT SAME AS PHOTOS 2 & 3)             */
  /* ======================================================== */
  detailScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  orderSuccessHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  orderSuccessTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  orderSuccessSubtitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 28,
  },
  orderSuccessCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 6,
  },
  orderSuccessDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  actionButtonsContainer: {
    marginVertical: 16,
  },
  primaryActionButton: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  infoDeliveryTime: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 20,
  },
  orderTimestampText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  orderItemRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderItemMainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  orderItemQty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 8,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  orderItemOptions: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rewardPointsNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  contactSupportSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 6,
  },
  supportHotline: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND_RED,
    marginBottom: 10,
  },
  supportNotice: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
});

export default styles;
