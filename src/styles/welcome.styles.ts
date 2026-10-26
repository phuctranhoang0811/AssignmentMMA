import { StyleSheet } from 'react-native';
import { fontFamilies } from '../theme/typography';

export const BRAND_RED = '#CF4226';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  heroContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#9A2113',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  titleRegular: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2024',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleBold: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    fontWeight: '800',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: BRAND_RED,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  guestButton: {
    marginTop: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    color: '#C0321F',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default styles;
