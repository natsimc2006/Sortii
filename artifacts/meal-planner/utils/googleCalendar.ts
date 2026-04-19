import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { SortiiCalEvent, GoogleCalendarMeta, GOOGLE_TOKEN_KEY } from "./calendarTypes";

const GOOGLE_REFRESH_KEY = "sortii_google_refresh_token";

// EXPO_PUBLIC_GOOGLE_CLIENT_ID is forwarded from the GOOGLE_CLIENT_ID secret
// via the dev script and inlined by Metro at bundle time.
// Falls back to Constants.expoConfig.extra for EAS / production builds.
function resolveGoogleClientId(): string {
  if (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  }
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.googleClientId;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra;
  return "";
}

const GOOGLE_CLIENT_ID = resolveGoogleClientId();

export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

// The API server base — web uses root-relative, native uses localhost
function apiBase(): string {
  return Platform.OS === "web" ? "" : "http://localhost:8080";
}

// Exchange authorization code for tokens via our API server (keeps secret server-side)
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ access_token?: string; refresh_token?: string } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/google/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier, redirectUri }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { access_token?: string; refresh_token?: string };
  } catch {
    return null;
  }
}

// Try to refresh an expired access token
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/google/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    if (data.access_token) {
      await AsyncStorage.setItem(GOOGLE_TOKEN_KEY, data.access_token);
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<string | null> {
  if (!isGoogleConfigured()) return null;
  try {
    const AuthSession = await import("expo-auth-session");
    const WebBrowser  = await import("expo-web-browser");
    (WebBrowser as any).maybeCompleteAuthSession?.();

    const discovery = {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint:         "https://oauth2.googleapis.com/token",
    };

    const redirectUri = AuthSession.makeRedirectUri({
      useProxy: true,
      projectNameForProxy: "@natsimc/sortiidinnersorted",
    });

    // Log the exact URI so it can be confirmed in Google Cloud Console
    console.log("[Sortii] Google OAuth redirect URI:", redirectUri);

    const request = new AuthSession.AuthRequest({
      clientId:            GOOGLE_CLIENT_ID,
      scopes:              [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      redirectUri,
      responseType:        AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      usePKCE:             true,
      extraParams:         { access_type: "offline", prompt: "consent" },
    });

    const result = await request.promptAsync(discovery as any);

    if (result.type === "success") {
      const code         = (result.params as any).code as string;
      const codeVerifier = (request as any).codeVerifier as string;

      const tokens = await exchangeCodeForToken(code, codeVerifier, redirectUri);
      if (!tokens?.access_token) return null;

      await AsyncStorage.setItem(GOOGLE_TOKEN_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        await AsyncStorage.setItem(GOOGLE_REFRESH_KEY, tokens.refresh_token);
      }

      // Fetch user email
      try {
        const infoRes = await fetch(
          `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokens.access_token}`
        );
        if (infoRes.ok) {
          const info = (await infoRes.json()) as { email?: string };
          if (info.email) {
            await AsyncStorage.setItem("sortii_google_user_email", info.email);
          }
        }
      } catch {}

      return tokens.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

// Returns a valid access token, refreshing if needed
export async function getValidGoogleToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(GOOGLE_TOKEN_KEY);
  if (!token) return null;

  // Check if token is still valid
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
    );
    if (res.ok) return token;
  } catch {}

  // Try to refresh
  const refreshToken = await AsyncStorage.getItem(GOOGLE_REFRESH_KEY);
  if (refreshToken) {
    const fresh = await refreshAccessToken(refreshToken);
    if (fresh) return fresh;
  }

  // Token dead and no refresh — clear both
  await AsyncStorage.multiRemove([GOOGLE_TOKEN_KEY, GOOGLE_REFRESH_KEY]);
  return null;
}

export async function getGoogleCalendars(token: string): Promise<GoogleCalendarMeta[]> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Google Calendar auth failed");
  const data = (await response.json()) as { items?: any[] };
  return (data.items ?? []).map((c) => ({
    id:              c.id as string,
    summary:         (c.summary as string) ?? "Calendar",
    backgroundColor: (c.backgroundColor as string | null) ?? null,
    enabled:         true,
  }));
}

export async function getGoogleEventsForRange(
  token: string,
  startDate: Date,
  endDate: Date,
  calendarIds: string[]
): Promise<SortiiCalEvent[]> {
  const allEvents: SortiiCalEvent[] = [];
  for (const calId of calendarIds) {
    const params = new URLSearchParams({
      timeMin:       startDate.toISOString(),
      timeMax:       endDate.toISOString(),
      singleEvents:  "true",
      orderBy:       "startTime",
      maxResults:    "50",
    });
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: any[] };
      const events = (data.items ?? []).map((e) => ({
        id:                  `google_${e.id as string}`,
        source:              "google" as const,
        title:               (e.summary as string) ?? "Untitled",
        startTime:           (e.start?.dateTime ?? e.start?.date ?? "") as string,
        endTime:             (e.end?.dateTime ?? e.end?.date ?? null) as string | null,
        location:            (e.location as string | null) ?? null,
        notes:               (e.description as string | null) ?? null,
        calendarName:        calId,
        calendarColor:       null,
        isAllDay:            !!e.start?.date && !e.start?.dateTime,
        pushToFamily:        false,
        addedToFamilyJuggle: false,
      }));
      allEvents.push(...events);
    } catch {}
  }
  return allEvents.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

export async function getUpcomingGoogleEvents(
  token: string,
  calendarIds: string[]
): Promise<SortiiCalEvent[]> {
  const now          = new Date();
  const twoWeeksOut  = new Date();
  twoWeeksOut.setDate(now.getDate() + 14);
  return getGoogleEventsForRange(token, now, twoWeeksOut, calendarIds);
}
