import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { request } from './payosService';

// Remote push needs a development/production build with an EAS project id; Expo Go (Android) and web cannot
// receive it. In those cases this quietly does nothing and the in-app toast still covers an open app.
const supported = () => Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const projectId = () => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export async function registerForOrderPush(uid: string) {
  if (!supported() || !projectId()) return;
  try {
    const Notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Trạng thái đơn hàng', importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await request('/api/push/token', { method: 'POST', body: JSON.stringify({ token }) }, uid);
  } catch { /* Push is optional: never block sign-in or ordering. */ }
}

// Tapping a notification opens that order. The in-app toast already covers a foreground app, so no banner then.
export async function listenForOrderPush() {
  if (!supported()) return () => {};
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: true }),
  });
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const orderId = response.notification.request.content.data?.orderId;
    if (typeof orderId === 'string') router.push({ pathname: '/order/tracking', params: { orderId } });
  });
  return () => subscription.remove();
}
