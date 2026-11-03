import { StyleSheet } from 'react-native';

export const BRAND_RED = '#CF4226';

// Floating cart: 58px tall, 14px above the tab bar (68px on Home, above its own bar).
// Tab screens pad their scroll content by this much so the last item can scroll clear of it.
const FLOATING_CART_SIZE = 58;
export const FLOATING_CART_OFFSET = 14;
export const FLOATING_CART_OFFSET_HOME = 68;
export const FLOATING_CART_CLEARANCE = FLOATING_CART_OFFSET + FLOATING_CART_SIZE + 16;
export const FLOATING_CART_CLEARANCE_HOME = FLOATING_CART_OFFSET_HOME + FLOATING_CART_SIZE + 16;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingCartWrap: {
    position: 'absolute',
    right: 18,
    zIndex: 9999,
  },
  floatingCartBtn: {
    width: FLOATING_CART_SIZE,
    height: FLOATING_CART_SIZE,
    borderRadius: FLOATING_CART_SIZE / 2,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BRAND_RED,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default styles;
