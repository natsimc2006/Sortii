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

export const APPLE_CONNECTED_KEY      = "sortii_apple_connected";
export const APPLE_CALENDAR_IDS_KEY   = "sortii_apple_calendar_ids";
export const GOOGLE_CONNECTED_KEY     = "sortii_google_connected";
export const GOOGLE_TOKEN_KEY         = "sortii_google_token";
export const GOOGLE_CALENDAR_IDS_KEY  = "sortii_google_calendar_ids";
export const GOOGLE_EMAIL_KEY         = "sortii_google_user_email";
export const CACHED_EVENTS_KEY        = "sortii_cached_events";
export const FAMILY_PUSHED_KEY        = "sortii_family_pushed_events";
export const MANUAL_EVENTS_KEY        = "sortii_manual_events";

export const NOISY_CALENDAR_KEYWORDS = [
  "fixture", "nrl", "afl", "sport", "fixture", "cricket",
  "rugby", "footy", "soccer", "nba", "nfl", "schedule",
];

export function isNoisyCalendar(name: string): boolean {
  const lower = name.toLowerCase();
  return NOISY_CALENDAR_KEYWORDS.some((k) => lower.includes(k));
}
