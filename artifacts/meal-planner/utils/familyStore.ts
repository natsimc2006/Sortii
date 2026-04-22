import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyState } from "./familyTypes";
import { SK } from "./storageKeys";
import { getCurrentUserId } from "./currentUser";

export const FAMILY_KEY = "@sortii_family_v2"; // legacy

function key(): string { return SK.family(getCurrentUserId()); }

const DEFAULT: FamilyState = { members: [], events: [] };

export async function loadFamilyState(): Promise<FamilyState> {
  try {
    const raw = await AsyncStorage.getItem(key());
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return { members: parsed.members ?? [], events: parsed.events ?? [] };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveFamilyState(state: FamilyState): Promise<void> {
  await AsyncStorage.setItem(key(), JSON.stringify(state));
}
