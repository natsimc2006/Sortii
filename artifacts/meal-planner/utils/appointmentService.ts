import AsyncStorage from "@react-native-async-storage/async-storage";
import { SortiiCalEvent, CalendarSettings, calKeys } from "./calendarTypes";
import { getUpcomingAppleEvents } from "./appleCalendar";
import { getValidGoogleToken, getUpcomingGoogleEvents } from "./googleCalendar";

export async function loadCalendarSettings(): Promise<CalendarSettings> {
  const [appleConn, appleIds, googleConn, googleToken, googleIds] = await Promise.all([
    AsyncStorage.getItem(calKeys.appleConn()),
    AsyncStorage.getItem(calKeys.appleIds()),
    AsyncStorage.getItem(calKeys.googleConn()),
    AsyncStorage.getItem(calKeys.googleToken()),
    AsyncStorage.getItem(calKeys.googleIds()),
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
  await AsyncStorage.setItem(calKeys.cachedEvents(), JSON.stringify(events));
}

export async function loadCachedCalendarEvents(): Promise<SortiiCalEvent[]> {
  const raw = await AsyncStorage.getItem(calKeys.cachedEvents());
  if (!raw) return [];
  try { return JSON.parse(raw) as SortiiCalEvent[]; } catch { return []; }
}

export async function loadFamilyPushedEvents(): Promise<SortiiCalEvent[]> {
  const raw = await AsyncStorage.getItem(calKeys.pushedEvents());
  if (!raw) return [];
  try { return JSON.parse(raw) as SortiiCalEvent[]; } catch { return []; }
}

export async function saveFamilyPushedEvents(events: SortiiCalEvent[]): Promise<void> {
  await AsyncStorage.setItem(calKeys.pushedEvents(), JSON.stringify(events));
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
