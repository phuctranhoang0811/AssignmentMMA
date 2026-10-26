import { StyleSheet } from 'react-native';
import { fontFamilies } from '../theme/typography';

export const PRIMARY_COLOR = '#CF4226';
export const BRAND_RED = PRIMARY_COLOR;

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
    fontFamily: fontFamilies.bold,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  /* Membership Card (Màu đỏ chủ đạo Pizza FPT) */
  memberCard: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    marginBottom: 14,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  memberCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberBadgeWrap: {
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberTier: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  memberExpiry: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  memberCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 24,
  },
  statCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 46,
  },
  statUnit: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13.5,
    marginLeft: 4,
    marginBottom: 2,
  },

  /* Button: Hiển thị mã QR */
  qrOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrOutlineBtnText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '700',
  },

  /* Card Groups (White containers with rounded borders) */
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  menuIconCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 15.5,
    fontWeight: '500',
    color: '#1E2024',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F2',
    marginLeft: 58,
  },

  /* Xóa tài khoản */
  deleteAccountBtn: {
    marginTop: 18,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },

  /* Footer Copyright (Khi chưa đăng nhập) */
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  copyrightText: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 4,
  },
  versionText: {
    color: '#9CA3AF',
    fontSize: 12,
  },

  /* QR Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111215',
    marginTop: 8,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 18,
  },
  qrContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginBottom: 12,
  },
  memberIdText: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    letterSpacing: 2,
    marginBottom: 10,
  },
  modalInstruction: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  modalActionBtn: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default styles;
