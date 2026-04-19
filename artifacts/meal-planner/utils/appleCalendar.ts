import { Platform } from "react-native";
import { SortiiCalEvent, AppleCalendarMeta } from "./calendarTypes";

export async function requestCalendarPermission(): Promise<"granted" | "denied" | "unavailable"> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const Calendar = await import("expo-calendar");
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function getAppleCalendars(): Promise<AppleCalendarMeta[]> {
  if (Platform.OS === "web") return [];
  try {
    const Calendar = await import("expo-calendar");
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.map((c) => ({
      id: c.id,
      title: c.title ?? "Calendar",
      color: (c as any).color ?? null,
      enabled: true,
    }));
  } catch {
    return [];
  }
}

export async function getAppleEventsForRange(
  startDate: Date,
  endDate: Date,
  calendarIds: string[]
): Promise<SortiiCalEvent[]> {
  if (Platform.OS === "web") return [];
  if (!calendarIds.length) return [];
  try {
    const Calendar = await import("expo-calendar");
    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    return events.map((e) => ({
      id: `apple_${e.id}`,
      source: "apple" as const,
      title: e.title ?? "Untitled event",
      startTime: typeof e.startDate === "string" ? e.startDate : (e.startDate as Date).toISOString(),
      endTime: e.endDate
        ? (typeof e.endDate === "string" ? e.endDate : (e.endDate as Date).toISOString())
        : null,
      location: (e as any).location ?? null,
      notes: (e as any).notes ?? null,
      calendarName: (e as any).calendar?.title ?? null,
      calendarColor: (e as any).calendar?.color ?? null,
      isAllDay: (e as any).allDay ?? false,
      pushToFamily: false,
      addedToFamilyJuggle: false,
    }));
  } catch {
    return [];
  }
}

export async function getUpcomingAppleEvents(calendarIds: string[]): Promise<SortiiCalEvent[]> {
  const now = new Date();
  const twoWeeksOut = new Date();
  twoWeeksOut.setDate(now.getDate() + 14);
  return getAppleEventsForRange(now, twoWeeksOut, calendarIds);
}
