const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Hỗ trợ Firebase CJS modules và tắt package exports để resolve đúng firebase/auth, firestore trên React Native
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
