import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyState } from "./familyTypes";

export const FAMILY_KEY = "@sortii_family_v2";

const DEFAULT: FamilyState = { members: [], events: [] };

export async function loadFamilyState(): Promise<FamilyState> {
  try {
    const raw = await AsyncStorage.getItem(FAMILY_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return { members: parsed.members ?? [], events: parsed.events ?? [] };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveFamilyState(state: FamilyState): Promise<void> {
  await AsyncStorage.setItem(FAMILY_KEY, JSON.stringify(state));
}
