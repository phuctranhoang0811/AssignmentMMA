import { Platform, TextStyle } from 'react-native';

export const fontFamilies = {
  sans: Platform.select({
    web: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
};

const FONT = fontFamilies.sans;

export const typography = {
  h1: {
    fontFamily: FONT,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  } as TextStyle,
  h2: {
    fontFamily: FONT,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontFamily: FONT,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,
  cardTitle: {
    fontFamily: FONT,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.1,
  } as TextStyle,
  bodyLarge: {
    fontFamily: FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  } as TextStyle,
  body: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0,
  } as TextStyle,
  bodyMedium: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    letterSpacing: 0,
  } as TextStyle,
  bodySemiBold: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: 0,
  } as TextStyle,
  caption: {
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0.1,
  } as TextStyle,
  captionMedium: {
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.1,
  } as TextStyle,
  captionSemiBold: {
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
  } as TextStyle,
  small: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  } as TextStyle,
  price: {
    fontFamily: FONT,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  } as TextStyle,
  priceLarge: {
    fontFamily: FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  } as TextStyle,
  button: {
    fontFamily: FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  } as TextStyle,
} as const;

