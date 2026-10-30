const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Hỗ trợ Firebase CJS modules
config.resolver.sourceExts.push('cjs');

// OTP e-mail moved to the backend (POST /api/otp/send); see backend/.env.example.
module.exports = config;
