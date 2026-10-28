import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design base width (iPhone 13 / 14 / 15 standard)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const isIos = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const isSmallDevice = SCREEN_WIDTH < 375;
export const isStandardDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH <= 414;
export const isLargeDevice = SCREEN_WIDTH > 414;
export const isTablet = SCREEN_WIDTH >= 600 || SCREEN_WIDTH / SCREEN_HEIGHT > 0.7;

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

/**
 * Linear horizontal scaling based on 390pt baseline
 */
export const scale = (size: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * size));
};

/**
 * Linear vertical scaling based on 844pt baseline
 */
export const verticalScale = (size: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel((SCREEN_HEIGHT / BASE_HEIGHT) * size));
};

/**
 * Moderate scaling with damping factor (default 0.5) to avoid oversized/undersized text
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor));
};

/**
 * Width percentage helper
 */
export const wp = (percentage: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel((SCREEN_WIDTH * percentage) / 100));
};

/**
 * Height percentage helper
 */
export const hp = (percentage: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel((SCREEN_HEIGHT * percentage) / 100));
};

/**
 * Safe bottom space helper for sticky footers and bottom bars
 */
export const getBottomSpace = (insetsBottom: number, fallback = 12): number => {
  return Math.max(insetsBottom, fallback);
};
