import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'AgroYield',
  slug: 'agroyield',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1B4332',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.agrotech.agroyield',
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Select orchard photos for yield estimation.',
      NSCameraUsageDescription: 'Capture orchard photos for yield estimation.',
      NSLocationWhenInUseUsageDescription:
        'Location is used for field-accurate weather when farm coordinates are not set.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1B4332',
    },
    package: 'com.agrotech.agroyield',
    edgeToEdgeEnabled: true,
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow AgroYield to use your device location for local weather forecasts.',
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000',
    weatherApiKey: process.env.EXPO_PUBLIC_WEATHER_API_KEY ?? '',
    openWeatherBaseUrl:
      process.env.EXPO_PUBLIC_OPENWEATHER_BASE_URL ?? 'https://api.openweathermap.org/data/2.5',
  },
});
