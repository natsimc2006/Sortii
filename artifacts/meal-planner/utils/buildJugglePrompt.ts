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
  const adults   = members.filter((m) => m.role === "adult");
  const children = members.filter((m) => m.role === "child");

  const lines: string[] = [];

  // ── Adults section ──────────────────────────────────────────────────────────
  lines.push("Available adults:");
  if (adults.length === 0) {
    lines.push("(none)");
  } else {
    for (const a of adults) {
      lines.push(`${a.name}, can drive: yes`);
    }
  }

  lines.push("");

  // ── Children section ─────────────────────────────────────────────────────
  if (children.length > 0) {
    lines.push("Children in household:");
    for (const c of children) {
      lines.push(`${c.name}`);
    }
    lines.push("");
  }

  // ── Events section ───────────────────────────────────────────────────────
  lines.push("Events this week:");
  if (events.length === 0) {
    lines.push("(none)");
  } else {
    for (const ev of events) {
      const childNames = ev.personIds
        .map((id) => members.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const driverName = ev.driverId
        ? (members.find((m) => m.id === ev.driverId)?.name ?? "unassigned")
        : "unassigned";
      const endDisplay = ev.endTime ? formatTime(ev.endTime) : "not specified";
      const repeat = ev.repeat !== "none" ? ev.repeat : "one-off";

      lines.push(`Activity: ${ev.title}`);
      lines.push(`Day: ${ev.day}`);
      lines.push(`Start: ${formatTime(ev.time) || "not specified"}`);
      lines.push(`End: ${endDisplay}`);
      lines.push(`Who's going: ${childNames || "not specified"}`);
      lines.push(`Assigned adult/driver: ${driverName}`);
      if (ev.location) lines.push(`Location: ${ev.location}`);
      if (ev.carpoolContact) lines.push(`Carpool contact: ${ev.carpoolContact}`);
      if (ev.notes) lines.push(`Notes: ${ev.notes}`);
      lines.push(`Frequency: ${repeat}`);
      lines.push("---");
    }
  }

  // ── Carpool contacts section (deduplicated from event fields) ─────────────
  const carpoolContacts = events
    .filter((e) => e.carpoolContact && e.carpoolContact.trim().length > 0)
    .map((e) => e.carpoolContact!.trim());
  const uniqueContacts = [...new Set(carpoolContacts)];
  if (uniqueContacts.length > 0) {
    lines.push("");
    lines.push("Carpool contacts available:");
    for (const c of uniqueContacts) {
      lines.push(c);
    }
  }

  lines.push("");
  lines.push(
    "Please work out the most practical plan for this week. Flag any timing issues, conflicts, or things worth knowing."
  );

  return lines.join("\n");
}
