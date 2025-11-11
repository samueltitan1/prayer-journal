# Prayer Journal

A mobile app for recording and reflecting on prayers, built with Expo Router.

## Project Structure

```
app/
├── _layout.tsx              # Root layout
├── index.tsx                # Splash screen
├── onboarding/              # Onboarding flow
│   ├── _layout.tsx
│   ├── 1.tsx
│   ├── 2.tsx
│   ├── 3.tsx
│   ├── reminder.tsx
│   └── reminder2.tsx
├── auth/                    # Authentication
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/                  # Main app tabs
│   ├── _layout.tsx
│   ├── pray/                # Prayer recording
│   │   ├── index.tsx
│   │   ├── recording.tsx
│   │   └── saved.tsx
│   └── journal/             # Journal view
│       ├── index.tsx
│       └── entry.tsx
├── settings.tsx             # Settings screen
└── paywall.tsx              # Subscription screen
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on iOS:
```bash
npm run ios
```

4. Run on Android:
```bash
npm run android
```

5. Run on Web:
```bash
npm run web
```

## Features

- Prayer recording interface
- Journal with calendar view
- Weekly and monthly reflections
- Settings and preferences
- Subscription management

## Tech Stack

- Expo Router (file-based routing)
- React Native
- TypeScript

