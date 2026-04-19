import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SortiiCalEvent,
  CalendarSettings,
  CACHED_EVENTS_KEY,
  APPLE_CONNECTED_KEY,
  APPLE_CALENDAR_IDS_KEY,
  GOOGLE_CONNECTED_KEY,
  GOOGLE_TOKEN_KEY,
  GOOGLE_CALENDAR_IDS_KEY,
  FAMILY_PUSHED_KEY,
} from "./calendarTypes";
import { getUpcomingAppleEvents } from "./appleCalendar";
import { getValidGoogleToken, getUpcomingGoogleEvents } from "./googleCalendar";

export async function loadCalendarSettings(): Promise<CalendarSettings> {
  const [appleConn, appleIds, googleConn, googleToken, googleIds] = await Promise.all([
    AsyncStorage.getItem(APPLE_CONNECTED_KEY),
    AsyncStorage.getItem(APPLE_CALENDAR_IDS_KEY),
    AsyncStorage.getItem(GOOGLE_CONNECTED_KEY),
    AsyncStorage.getItem(GOOGLE_TOKEN_KEY),
    AsyncStorage.getItem(GOOGLE_CALENDAR_IDS_KEY),
  ]);
  return {
    appleConnected: appleConn === "true",
    appleCalendarIds: appleIds ? (JSON.parse(appleIds) as string[]) : [],
    googleConnected: googleConn === "true",
    googleToken,
    googleCalendarIds: googleIds ? (JSON.parse(googleIds) as string[]) : [],
  };
}

export async function getAllCalendarEvents(
  settings: CalendarSettings
): Promise<SortiiCalEvent[]> {
  const allEvents: SortiiCalEvent[] = [];

  if (settings.appleConnected && settings.appleCalendarIds.length > 0) {
    try {
      const events = await getUpcomingAppleEvents(settings.appleCalendarIds);
      allEvents.push(...events);
    } catch {}
  }

  if (settings.googleConnected) {
    try {
      const token = await getValidGoogleToken();
      if (token && settings.googleCalendarIds.length > 0) {
        const events = await getUpcomingGoogleEvents(token, settings.googleCalendarIds);
        allEvents.push(...events);
      }
    } catch {}
  }

  const seen = new Set<string>();
  const deduped = allEvents.filter((e) => {
    const key = `${e.title}_${e.startTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

export async function cacheCalendarEvents(events: SortiiCalEvent[]): Promise<void> {
  await AsyncStorage.setItem(CACHED_EVENTS_KEY, JSON.stringify(events));
}

export async function loadCachedCalendarEvents(): Promise<SortiiCalEvent[]> {
  const raw = await AsyncStorage.getItem(CACHED_EVENTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as SortiiCalEvent[]; } catch { return []; }
}

export async function loadFamilyPushedEvents(): Promise<SortiiCalEvent[]> {
  const raw = await AsyncStorage.getItem(FAMILY_PUSHED_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as SortiiCalEvent[]; } catch { return []; }
}

export async function saveFamilyPushedEvents(events: SortiiCalEvent[]): Promise<void> {
  await AsyncStorage.setItem(FAMILY_PUSHED_KEY, JSON.stringify(events));
}

export async function pushEventToFamily(event: SortiiCalEvent): Promise<void> {
  const current = await loadFamilyPushedEvents();
  const exists = current.some((e) => e.id === event.id);
  if (!exists) {
    await saveFamilyPushedEvents([...current, { ...event, pushToFamily: true }]);
  }
}

export async function removeEventFromFamily(eventId: string): Promise<void> {
  const current = await loadFamilyPushedEvents();
  await saveFamilyPushedEvents(current.filter((e) => e.id !== eventId));
}
