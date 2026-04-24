// Dynamic Expo config — reads secrets from the environment so they are
// available in the client bundle via Constants.expoConfig.extra
// without needing to be prefixed EXPO_PUBLIC_.
// This file takes precedence over app.json.

const base = require("./app.json");

const googleClientId    = process.env.GOOGLE_CLIENT_ID    ?? null;
const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID ?? null;

console.error(
  "[Sortii Config] GOOGLE_CLIENT_ID:",    googleClientId    ? "present ✓" : "MISSING ✗"
);
console.error(
  "[Sortii Config] GOOGLE_IOS_CLIENT_ID:", googleIosClientId ? "present ✓" : "MISSING ✗"
);

module.exports = {
  ...base.expo,

  ios: {
    ...base.expo.ios,
    appleTeamId: "539W2H9SZV",
    bundleIdentifier: "app.replit.sortiiweeklymealplanner",
    infoPlist: {
      ...base.expo.ios.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  extra: {
    ...(base.expo.extra ?? {}),
    googleClientId,
    googleIosClientId,
  },
};
