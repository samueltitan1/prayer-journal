const appJson = require("./app.json");

module.exports = ({ config }) => {
  const expoConfig = appJson.expo ?? config ?? {};
  const baseExtra = expoConfig.extra ?? {};
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? null;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? null;
  const revenuecatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? null;
  const revenuecatAndroidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? null;

  return {
    ...expoConfig,
    extra: {
      ...baseExtra,
      googleWebClientId,
      googleIosClientId,
      google: {
        ...(typeof baseExtra.google === "object" && baseExtra.google ? baseExtra.google : {}),
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId,
      },
      revenuecatIosApiKey,
      revenuecatAndroidApiKey,
      revenuecat: {
        ...(typeof baseExtra.revenuecat === "object" && baseExtra.revenuecat
          ? baseExtra.revenuecat
          : {}),
        iosApiKey: revenuecatIosApiKey,
        androidApiKey: revenuecatAndroidApiKey,
      },
    },
  };
};
