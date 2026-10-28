import { Platform, useWindowDimensions } from 'react-native';

// Above this width the app is shown as a centered phone-width column instead of stretching.
export const WIDE_BREAKPOINT = 600;
// Web on desktop/tablet: phone frame (rootLayout.styles phoneFrame: maxWidth 450, border 7 each side).
export const WEB_FRAME_WIDTH = 450;
const WEB_FRAME_BORDER = 7;
// Native tablets: centered column.
export const NATIVE_COLUMN_WIDTH = 600;

export function layoutMode(width: number): 'phone' | 'webFrame' | 'nativeColumn' {
  if (width <= WIDE_BREAKPOINT) return 'phone';
  return Platform.OS === 'web' ? 'webFrame' : 'nativeColumn';
}

/** Width actually available to screens, which differs from the window on desktop web and tablets. Updates on rotation. */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  const mode = layoutMode(width);
  if (mode === 'webFrame') return WEB_FRAME_WIDTH - WEB_FRAME_BORDER * 2;
  if (mode === 'nativeColumn') return NATIVE_COLUMN_WIDTH;
  return width;
}
