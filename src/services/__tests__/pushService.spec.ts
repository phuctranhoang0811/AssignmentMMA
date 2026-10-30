import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { notificationsModule, registerForOrderPush } from '../pushService';

const mockRequest = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../payosService', () => ({ request: (...args: unknown[]) => mockRequest(...args) }));
jest.mock('expo-constants', () => ({
  __esModule: true, default: { executionEnvironment: 'standalone', expoConfig: {}, easConfig: undefined },
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone' },
}));
jest.mock('expo-notifications', () => ({ __esModule: true,
  setNotificationChannelAsync: jest.fn(), AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })), requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[abcdefghijklmnop]' })),
}));
const mockConstants = Constants as unknown as { executionEnvironment: string; expoConfig: unknown };
const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
notificationsModule.load = async () => mockNotifications as never;

beforeEach(() => { jest.clearAllMocks(); mockConstants.executionEnvironment = 'standalone'; mockConstants.expoConfig = { extra: { eas: { projectId: 'p1' } } }; });

test('inside Expo Go nothing is requested, so the app keeps working', async () => {
  mockConstants.executionEnvironment = 'storeClient';
  await registerForOrderPush('u1');
  expect(mockRequest).not.toHaveBeenCalled();
});

test('without an EAS project id push is skipped', async () => {
  mockConstants.expoConfig = {};
  await registerForOrderPush('u1');
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test('a build with permission sends its Expo token to the backend for this account', async () => {
  await registerForOrderPush('u1');
  expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'p1' });
  expect(mockRequest).toHaveBeenCalledWith('/api/push/token', { method: 'POST', body: JSON.stringify({ token: 'ExponentPushToken[abcdefghijklmnop]' }) }, 'u1');
});

test('a refused permission, or a backend error, never throws or blocks sign-in', async () => {
  mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
  mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
  await registerForOrderPush('u1');
  expect(mockRequest).not.toHaveBeenCalled();
  mockRequest.mockRejectedValueOnce(new Error('offline'));
  await expect(registerForOrderPush('u1')).resolves.toBeUndefined();
});
