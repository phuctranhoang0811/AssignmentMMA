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
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 72,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  readAllButton: {
    width: 72,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  readAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: BRAND_RED,
  },
  tabsWrapper: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabButtonActive: {
    backgroundColor: BRAND_RED,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyWrap: {
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#111827',
    textAlign: 'center',
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 40,
  },
  swipeRowWrapper: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
  },
  notificationCardUnread: {
    backgroundColor: '#FFFFFF',
  },
  iconBoxPink: {
    width: 92,
    height: 92,
    borderRadius: 4,
    backgroundColor: '#FDF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconBoxLogo: {
    width: 92,
    height: 92,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    height: 88,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  moreText: {
    fontSize: 13,
    fontWeight: '500',
    color: BRAND_RED,
  },
  deleteActionBtn: {
    width: 84,
    height: 96,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMoreText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  guestPromptWrap: {
    paddingTop: 140,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  guestPromptText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  guestLoginBtn: {
    width: '100%',
    height: 50,
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestLoginBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default styles;
