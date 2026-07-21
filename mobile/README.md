# AgroYield (React Native)

Production-style mobile client for the Fruit Yield Estimator Django API. This folder is a standalone Expo + TypeScript app.

## Prerequisites

- Node.js 20+
- For devices: Expo Go, or Android Studio / Xcode for native builds

## Install

```bash
cd mobile
npm install
```

## Environment

1. Copy `.env.example` to `.env` in the `mobile` folder.
2. Set `EXPO_PUBLIC_API_BASE_URL` to your Django origin (no trailing slash).
3. Set `EXPO_PUBLIC_WEATHER_API_KEY` to a valid [OpenWeatherMap](https://openweathermap.org/api) key for live weather on Home and spray hints.

`app.config.ts` maps `EXPO_PUBLIC_*` into `expo.extra` for runtime access.

## Placeholder media

- **Hero / orchard imagery:** `src/constants/media.ts` points to a royalty-free Unsplash URL. Replace with `require('../assets/your-hero.jpg')` and add files under `assets/` for offline, branded photography.

## Run

```bash
npm run start
```

Then press `a` (Android), `i` (iOS simulator on macOS), or scan the QR code with Expo Go.

```bash
npm run android
npm run ios
```

### Android emulator and `localhost`

Use `http://10.0.2.2:8000` instead of `127.0.0.1` so the emulator reaches the host machine. For HTTP on Android 9+, you may need network security config in a custom dev client.

## Architecture (high level)

- `src/api` — RTK Query `agroApi`, typed DTOs, JWT refresh on 401 via `expo-secure-store`
- `src/features` — screens grouped by domain
- `src/components` — reusable UI (cards, weather header, task rows, etc.)
- `src/navigation` — boot → auth / main tabs + nested stacks
- `src/hooks` — weather resolution (farm coords → device GPS → manual cache)
- `src/theme` — colors, spacing, typography

## Orchard POST note

The backend `OrchardListSerializer` must accept all required orchard fields on create (`planting_density`, `tree_maturity`, etc.). If orchard creation returns 400, align the serializer with the model (this app already sends the full payload expected by the `Orchard` model and API contracts).
