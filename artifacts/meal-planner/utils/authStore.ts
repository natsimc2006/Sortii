import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Not user-scoped — needed before the user ID is known
const AUTH_STATE_KEY = "sortii:auth:v1";

export interface AuthUser {
  id: string;            // "google_109234567" | "apple_001234.abc.xyz"
  provider: "google" | "apple";
  email?: string;
  displayName?: string;
  signedInAt: number;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch { return null; }
}

export async function saveAuthUser(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify(user));
}

export async function clearAuthUser(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STATE_KEY);
}

/**
 * Google sign-in for identity.
 * Reuses the existing OAuth flow from googleCalendar.ts, then fetches
 * the Google user sub ID to construct a stable userId.
 */
export async function signInWithGoogleAuth(): Promise<AuthUser | null> {
  try {
    const { signInWithGoogle } = await import("./googleCalendar");
    const token = await signInWithGoogle();
    if (!token) return null;

    const infoRes = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`
    );
    if (!infoRes.ok) return null;
    const info = (await infoRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
    };
    if (!info.id) return null;

    const user: AuthUser = {
      id: `google_${info.id}`,
      provider: "google",
      email: info.email,
      displayName: info.name,
      signedInAt: Date.now(),
    };
    await saveAuthUser(user);
    return user;
  } catch { return null; }
}

/**
 * Apple Sign In — iOS native only.
 * On web or if package unavailable, returns null.
 * Web users see a friendly message on the sign-in screen.
 */
export async function signInWithAppleAuth(): Promise<AuthUser | null> {
  if (Platform.OS !== "ios") return null;
  try {
    const AppleAuth = await import("expo-apple-authentication");
    const isAvail = await (AppleAuth as any).isAvailableAsync?.();
    if (!isAvail) return null;

    const credential = await (AppleAuth as any).signInAsync({
      requestedScopes: [
        (AppleAuth as any).AppleAuthenticationScope?.EMAIL,
        (AppleAuth as any).AppleAuthenticationScope?.FULL_NAME,
      ],
    });
    if (!credential?.user) return null;

    const user: AuthUser = {
      id: `apple_${credential.user as string}`,
      provider: "apple",
      email: (credential.email as string | null) ?? undefined,
      displayName: (credential.fullName?.givenName as string | null) ?? undefined,
      signedInAt: Date.now(),
    };
    await saveAuthUser(user);
    return user;
  } catch { return null; }
}
