import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  return {
    ...config,
    name: config.name || 'Pizza FPT',
    slug: config.slug || 'pizza-fpt',
    plugins: [
      ...(config.plugins || []),
      ...(iosClientId ? [[
        '@react-native-google-signin/google-signin',
        { iosUrlScheme: `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}` },
      ] as [string, Record<string, string>]] : []),
    ],
    ios: {
      ...config.ios,
      ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}),
    },
  };
};
