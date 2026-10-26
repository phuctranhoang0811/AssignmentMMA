import { StyleSheet, Platform } from 'react-native';

export const BRAND_RED = '#CF4226';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E2024',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },

  /* Step Indicator Bar */
  stepBarContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepCircleActive: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  stepCompletedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  stepLabelActive: {
    color: BRAND_RED,
    fontWeight: '700',
  },
  activeUnderline: {
    height: 2.5,
    width: '100%',
    backgroundColor: BRAND_RED,
  },

  /* Scroll and Content */
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  stepContent: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14.5,
    fontWeight: '500',
    color: '#1E2024',
    marginBottom: 8,
  },
  requiredStar: {
    color: BRAND_RED,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    fontSize: 15,
    color: '#1E2024',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  passwordHintText: {
    fontSize: 12,
    color: BRAND_RED,
    lineHeight: 17,
    marginTop: 6,
  },

  /* Date Row in Step 2 */
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePickerBtn: {
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  datePickerBtnText: {
    fontSize: 14,
    color: '#1E2024',
  },

  /* Checkboxes in Step 3 */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareActive: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    flex: 1,
  },
  checkboxLink: {
    textDecorationLine: 'underline',
    color: '#1F2937',
  },

  /* Primary Button */
  primaryBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#4B5563',
  },
  footerLinkHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_RED,
  },

  /* Step 4 Celebration */
  successContainer: {
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  popperWrapper: {
    marginBottom: 24,
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubheading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  /* OTP Modal Popup */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  otpTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
  },
  redBarDecor: {
    width: 44,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BRAND_RED,
    marginTop: 8,
    marginBottom: 14,
  },
  otpDescription: {
    fontSize: 13.5,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  otpEmailHighlight: {
    fontWeight: '700',
    color: '#111215',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  otpBox: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#111215',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: BRAND_RED,
  },
  resendText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  otpButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  otpCancelBtn: {
    width: '47%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCancelBtnText: {
    color: BRAND_RED,
    fontSize: 15,
    fontWeight: '700',
  },
  otpConfirmBtn: {
    width: '47%',
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpConfirmBtnActive: {
    backgroundColor: BRAND_RED,
  },
  otpConfirmBtnText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '700',
  },
  otpConfirmBtnTextActive: {
    color: '#FFFFFF',
  },

  /* Picker Modals */
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 280,
  },
  modalPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#1F2937',
  },
});

export default styles;
