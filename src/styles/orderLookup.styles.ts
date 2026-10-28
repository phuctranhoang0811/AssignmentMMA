import { StyleSheet } from 'react-native';

export const BRAND_RED = '#CF4226';

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
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  searchButton: {
    height: 50,
    backgroundColor: BRAND_RED,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginButton: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: BRAND_RED,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: BRAND_RED,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* DETAIL VIEW STYLES (MATCHING CHECKOUT SUCCESS EXACTLY) */
  detailHeaderBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  orderSuccessScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
  },
  orderSuccessHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  orderSuccessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  orderSuccessSubtitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  orderSuccessCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 4,
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
    marginBottom: 16,
  },
  primaryActionButton: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BRAND_RED,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_RED,
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
