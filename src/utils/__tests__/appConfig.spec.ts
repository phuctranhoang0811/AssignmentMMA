import createConfig from '../../../app.config';

const base = { name: 'Pizza FPT', slug: 'pizza-fpt', plugins: ['expo-router'], ios: { supportsTablet: true } };
const build = () => createConfig({ config: base as never, projectRoot: '.', staticConfigPath: null, packageJsonPath: null });
// The config module keeps a reference to process.env, so restore the variables in place instead of replacing the object.
const KEYS = ['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'IOS_BUNDLE_IDENTIFIER'] as const;
const saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
afterEach(() => { for (const key of KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });

test('without an iOS client ID the Google plugin is left out and the static config is kept', () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  delete process.env.IOS_BUNDLE_IDENTIFIER;
  const config = build();
  expect(config.plugins).toEqual(['expo-router']);
  expect(config.ios).toEqual({ supportsTablet: true });
  expect(config.slug).toBe('pizza-fpt');
});

test('an iOS client ID adds the Google plugin with the reversed client ID as URL scheme', () => {
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ' 123-abc.apps.googleusercontent.com ';
  expect(build().plugins).toEqual(['expo-router', ['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.123-abc' }]]);
});

test('the iOS bundle identifier comes from the environment', () => {
  process.env.IOS_BUNDLE_IDENTIFIER = 'com.pizzatime.app';
  expect(build().ios).toEqual({ supportsTablet: true, bundleIdentifier: 'com.pizzatime.app' });
});
