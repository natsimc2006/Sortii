import AsyncStorage from "@react-native-async-storage/async-storage";

export const APPOINTMENTS_KEY = "@sortii_appointments_v1";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
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
  createdAt: number;
  updatedAt: number;
}

export async function loadAppointments(): Promise<Appointment[]> {
  try {
    const raw = await AsyncStorage.getItem(APPOINTMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveAppointments(items: Appointment[]): Promise<void> {
  await AsyncStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(items));
}
