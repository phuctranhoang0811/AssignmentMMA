import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

// Haptics are a nicety: some devices and Expo Go builds reject the call (e.g. notificationAsync is
// unavailable on some Android devices). The calls return promises, so a sync try/catch cannot see that
// rejection; swallow it here so it never surfaces as an "Uncaught (in promise)" error.
const safely = (feedback: () => Promise<void>) => {
  try { feedback().catch(() => {}); } catch { /* feedback unsupported */ }
};

export const triggerHaptic = (type: HapticType = 'light') => {
  if (Platform.OS === 'web') return;
  switch (type) {
    case 'light':
      return safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    case 'medium':
      return safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    case 'heavy':
      return safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    case 'success':
      return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    case 'warning':
      return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    case 'error':
      return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }
};
