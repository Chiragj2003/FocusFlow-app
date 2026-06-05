const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// Refreshing Metro cache for expo-notifications and netinfo
module.exports = withNativeWind(config, { input: './global.css' });
