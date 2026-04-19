// Dynamic Expo config — reads secrets from the environment so they are
// available in the client bundle via Constants.expoConfig.extra
// without needing to be prefixed EXPO_PUBLIC_.
// This file takes precedence over app.json.

const base = require("./app.json");

module.exports = {
  ...base.expo,
  extra: {
    ...(base.expo.extra ?? {}),
    googleClientId:    process.env.GOOGLE_CLIENT_ID    ?? null,
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? null,
  },
};
