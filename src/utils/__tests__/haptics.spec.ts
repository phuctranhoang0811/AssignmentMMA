import * as Haptics from 'expo-haptics';
import { triggerHaptic } from '../haptics';

test('a rejected haptic call never surfaces as an unhandled rejection', async () => {
  (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('not available on android'));
  const unhandled = jest.fn();
  process.on('unhandledRejection', unhandled);
  expect(() => triggerHaptic('success')).not.toThrow();
  await new Promise(resolve => setTimeout(resolve, 20));
  process.off('unhandledRejection', unhandled);
  expect(unhandled).not.toHaveBeenCalled();
});

test('each haptic type reaches the matching expo-haptics call', () => {
  triggerHaptic('light');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  triggerHaptic('error');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
});
