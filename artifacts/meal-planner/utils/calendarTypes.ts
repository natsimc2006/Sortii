export interface SortiiCalEvent {
  id: string;
  source: "apple" | "google" | "manual";
  title: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  calendarName: string | null;
  calendarColor: string | null;
  isAllDay: boolean;
  pushToFamily: boolean;
  addedToFamilyJuggle: boolean;
}

export interface AppleCalendarMeta {
  id: string;
  title: string;
  color: string | null;
  enabled: boolean;
}

export interface GoogleCalendarMeta {
  id: string;
  summary: string;
  backgroundColor: string | null;
  enabled: boolean;
}

export interface CalendarSettings {
  appleConnected: boolean;
  appleCalendarIds: string[];
  googleConnected: boolean;
  googleToken: string | null;
  googleCalendarIds: string[];
}

// Legacy constants — kept for callers not yet migrated
export const APPLE_CONNECTED_KEY      = "sortii_apple_connected";
export const APPLE_CALENDAR_IDS_KEY   = "sortii_apple_calendar_ids";
export const GOOGLE_CONNECTED_KEY     = "sortii_google_connected";
export const GOOGLE_TOKEN_KEY         = "sortii_google_token";
export const GOOGLE_CALENDAR_IDS_KEY  = "sortii_google_calendar_ids";
export const GOOGLE_EMAIL_KEY         = "sortii_google_user_email";
export const CACHED_EVENTS_KEY        = "sortii_cached_events";
export const FAMILY_PUSHED_KEY        = "sortii_family_pushed_events";
export const MANUAL_EVENTS_KEY        = "sortii_manual_events";

// ── User-scoped key getters — use these for all new code ────────────────────
import { SK } from "./storageKeys";
import { getCurrentUserId } from "./currentUser";

export const calKeys = {
  appleConn:    () => SK.calAppleConn(getCurrentUserId()),
  appleIds:     () => SK.calAppleIds(getCurrentUserId()),
  googleConn:   () => SK.calGoogleConn(getCurrentUserId()),
  googleToken:  () => SK.calGoogleToken(getCurrentUserId()),
  googleIds:    () => SK.calGoogleIds(getCurrentUserId()),
  googleEmail:  () => SK.calGoogleEmail(getCurrentUserId()),
  googleRefresh:() => SK.calGoogleRefreshToken(getCurrentUserId()),
  cachedEvents: () => SK.calEvents(getCurrentUserId()),
  pushedEvents: () => SK.calPushed(getCurrentUserId()),
};

export const NOISY_CALENDAR_KEYWORDS = [
  "fixture", "nrl", "afl", "sport", "fixture", "cricket",
  "rugby", "footy", "soccer", "nba", "nfl", "schedule",
];

export function isNoisyCalendar(name: string): boolean {
  const lower = name.toLowerCase();
  return NOISY_CALENDAR_KEYWORDS.some((k) => lower.includes(k));
}
