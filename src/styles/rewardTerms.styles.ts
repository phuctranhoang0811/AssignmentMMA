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
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  /* Logo Section (Screenshot 1) */
  logoSection: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 18,
  },

  /* Red Main Banner Box (Screenshot 1) */
  redBannerBox: {
    backgroundColor: BRAND_RED,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 22,
  },
  bannerHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 18,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    marginBottom: 16,
    minHeight: 118,
    position: 'relative',
    overflow: 'hidden',
  },
  stepCardLast: {
    marginBottom: 0,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_RED,
  },
  stepDesc: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    paddingRight: 48,
  },
  stepBigNumber: {
    position: 'absolute',
    right: 12,
    bottom: -10,
    fontSize: 64,
    fontWeight: '800',
    color: BRAND_RED,
    lineHeight: 68,
  },

  /* Divider line before Tier Tabs */
  sectionTopBorder: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 28,
  },

  /* 3 Tier Tabs (Cơ Bản | Vàng | VIP) */
  tierTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#F6F7F9',
    height: 62,
  },
  tierTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 6,
  },
  tierTabLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  tierTabLabelActive: {
    color: BRAND_RED,
    fontWeight: '600',
  },
  tierTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: BRAND_RED,
  },

  /* 2 Benefit Icons Row (Screenshots 2, 4, 5) */
  benefitIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 22,
  },
  benefitIconCol: {
    flex: 1,
    alignItems: 'center',
  },
  benefitIconBox: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIconTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
  },

  /* Gray Benefit Details Card */
  benefitDetailCard: {
    backgroundColor: '#F5F5F8',
    marginHorizontal: 22,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 24,
  },
  detailSectionHeading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  detailSectionHeadingSpaced: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginTop: 14,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
    marginTop: 8,
    marginRight: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    color: '#1F2937',
  },

  /* Maturity Date Card (Screenshot 3) */
  maturityCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
    marginTop: 4,
  },
  maturityHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 18,
  },

  /* Bottom Link */
  bottomTermsBtn: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  bottomTermsText: {
    fontSize: 16,
    fontWeight: '500',
    color: BRAND_RED,
    textDecorationLine: 'underline',
  },
});

export default styles;

