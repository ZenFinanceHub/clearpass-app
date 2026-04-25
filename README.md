# ClearPass

UK driving theory test prep app — Expo React Native monorepo.

## Setup

```
npm install
cd apps/mobile && npm install
```

## Environment variables

The AI tutor feature requires an Anthropic API key. Create `apps/mobile/.env.local` (this file is git-ignored and must never be committed):

```
ANTHROPIC_API_KEY=your_key_here
```

Get a key at https://console.anthropic.com. Without a key the AI tutor falls back to a plain-text hint.

## Running

```
cd apps/mobile
npx expo start --clear
```
