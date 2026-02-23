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
