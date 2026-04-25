import type { FamilyEvent, FamilyMember } from "./familyTypes";
import { formatTime } from "./familyEngine";

/**
 * Transforms family members and events into the formatted string prompt
 * that the juggle-solve API endpoint expects.
 */
export function buildJugglePrompt(
  members: FamilyMember[],
  events: FamilyEvent[]
): string {
  const adults   = members.filter((m) => m.role === "adult").map((m) => m.name);
  const children = members.filter((m) => m.role === "child").map((m) => m.name);

  const eventLines = events.map((ev) => {
    const personNames = ev.personIds
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    const driverName = ev.driverId
      ? (members.find((m) => m.id === ev.driverId)?.name ?? "unassigned")
      : "unassigned";

    const isAppointment = ev.isAppointment ?? false;

    const coverage = isAppointment
      ? `${driverName}'s own appointment — they must attend`
      : `${driverName} is primary driver — needs to be there for drop-off/pick-up`;

    const startDisplay = formatTime(ev.time) || ev.time;
    const endDisplay   = ev.endTime ? `–${formatTime(ev.endTime) || ev.endTime}` : "";

    // Prefer per-event carpoolContacts array, fall back to legacy string field
    let carpoolLine: string;
    if (ev.carpoolContacts && ev.carpoolContacts.length > 0) {
      carpoolLine = `Carpool contacts: ${ev.carpoolContacts.map((c) => c.mobile ? `${c.name} (${c.mobile})` : c.name).join(", ")}`;
    } else if (ev.carpoolContact) {
      carpoolLine = `Carpool contacts: ${ev.carpoolContact}`;
    } else {
      carpoolLine = "No carpool contacts listed";
    }

    return [
      `Event: ${ev.title}`,
      `Child/person: ${personNames || driverName}`,
      `Day: ${ev.day}`,
      `Time: ${startDisplay}${endDisplay}`,
      `Location: ${ev.location || "not specified"}`,
      `Type: ${ev.repeat !== "none" ? "Recurring weekly" : "One-off"}`,
      `Priority: ${isAppointment ? "must — medical appointment, do not reschedule" : "must"}`,
      `Coverage needed: ${coverage}`,
      carpoolLine,
    ].join("\n");
  }).join("\n\n");

  return `
Family: ${adults.join(", ")} (adults), ${children.join(", ")} (children)
Location context: Lake Macquarie / Hunter region, NSW Australia

Events requiring coverage this week:

${eventLines}

Instructions:
- Assign one adult per child event (drop-off and pick-up)
- Medical appointments are fixed — never suggest rescheduling them
- Where one adult has two overlapping commitments, check if another adult can cover via handoff
- Factor in drive time between locations. Morisset to Wangi Wangi is ~12 min. Wangi Wangi to Rathmines is ~10 min. Morisset to Rathmines is ~15 min.
- If a handoff is possible (adult finishes nearby in time to cover), name it explicitly: who, what time, where
- Prefer handoff solutions over rescheduling suggestions
- If carpool contacts are listed for a child, surface them by name in conflict suggestions for that child only
`.trim();
}
