# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Maps setup (Google + fallback)

The app supports provider selection with `MAPS_PROVIDER`:

- `google`: use Google Maps Platform APIs
- `auto`: use Google if `GOOGLE_MAPS_API_KEY` exists, otherwise OpenStreetMap/OSRM fallback
- `osm`: force OpenStreetMap/OSRM

### Local env

Create/update `.env.local`:

```bash
MAPS_PROVIDER=auto
GOOGLE_MAPS_API_KEY=your_google_key
```

Then restart:

```bash
npx convex dev
npx expo start
```

### Convex deployment env (prod/staging)

Set secrets in Convex too (recommended for hosted deployments):

```bash
npx convex env set MAPS_PROVIDER google
npx convex env set GOOGLE_MAPS_API_KEY your_google_key
```

## Google API restrictions (recommended)

Use one backend key restricted to these APIs only:

- Places API
- Place Details API
- Directions API

Recommended restrictions in Google Cloud Console:

1. Go to **APIs & Services** -> **Credentials** -> your key.
2. In **Application restrictions**, choose **IP addresses**.
3. Add server egress IP(s):
   - local dev: your public IP (temporary)
   - production: your backend/Convex egress IP(s)
4. In **API restrictions**, choose **Restrict key** and select only:
   - Places API
   - Place Details API
   - Directions API
5. Save and wait a few minutes for propagation.

If your infra has no stable outbound IP in dev, keep the key unrestricted only temporarily and still keep API restrictions enabled.

## OAuth setup (Google + Apple)

The profile screen now supports:

- Complete local profile creation (name, phone, full address)
- Sign in with Google (iOS, Android, Web)
- Sign in with Apple (iOS only)

### Required env vars

Add these values in `.env.local`:

```bash
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

### Google Cloud Console (activate Google auth)

1. Open Google Cloud Console and select/create a project.
2. Go to **APIs & Services -> OAuth consent screen**.
3. Configure app name, support email, developer email.
4. Add scopes: `openid`, `email`, `profile`.
5. Add test users while the app is in testing mode.
6. Go to **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**.
7. Create clients for each platform:
   - Web application -> copy client id to `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - iOS -> copy client id to `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - Android -> copy client id to `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
8. For Expo development flow, also create/copy an Expo client id and set `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`.
9. Save, wait 1-5 minutes, then restart Expo.

### Apple sign in (iOS)

1. In Apple Developer, enable **Sign in with Apple** for your App ID.
2. Ensure the iOS bundle identifier matches `app.json` (`com.jojo946.colib`).
3. Build a development client or production build (Apple sign in is not available in plain Expo Go).
