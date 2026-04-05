# Prayer Journal

Prayer Journal is an Expo/React Native app for guided prayer, voice/text journaling, reflections, and subscription-gated access.

## Current App Structure

```text
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
│   ├── _layout.tsx
│   ├── reset-password.tsx
│   └── onboarding/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── welcome.tsx
│       ├── survey.tsx
│       ├── privacy.tsx
│       ├── apple-health.tsx
│       ├── reminder.tsx
│       ├── biometric-setup.tsx
│       ├── preparing.tsx
│       ├── congratulations.tsx
│       ├── signup.tsx
│       ├── login.tsx
│       ├── paywall.tsx
│       ├── confirm-email.tsx
│       └── splash.tsx
└── (tabs)/
    ├── _layout.tsx
    ├── pray/index.tsx
    └── journal/index.tsx
```

## Widget

iOS widget source lives in:

```text
widget/PrayerJournalWidget/
```

The custom config plugin copies widget files into `ios/PrayerJournalWidget` during prebuild:

- `plugins/withPrayerJournalWidget.js`

Important: treat `widget/PrayerJournalWidget` as source of truth for widget changes.

## Supabase

Supabase assets in this repo:

```text
supabase/
├── migrations/
└── functions/
    ├── transcribe
    ├── ocr
    ├── generate_reflection
    ├── validate-apple-subscription
    ├── sync-revenuecat-subscription
    └── revenuecat-webhook
```

## Environment Variables

### App (`EXPO_PUBLIC_*`)

- `EXPO_PUBLIC_SUPABASE_URL` (or `EXPO_PUBLIC_SUPABASE_URL_PUBLIC`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (or `EXPO_PUBLIC_SUPABASE_ANON_KEY_PUBLIC`)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` (optional, defaults to `pro`)
- `EXPO_PUBLIC_REVENUECAT_DEBUG_LOGS` (optional; `1` to enable debug logs in dev)

### Supabase Edge Function Secrets

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`
- `REVENUECAT_WEBHOOK_AUTH`
- `AZURE_VISION_ENDPOINT`
- `AZURE_VISION_KEY`
- `APPLE_ISSUER_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_BUNDLE_ID`

## Local Development

Install:

```bash
npm install
```

Run:

```bash
npm run start
npm run ios
npm run android
npm run web
```

Typecheck:

```bash
npx tsc --noEmit
```

## Build & Release Notes

- EAS is configured with remote app versioning (`eas.json` -> `"appVersionSource": "remote"`).
- Production profile uses `autoIncrement`.
- iOS widget is included via custom plugin and EAS app extension config.

## Subscription / Access Model

- Canonical subscription state is stored in `public.subscriptions`.
- RevenueCat sync updates subscription status.
- Entitlement checks read subscription status plus override fields.
- Permanent/manual grants are supported through:
  - `access_override`
  - `access_override_reason`
  - `access_override_expires_at`

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- Supabase
- RevenueCat
- TypeScript
