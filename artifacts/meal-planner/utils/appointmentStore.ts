import AsyncStorage from "@react-native-async-storage/async-storage";
import { SK } from "./storageKeys";
import { getCurrentUserId } from "./currentUser";

export const APPOINTMENTS_KEY = "@sortii_appointments_v1"; // legacy

function key(): string { return SK.appts(getCurrentUserId()); }

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface AvailabilityBlock {
  personIds: string[];
  scope: "appointment" | "allday" | "custom";
  startTime?: string;  // HH:MM — only set when scope === "custom"
  endTime?: string;    // HH:MM — only set when scope === "custom"
}

export interface Appointment {
  id: string;
  title: string;
  category: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime?: string;   // HH:MM (optional)
  person: string;
  locationName?: string;
  suburb?: string;
  notes?: string;
  checklist: ChecklistItem[];
  reminderEnabled: boolean;
  recurringEnabled: boolean;
  isDone: boolean;
  isCancelled: boolean;
  // Phase 2 additions
  appointmentCost?: number | null;
  availabilityBlock?: AvailabilityBlock | null;
  createdAt: number;
  updatedAt: number;
}

export async function loadAppointments(): Promise<Appointment[]> {
  try {
    const raw = await AsyncStorage.getItem(key());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveAppointments(items: Appointment[]): Promise<void> {
  await AsyncStorage.setItem(key(), JSON.stringify(items));
}

export function getAppointmentDayStr(appt: Appointment): string {
  return appt.date;
}

export async function getAppointmentsWithCostThisWeek(): Promise<Appointment[]> {
  try {
    const items = await loadAppointments();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return items.filter((a) => {
      if (a.isDone || a.isCancelled) return false;
      if (!a.appointmentCost || a.appointmentCost <= 0) return false;
      const [y, m, d] = a.date.split("-").map(Number);
      const due = new Date(y!, (m! - 1), d!);
      const diff = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
      return diff >= 0 && diff <= 7;
    }).sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}
