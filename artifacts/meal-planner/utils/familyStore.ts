import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyMember, FamilyEvent, FamilyState } from "./familyTypes";
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

/**
 * If any personId on an event belongs to an adult, this is a personal
 * appointment for that adult — force assignedAdult to their name so
 * Claude receives the correct assignment and never re-routes it.
 */
function sanitiseEventAssignments(state: FamilyState): FamilyState {
  const memberMap = new Map<string, FamilyMember>(
    state.members.map((m) => [m.id, m])
  );
  const events: FamilyEvent[] = state.events.map((ev) => {
    const adultPerson = ev.personIds
      .map((id) => memberMap.get(id))
      .find((m) => m?.role === "adult");
    if (adultPerson) {
      return { ...ev, assignedAdult: adultPerson.name };
    }
    return ev;
  });
  return { ...state, events };
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
  const sanitised = sanitiseEventAssignments(state);
  const clean: FamilyState = { ...sanitised, members: dedupMembers(sanitised.members) };
  await AsyncStorage.setItem(key(), JSON.stringify(clean));
}
