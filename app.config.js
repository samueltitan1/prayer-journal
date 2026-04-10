const appJson = require("./app.json");

module.exports = ({ config }) => {
  const expoConfig = appJson.expo ?? config ?? {};
  return {
    ...expoConfig,
    extra: {
      ...(expoConfig.extra ?? {}),
      google: {
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? null,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? null,
      },
      revenuecat: {
        iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? null,
        androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? null,
      },
    },
  };
};
