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
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
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
  actionButton: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E2024',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  saveButtonText: {
    color: BRAND_RED,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E2024',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  inputBox: {
    backgroundColor: '#E1E4EE',
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputBoxEditing: {
    backgroundColor: '#EBF0F8',
    borderWidth: 1.5,
    borderColor: BRAND_RED,
  },
  dropdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 15,
    color: '#1E2024',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },

  /* Modal chọn giới tính */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2024',
    marginBottom: 14,
    textAlign: 'center',
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  genderOptionText: {
    fontSize: 15,
    color: '#1E2024',
  },
  genderOptionSelectedText: {
    color: BRAND_RED,
    fontWeight: '700',
  },
});

export default styles;
