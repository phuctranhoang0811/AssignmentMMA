// Screens import Firebase and the backend client at module load; stub them so component tests stay offline.
jest.mock('./src/services/firebase', () => ({ auth: { currentUser: null, authStateReady: async () => {} }, db: {} }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}), notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
// lucide-react-native ships an .mjs build Jest cannot load; icons are decoration, so render nothing for them.
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_target, name) => (name === '__esModule' ? true : () => null) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
