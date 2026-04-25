import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyMember, FamilyState } from "./familyTypes";
import { SK } from "./storageKeys";
import { getCurrentUserId } from "./currentUser";

export const FAMILY_KEY = "@sortii_family_v2"; // legacy

function key(): string { return SK.family(getCurrentUserId()); }

const DEFAULT: FamilyState = { members: [], events: [] };

function dedupMembers(members: FamilyMember[]): FamilyMember[] {
  return members.filter(
    (member, index, self) =>
      index === self.findIndex(
        (m) => m.name.toLowerCase().trim() === member.name.toLowerCase().trim()
      )
  );
}

export async function loadFamilyState(): Promise<FamilyState> {
  try {
    const raw = await AsyncStorage.getItem(key());
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      members: dedupMembers(parsed.members ?? []),
      events: parsed.events ?? [],
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveFamilyState(state: FamilyState): Promise<void> {
  const clean: FamilyState = { ...state, members: dedupMembers(state.members) };
  await AsyncStorage.setItem(key(), JSON.stringify(clean));
}
