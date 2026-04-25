import type { FamilyEvent, FamilyMember, CarpoolContactEntry } from "./familyTypes";

const PERSONAL_APPT_RE = /doctor|gp|dentist|hospital|physio|appointment|clinic/i;

/**
 * Builds the user message sent to Claude's juggle-solve endpoint.
 * Maps from FamilyMember[] + FamilyEvent[] to the structured text format
 * the API system prompt expects.
 */
export function buildJugglePrompt(
  members: FamilyMember[],
  events: FamilyEvent[],
  globalContacts: CarpoolContactEntry[] = [],
  freeText: string = "",
): string {
  const adultNames = members
    .filter((m) => m.role === "adult" && m.name.trim())
    .map((m) => m.name.toLowerCase());

  const adultsStr = members
    .filter((m) => m.role === "adult" && m.name.trim())
    .map((m) => `- ${m.name} (can drive)`)
    .join("\n");

  const eventsStr = events
    .filter((e) => e.title.trim() && e.time.trim())
    .map((e, i) => {
      const childMembers = e.personIds
        .map((id) => members.find((m) => m.id === id))
        .filter((m) => m?.role === "child");
      const child =
        childMembers.map((m) => m!.name).join(", ") || e.title;

      // Detect personal appointment (an adult attending their own appointment)
      const isPersonalAppointment =
        adultNames.some((n) => child.toLowerCase() === n) &&
        PERSONAL_APPT_RE.test(e.title);

      // For personal appointments the adult IS the attendee — self-assign
      const assignedAdult = isPersonalAppointment
        ? child
        : e.assignedAdult ||
          (e.driverId
            ? (members.find((m) => m.id === e.driverId)?.name ?? "unassigned")
            : "unassigned");

      const priority = e.priority ?? (e.isAppointment ? "must" : "must");
      const isRecurring = e.isRecurring ?? e.repeat !== "none";

      return [
        `Event ${i + 1} (ID: ${e.id}):`,
        `  Child/person: ${child}${isPersonalAppointment ? " (this is their own appointment — they must attend in person)" : ""}`,
        `  Activity: ${e.title}`,
        `  Location: ${e.location || "unspecified"}`,
        `  Day: ${e.day}`,
        `  Start: ${e.time || "unspecified"}`,
        `  End: ${e.endTime || "unspecified"}`,
        `  Assigned adult: ${assignedAdult}`,
        `  Priority: ${priority}`,
        `  Recurring: ${isRecurring ? "yes — weekly commitment" : "no — one-off"}`,
        `  Notes: ${e.notes || "none"}`,
      ].join("\n");
    })
    .join("\n\n");

  const allContacts: CarpoolContactEntry[] = [...globalContacts];
  events.forEach((e) => {
    if (e.carpoolContacts && e.carpoolContacts.length > 0) {
      e.carpoolContacts.forEach((c) => {
        const defaultChild =
          e.personIds
            .map((id) => members.find((m) => m.id === id))
            .find((m) => m?.role === "child")?.name ?? e.title;
        allContacts.push({
          ...c,
          canHelpWith:
            c.canHelpWith && c.canHelpWith.length > 0
              ? c.canHelpWith
              : [defaultChild],
        });
      });
    } else if (e.carpoolContact) {
      allContacts.push({
        name: e.carpoolContact,
        relationship: "contact",
        canHelpWith: [],
        phone: "",
        notes: "",
      });
    }
  });

  const contactsStr =
    allContacts.length > 0
      ? `\n\nCarpool contacts available:\n${allContacts
          .map(
            (c) =>
              `- Name: ${c.name}\n  Relationship: ${c.relationship || "contact"}\n  Can help with: ${(c.canHelpWith || []).join(", ") || "any child"}\n  Phone: ${c.phone || c.mobile || "not provided"}\n  Notes: ${c.notes || "none"}`,
          )
          .join("\n")}`
      : "";

  const freeTextStr =
    freeText && freeText.trim()
      ? `\n\nAdditional context (read carefully — this may affect assignments and timing):\n${freeText}`
      : "";

  return `Available adults:\n${adultsStr}\n\nWeekend events:\n${eventsStr}${contactsStr}${freeTextStr}\n\nLocation context: Lake Macquarie / Hunter region, NSW Australia. Estimate suburban drive times accordingly.\n\nPlease solve this schedule.`;
}
