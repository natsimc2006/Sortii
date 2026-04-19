import AsyncStorage from "@react-native-async-storage/async-storage";
import { SortiiCalEvent, GoogleCalendarMeta, GOOGLE_TOKEN_KEY } from "./calendarTypes";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== "";
}

export async function signInWithGoogle(): Promise<string | null> {
  if (!isGoogleConfigured()) return null;
  try {
    const AuthSession = await import("expo-auth-session");
    const WebBrowser  = await import("expo-web-browser");
    (WebBrowser as any).maybeCompleteAuthSession?.();

    const discovery = {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
    };

    const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    });

    const result = await request.promptAsync(discovery as any);
    if (result.type === "success") {
      const token = (result.params as any).access_token as string;
      await AsyncStorage.setItem(GOOGLE_TOKEN_KEY, token);
      try {
        const infoRes = await fetch(
          `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`
        );
        if (infoRes.ok) {
          const info = await infoRes.json() as { email?: string };
          if (info.email) {
            await AsyncStorage.setItem("sortii_google_user_email", info.email);
          }
        }
      } catch {}
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getValidGoogleToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(GOOGLE_TOKEN_KEY);
  if (!token) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
    );
    if (res.ok) return token;
    await AsyncStorage.removeItem(GOOGLE_TOKEN_KEY);
    return null;
  } catch {
    return token;
  }
}

export async function getGoogleCalendars(token: string): Promise<GoogleCalendarMeta[]> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Google Calendar auth failed");
  const data = await response.json() as { items?: any[] };
  return (data.items ?? []).map((c) => ({
    id: c.id as string,
    summary: (c.summary as string) ?? "Calendar",
    backgroundColor: (c.backgroundColor as string | null) ?? null,
    enabled: true,
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
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) continue;
      const data = await res.json() as { items?: any[] };
      const events = (data.items ?? []).map((e) => ({
        id: `google_${e.id as string}`,
        source: "google" as const,
        title: (e.summary as string) ?? "Untitled",
        startTime: (e.start?.dateTime ?? e.start?.date ?? "") as string,
        endTime: (e.end?.dateTime ?? e.end?.date ?? null) as string | null,
        location: (e.location as string | null) ?? null,
        notes: (e.description as string | null) ?? null,
        calendarName: calId,
        calendarColor: null,
        isAllDay: !!e.start?.date && !e.start?.dateTime,
        pushToFamily: false,
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
  const now = new Date();
  const twoWeeksOut = new Date();
  twoWeeksOut.setDate(now.getDate() + 14);
  return getGoogleEventsForRange(token, now, twoWeeksOut, calendarIds);
}
