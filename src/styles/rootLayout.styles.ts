import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { NATIVE_COLUMN_WIDTH, WEB_FRAME_WIDTH } from '../utils/layout';

export const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileContent: {
    flex: 1,
  },
  // Native tablets: keep the phone-designed screens readable in a centered column.
  tabletCanvas: {
    alignItems: 'center',
    backgroundColor: '#EAEAE5',
  },
  tabletColumn: {
    width: '100%',
    maxWidth: NATIVE_COLUMN_WIDTH,
    backgroundColor: colors.background,
  },
  desktopCanvas: {
    flex: 1,
    backgroundColor: '#EAEAE5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_FRAME_WIDTH,
    backgroundColor: colors.background,
    overflow: 'hidden',
    height: '100%',
    maxHeight: 900,
    borderRadius: 36,
    borderWidth: 7,
    borderColor: '#1C1C1E',
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
  },
  notchContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  dynamicIsland: {
    width: 90,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
  },
});

export default styles;
